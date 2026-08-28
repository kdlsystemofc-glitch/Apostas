import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText, calcGols, calcCorners, calcCartoes } from "../src/lib/predictionEngine.js";

// Função para calcular o Intervalo de Confiança 95% de Wilson Score para proporções binomiais
function wilsonScoreInterval(k, n, confidence = 0.95) {
  if (n === 0) return { lower: 0, upper: 0, str: "[0.0%, 0.0%]" };
  const z = 1.959964; // z para 95% IC
  const p = k / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;

  const lower = Math.max(0, (centre - margin) * 100);
  const upper = Math.min(100, (centre + margin) * 100);

  return {
    lower: lower.toFixed(1),
    upper: upper.toFixed(1),
    str: `[${lower.toFixed(1)}%, ${upper.toFixed(1)}%]`,
  };
}

function normalCDF(z) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  const erfVal = sign * y;
  return 0.5 * (1 + erfVal);
}

function testeBinomial(k, n, pNull = 0.5) {
  if (n === 0) return { pHat: 0, z: 0, pValor: 1, sig: false };
  const pHat = k / n;
  const se = Math.sqrt(pNull * (1 - pNull) / n);
  const z = (pHat - pNull) / (se || 1);
  const pValor = 1 - normalCDF(z);
  return { pHat, z, pValor: pValor.toFixed(4), sig: pValor < 0.05 };
}

function calcFullMetrics(preds, reals) {
  const cleanPreds = [];
  const cleanReals = [];

  for (let i = 0; i < preds.length; i++) {
    if (preds[i] != null && !isNaN(preds[i]) && reals[i] != null && !isNaN(reals[i])) {
      cleanPreds.push(preds[i]);
      cleanReals.push(reals[i]);
    }
  }

  const n = cleanPreds.length;
  if (n === 0) return { n: 0, vies: 0, mae: 0, r2: 0, winRate: "0.0%", ic95: "[0.0%, 0.0%]", pValor: 1.0, statusAmostra: "Insuficiente" };

  const meanReal = cleanReals.reduce((a, b) => a + b, 0) / n;
  const vies = (cleanPreds.reduce((a, b) => a + b, 0) / n) - meanReal;
  const mae = cleanPreds.reduce((a, b, i) => a + Math.abs(b - cleanReals[i]), 0) / n;

  const ssRes = cleanPreds.reduce((a, b, i) => a + (cleanReals[i] - b) ** 2, 0);
  const ssTot = cleanReals.reduce((a, b) => a + (b - meanReal) ** 2, 0);
  const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  let acertos = 0;
  for (let i = 0; i < n; i++) {
    const linha = Math.floor(cleanPreds[i]) + 0.5;
    if ((cleanPreds[i] >= linha) === (cleanReals[i] > linha)) acertos++;
  }
  const winRate = (acertos / n) * 100;
  const ic = wilsonScoreInterval(acertos, n);
  const binTest = testeBinomial(acertos, n);

  const statusAmostra = n >= 25 ? "✓ Amostra Adequada" : "⚠ PRELIMINAR (Aguardando + Dados)";

  return {
    n,
    acertos,
    vies: vies.toFixed(2),
    mae: mae.toFixed(2),
    r2: r2.toFixed(4),
    winRate: winRate.toFixed(1) + "%",
    ic95: ic.str,
    pValorBinomial: binTest.pValor,
    statusAmostra,
  };
}

async function runRigorously() {
  console.log("==========================================================================");
  console.log("AVALIAÇÃO ESTATÍSTICA RIGOROSA DOS 3 EXPERIMENTOS COM TESTE BINOMIAL E IC 95%");
  console.log("==========================================================================\n");

  const matches = await base44.entities.Match.list("-created_date", 500);
  const valid = matches.filter(m => (m.status === "completed" || m.real_results) && m.home_stats?._raw_text && m.away_stats?._raw_text);

  console.log(`Partidas elegíveis (com resultado real e _raw_text no banco): ${valid.length}`);

  const sorted = [...valid].sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));
  const trainSize = Math.floor(sorted.length * 0.80);
  const trainSet = sorted.slice(0, trainSize);
  const testSet = sorted.slice(trainSize);

  console.log(`Split Cronológico 80/20: Treino N = ${trainSet.length} | Teste N = ${testSet.length}\n`);

  // -------------------------------------------------------------------------
  // EXPERIMENTO 1: Split Casa/Fora Real vs Multiplicador Fixo
  // -------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------");
  console.log("EXPERIMENTO 1: Split Casa/Fora Real vs Multiplicador Fixo");
  console.log("--------------------------------------------------------------------------");

  const testGolsReals = testSet.map(m => (m.real_results?.goals_home ?? m.real_goals_home ?? 0) + (m.real_results?.goals_away ?? m.real_goals_away ?? 0));
  const testGolsFixo = testSet.map(m => m.results?.xg_total || 0);
  const testGolsRealSplit = testSet.map(m => {
    const hs = parseStatsHubText(m.home_stats._raw_text);
    const as = parseStatsHubText(m.away_stats._raw_text);
    const res = calcGols(hs, as);
    let xgHome = res.xg_casa || 1.1;
    let xgAway = res.xg_fora || 1.1;
    if (hs.goals?.media_casa != null && hs.goals?.t > 0) {
      const f = Math.max(0.7, Math.min(1.4, hs.goals.media_casa / hs.goals.t));
      xgHome *= f;
    }
    if (as.goals?.media_fora != null && as.goals?.t > 0) {
      const f = Math.max(0.7, Math.min(1.4, as.goals.media_fora / as.goals.t));
      xgAway *= f;
    }
    return Math.round((xgHome + xgAway) * 100) / 100;
  });

  console.log("Gols Total (Multiplicador Fixo x1.08/0.92):", calcFullMetrics(testGolsFixo, testGolsReals));
  console.log("Gols Total (Split Casa/Fora Real):         ", calcFullMetrics(testGolsRealSplit, testGolsReals));

  // Cartões Total
  const testCardsReals = testSet.map(m => (m.real_results?.cards_home ?? m.real_cards_home ?? 0) + (m.real_results?.cards_away ?? m.real_cards_away ?? 0));
  const testCardsFixo = testSet.map(m => m.results?.xcard_total || 0);
  const testCardsRealSplit = testSet.map(m => {
    const hs = parseStatsHubText(m.home_stats._raw_text);
    const as = parseStatsHubText(m.away_stats._raw_text);
    const res = calcCartoes(hs, as);
    let xcHome = res.xcard_casa || 2.0;
    let xcAway = res.xcard_fora || 2.0;
    if (hs.cards?.media_casa != null && hs.cards?.t > 0) {
      const f = Math.max(0.7, Math.min(1.4, hs.cards.media_casa / hs.cards.t));
      xcHome *= f;
    }
    if (as.cards?.media_fora != null && as.cards?.t > 0) {
      const f = Math.max(0.7, Math.min(1.4, as.cards.media_fora / as.cards.t));
      xcAway *= f;
    }
    return Math.round((xcHome + xcAway) * 100) / 100;
  });

  console.log("\nCartões Total (Multiplicador Fixo x1.10/0.90):", calcFullMetrics(testCardsFixo, testCardsReals));
  console.log("Cartões Total (Split Casa/Fora Real):        ", calcFullMetrics(testCardsRealSplit, testCardsReals));

  // -------------------------------------------------------------------------
  // EXPERIMENTO 2: Média com Recência (Ponderação Exponencial 0.95) vs Média Simples
  // -------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------");
  console.log("EXPERIMENTO 2: Média com Recência (Decaimento 0.95) vs Média Simples");
  console.log("--------------------------------------------------------------------------");

  const testGolsRecente = testSet.map(m => {
    const hs = parseStatsHubText(m.home_stats._raw_text);
    const as = parseStatsHubText(m.away_stats._raw_text);
    const hsRec = hs.goals?.media_recente || hs.goals?.t || 1.1;
    const asRec = as.goals?.media_recente || as.goals?.t || 1.1;
    const hsCedRec = hs.goals?.c || 1.1;
    const asCedRec = as.goals?.c || 1.1;
    const xgHome = (hsRec + asCedRec) / 2;
    const xgAway = (asRec + hsCedRec) / 2;
    return Math.round((xgHome + xgAway) * 100) / 100;
  });

  console.log("Gols Total (Média Simples): ", calcFullMetrics(testGolsFixo, testGolsReals));
  console.log("Gols Total (Média Recente): ", calcFullMetrics(testGolsRecente, testGolsReals));

  // -------------------------------------------------------------------------
  // EXPERIMENTO 3 & PARTE 4: Investigação da Decomposição Taxa x Volume para Escanteios
  // -------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------");
  console.log("EXPERIMENTO 3 & PARTE 4: Decomposição Taxa x Volume para Escanteios");
  console.log("--------------------------------------------------------------------------");

  const testCornersReals = testSet.map(m => (m.real_results?.corners_home ?? m.real_corners_home ?? 0) + (m.real_results?.corners_away ?? m.real_corners_away ?? 0));
  const testCornersFixo = testSet.map(m => m.results?.xc_total || 0);

  const testCornersTaxaVolume = testSet.map(m => {
    const hs = parseStatsHubText(m.home_stats._raw_text);
    const as = parseStatsHubText(m.away_stats._raw_text);

    const hsCantos = hs.corners?.t || 5.0;
    const hsChutes = hs.total_shots?.t || 13.0;
    const taxaHs = hsChutes > 0 ? hsCantos / hsChutes : 0.40;

    const asCantos = as.corners?.t || 4.5;
    const asChutes = as.total_shots?.t || 12.0;
    const taxaAs = asChutes > 0 ? asCantos / asChutes : 0.38;

    const xShotsHome = (hsChutes + (as.total_shots?.c || 12.0)) / 2;
    const xShotsAway = (asChutes + (hs.total_shots?.c || 13.0)) / 2;

    const xcHome = taxaHs * xShotsHome;
    const xcAway = taxaAs * xShotsAway;

    return Math.round((xcHome + xcAway) * 100) / 100;
  });

  console.log("Escanteios Modelo Atual (Âncora Mecanística Direct):", calcFullMetrics(testCornersFixo, testCornersReals));
  console.log("Escanteios Modelo Decomposto (Taxa x Volume):       ", calcFullMetrics(testCornersTaxaVolume, testCornersReals));

  console.log("\nDETALHAMENTO JOGO-A-JOGO DA DECOMPOSIÇÃO (INVESTIGAÇÃO DE OUTLIERS NO TESTE):");
  testSet.forEach((m, idx) => {
    const prevAtual = testCornersFixo[idx];
    const prevDec = testCornersTaxaVolume[idx];
    const real = testCornersReals[idx];
    const errAtual = (real - prevAtual) ** 2;
    const errDec = (real - prevDec) ** 2;

    console.log(`  Jogo ${idx + 1} [${m.home_team} vs ${m.away_team}]: Real=${real} | PrevAtual=${prevAtual} (Err²=${errAtual.toFixed(2)}) | PrevDec=${prevDec} (Err²=${errDec.toFixed(2)})`);
  });
}

runRigorously().catch(console.error);
