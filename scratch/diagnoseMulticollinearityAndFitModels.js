import { base44 } from "../src/api/base44Client.js";
import { isMercadoEmEstudo, classificarMercado } from "../src/lib/calibrationLayer.js";
import { fitPoissonGLM, predictPoissonGLM } from "./fitAndValidatePoissonGLM.js";

function g(stats, key, campo = "t") {
  return stats?.[key]?.[campo] || 0.0;
}

// ── Coeficiente de Correlação de Pearson ──
function pearsonCorrelation(vec1, vec2) {
  const n = vec1.length;
  if (n === 0) return 0;
  const m1 = vec1.reduce((s, v) => s + v, 0) / n;
  const m2 = vec2.reduce((s, v) => s + v, 0) / n;

  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < n; i++) {
    const d1 = vec1[i] - m1;
    const d2 = vec2[i] - m2;
    num += d1 * d2;
    den1 += d1 * d1;
    den2 += d2 * d2;
  }
  const den = Math.sqrt(den1 * den2);
  return den !== 0 ? num / den : 0;
}

// ── Validação Cruzada 5-Fold para Seleção do Lambda Ridge ──
function kFoldCVPoissonGLM(X, y, k = 5, lambdaCandidates = [0.5, 1.0, 2.0, 5.0]) {
  const n = X.length;
  const foldSize = Math.floor(n / k);

  const candidateScores = {};

  for (const lambda of lambdaCandidates) {
    let totalMAE = 0;
    let totalLogLikelihood = 0;

    for (let fold = 0; fold < k; fold++) {
      const valStart = fold * foldSize;
      const valEnd = fold === k - 1 ? n : (fold + 1) * foldSize;

      const X_train_fold = [];
      const y_train_fold = [];
      const X_val_fold = [];
      const y_val_fold = [];

      for (let i = 0; i < n; i++) {
        if (i >= valStart && i < valEnd) {
          X_val_fold.push(X[i]);
          y_val_fold.push(y[i]);
        } else {
          X_train_fold.push(X[i]);
          y_train_fold.push(y[i]);
        }
      }

      const betaFold = fitPoissonGLM(X_train_fold, y_train_fold, lambda);

      for (let i = 0; i < X_val_fold.length; i++) {
        const predMu = predictPoissonGLM(X_val_fold[i], betaFold);
        const actual = y_val_fold[i];
        totalMAE += Math.abs(predMu - actual);
        totalLogLikelihood += (actual * Math.log(Math.max(1e-5, predMu)) - predMu);
      }
    }

    const avgMAE = totalMAE / n;
    const avgLL = totalLogLikelihood / n;
    candidateScores[lambda] = { avgMAE, avgLL };
  }

  // Selecionar o lambda com MENOR MAE médio na validação cruzada
  let bestLambda = lambdaCandidates[0];
  let minMAE = Infinity;
  for (const lambda of lambdaCandidates) {
    if (candidateScores[lambda].avgMAE < minMAE) {
      minMAE = candidateScores[lambda].avgMAE;
      bestLambda = lambda;
    }
  }

  return { bestLambda, candidateScores };
}

// ── Suporte a Métricas de Validação Out-of-Sample ──
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

async function runMulticollinearityAndPruningStudy() {
  const matches = await base44.entities.Match.list("-created_date", 500);
  const completed = matches.filter(m => m.status === "completed" || m.real_results);
  const sorted = [...completed].sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));

  const trainSize = Math.floor(sorted.length * 0.80);
  const trainSet = sorted.slice(0, trainSize);
  const testSet = sorted.slice(trainSize);

  console.log("==========================================================================");
  console.log(`ESTUDO DE MULTICOLINEARIDADE, PODAGEM DE RECURSOS E CV DE LAMBDA RIDGE`);
  console.log(`Base Total: ${sorted.length} jogos | Treino: ${trainSet.length} | Teste: ${testSet.length}`);
  console.log("==========================================================================\n");

  // PARTE 1 — Extração das 5 Variáveis de Gols no Treino
  const varNames5 = ["gols_feitos", "xg", "shots_on_target", "gols_cedidos_adv", "sot_cedidos_adv"];
  const matrix5Vars = {
    gols_feitos: [],
    xg: [],
    shots_on_target: [],
    gols_cedidos_adv: [],
    sot_cedidos_adv: [],
  };

  const X5_train = [];
  const y_train = [];

  for (const m of trainSet) {
    const hs = m.home_stats || {};
    const as = m.away_stats || {};
    const gHome = m.real_results?.goals_home ?? m.real_goals_home;
    const gAway = m.real_results?.goals_away ?? m.real_goals_away;

    if (gHome !== undefined && gHome !== null) {
      const gf = g(hs, "goals");
      const xg_val = g(hs, "xg");
      const sot = g(hs, "shots_on_target");
      const gc_adv = g(as, "goals", "c");
      const sot_adv = g(as, "shots_on_target", "c");

      matrix5Vars.gols_feitos.push(gf);
      matrix5Vars.xg.push(xg_val);
      matrix5Vars.shots_on_target.push(sot);
      matrix5Vars.gols_cedidos_adv.push(gc_adv);
      matrix5Vars.sot_cedidos_adv.push(sot_adv);

      X5_train.push([1.0, gf, xg_val, sot, gc_adv, sot_adv]);
      y_train.push(Number(gHome));
    }

    if (gAway !== undefined && gAway !== null) {
      const gf = g(as, "goals");
      const xg_val = g(as, "xg");
      const sot = g(as, "shots_on_target");
      const gc_adv = g(hs, "goals", "c");
      const sot_adv = g(hs, "shots_on_target", "c");

      matrix5Vars.gols_feitos.push(gf);
      matrix5Vars.xg.push(xg_val);
      matrix5Vars.shots_on_target.push(sot);
      matrix5Vars.gols_cedidos_adv.push(gc_adv);
      matrix5Vars.sot_cedidos_adv.push(sot_adv);

      X5_train.push([1.0, gf, xg_val, sot, gc_adv, sot_adv]);
      y_train.push(Number(gAway));
    }
  }

  // Matriz de Correlação 5x5
  const corrMatrix = {};
  for (const name1 of varNames5) {
    corrMatrix[name1] = {};
    for (const name2 of varNames5) {
      const r = pearsonCorrelation(matrix5Vars[name1], matrix5Vars[name2]);
      corrMatrix[name1][name2] = Number(r.toFixed(4));
    }
  }
  console.log("--- PARTE 1: MATRIZ DE CORRELAÇÃO DE PEARSON (TREINO N = 161 JOGOS x 2) ---");
  console.log(JSON.stringify(corrMatrix, null, 2));
  console.log("");

  // PARTE 2 — Modelo Podado (3 Variáveis: xG_atk, gols_cedidos_adv, sot_cedidos_adv)
  const X3_train = X5_train.map(row => [row[0], row[2], row[4], row[5]]); // [1, xg, gc_adv, sot_adv]

  const beta5_default = fitPoissonGLM(X5_train, y_train, 0.5);
  const beta3_default = fitPoissonGLM(X3_train, y_train, 0.5);

  console.log("--- PARTE 2: COEFICIENTES DO MODELO PODADO (3 VARIÁVEIS, λ=0.5) ---");
  console.log(`β0 (Intercepto Log-Base):              ${beta3_default[0].toFixed(4)} (exp = ${Math.exp(beta3_default[0]).toFixed(2)} gols)`);
  console.log(`β1 (xG Atacante):                      ${beta3_default[1].toFixed(4)} ${beta3_default[1] > 0 ? "✓ POSITIVO (Coerente!)" : "✗ NEGATIVO"}`);
  console.log(`β2 (Gols Cedidos Adv):                 ${beta3_default[2].toFixed(4)} ${beta3_default[2] > 0 ? "✓ POSITIVO (Coerente!)" : "✗ NEGATIVO"}`);
  console.log(`β3 (Chutes no Gol Cedidos Adv):        ${beta3_default[3].toFixed(4)} ${beta3_default[3] > 0 ? "✓ POSITIVO (Coerente!)" : "✗ NEGATIVO"}\n`);

  // PARTE 3 — Validação Cruzada 5-Fold para Seleção de Lambda
  console.log("--- PARTE 3: VALIDAÇÃO CRUZADA 5-FOLD PARA SELEÇÃO DE LAMBDA RIDGE ---");
  const cv5 = kFoldCVPoissonGLM(X5_train, y_train, 5, [0.5, 1.0, 2.0, 5.0]);
  const cv3 = kFoldCVPoissonGLM(X3_train, y_train, 5, [0.5, 1.0, 2.0, 5.0]);

  console.log("Resultados CV (Modelo 5 Variáveis):", cv5.candidateScores);
  console.log(`-> Melhor λ (5 Variáveis): ${cv5.bestLambda}\n`);

  console.log("Resultados CV (Modelo Podado 3 Variáveis):", cv3.candidateScores);
  console.log(`-> Melhor λ (3 Variáveis): ${cv3.bestLambda}\n`);

  const beta5_cv = fitPoissonGLM(X5_train, y_train, cv5.bestLambda);
  const beta3_cv = fitPoissonGLM(X3_train, y_train, cv3.bestLambda);

  // PARTE 4 — Avaliação Comparativa Out-of-Sample das 5 Variantes no Teste (N = 41)
  const evalVariantes = {
    heuristic: [],
    p5_def: [],
    p3_def: [],
    p5_cv: [],
    p3_cv: [],
  };

  for (const m of testSet) {
    const hs = m.home_stats || {};
    const as = m.away_stats || {};

    const realGHome = m.real_results?.goals_home ?? m.real_goals_home;
    const realGAway = m.real_results?.goals_away ?? m.real_goals_away;
    if (realGHome === undefined || realGAway === undefined) continue;
    const realTotal = Number(realGHome) + Number(realGAway);

    // 1. Baseline Heurístico
    const prevHeur = m.results?.xg_total || 0;

    // 2. Modelo 5 Vars (λ=0.5)
    const row5_H = [1.0, g(hs, "goals"), g(hs, "xg"), g(hs, "shots_on_target"), g(as, "goals", "c"), g(as, "shots_on_target", "c")];
    const row5_A = [1.0, g(as, "goals"), g(as, "xg"), g(as, "shots_on_target"), g(hs, "goals", "c"), g(hs, "shots_on_target", "c")];
    const prev5_def = predictPoissonGLM(row5_H, beta5_default) + predictPoissonGLM(row5_A, beta5_default);

    // 3. Modelo Podado 3 Vars (λ=0.5)
    const row3_H = [1.0, g(hs, "xg"), g(as, "goals", "c"), g(as, "shots_on_target", "c")];
    const row3_A = [1.0, g(as, "xg"), g(hs, "goals", "c"), g(hs, "shots_on_target", "c")];
    const prev3_def = predictPoissonGLM(row3_H, beta3_default) + predictPoissonGLM(row3_A, beta3_default);

    // 4. Modelo 5 Vars (λ_CV)
    const prev5_cv = predictPoissonGLM(row5_H, beta5_cv) + predictPoissonGLM(row5_A, beta5_cv);

    // 5. Modelo Podado 3 Vars (λ_CV)
    const prev3_cv = predictPoissonGLM(row3_H, beta3_cv) + predictPoissonGLM(row3_A, beta3_cv);

    evalVariantes.heuristic.push({ prev: prevHeur, real: realTotal });
    evalVariantes.p5_def.push({ prev: prev5_def, real: realTotal });
    evalVariantes.p3_def.push({ prev: prev3_def, real: realTotal });
    evalVariantes.p5_cv.push({ prev: prev5_cv, real: realTotal });
    evalVariantes.p3_cv.push({ prev: prev3_cv, real: realTotal });
  }

  function avaliarVariante(nome, dados) {
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
    const status = classificarMercado(r2, binTest.pValor, 5, vies, mae);

    return {
      Variante: nome,
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

  console.log("--- PARTE 4: TABELA COMPARATIVA DAS 5 VARIANTES EM GOLS TOTAL (N = 41 TESTE) ---");
  const tabela5 = [
    avaliarVariante("1. Modelo Heurístico Atual (Baseline)", evalVariantes.heuristic),
    avaliarVariante("2. Poisson GLM (5 Vars, λ=0.5)", evalVariantes.p5_def),
    avaliarVariante("3. Poisson GLM Podado (3 Vars, λ=0.5)", evalVariantes.p3_def),
    avaliarVariante(`4. Poisson GLM (5 Vars, λ_CV=${cv5.bestLambda})`, evalVariantes.p5_cv),
    avaliarVariante(`5. Poisson GLM Podado (3 Vars, λ_CV=${cv3.bestLambda})`, evalVariantes.p3_cv),
  ];
  console.table(tabela5);
  console.log("\nJSON Tabela 5 Variantes (Gols Total):\n", JSON.stringify(tabela5, null, 2));
  console.log("");

  // PARTE 5 — Extensão para Cartões e Defesas do Goleiro
  console.log("--- PARTE 5: EXTENSÃO DA MESMA ABORDAGEM PARA CARTÕES TOTAL E DEFESAS DO GOLEIRO ---");

  // A. Cartões Total (Features: fouls, yellow_cards, tackles + adv fouls, adv tackles)
  const X_cards = [];
  const y_cards = [];
  for (const m of trainSet) {
    const hs = m.home_stats || {};
    const as = m.away_stats || {};
    const cH = m.real_results?.cards_home ?? m.real_cards_home;
    const cA = m.real_results?.cards_away ?? m.real_cards_away;

    if (cH !== undefined && cH !== null) {
      X_cards.push([1.0, g(hs, "fouls"), g(hs, "yellow_cards"), g(as, "fouls", "c")]);
      y_cards.push(Number(cH));
    }
    if (cA !== undefined && cA !== null) {
      X_cards.push([1.0, g(as, "fouls"), g(as, "yellow_cards"), g(hs, "fouls", "c")]);
      y_cards.push(Number(cA));
    }
  }

  const cvCards = kFoldCVPoissonGLM(X_cards, y_cards, 5, [0.5, 1.0, 2.0, 5.0]);
  const betaCards = fitPoissonGLM(X_cards, y_cards, cvCards.bestLambda);

  console.log(`Cartões GLM (λ_CV=${cvCards.bestLambda}) Betas:`, betaCards.map(v => Number(v.toFixed(4))));

  const evalCardsHeur = [];
  const evalCardsGLM = [];

  for (const m of testSet) {
    const hs = m.home_stats || {};
    const as = m.away_stats || {};
    const cH = m.real_results?.cards_home ?? m.real_cards_home;
    const cA = m.real_results?.cards_away ?? m.real_cards_away;
    if (cH === undefined || cA === undefined) continue;
    const realTotal = Number(cH) + Number(cA);

    const prevHeur = m.results?.xcard_total || 0;

    const rowH = [1.0, g(hs, "fouls"), g(hs, "yellow_cards"), g(as, "fouls", "c")];
    const rowA = [1.0, g(as, "fouls"), g(as, "yellow_cards"), g(hs, "fouls", "c")];
    const prevGLM = predictPoissonGLM(rowH, betaCards) + predictPoissonGLM(rowA, betaCards);

    evalCardsHeur.push({ prev: prevHeur, real: realTotal });
    evalCardsGLM.push({ prev: prevGLM, real: realTotal });
  }

  console.log("\nCartões Total (N = 41 Teste):");
  console.table([
    avaliarVariante("Cartões Modelo Heurístico", evalCardsHeur),
    avaliarVariante(`Cartões Poisson GLM Podado (λ_CV=${cvCards.bestLambda})`, evalCardsGLM),
  ]);

  // B. Defesas do Goleiro (Features: shots_on_target adv, total_shots adv)
  const X_saves = [];
  const y_saves = [];
  for (const m of trainSet) {
    const hs = m.home_stats || {};
    const as = m.away_stats || {};
    const sH = m.real_results?.saves_home ?? m.real_saves_home;
    const sA = m.real_results?.saves_away ?? m.real_saves_away;

    if (sH !== undefined && sH !== null) {
      X_saves.push([1.0, g(as, "shots_on_target", "c"), g(as, "total_shots", "c")]);
      y_saves.push(Number(sH));
    }
    if (sA !== undefined && sA !== null) {
      X_saves.push([1.0, g(hs, "shots_on_target", "c"), g(hs, "total_shots", "c")]);
      y_saves.push(Number(sA));
    }
  }

  const cvSaves = kFoldCVPoissonGLM(X_saves, y_saves, 5, [0.5, 1.0, 2.0, 5.0]);
  const betaSaves = fitPoissonGLM(X_saves, y_saves, cvSaves.bestLambda);

  console.log(`Defesas Goleiro GLM (λ_CV=${cvSaves.bestLambda}) Betas:`, betaSaves.map(v => Number(v.toFixed(4))));

  const evalSavesHeur = [];
  const evalSavesGLM = [];

  for (const m of testSet) {
    const hs = m.home_stats || {};
    const as = m.away_stats || {};
    const sH = m.real_results?.saves_home ?? m.real_saves_home;
    const sA = m.real_results?.saves_away ?? m.real_saves_away;
    if (sH === undefined || sA === undefined) continue;
    const realTotal = Number(sH) + Number(sA);

    const prevHeur = m.results?.xsaves_total || 0;

    const rowH = [1.0, g(as, "shots_on_target", "c"), g(as, "total_shots", "c")];
    const rowA = [1.0, g(hs, "shots_on_target", "c"), g(hs, "total_shots", "c")];
    const prevGLM = predictPoissonGLM(rowH, betaSaves) + predictPoissonGLM(rowA, betaSaves);

    evalSavesHeur.push({ prev: prevHeur, real: realTotal });
    evalSavesGLM.push({ prev: prevGLM, real: realTotal });
  }

  console.log("\nDefesas do Goleiro Total (N = 41 Teste):");
  console.table([
    avaliarVariante("Defesas Modelo Heurístico", evalSavesHeur),
    avaliarVariante(`Defesas Poisson GLM Podado (λ_CV=${cvSaves.bestLambda})`, evalSavesGLM),
  ]);
}

runMulticollinearityAndPruningStudy().catch(console.error);
