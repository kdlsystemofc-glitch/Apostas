import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText, calcGols, calcCorners, calcCartoes } from "../src/lib/predictionEngine.js";

function calcMetrics(preds, reals) {
  const cleanPreds = [];
  const cleanReals = [];

  for (let i = 0; i < preds.length; i++) {
    if (preds[i] != null && !isNaN(preds[i]) && reals[i] != null && !isNaN(reals[i])) {
      cleanPreds.push(preds[i]);
      cleanReals.push(reals[i]);
    }
  }

  const n = cleanPreds.length;
  if (n === 0) return { n: 0, vies: 0, mae: 0, r2: 0, winRate: 0 };

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

  return {
    n,
    vies: vies.toFixed(2),
    mae: mae.toFixed(2),
    r2: r2.toFixed(4),
    winRate: winRate.toFixed(1) + "%",
  };
}

function desvioPadrao(arr) {
  if (arr.length === 0) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

function coefVariaçao(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  if (m === 0) return 0;
  return desvioPadrao(arr) / m;
}

async function runExperiments() {
  console.log("==========================================================================");
  console.log("BATERIA DE EXPERIMENTOS ESTATÍSTICOS OUT-OF-SAMPLE (SPLIT 80/20 CRONOLÓGICO)");
  console.log("==========================================================================\n");

  const matches = await base44.entities.Match.list("-created_date", 500);
  const valid = matches.filter(m => (m.status === "completed" || m.real_results) && m.home_stats?._raw_text && m.away_stats?._raw_text);

  console.log(`Total de jogos com resultado real e texto bruto de historico: ${valid.length}`);

  const sorted = [...valid].sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));
  const trainSize = Math.floor(sorted.length * 0.80);
  const trainSet = sorted.slice(0, trainSize);
  const testSet = sorted.slice(trainSize);

  console.log(`Split: Treino = ${trainSet.length} jogos | Teste = ${testSet.length} jogos\n`);

  // -------------------------------------------------------------------------
  // EXPERIMENTO 1: Split Casa/Fora Real vs Multiplicador Fixo
  // -------------------------------------------------------------------------
  console.log("--- EXPERIMENTO 1: Split Casa/Fora Real vs Multiplicador Fixo ---");

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

  console.log("Gols Total (Multiplicador Fixo x1.08/0.92):", calcMetrics(testGolsFixo, testGolsReals));
  console.log("Gols Total (Split Casa/Fora Real):         ", calcMetrics(testGolsRealSplit, testGolsReals));

  // Escanteios Total
  const testCornersReals = testSet.map(m => (m.real_results?.corners_home ?? m.real_corners_home ?? 0) + (m.real_results?.corners_away ?? m.real_corners_away ?? 0));
  const testCornersFixo = testSet.map(m => m.results?.xc_total || 0);
  const testCornersRealSplit = testSet.map(m => {
    const hs = parseStatsHubText(m.home_stats._raw_text);
    const as = parseStatsHubText(m.away_stats._raw_text);
    const res = calcCorners(hs, as);
    let xcHome = res.xc_casa || 5.0;
    let xcAway = res.xc_fora || 4.5;
    if (hs.corners?.media_casa != null && hs.corners?.t > 0) {
      const f = Math.max(0.7, Math.min(1.4, hs.corners.media_casa / hs.corners.t));
      xcHome *= f;
    }
    if (as.corners?.media_fora != null && as.corners?.t > 0) {
      const f = Math.max(0.7, Math.min(1.4, as.corners.media_fora / as.corners.t));
      xcAway *= f;
    }
    return Math.round((xcHome + xcAway) * 100) / 100;
  });

  console.log("\nEscanteios Total (Multiplicador Fixo x1.15/0.97):", calcMetrics(testCornersFixo, testCornersReals));
  console.log("Escanteios Total (Split Casa/Fora Real):        ", calcMetrics(testCornersRealSplit, testCornersReals));

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

  console.log("\nCartões Total (Multiplicador Fixo x1.10/0.90):", calcMetrics(testCardsFixo, testCardsReals));
  console.log("Cartões Total (Split Casa/Fora Real):        ", calcMetrics(testCardsRealSplit, testCardsReals));

  // -------------------------------------------------------------------------
  // EXPERIMENTO 2: Média com Recência (Ponderação Exponencial 0.95) vs Média Simples
  // -------------------------------------------------------------------------
  console.log("\n--- EXPERIMENTO 2: Média com Recência (Decaimento 0.95) vs Média Simples ---");

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

  console.log("Gols Total (Média Simples): ", calcMetrics(testGolsFixo, testGolsReals));
  console.log("Gols Total (Média Recente): ", calcMetrics(testGolsRecente, testGolsReals));

  // -------------------------------------------------------------------------
  // EXPERIMENTO 3: Decomposição Taxa x Volume para Escanteios
  // -------------------------------------------------------------------------
  console.log("\n--- EXPERIMENTO 3: Decomposição Taxa x Volume para Escanteios ---");

  let cvCantosBrutos = [];
  let cvTaxaCantosPorChute = [];

  sorted.forEach(m => {
    const hs = parseStatsHubText(m.home_stats._raw_text);
    if (hs.corners?.historico && hs.total_shots?.historico && hs.corners.historico.length >= 5) {
      const cantosArr = hs.corners.historico.map(h => h.t);
      const chutesArr = hs.total_shots.historico.map(h => h.t);
      const taxaArr = cantosArr.map((c, idx) => (chutesArr[idx] > 0 ? c / chutesArr[idx] : 0)).filter(t => t > 0);

      if (cantosArr.length >= 5 && taxaArr.length >= 5) {
        cvCantosBrutos.push(coefVariaçao(cantosArr));
        cvTaxaCantosPorChute.push(coefVariaçao(taxaArr));
      }
    }
  });

  const avgCVCantos = cvCantosBrutos.reduce((a, b) => a + b, 0) / (cvCantosBrutos.length || 1);
  const avgCVTaxa = cvTaxaCantosPorChute.reduce((a, b) => a + b, 0) / (cvTaxaCantosPorChute.length || 1);

  console.log(`Estabilidade no Histórico dos Times (Amostra = ${cvCantosBrutos.length} séries de jogos):`);
  console.log(`  - Coeficiente de Variação MPT (CV) Escanteios Brutos:   ${avgCVCantos.toFixed(4)}`);
  console.log(`  - Coeficiente de Variação MPT (CV) Taxa (Cantos/Chute): ${avgCVTaxa.toFixed(4)}`);
  console.log(`  - Redução de Variância / Estabilidade Ganha:           ${(((avgCVCantos - avgCVTaxa) / avgCVCantos) * 100).toFixed(1)}%`);

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

  console.log("\nPerformance em Previsão de Escanteios (Out-of-Sample):");
  console.log("Escanteios Modelo Atual (Âncora Mecanística Direct):", calcMetrics(testCornersFixo, testCornersReals));
  console.log("Escanteios Modelo Decomposto (Taxa x Volume):       ", calcMetrics(testCornersTaxaVolume, testCornersReals));
}

runExperiments().catch(console.error);
