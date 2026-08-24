import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText, analisarJogo, dixonColesProbs, poissonOver } from "../src/lib/predictionEngine.js";

function fixLegacyStats(statsObj) {
  if (!statsObj || typeof statsObj !== "object") return statsObj;
  const fixed = {};
  for (const [key, val] of Object.entries(statsObj)) {
    if (val && typeof val === "object" && val.t !== undefined && val.c !== undefined) {
      if (val.t > val.c) {
        const teamMade = val.c;
        const conceded = Math.max(0, val.t - val.c);
        fixed[key] = { t: teamMade, c: conceded };
      } else {
        fixed[key] = val;
      }
    } else {
      fixed[key] = val;
    }
  }
  return fixed;
}

function g(stats, key, campo = "t") {
  return stats?.[key]?.[campo] || 0.0;
}

// Matrix helper routines for OLS
function transpose(A) {
  const m = A.length, n = A[0].length;
  const AT = Array.from({ length: n }, () => new Array(m));
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) AT[j][i] = A[i][j];
  return AT;
}

function multiply(A, B) {
  const m = A.length, n = A[0].length, p = B[0].length;
  const C = Array.from({ length: m }, () => new Array(p).fill(0));
  for (let i = 0; i < m; i++) for (let k = 0; k < n; k++) for (let j = 0; j < p; j++) C[i][j] += A[i][k] * B[k][j];
  return C;
}

function invertMatrix(M) {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    if (Math.abs(A[maxRow][i]) < 1e-10) return null;
    const temp = A[i]; A[i] = A[maxRow]; A[maxRow] = temp;
    const pivot = A[i][i];
    for (let j = 0; j < 2 * n; j++) A[i][j] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = 0; j < 2 * n; j++) A[k][j] -= factor * A[i][j];
      }
    }
  }
  return A.map(row => row.slice(n));
}

function solveMultivariateOLS(X, Y) {
  const XT = transpose(X);
  const XTX = multiply(XT, X);
  const XTX_inv = invertMatrix(XTX);
  if (!XTX_inv) return null;
  const Y_col = Y.map(y => [y]);
  const XTY = multiply(XT, Y_col);
  const beta = multiply(XTX_inv, XTY);
  return beta.map(b => b[0]);
}

function calculateR2(preds, reals) {
  const n = preds.length;
  if (n < 5) return 0;
  const meanY = reals.reduce((s, y) => s + y, 0) / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (reals[i] - preds[i]) ** 2;
    ssTot += (reals[i] - meanY) ** 2;
  }
  return ssTot !== 0 ? 1 - ssRes / ssTot : 0;
}

function calculateMAE(preds, reals) {
  const n = preds.length;
  if (n === 0) return 0;
  return preds.reduce((s, p, i) => s + Math.abs(p - reals[i]), 0) / n;
}

function erf(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCDF(z) {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function testeBinomial(acertos, total, p_null = 0.5) {
  if (total === 0) return { p_hat: 0, z: 0, p_valor: 1, significativo: false };
  const p_hat = acertos / total;
  const se = Math.sqrt(p_null * (1 - p_null) / total);
  const z = (p_hat - p_null) / (se || 1);
  const p_valor = 1 - normalCDF(z);
  return { p_hat, z, p_valor, significativo: p_valor < 0.05 };
}

function calcPearson(xArr, yArr) {
  const n = xArr.length;
  if (n < 5) return 0;
  const mx = xArr.reduce((a, b) => a + b, 0) / n;
  const my = yArr.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const xDiff = xArr[i] - mx;
    const yDiff = yArr[i] - my;
    num += xDiff * yDiff;
    dx += xDiff * xDiff;
    dy += yDiff * yDiff;
  }
  const denom = Math.sqrt(dx * dy);
  return denom !== 0 ? num / denom : 0;
}

async function runValidationPipeline() {
  console.log("Buscando partidas do Supabase para validação completa dos 6 mercados...");
  const matches = await base44.entities.Match.list("-date", 500);

  const completed = matches.filter(m => m.status === "completed" || m.real_results);
  completed.sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));

  const totalN = completed.length;
  const trainSize = Math.floor(totalN * 0.80);
  const trainSet = completed.slice(0, trainSize);
  const testSet = completed.slice(trainSize);

  console.log(`Total de jogos disponíveis: ${totalN}`);
  console.log(`Conjunto de TREINO (80% mais antigos): ${trainSet.length} jogos`);
  console.log(`Conjunto de TESTE (20% mais recentes): ${testSet.length} jogos\n`);

  // Helper para obter gols reais
  function getRealGoals(m) {
    const rr = m.real_results;
    if (!rr) return null;
    const h = rr.goals_home ?? rr.real_goals_home;
    const a = rr.goals_away ?? rr.real_goals_away;
    if (h === undefined || a === undefined) return null;
    return { h: Number(h), a: Number(a) };
  }

  // =========================================================================
  // PARTE 1 — VALIDAR 1X2 (CLASSIFICAÇÃO CATEGÓRICA DE 3 CLASSES)
  // =========================================================================
  console.log("======================================================");
  console.log("PARTE 1 — VALIDAÇÃO ESTATÍSTICA DO RESULTADO 1X2 (3 CLASSES)");
  console.log("======================================================");

  // Calcula frequências médias do Treino (Baseline)
  let trainCasa = 0, trainEmpate = 0, trainFora = 0, trainN = 0;
  for (const m of trainSet) {
    const g = getRealGoals(m);
    if (!g) continue;
    trainN++;
    if (g.h > g.a) trainCasa++;
    else if (g.h === g.a) trainEmpate++;
    else trainFora++;
  }

  const pBaseCasa = trainCasa / trainN;
  const pBaseEmpate = trainEmpate / trainN;
  const pBaseFora = trainFora / trainN;

  console.log(`Frequências médias na Amostra de Treino (${trainN} jogos):`);
  console.log(`  - Vitória Mandante (Casa): ${(pBaseCasa * 100).toFixed(1)}%`);
  console.log(`  - Empate (X):               ${(pBaseEmpate * 100).toFixed(1)}%`);
  console.log(`  - Vitória Visitante (Fora): ${(pBaseFora * 100).toFixed(1)}%`);

  // Avaliação no Teste (32 jogos)
  let brierSumModel = 0;
  let brierSumBase = 0;
  let acertosFavoritoModelo = 0;
  let acertosBaselineCasa = 0;
  let testN1x2 = 0;

  for (const m of testSet) {
    const g = getRealGoals(m);
    if (!g) continue;
    testN1x2++;

    // Codificação One-Hot real: [y_casa, y_empate, y_fora]
    let yVector = [0, 0, 0];
    if (g.h > g.a) yVector = [1, 0, 0];
    else if (g.h === g.a) yVector = [0, 1, 0];
    else yVector = [0, 0, 1];

    // Probabilidades do Modelo Dixon-Coles
    let homeStats = fixLegacyStats(m.home_stats);
    let awayStats = fixLegacyStats(m.away_stats);
    if (typeof m.home_text === "string" && m.home_text.trim().length > 10) homeStats = parseStatsHubText(m.home_text);
    if (typeof m.away_text === "string" && m.away_text.trim().length > 10) awayStats = parseStatsHubText(m.away_text);

    const res = analisarJogo(homeStats, awayStats);
    const pCasaMod = res.pick_1x2?.p_casa ?? 0.45;
    const pEmpateMod = res.pick_1x2?.p_empate ?? 0.27;
    const pForaMod = res.pick_1x2?.p_fora ?? 0.28;

    // 1. Brier Score Modelo
    const brierMod = (pCasaMod - yVector[0]) ** 2 + (pEmpateMod - yVector[1]) ** 2 + (pForaMod - yVector[2]) ** 2;
    brierSumModel += brierMod;

    // 2. Brier Score Baseline Média da Liga
    const brierBase = (pBaseCasa - yVector[0]) ** 2 + (pBaseEmpate - yVector[1]) ** 2 + (pBaseFora - yVector[2]) ** 2;
    brierSumBase += brierBase;

    // 3. Favorito Previsto pelo Modelo
    let favModelo = "CASA";
    if (pEmpateMod >= pCasaMod && pEmpateMod >= pForaMod) favModelo = "EMPATE";
    else if (pForaMod >= pCasaMod && pForaMod >= pEmpateMod) favModelo = "FORA";

    const realResultStr = g.h > g.a ? "CASA" : g.h === g.a ? "EMPATE" : "FORA";
    if (favModelo === realResultStr) acertosFavoritoModelo++;

    // 4. Baseline Realista: "Sempre Apostar na Casa"
    if (realResultStr === "CASA") acertosBaselineCasa++;
  }

  const brierScoreModelo = brierSumModel / testN1x2;
  const brierScoreBaseline = brierSumBase / testN1x2;
  const winRateFavorito = (acertosFavoritoModelo / testN1x2) * 100;
  const winRateBaselineCasa = (acertosBaselineCasa / testN1x2) * 100;

  console.log(`\nResultados no Conjunto de TESTE (${testN1x2} jogos out-of-sample):`);
  console.log(`  - Brier Score do Modelo (Dixon-Coles): ${brierScoreModelo.toFixed(4)}`);
  console.log(`  - Brier Score Baseline (Média Liga):   ${brierScoreBaseline.toFixed(4)}`);
  console.log(`  - Avaliação Brier: ${brierScoreModelo < brierScoreBaseline ? "✅ MODELO SUPEROU BASELINE (menor é melhor)" : "❌ MODELO PIOR QUE A MÉDIA DA LIGA"}`);

  console.log(`\n  - Acerto do Favorito Previsto (Modelo): ${winRateFavorito.toFixed(1)}% (${acertosFavoritoModelo}/${testN1x2})`);
  console.log(`  - Baseline Realista ("Sempre Casa"):     ${winRateBaselineCasa.toFixed(1)}% (${acertosBaselineCasa}/${testN1x2})`);
  console.log(`  - Avaliação Acerto: ${winRateFavorito >= winRateBaselineCasa ? "✅ MODELO IUALOU/SUPEROU BASELINE CASA" : "❌ MODELO PIOR QUE APOSTAR SEMPRE NA CASA"}`);

  let rec1x2 = "";
  if (brierScoreModelo < brierScoreBaseline && winRateFavorito >= winRateBaselineCasa) {
    rec1x2 = "MANTER EM PRODUÇÃO NORMAL (Dixon-Coles adiciona sinal preditivo real sobre a média da liga)";
  } else {
    rec1x2 = "MARCAR COMO BAIXA CONFIABILIDADE (Modelo não superou o baseline estatístico da liga)";
  }
  console.log(`\n👉 RECOMENDAÇÃO 1X2: ${rec1x2}\n`);

  // =========================================================================
  // PARTE 2 — VALIDAR BTTS (CLASSIFICAÇÃO BINÁRIA)
  // =========================================================================
  console.log("======================================================");
  console.log("PARTE 2 — VALIDAÇÃO ESTATÍSTICA DE AMBAS MARCAM (BTTS)");
  console.log("======================================================");

  let bttsBrierSum = 0;
  let bttsAcertos = 0;
  let bttsTotalN = 0;

  for (const m of testSet) {
    const rr = m.real_results;
    if (!rr) continue;
    const g = getRealGoals(m);
    if (!g) continue;
    const realBTTS = (g.h > 0 && g.a > 0) ? 1 : 0;

    let homeStats = fixLegacyStats(m.home_stats);
    let awayStats = fixLegacyStats(m.away_stats);
    if (typeof m.home_text === "string" && m.home_text.trim().length > 10) homeStats = parseStatsHubText(m.home_text);
    if (typeof m.away_text === "string" && m.away_text.trim().length > 10) awayStats = parseStatsHubText(m.away_text);

    const res = analisarJogo(homeStats, awayStats);
    const pBTTS = res.p_btts ?? 0.50;

    bttsTotalN++;
    const brierCell = (pBTTS - realBTTS) ** 2;
    bttsBrierSum += brierCell;

    const predBinary = pBTTS >= 0.50 ? 1 : 0;
    if (predBinary === realBTTS) bttsAcertos++;
  }

  const bttsBrierScore = bttsBrierSum / bttsTotalN;
  const bttsWinRate = (bttsAcertos / bttsTotalN) * 100;
  const bttsBinTest = testeBinomial(bttsAcertos, bttsTotalN);

  console.log(`Resultados do BTTS no Conjunto de TESTE (${bttsTotalN} jogos out-of-sample):`);
  console.log(`  - Brier Score Binário:              ${bttsBrierScore.toFixed(4)}`);
  console.log(`  - Taxa de Acerto (threshold 0.50): ${bttsWinRate.toFixed(1)}% (${bttsAcertos}/${bttsTotalN})`);
  console.log(`  - Teste Binomial (H0: p=0.50):     Z = ${bttsBinTest.z.toFixed(2)}, p-valor = ${bttsBinTest.p_valor.toFixed(4)}`);
  console.log(`  - Significância (p < 0.05):        ${bttsBinTest.significativo ? "✅ ESTATISTICAMENTE SIGNIFICATIVO" : "❌ NÃO SIGNIFICATIVO (Semelhando a cara ou coroa)"}`);

  let recBTTS = "";
  if (bttsWinRate > 52.0 && bttsBinTest.significativo) {
    recBTTS = "MANTER EM PRODUÇÃO NORMAL (Aprovado com significância estatística)";
  } else {
    recBTTS = "MARCAR COMO BAIXA CONFIABILIDADE (Sinal estatístico insuficiente out-of-sample)";
  }
  console.log(`\n👉 RECOMENDAÇÃO BTTS: ${recBTTS}\n`);

  // =========================================================================
  // PARTE 3 — VALIDAR SPLITS INDIVIDUAIS (ESCANTEIOS CASA/FORA, GOLS CASA/FORA)
  // =========================================================================
  console.log("======================================================");
  console.log("PARTE 3 — VALIDAÇÃO DOS 4 MERCADOS INDIVIDUAIS CASA / FORA");
  console.log("======================================================");

  // Fatores Estatísticos Candidatos
  const ALL_STAT_KEYS = [
    "shots_on_target", "shots_in_box", "crosses", "touches_opp_box",
    "big_chance_created", "big_chance_missed", "total_shots",
    "clearances", "gk_saves", "fouls", "tackles", "yellow_cards", "dispossessed"
  ];

  function getRealSingle(homeKey, awayKey, targetType = "home") {
    return m => {
      const rr = m.real_results;
      if (!rr) return null;
      const key = targetType === "home" ? homeKey : awayKey;
      const v = rr[key] ?? rr[`real_${key}`];
      if (v === undefined || v === null || v === "") return null;
      return Number(v);
    };
  }

  const singleMarkets = [
    { key: "corners_home", label: "ESCANTEIOS MANDANTE (CASA)", realFn: getRealSingle("corners_home", "corners_away", "home") },
    { key: "corners_away", label: "ESCANTEIOS VISITANTE (FORA)", realFn: getRealSingle("corners_home", "corners_away", "away") },
    { key: "goals_home",   label: "GOLS MANDANTE (CASA)",       realFn: getRealSingle("goals_home", "goals_away", "home") },
    { key: "goals_away",   label: "GOLS VISITANTE (FORA)",      realFn: getRealSingle("goals_home", "goals_away", "away") },
  ];

  for (const sm of singleMarkets) {
    console.log(`------------------------------------------------------`);
    console.log(`MERCADO INDIVIDUAL: ${sm.label}`);
    console.log(`------------------------------------------------------`);

    // 1. Matriz Completa para Pearson
    const allRowsX = [];
    const allY = [];

    for (const m of completed) {
      let homeStats = fixLegacyStats(m.home_stats);
      let awayStats = fixLegacyStats(m.away_stats);
      if (typeof m.home_text === "string" && m.home_text.trim().length > 10) homeStats = parseStatsHubText(m.home_text);
      if (typeof m.away_text === "string" && m.away_text.trim().length > 10) awayStats = parseStatsHubText(m.away_text);

      const yVal = sm.realFn(m);
      if (yVal === null) continue;

      const featObj = {};
      for (const sk of ALL_STAT_KEYS) {
        featObj[`${sk}_home_t`] = g(homeStats, sk, "t");
        featObj[`${sk}_home_c`] = g(homeStats, sk, "c");
        featObj[`${sk}_away_t`] = g(awayStats, sk, "t");
        featObj[`${sk}_away_c`] = g(awayStats, sk, "c");
      }
      allRowsX.push(featObj);
      allY.push(yVal);
    }

    // Calcula Pearson para cada fator candidato
    const pearsonResults = [];
    if (allRowsX.length > 0) {
      const sampleFeatKeys = Object.keys(allRowsX[0]);
      for (const fk of sampleFeatKeys) {
        const xVals = allRowsX.map(r => r[fk]);
        const rCorr = calcPearson(xVals, allY);
        if (Math.abs(rCorr) >= 0.10) {
          pearsonResults.push({ key: fk, r: rCorr });
        }
      }
    }

    pearsonResults.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const selectedFeatures = pearsonResults.slice(0, 4);

    console.log(`1. Variáveis Candidatas Selecionadas (Pearson |r| >= 0.10, top 4):`);
    if (selectedFeatures.length === 0) {
      console.log(`   ⚠️ Nenhuma variável atingiu |r| >= 0.10 com o resultado real.`);
    } else {
      selectedFeatures.forEach(f => {
        console.log(`   - ${f.key}: r = ${f.r > 0 ? "+" : ""}${f.r.toFixed(3)}`);
      });
    }

    if (selectedFeatures.length === 0) {
      console.log(`\n👉 RECOMENDAÇÃO: MARCAR COMO BAIXA CONFIABILIDADE (Sem sinal correlacionado r >= 0.10)\n`);
      continue;
    }

    // 2. Ajuste OLS nos Dados de Treino
    const trainX = [], trainY = [];
    for (const m of trainSet) {
      let homeStats = fixLegacyStats(m.home_stats), awayStats = fixLegacyStats(m.away_stats);
      if (typeof m.home_text === "string" && m.home_text.trim().length > 10) homeStats = parseStatsHubText(m.home_text);
      if (typeof m.away_text === "string" && m.away_text.trim().length > 10) awayStats = parseStatsHubText(m.away_text);
      const yVal = sm.realFn(m);
      if (yVal === null) continue;

      const row = [1.0];
      for (const sf of selectedFeatures) {
        const parts = sf.key.split("_");
        const teamType = parts[parts.length - 2];
        const campo = parts[parts.length - 1];
        const statKey = parts.slice(0, parts.length - 2).join("_");
        const stObj = teamType === "home" ? homeStats : awayStats;
        row.push(g(stObj, statKey, campo));
      }
      trainX.push(row);
      trainY.push(yVal);
    }

    const beta = solveMultivariateOLS(trainX, trainY);
    if (!beta) {
      console.log(`⚠️ Matriz singular para ${sm.label}.\n`);
      continue;
    }

    const trainPreds = trainX.map(row => row.reduce((s, val, idx) => s + val * beta[idx], 0));
    const r2Train = calculateR2(trainPreds, trainY);

    // 3. Validação nos Dados de Teste
    const testX = [], testY = [];
    for (const m of testSet) {
      let homeStats = fixLegacyStats(m.home_stats), awayStats = fixLegacyStats(m.away_stats);
      if (typeof m.home_text === "string" && m.home_text.trim().length > 10) homeStats = parseStatsHubText(m.home_text);
      if (typeof m.away_text === "string" && m.away_text.trim().length > 10) awayStats = parseStatsHubText(m.away_text);
      const yVal = sm.realFn(m);
      if (yVal === null) continue;

      const row = [1.0];
      for (const sf of selectedFeatures) {
        const parts = sf.key.split("_");
        const teamType = parts[parts.length - 2];
        const campo = parts[parts.length - 1];
        const statKey = parts.slice(0, parts.length - 2).join("_");
        const stObj = teamType === "home" ? homeStats : awayStats;
        row.push(g(stObj, statKey, campo));
      }
      testX.push(row);
      testY.push(yVal);
    }

    const testPreds = testX.map(row => row.reduce((s, val, idx) => s + val * beta[idx], 0));
    const r2Test = calculateR2(testPreds, testY);
    const maeTest = calculateMAE(testPreds, testY);

    let acertosTest = 0;
    for (let i = 0; i < testPreds.length; i++) {
      const linha = Math.floor(testPreds[i]) + 0.5;
      if ((testPreds[i] >= linha) === (testY[i] > linha)) acertosTest++;
    }
    const winRateTest = testPreds.length > 0 ? (acertosTest / testPreds.length) * 100 : 0;
    const binTest = testeBinomial(acertosTest, testPreds.length);

    console.log(`\n2. Coeficientes da Equação (Treino ${trainSet.length} jogos):`);
    console.log(`   b0 (Intercepto) = ${beta[0].toFixed(3)}`);
    selectedFeatures.forEach((sf, idx) => {
      console.log(`   - b${idx + 1} (${sf.key}) = ${beta[idx + 1].toFixed(4)}`);
    });

    console.log(`\n3. Métricas Treino vs Teste (Out-of-Sample ${testSet.length} jogos):`);
    console.log(`   - R² no Treino:           ${r2Train.toFixed(4)}`);
    console.log(`   - R² no TESTE:             ${r2Test.toFixed(4)}`);
    console.log(`   - MAE no TESTE:           ${maeTest.toFixed(2)}`);
    console.log(`   - Taxa de Acerto TESTE:   ${winRateTest.toFixed(1)}% (${acertosTest}/${testPreds.length})`);
    console.log(`   - Teste Binomial (p-val): ${binTest.p_valor.toFixed(4)} ${binTest.significativo ? "(✓ Sig.)" : "(ns)"}`);

    const passesR2 = r2Test > 0.10;
    const passesWinRate = winRateTest > 52.0 && binTest.significativo;

    let recSingle = "";
    if (passesR2 && passesWinRate) {
      recSingle = "MANTER EM PRODUÇÃO NORMAL (Aprovado com sinal estatístico comprovado)";
    } else {
      recSingle = "MARCAR COMO BAIXA CONFIABILIDADE (Sinal preditivo insuficiente out-of-sample)";
    }
    console.log(`\n👉 RECOMENDAÇÃO: ${recSingle}\n`);
  }
}

runValidationPipeline().catch(console.error);
