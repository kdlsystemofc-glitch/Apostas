import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText, analisarJogo } from "../src/lib/predictionEngine.js";
import {
  CALIBRATION_COEFFICIENTS,
  setCalibrationCoefficients,
  fitOLS,
} from "../src/lib/calibrationLayer.js";

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

const OLS_MARKETS_MAP = [
  { key: "corners_total",   name: "Escanteios Total", rawKey: "xc_total_bruto",  homeRealKey: "corners_home", awayRealKey: "corners_away" },
  { key: "goals_total",     name: "Gols Total",       rawKey: "xg_total_bruto",  homeRealKey: "goals_home",   awayRealKey: "goals_away" },
  { key: "cards_total",     name: "Cartões Total",    rawKey: "xcard_total_bruto", homeRealKey: "cards_home", awayRealKey: "cards_away" },
  { key: "shots_on_target", name: "Chutes no Gol",    rawKey: "xs_total_bruto",  homeRealKey: "shots_home",   awayRealKey: "shots_away" },
  { key: "fouls_total",     name: "Faltas Total",     rawKey: "xfouls_total_bruto", homeRealKey: "fouls_home", awayRealKey: "fouls_away" },
  { key: "saves_total",     name: "Defesas Goleiro",  rawKey: "xsaves_total_bruto", homeRealKey: "saves_home", awayRealKey: "saves_away" },
  { key: "total_shots",     name: "Chutes Totais",    rawKey: "xtotalshots_total_bruto", homeRealKey: "totalshots_home", awayRealKey: "totalshots_away" },
];

async function runOLSFitAndRecalibration() {
  console.log("Buscando partidas do Supabase para ajuste OLS...");
  const matches = await base44.entities.Match.list("-created_date", 500);
  const completed = matches.filter(m => m.status === "completed" || m.real_results);
  console.log(`Encontrados ${completed.length} jogos com resultado real.`);

  // 1. Fit OLS em cada mercado
  const fitted = {};
  for (const mObj of OLS_MARKETS_MAP) {
    const pares = [];
    for (const m of completed) {
      let homeStats = m.home_stats;
      let awayStats = m.away_stats;
      if (typeof m.home_text === "string" && m.home_text.trim().length > 10) {
        homeStats = parseStatsHubText(m.home_text);
      } else {
        homeStats = fixLegacyStats(m.home_stats);
      }
      if (typeof m.away_text === "string" && m.away_text.trim().length > 10) {
        awayStats = parseStatsHubText(m.away_text);
      } else {
        awayStats = fixLegacyStats(m.away_stats);
      }

      const res = analisarJogo(homeStats, awayStats);
      const rawVal = res.raw_totals?.[mObj.rawKey];

      const rr = m.real_results;
      const realH = rr?.[mObj.homeRealKey] ?? rr?.[`real_${mObj.homeRealKey}`];
      const realA = rr?.[mObj.awayRealKey] ?? rr?.[`real_${mObj.awayRealKey}`];

      if (rawVal !== undefined && realH !== undefined && realA !== undefined) {
        const realTotal = (Number(realH) || 0) + (Number(realA) || 0);
        pares.push([rawVal, realTotal]);
      }
    }

    const coef = fitOLS(pares);
    if (coef) {
      fitted[mObj.key] = coef;
    }
  }

  console.log(`\n======================================================`);
  console.log(`COEFICIENTES OLS CALCULADOS (y = intercept + slope * raw)`);
  console.log(`======================================================`);
  console.table(fitted);

  // 2. Aplica coeficientes no modelo
  setCalibrationCoefficients(fitted);

  // 3. Recalcula todos os jogos com a calibração OLS ativada
  console.log("\nRecalculando partidas com a camada de calibração OLS ativa...");
  let count = 0;
  for (const m of matches) {
    count++;
    let homeStats = m.home_stats;
    let awayStats = m.away_stats;

    if (typeof m.home_text === "string" && m.home_text.trim().length > 10) {
      homeStats = parseStatsHubText(m.home_text);
    } else {
      homeStats = fixLegacyStats(m.home_stats);
    }

    if (typeof m.away_text === "string" && m.away_text.trim().length > 10) {
      awayStats = parseStatsHubText(m.away_text);
    } else {
      awayStats = fixLegacyStats(m.away_stats);
    }

    const newResults = analisarJogo(homeStats, awayStats);

    await base44.entities.Match.update(m.id, {
      home_stats: homeStats,
      away_stats: awayStats,
      results: newResults,
    });
  }

  // 4. Relatório Pós-Calibração OLS
  const reloaded = await base44.entities.Match.list("-created_date", 500);
  const completedReloaded = reloaded.filter(m => m.status === "completed" || m.real_results);

  console.log(`\n======================================================`);
  console.log(`RELATÓRIO DE CALIBRAÇÃO PÓS-AJUSTE OLS (ENGINE V2.3)`);
  console.log(`Total de jogos finalizados com resultado real: ${completedReloaded.length}`);
  console.log(`======================================================\n`);

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

  const mercados = [
    { key: "Gols Total",        prev: m => m.results?.xg_total,          real: buildRealSum("goals_home", "goals_away") },
    { key: "Escanteios Total",  prev: m => m.results?.xc_total,          real: buildRealSum("corners_home", "corners_away") },
    { key: "Cartões Total",     prev: m => m.results?.xcard_total,       real: buildRealSum("cards_home", "cards_away") },
    { key: "Chutes no Gol",     prev: m => m.results?.xs_total,          real: buildRealSum("shots_home", "shots_away") },
    { key: "Faltas Total",      prev: m => m.results?.xfouls_total,      real: buildRealSum("fouls_home", "fouls_away") },
    { key: "Defesas Goleiro",   prev: m => m.results?.xsaves_total,      real: buildRealSum("saves_home", "saves_away") },
    { key: "Chutes Totais",     prev: m => m.results?.xtotalshots_total, real: buildRealSum("totalshots_home", "totalshots_away") },
  ];

  mercados.forEach(merc => {
    const dados = completedReloaded
      .map(m => ({ p: merc.prev(m), r: merc.real(m) }))
      .filter(d => d.p !== null && d.p !== undefined && d.r !== null && d.r !== undefined);

    if (dados.length === 0) {
      console.log(`${merc.key}: Sem dados suficientes`);
      return;
    }

    const n = dados.length;
    const mediaPrev = dados.reduce((s, d) => s + d.p, 0) / n;
    const mediaReal = dados.reduce((s, d) => s + d.r, 0) / n;
    const vies = mediaPrev - mediaReal;
    const mae = dados.reduce((s, d) => s + Math.abs(d.p - d.r), 0) / n;
    const rmse = Math.sqrt(dados.reduce((s, d) => s + Math.pow(d.p - d.r, 2), 0) / n);

    let acertos = 0;
    dados.forEach(d => {
      const linha = Math.floor(d.p) + 0.5;
      if ((d.p >= linha) === (d.r > linha)) acertos++;
    });
    const winRate = ((acertos / n) * 100).toFixed(1);

    console.log(`Mercado: ${merc.key.padEnd(20)} | Amostra: ${n} jogos`);
    console.log(`  Previsto Médio: ${mediaPrev.toFixed(2)} | Real Médio: ${mediaReal.toFixed(2)}`);
    console.log(`  Viés: ${vies > 0 ? "+" : ""}${vies.toFixed(2)} | MAE: ${mae.toFixed(2)} | RMSE: ${rmse.toFixed(2)} | Acerto: ${winRate}%\n`);
  });
}

runOLSFitAndRecalibration().catch(console.error);
