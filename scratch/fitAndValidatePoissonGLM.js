import { base44 } from "../src/api/base44Client.js";
import { isMercadoEmEstudo, classificarMercado } from "../src/lib/calibrationLayer.js";

function g(stats, key, campo = "t") {
  return stats?.[key]?.[campo] || 0.0;
}

// ── Solução de Equações Lineares (A * x = b) via Eliminação Gaussiana com Pivoteamento Parcial ──
function solveLinearSystem(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[i][i]) < 1e-12) continue; // Singulação tratada por ridge

    for (let k = i + 1; k < n; k++) {
      const c = -M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        if (i === j) M[k][j] = 0;
        else M[k][j] += c * M[i][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(M[i][i]) < 1e-12) {
      x[i] = 0;
      continue;
    }
    x[i] = M[i][n] / M[i][i];
    for (let k = i - 1; k >= 0; k--) {
      M[k][n] -= M[k][i] * x[i];
    }
  }
  return x;
}

// ── Poisson GLM via IRLS (Iteratively Reweighted Least Squares) + L2 Ridge Regularization ──
export function fitPoissonGLM(X, y, ridgeLambda = 0.1, maxIter = 40, tol = 1e-6) {
  const n = X.length;
  const p = X[0].length;
  let beta = new Array(p).fill(0);
  // Inicialização razoável do intercepto beta_0 = log(mean(y))
  const meanY = Math.max(0.1, y.reduce((s, v) => s + v, 0) / n);
  beta[0] = Math.log(meanY);

  for (let iter = 0; iter < maxIter; iter++) {
    const eta = X.map(row => row.reduce((s, x, i) => s + x * beta[i], 0));
    const mu = eta.map(e => Math.max(1e-5, Math.exp(Math.min(10, Math.max(-10, e)))));

    // W = diag(mu)
    // z_i = eta_i + (y_i - mu_i) / mu_i
    const z = eta.map((e, i) => e + (y[i] - mu[i]) / mu[i]);

    // Montar X^T W X + lambda I*
    const XtWX = Array.from({ length: p }, () => new Array(p).fill(0));
    const XtWz = new Array(p).fill(0);

    for (let i = 0; i < n; i++) {
      const w = mu[i];
      for (let j = 0; j < p; j++) {
        XtWz[j] += X[i][j] * w * z[i];
        for (let k = 0; k < p; k++) {
          XtWX[j][k] += X[i][j] * w * X[i][k];
        }
      }
    }

    // Adicionar penalização Ridge (sem penalizar intercepto beta_0)
    for (let j = 1; j < p; j++) {
      XtWX[j][j] += ridgeLambda;
    }

    const betaNew = solveLinearSystem(XtWX, XtWz);

    // Teste de convergência
    const diff = betaNew.reduce((s, v, idx) => s + Math.abs(v - beta[idx]), 0);
    beta = betaNew;
    if (diff < tol) break;
  }

  return beta;
}

// Predict function para Poisson GLM
export function predictPoissonGLM(rowFeatures, beta) {
  const eta = rowFeatures.reduce((s, x, i) => s + x * (beta[i] || 0), 0);
  return Math.exp(Math.min(10, Math.max(-10, eta)));
}

// ── Funções de Apoio para Métricas ──
function wilsonScoreInterval(k, n) {
  if (n === 0) return "[0.0%, 0.0%]";
  const z = 1.959964;
  const p = k / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
  return `[${Math.max(0, (centre - margin) * 100).toFixed(1)}%, ${Math.min(100, (centre + margin) * 100).toFixed(1)}%]`;
}

function normalCDF(z) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function testeBinomial(k, n, pNull = 0.5) {
  if (n === 0) return { pValor: "1.0000" };
  const pHat = k / n;
  const se = Math.sqrt(pNull * (1 - pNull) / n);
  const z = (pHat - pNull) / (se || 1);
  const pValor = 1 - normalCDF(z);
  return { pValor: pValor.toFixed(4) };
}

// ── Execução Completa dos Experimentos ──
async function runGLMExperiments() {
  const matches = await base44.entities.Match.list("-created_date", 500);
  const completed = matches.filter(m => m.status === "completed" || m.real_results);
  const sorted = [...completed].sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));

  const trainSize = Math.floor(sorted.length * 0.80);
  const trainSet = sorted.slice(0, trainSize);
  const testSet = sorted.slice(trainSize);

  console.log("==========================================================================");
  console.log(`AVALIAÇÃO OUT-OF-SAMPLE: REGRESSÃO DE POISSON (GLM IRLS) VS MODELO HEURÍSTICO`);
  console.log(`Base Total: ${sorted.length} jogos | Treino: ${trainSet.length} | Teste: ${testSet.length}`);
  console.log("==========================================================================\n");

  // Preparar matrizes X e y para o Modelo Poisson GLM (PARTE 2B)
  // Features: [1 (bias), xg, big_chance_scored, shots_on_target, xg_cedido_adv, shots_on_target_cedido_adv]
  function extractFeatures(atkStats, defStats) {
    return [
      1.0, // Intercepto
      g(atkStats, "goals"),
      g(atkStats, "xg"),
      g(atkStats, "shots_on_target"),
      g(defStats, "goals", "c"),
      g(defStats, "shots_on_target", "c"),
    ];
  }

  const X_train = [];
  const y_train = [];

  for (const m of trainSet) {
    const hs = m.home_stats || {};
    const as = m.away_stats || {};
    const gHome = m.real_results?.goals_home ?? m.real_goals_home;
    const gAway = m.real_results?.goals_away ?? m.real_goals_away;

    if (gHome !== undefined && gHome !== null) {
      X_train.push(extractFeatures(hs, as));
      y_train.push(Number(gHome));
    }
    if (gAway !== undefined && gAway !== null) {
      X_train.push(extractFeatures(as, hs));
      y_train.push(Number(gAway));
    }
  }

  // Ajustar o Poisson GLM SÓ nos dados de TREINO (Zero Data Leakage)
  const ridgeLambda = 0.5;
  const betaEstimado = fitPoissonGLM(X_train, y_train, ridgeLambda);

  console.log("--- PARÂMETROS BETAS AJUSTADOS VIA POISSON GLM (IRLS + RIDGE L2) ---");
  console.log(`β0 (Intercepto Log-Base):         ${betaEstimado[0].toFixed(4)} (exp = ${Math.exp(betaEstimado[0]).toFixed(2)} gols)`);
  console.log(`β1 (Média Gols Feitos):           ${betaEstimado[1].toFixed(4)}`);
  console.log(`β2 (xG Atacante):                 ${betaEstimado[2].toFixed(4)}`);
  console.log(`β3 (Chutes no Gol Atacante):      ${betaEstimado[3].toFixed(4)}`);
  console.log(`β4 (Média Gols Cedidos Adv):       ${betaEstimado[4].toFixed(4)}`);
  console.log(`β5 (Chutes no Gol Cedidos Adv):   ${betaEstimado[5].toFixed(4)}\n`);

  // Avaliação Out-of-Sample no Conjunto de TESTE (N = 41 Partidas)
  const evalHeuristico = [];
  const evalPoissonGLM = [];

  for (const m of testSet) {
    const hs = m.home_stats || {};
    const as = m.away_stats || {};

    const realGHome = m.real_results?.goals_home ?? m.real_goals_home;
    const realGAway = m.real_results?.goals_away ?? m.real_goals_away;
    if (realGHome === undefined || realGAway === undefined) continue;

    const realTotal = Number(realGHome) + Number(realGAway);

    // Modelo 1: Heurístico Atual (Âncora Mecanística)
    const prevHeuristica = m.results?.xg_total || 0;

    // Modelo 2: Poisson GLM (Predição em Escala Log-Linear de Poisson)
    const lambdaHome = predictPoissonGLM(extractFeatures(hs, as), betaEstimado);
    const lambdaAway = predictPoissonGLM(extractFeatures(as, hs), betaEstimado);
    const prevPoissonGLM = lambdaHome + lambdaAway;

    evalHeuristico.push({ prev: prevHeuristica, real: realTotal });
    evalPoissonGLM.push({ prev: prevPoissonGLM, real: realTotal });
  }

  function avaliarModelo(nome, dados) {
    const n = dados.length;
    const mediaPrev = dados.reduce((s, d) => s + d.prev, 0) / n;
    const mediaReal = dados.reduce((s, d) => s + d.real, 0) / n;
    const vies = mediaPrev - mediaReal;
    const mae = dados.reduce((s, d) => s + Math.abs(d.prev - d.real), 0) / n;

    const ssRes = dados.reduce((s, d) => s + (d.real - d.prev) ** 2, 0);
    const ssTot = dados.reduce((s, d) => s + (d.real - mediaReal) ** 2, 0);
    const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    let acertos = 0;
    for (const d of dados) {
      const linha = Math.floor(d.prev) + 0.5;
      if ((d.prev >= linha) === (d.real > linha)) acertos++;
    }

    const winRate = (acertos / n) * 100;
    const ic95 = wilsonScoreInterval(acertos, n);
    const binTest = testeBinomial(acertos, n);
    const status = classificarMercado(r2, binTest.pValor, 12, vies, mae);

    return {
      Modelo: nome,
      Amostra: n,
      "Média Prevista": mediaPrev.toFixed(2),
      "Média Real": mediaReal.toFixed(2),
      Viés: vies.toFixed(2),
      MAE: mae.toFixed(2),
      "R² Out-of-Sample": r2.toFixed(4),
      "Taxa Acerto": `${winRate.toFixed(1)}%`,
      "IC 95% Wilson": ic95,
      "p-valor Binomial": binTest.pValor,
      Status: status,
    };
  }

  console.log("--- RESULTADOS COMPARATIVOS OUT-OF-SAMPLE (N = 41 PARTIDAS DE TESTE) ---");
  const tabelaComparativa = [
    avaliarModelo("Modelo Heurístico Atual (Âncora)", evalHeuristico),
    avaliarModelo("Novo Modelo Poisson GLM (IRLS + Ridge)", evalPoissonGLM),
  ];

  console.table(tabelaComparativa);
}

runGLMExperiments().catch(console.error);
