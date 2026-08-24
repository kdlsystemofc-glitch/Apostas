import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText } from "../src/lib/predictionEngine.js";

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

function calculateWinRate(preds, reals) {
  const n = preds.length;
  if (n === 0) return 0;
  let acertos = 0;
  for (let i = 0; i < n; i++) {
    const linha = Math.floor(preds[i]) + 0.5;
    if ((preds[i] >= linha) === (reals[i] > linha)) acertos++;
  }
  return (acertos / n) * 100;
}

async function runMultivariateAnalysis() {
  const matches = await base44.entities.Match.list("-date", 500);
  const completed = matches.filter(m => m.status === "completed" || m.real_results);
  completed.sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));

  const totalN = completed.length;
  const trainSize = Math.floor(totalN * 0.80);
  const trainSet = completed.slice(0, trainSize);
  const testSet = completed.slice(trainSize);

  function buildRealSum(homeKey, awayKey) {
    return m => {
      const rr = m.real_results;
      if (!rr) return null;
      const h = rr[homeKey] ?? rr[`real_${homeKey}`];
      const a = rr[awayKey] ?? rr[`real_${awayKey}`];
      if (h === undefined && a === undefined) return null;
      return (Number(h) || 0) + (Number(a) || 0);
    };
  }

  const marketSpecs = [
    {
      key: "corners_total",
      label: "ESCANTEIOS TOTAL",
      realFn: buildRealSum("corners_home", "corners_away"),
      featureDefs4: [
        { name: "clearances_t (soma)", get: (h, a) => g(h, "clearances", "t") + g(a, "clearances", "t") },
        { name: "clearances_c (soma)", get: (h, a) => g(h, "clearances", "c") + g(a, "clearances", "c") },
        { name: "gk_saves_t (soma)",   get: (h, a) => g(h, "gk_saves", "t") + g(a, "gk_saves", "t") },
        { name: "gk_saves_c (soma)",   get: (h, a) => g(h, "gk_saves", "c") + g(a, "gk_saves", "c") },
      ],
      featureDefs2: [
        { name: "clearances_t (soma)", get: (h, a) => g(h, "clearances", "t") + g(a, "clearances", "t") },
        { name: "gk_saves_t (soma)",   get: (h, a) => g(h, "gk_saves", "t") + g(a, "gk_saves", "t") },
      ]
    },
    {
      key: "shots_on_target",
      label: "CHUTES NO GOL TOTAL",
      realFn: buildRealSum("shots_home", "shots_away"),
      featureDefs4: [
        { name: "big_chance_created_c (visitante)", get: (h, a) => g(a, "big_chance_created", "c") },
        { name: "clearances_soma",                 get: (h, a) => g(h, "clearances", "t") + g(a, "clearances", "t") },
        { name: "shots_on_target_c (soma)",         get: (h, a) => g(h, "shots_on_target", "c") + g(a, "shots_on_target", "c") },
        { name: "touches_opp_box_c (visitante)",   get: (h, a) => g(a, "touches_opp_box", "c") },
      ],
      featureDefs2: [
        { name: "big_chance_created_c (visitante)", get: (h, a) => g(a, "big_chance_created", "c") },
        { name: "clearances_soma",                 get: (h, a) => g(h, "clearances", "t") + g(a, "clearances", "t") },
      ]
    },
    {
      key: "fouls_total",
      label: "FALTAS TOTAL",
      realFn: buildRealSum("fouls_home", "fouls_away"),
      featureDefs4: [
        { name: "yellow_cards_c (visitante)", get: (h, a) => g(a, "yellow_cards", "c") },
        { name: "fouls_c (visitante)",        get: (h, a) => g(a, "fouls", "c") },
        { name: "dispossessed_c (soma)",      get: (h, a) => g(h, "dispossessed", "c") + g(a, "dispossessed", "c") },
        { name: "fouls_t (soma)",             get: (h, a) => g(h, "fouls", "t") + g(a, "fouls", "t") },
      ],
      featureDefs2: [
        { name: "yellow_cards_c (visitante)", get: (h, a) => g(a, "yellow_cards", "c") },
        { name: "fouls_c (visitante)",        get: (h, a) => g(a, "fouls", "c") },
      ]
    },
    {
      key: "total_shots",
      label: "CHUTES TOTAIS",
      realFn: buildRealSum("totalshots_home", "totalshots_away"),
      featureDefs4: [
        { name: "big_chance_created_c (visitante)", get: (h, a) => g(a, "big_chance_created", "c") },
        { name: "shots_in_box_c (visitante)",      get: (h, a) => g(a, "shots_in_box", "c") },
        { name: "total_shots_c (visitante)",       get: (h, a) => g(a, "total_shots", "c") },
        { name: "touches_opp_box_c (visitante)",   get: (h, a) => g(a, "touches_opp_box", "c") },
      ],
      featureDefs2: [
        { name: "big_chance_created_c (visitante)", get: (h, a) => g(a, "big_chance_created", "c") },
        { name: "total_shots_c (visitante)",       get: (h, a) => g(a, "total_shots", "c") },
      ]
    },
  ];

  console.log(`\n======================================================`);
  console.log(`RELATÓRIO DE COMPARAÇÃO DE VARIÁVEIS (4 FEATS VS 2 FEATS)`);
  console.log(`Split: Treino ${trainSet.length} jogos | Teste ${testSet.length} jogos`);
  console.log(`======================================================\n`);

  for (const mSpec of marketSpecs) {
    console.log(`------------------------------------------------------`);
    console.log(`MERCADO: ${mSpec.label}`);
    console.log(`------------------------------------------------------`);

    for (const [mode, fDefs] of [["4 Variáveis", mSpec.featureDefs4], ["2 Variáveis (Parsimônia)", mSpec.featureDefs2]]) {
      const trainX = [], trainY = [];
      for (const m of trainSet) {
        let homeStats = fixLegacyStats(m.home_stats), awayStats = fixLegacyStats(m.away_stats);
        if (typeof m.home_text === "string" && m.home_text.trim().length > 10) homeStats = parseStatsHubText(m.home_text);
        if (typeof m.away_text === "string" && m.away_text.trim().length > 10) awayStats = parseStatsHubText(m.away_text);
        const yVal = mSpec.realFn(m);
        if (yVal === null) continue;
        const row = [1.0];
        for (const feat of fDefs) row.push(feat.get(homeStats, awayStats));
        trainX.push(row); trainY.push(yVal);
      }

      const beta = solveMultivariateOLS(trainX, trainY);
      if (!beta) continue;

      const trainPreds = trainX.map(row => row.reduce((s, val, idx) => s + val * beta[idx], 0));
      const r2Train = calculateR2(trainPreds, trainY);

      const testX = [], testY = [];
      for (const m of testSet) {
        let homeStats = fixLegacyStats(m.home_stats), awayStats = fixLegacyStats(m.away_stats);
        if (typeof m.home_text === "string" && m.home_text.trim().length > 10) homeStats = parseStatsHubText(m.home_text);
        if (typeof m.away_text === "string" && m.away_text.trim().length > 10) awayStats = parseStatsHubText(m.away_text);
        const yVal = mSpec.realFn(m);
        if (yVal === null) continue;
        const row = [1.0];
        for (const feat of fDefs) row.push(feat.get(homeStats, awayStats));
        testX.push(row); testY.push(yVal);
      }

      const testPreds = testX.map(row => row.reduce((s, val, idx) => s + val * beta[idx], 0));
      const r2Test = calculateR2(testPreds, testY);
      const maeTest = calculateMAE(testPreds, testY);
      const winRateTest = calculateWinRate(testPreds, testY);

      console.log(`[${mode}]`);
      console.log(`  Equação: pred = ${beta[0].toFixed(2)} ` + fDefs.map((f, i) => `${beta[i+1]>=0?'+':'-'} ${Math.abs(beta[i+1]).toFixed(3)}*${f.name.split(' ')[0]}`).join(' '));
      console.log(`  R² Treino: ${r2Train.toFixed(4)} | R² TESTE: ${r2Test.toFixed(4)} | MAE Teste: ${maeTest.toFixed(2)} | Acerto Teste: ${winRateTest.toFixed(1)}%`);
    }
    console.log("");
  }
}

runMultivariateAnalysis().catch(console.error);
