import { base44 } from "../src/api/base44Client.js";
import {
  parseStatsHubText,
  ancora,
  indice,
  resistencia,
  pesosDinamicos,
  calcCorners,
  calcGols,
  calcShotsOnTarget,
  calcCartoes,
  calcFaltas,
  calcSaves,
  calcTotalShots,
  calcResultado,
  melhorLinhaComercial,
  COMMERCIAL_LINES,
} from "../src/lib/predictionEngine.js";

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

// Pearson correlation helper
function pearsonR(arrX, arrY) {
  const n = arrX.length;
  if (n < 5) return 0;
  const meanX = arrX.reduce((s, x) => s + x, 0) / n;
  const meanY = arrY.reduce((s, y) => s + y, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = arrX[i] - meanX;
    const dy = arrY[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den !== 0 ? num / den : 0;
}

// R² helper
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

// Custom analisarJogo with configurable dampingFactor for ic
function analisarJogoComDamping(statsCasa, statsFora, dampingFactor = 1.0) {
  function applyDamping(icRaw) {
    return 1.0 + (icRaw - 1.0) * dampingFactor;
  }

  // Calc Corners with custom damping
  const baseC_home = ancora(g(statsCasa, "corners"), g(statsFora, "corners", "c"));
  const ioC_home = pesosDinamicos({
    shots_on_target:   [0.25, indice(g(statsCasa, "shots_on_target"),   g(statsFora, "shots_on_target",   "c"))],
    shots_in_box:      [0.25, indice(g(statsCasa, "shots_in_box"),      g(statsFora, "shots_in_box",      "c"))],
    crosses:           [0.20, indice(g(statsCasa, "crosses"),           g(statsFora, "crosses",           "c"))],
    touches_opp_box:   [0.15, indice(g(statsCasa, "touches_opp_box"),   g(statsFora, "touches_opp_box",   "c"))],
    big_chance_missed: [0.10, indice(g(statsCasa, "big_chance_missed"), g(statsFora, "big_chance_missed", "c"))],
    total_shots:       [0.05, indice(g(statsCasa, "total_shots"),       g(statsFora, "total_shots",       "c"))],
  });
  const idC_home = pesosDinamicos({
    clearances: [0.40, resistencia(g(statsFora, "clearances", "c"), g(statsCasa, "shots_in_box"))],
    shots_ced:  [0.35, resistencia(g(statsFora, "shots_on_target", "c"), g(statsCasa, "shots_on_target"))],
    gk_saves:   [0.25, resistencia(g(statsFora, "gk_saves", "t"), g(statsCasa, "shots_on_target"))],
  });
  const icRawC_home = 0.50 * ioC_home + 0.50 * idC_home;
  const icC_home = applyDamping(icRawC_home);
  const xc_casa = baseC_home * icC_home * 1.03;

  const baseC_away = ancora(g(statsFora, "corners"), g(statsCasa, "corners", "c"));
  const ioC_away = pesosDinamicos({
    shots_on_target:   [0.25, indice(g(statsFora, "shots_on_target"),   g(statsCasa, "shots_on_target",   "c"))],
    shots_in_box:      [0.25, indice(g(statsFora, "shots_in_box"),      g(statsCasa, "shots_in_box",      "c"))],
    crosses:           [0.20, indice(g(statsFora, "crosses"),           g(statsCasa, "crosses",           "c"))],
    touches_opp_box:   [0.15, indice(g(statsFora, "touches_opp_box"),   g(statsCasa, "touches_opp_box",   "c"))],
    big_chance_missed: [0.10, indice(g(statsFora, "big_chance_missed"), g(statsCasa, "big_chance_missed", "c"))],
    total_shots:       [0.05, indice(g(statsFora, "total_shots"),       g(statsCasa, "total_shots",       "c"))],
  });
  const idC_away = pesosDinamicos({
    clearances: [0.40, resistencia(g(statsCasa, "clearances", "c"), g(statsFora, "shots_in_box"))],
    shots_ced:  [0.35, resistencia(g(statsCasa, "shots_on_target", "c"), g(statsFora, "shots_on_target"))],
    gk_saves:   [0.25, resistencia(g(statsCasa, "gk_saves", "t"), g(statsFora, "shots_on_target"))],
  });
  const icRawC_away = 0.50 * ioC_away + 0.50 * idC_away;
  const icC_away = applyDamping(icRawC_away);
  const xc_fora = baseC_away * icC_away * 0.97;
  const xc_total = Math.round((xc_casa + xc_fora) * 100) / 100;

  // Calc Goals
  const baseG_home = ancora(g(statsCasa, "goals"), g(statsFora, "goals", "c"));
  const ioG_home = pesosDinamicos({
    xg:                 [0.25, indice(g(statsCasa, "xg"),                 g(statsFora, "xg",                 "c"))],
    shots_on_target:    [0.25, indice(g(statsCasa, "shots_on_target"),    g(statsFora, "shots_on_target",    "c"))],
    big_chance_scored:  [0.20, indice(g(statsCasa, "big_chance_scored"),  g(statsFora, "big_chance_scored",  "c"))],
    shots_in_box:       [0.15, indice(g(statsCasa, "shots_in_box"),       g(statsFora, "shots_in_box",       "c"))],
    touches_opp_box:    [0.15, indice(g(statsCasa, "touches_opp_box"),    g(statsFora, "touches_opp_box",    "c"))],
  });
  const idG_home = pesosDinamicos({
    shots_ced:  [0.45, resistencia(g(statsFora, "shots_on_target", "c"), g(statsCasa, "shots_on_target"))],
    clearances: [0.25, resistencia(g(statsFora, "clearances", "c"), g(statsCasa, "shots_in_box"))],
    errors:     [0.20, indice(g(statsCasa, "errors_goal"), Math.max(g(statsFora, "errors_goal", "c"), 0.01))],
    gk_saves:   [0.10, resistencia(g(statsFora, "gk_saves", "t"), g(statsCasa, "shots_on_target"))],
  });
  const icRawG_home = 0.50 * ioG_home + 0.50 * idG_home;
  const xg_casa = baseG_home * applyDamping(icRawG_home) * 1.03;

  const baseG_away = ancora(g(statsFora, "goals"), g(statsCasa, "goals", "c"));
  const ioG_away = pesosDinamicos({
    xg:                 [0.25, indice(g(statsFora, "xg"),                 g(statsCasa, "xg",                 "c"))],
    shots_on_target:    [0.25, indice(g(statsFora, "shots_on_target"),    g(statsCasa, "shots_on_target",    "c"))],
    big_chance_scored:  [0.20, indice(g(statsFora, "big_chance_scored"),  g(statsCasa, "big_chance_scored",  "c"))],
    shots_in_box:       [0.15, indice(g(statsFora, "shots_in_box"),       g(statsCasa, "shots_in_box",       "c"))],
    touches_opp_box:    [0.15, indice(g(statsFora, "touches_opp_box"),    g(statsCasa, "touches_opp_box",    "c"))],
  });
  const idG_away = pesosDinamicos({
    shots_ced:  [0.45, resistencia(g(statsCasa, "shots_on_target", "c"), g(statsFora, "shots_on_target"))],
    clearances: [0.25, resistencia(g(statsCasa, "clearances", "c"), g(statsFora, "shots_in_box"))],
    errors:     [0.20, indice(g(statsFora, "errors_goal"), Math.max(g(statsCasa, "errors_goal", "c"), 0.01))],
    gk_saves:   [0.10, resistencia(g(statsCasa, "gk_saves", "t"), g(statsFora, "shots_on_target"))],
  });
  const icRawG_away = 0.50 * ioG_away + 0.50 * idG_away;
  const xg_fora = baseG_away * applyDamping(icRawG_away) * 0.97;
  const xg_total = Math.round((xg_casa + xg_fora) * 100) / 100;

  // Calc Shots on Target
  const baseS_home = ancora(g(statsCasa, "shots_on_target"), g(statsFora, "shots_on_target", "c"));
  const icS_home = applyDamping(0.50 * pesosDinamicos({
    shots_in_box:       [0.40, indice(g(statsCasa, "shots_in_box"),       g(statsFora, "shots_in_box",       "c"))],
    big_chance_created: [0.25, indice(g(statsCasa, "big_chance_created"), g(statsFora, "big_chance_created", "c"))],
    total_shots:        [0.20, indice(g(statsCasa, "total_shots"),        g(statsFora, "total_shots",        "c"))],
    touches_opp_box:    [0.15, indice(g(statsCasa, "touches_opp_box"),    g(statsFora, "touches_opp_box",    "c"))],
  }) + 0.50 * pesosDinamicos({
    shots_ced:  [0.60, resistencia(g(statsFora, "shots_on_target", "c"), g(statsCasa, "shots_on_target"))],
    clearances: [0.40, resistencia(g(statsFora, "clearances", "c"), g(statsCasa, "shots_in_box"))],
  }));
  const xs_casa = baseS_home * icS_home * 1.02;

  const baseS_away = ancora(g(statsFora, "shots_on_target"), g(statsCasa, "shots_on_target", "c"));
  const icS_away = applyDamping(0.50 * pesosDinamicos({
    shots_in_box:       [0.40, indice(g(statsFora, "shots_in_box"),       g(statsCasa, "shots_in_box",       "c"))],
    big_chance_created: [0.25, indice(g(statsFora, "big_chance_created"), g(statsCasa, "big_chance_created", "c"))],
    total_shots:        [0.20, indice(g(statsFora, "total_shots"),        g(statsCasa, "total_shots",        "c"))],
    touches_opp_box:    [0.15, indice(g(statsFora, "touches_opp_box"),    g(statsCasa, "touches_opp_box",    "c"))],
  }) + 0.50 * pesosDinamicos({
    shots_ced:  [0.60, resistencia(g(statsCasa, "shots_on_target", "c"), g(statsFora, "shots_on_target"))],
    clearances: [0.40, resistencia(g(statsCasa, "clearances", "c"), g(statsFora, "shots_in_box"))],
  }));
  const xs_fora = baseS_away * icS_away * 0.98;
  const xs_total = Math.round((xs_casa + xs_fora) * 100) / 100;

  // Calc Cards
  const baseCard_home = ancora(g(statsCasa, "cards"), g(statsFora, "cards", "c")) * 0.85 + Math.max(g(statsCasa, "cards"), g(statsFora, "cards", "c")) * 0.15;
  const icCard_home = applyDamping(pesosDinamicos({
    yellow_hist:   [0.35, indice(g(statsCasa, "yellow_cards"), Math.max(g(statsFora, "yellow_cards", "c"), 0.01))],
    fouls:         [0.30, indice(g(statsCasa, "fouls"),         g(statsFora, "fouls",           "c"))],
    tackles:       [0.20, indice(g(statsCasa, "tackles"),       g(statsFora, "tackles",         "c"))],
    interceptions: [0.15, indice(g(statsCasa, "interceptions"), g(statsFora, "interceptions",   "c"))],
  }));
  const xcard_casa = baseCard_home * icCard_home * 0.97;

  const baseCard_away = ancora(g(statsFora, "cards"), g(statsCasa, "cards", "c")) * 0.85 + Math.max(g(statsFora, "cards"), g(statsCasa, "cards", "c")) * 0.15;
  const icCard_away = applyDamping(pesosDinamicos({
    yellow_hist:   [0.35, indice(g(statsFora, "yellow_cards"), Math.max(g(statsCasa, "yellow_cards", "c"), 0.01))],
    fouls:         [0.30, indice(g(statsFora, "fouls"),         g(statsCasa, "fouls",           "c"))],
    tackles:       [0.20, indice(g(statsFora, "tackles"),       g(statsCasa, "tackles",         "c"))],
    interceptions: [0.15, indice(g(statsFora, "interceptions"), g(statsCasa, "interceptions",   "c"))],
  }));
  const xcard_fora = baseCard_away * icCard_away;
  const xcard_total = Math.round((xcard_casa + xcard_fora) * 100) / 100;

  // Calc Fouls
  const baseFouls_home = ancora(g(statsCasa, "fouls"), g(statsFora, "fouls", "c"));
  const icFouls_home = applyDamping(pesosDinamicos({
    fouls:         [0.40, indice(g(statsCasa, "fouls"),         g(statsFora, "fouls",         "c"))],
    tackles:       [0.30, indice(g(statsCasa, "tackles"),       g(statsFora, "tackles",       "c"))],
    interceptions: [0.20, indice(g(statsCasa, "interceptions"), g(statsFora, "interceptions", "c"))],
    dispossessed:  [0.10, indice(g(statsCasa, "dispossessed"),  g(statsFora, "dispossessed",  "c"))],
  }));
  const xfouls_casa = baseFouls_home * icFouls_home;

  const baseFouls_away = ancora(g(statsFora, "fouls"), g(statsCasa, "fouls", "c"));
  const icFouls_away = applyDamping(pesosDinamicos({
    fouls:         [0.40, indice(g(statsFora, "fouls"),         g(statsCasa, "fouls",         "c"))],
    tackles:       [0.30, indice(g(statsFora, "tackles"),       g(statsCasa, "tackles",       "c"))],
    interceptions: [0.20, indice(g(statsFora, "interceptions"), g(statsCasa, "interceptions", "c"))],
    dispossessed:  [0.10, indice(g(statsFora, "dispossessed"),  g(statsCasa, "dispossessed",  "c"))],
  }));
  const xfouls_fora = baseFouls_away * icFouls_away;
  const xfouls_total = Math.round((xfouls_casa + xfouls_fora) * 100) / 100;

  // Calc Saves
  const baseSaves_home = ancora(g(statsFora, "gk_saves", "t"), g(statsCasa, "shots_on_target", "c"));
  const icSaves_home = applyDamping(pesosDinamicos({
    shots_on_target: [0.45, indice(g(statsCasa, "shots_on_target"), g(statsFora, "shots_on_target", "c"))],
    shots_in_box:    [0.25, indice(g(statsCasa, "shots_in_box"),    g(statsFora, "shots_in_box",    "c"))],
    big_chance:      [0.15, indice(g(statsCasa, "big_chance_created"), g(statsFora, "big_chance_created", "c"))],
    total_shots:     [0.15, indice(g(statsCasa, "total_shots"),     g(statsFora, "total_shots",     "c"))],
  }));
  const xsaves_casa = baseSaves_home * icSaves_home;

  const baseSaves_away = ancora(g(statsCasa, "gk_saves", "t"), g(statsFora, "shots_on_target", "c"));
  const icSaves_away = applyDamping(pesosDinamicos({
    shots_on_target: [0.45, indice(g(statsFora, "shots_on_target"), g(statsCasa, "shots_on_target", "c"))],
    shots_in_box:    [0.25, indice(g(statsFora, "shots_in_box"),    g(statsCasa, "shots_in_box",    "c"))],
    big_chance:      [0.15, indice(g(statsFora, "big_chance_created"), g(statsCasa, "big_chance_created", "c"))],
    total_shots:     [0.15, indice(g(statsFora, "total_shots"),     g(statsCasa, "total_shots",     "c"))],
  }));
  const xsaves_fora = baseSaves_away * icSaves_away;
  const xsaves_total = Math.round((xsaves_casa + xsaves_fora) * 100) / 100;

  // Calc Total Shots
  const baseTS_home = ancora(g(statsCasa, "total_shots"), g(statsFora, "total_shots", "c"));
  const icTS_home = applyDamping(pesosDinamicos({
    total_shots:     [0.40, indice(g(statsCasa, "total_shots"),     g(statsFora, "total_shots",     "c"))],
    shots_in_box:    [0.25, indice(g(statsCasa, "shots_in_box"),    g(statsFora, "shots_in_box",    "c"))],
    touches_opp_box: [0.20, indice(g(statsCasa, "touches_opp_box"), g(statsFora, "touches_opp_box", "c"))],
    big_chance:      [0.15, indice(g(statsCasa, "big_chance_created"), g(statsFora, "big_chance_created", "c"))],
  }));
  const xtotalshots_casa = baseTS_home * icTS_home * 1.02;

  const baseTS_away = ancora(g(statsFora, "total_shots"), g(statsCasa, "total_shots", "c"));
  const icTS_away = applyDamping(pesosDinamicos({
    total_shots:     [0.40, indice(g(statsFora, "total_shots"),     g(statsCasa, "total_shots",     "c"))],
    shots_in_box:    [0.25, indice(g(statsFora, "shots_in_box"),    g(statsCasa, "shots_in_box",    "c"))],
    touches_opp_box: [0.20, indice(g(statsFora, "touches_opp_box"), g(statsCasa, "touches_opp_box", "c"))],
    big_chance:      [0.15, indice(g(statsFora, "big_chance_created"), g(statsCasa, "big_chance_created", "c"))],
  }));
  const xtotalshots_fora = baseTS_away * icTS_away * 0.98;
  const xtotalshots_total = Math.round((xtotalshots_casa + xtotalshots_fora) * 100) / 100;

  return {
    xg_total,
    xc_total,
    xs_total,
    xcard_total,
    xfouls_total,
    xsaves_total,
    xtotalshots_total,
    icRawC_home,
    icC_home,
  };
}

async function runDiagnosis() {
  console.log("Buscando partidas históricas do Supabase...");
  const matches = await base44.entities.Match.list("-created_date", 500);
  const completed = matches.filter(m => m.status === "completed" || m.real_results);
  console.log(`Carregadas ${completed.length} partidas finalizadas.\n`);

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

  // ═══════════════════════════════════════════════════════════
  // PASSO 2 — DIAGNÓSTICO DE icRaw vs ic AMORTECIDO (0.40)
  // ═══════════════════════════════════════════════════════════
  console.log("======================================================");
  console.log("PASSO 2 — DIAGNÓSTICO DE icRaw vs ic AMORTECIDO (ESCANTEIOS)");
  console.log("======================================================");

  const icRawList = [];
  const icDampedList = [];
  const predRawList = [];
  const predDampedList = [];
  const realCornersList = [];

  for (const m of completed) {
    let homeStats = fixLegacyStats(m.home_stats);
    let awayStats = fixLegacyStats(m.away_stats);
    if (typeof m.home_text === "string" && m.home_text.trim().length > 10) {
      homeStats = parseStatsHubText(m.home_text);
    }
    if (typeof m.away_text === "string" && m.away_text.trim().length > 10) {
      awayStats = parseStatsHubText(m.away_text);
    }

    const realCorners = buildRealSum("corners_home", "corners_away")(m);
    if (realCorners === null) continue;

    const resRaw = analisarJogoComDamping(homeStats, awayStats, 1.0); // sem amortecimento
    const resDamped = analisarJogoComDamping(homeStats, awayStats, 0.40); // com amortecimento (40% sinal)

    icRawList.push(resRaw.icRawC_home);
    icDampedList.push(resDamped.icC_home);
    predRawList.push(resRaw.xc_total);
    predDampedList.push(resDamped.xc_total);
    realCornersList.push(realCorners);
  }

  const n = icRawList.length;
  const meanRaw = icRawList.reduce((s, x) => s + x, 0) / n;
  const meanDamped = icDampedList.reduce((s, x) => s + x, 0) / n;

  const varRaw = icRawList.reduce((s, x) => s + (x - meanRaw) ** 2, 0) / n;
  const varDamped = icDampedList.reduce((s, x) => s + (x - meanDamped) ** 2, 0) / n;

  const stdRaw = Math.sqrt(varRaw);
  const stdDamped = Math.sqrt(varDamped);

  const r2Raw = calculateR2(predRawList, realCornersList);
  const r2Damped = calculateR2(predDampedList, realCornersList);

  console.log(`Amostra: ${n} jogos`);
  console.log(`Média icRaw: ${meanRaw.toFixed(4)} | Variância: ${varRaw.toFixed(5)} | Desvio Padrão: ${stdRaw.toFixed(4)}`);
  console.log(`Média icDamped (0.40): ${meanDamped.toFixed(4)} | Variância: ${varDamped.toFixed(5)} | Desvio Padrão: ${stdDamped.toFixed(4)}`);
  console.log(`R² de Escanteios Sem Amortecimento (icRaw, 100% sinal): ${r2Raw.toFixed(4)}`);
  console.log(`R² de Escanteios Com Amortecimento (icDamped, 40% sinal): ${r2Damped.toFixed(4)}\n`);

  // ═══════════════════════════════════════════════════════════
  // PASSO 3 — BACKTEST COMPLETO DAS 4 VARIAÇÕES DE AMORTECIMENTO
  // ═══════════════════════════════════════════════════════════
  console.log("======================================================");
  console.log("PASSO 3 — COMPARAÇÃO DAS 4 VARIAÇÕES DE AMORTECIMENTO");
  console.log("======================================================\n");

  const dampingLevels = [
    { label: "100% Sinal (0% Amortecimento)", factor: 1.0 },
    { label: "75% Sinal (25% Amortecimento)", factor: 0.75 },
    { label: "50% Sinal (50% Amortecimento)", factor: 0.50 },
    { label: "40% Sinal (60% Amortecimento - Atual)", factor: 0.40 },
  ];

  const mercadoDefs = [
    { key: "goals_total",     label: "Gols Total",       predKey: "xg_total",          realFn: buildRealSum("goals_home", "goals_away") },
    { key: "corners_total",   label: "Escanteios Total", predKey: "xc_total",          realFn: buildRealSum("corners_home", "corners_away") },
    { key: "cards_total",     label: "Cartões Total",    predKey: "xcard_total",       realFn: buildRealSum("cards_home", "cards_away") },
    { key: "shots_on_target", label: "Chutes no Gol",    predKey: "xs_total",          realFn: buildRealSum("shots_home", "shots_away") },
    { key: "fouls_total",     label: "Faltas Total",     predKey: "xfouls_total",      realFn: buildRealSum("fouls_home", "fouls_away") },
    { key: "saves_total",     label: "Defesas Goleiro",  predKey: "xsaves_total",      realFn: buildRealSum("saves_home", "saves_away") },
    { key: "total_shots",     label: "Chutes Totais",    predKey: "xtotalshots_total", realFn: buildRealSum("totalshots_home", "totalshots_away") },
  ];

  for (const level of dampingLevels) {
    console.log(`------------------------------------------------------`);
    console.log(`VARIAÇÃO: ${level.label} (dampingFactor = ${level.factor})`);
    console.log(`------------------------------------------------------`);

    mercadoDefs.forEach(mDef => {
      const preds = [];
      const reals = [];

      for (const m of completed) {
        let homeStats = fixLegacyStats(m.home_stats);
        let awayStats = fixLegacyStats(m.away_stats);
        if (typeof m.home_text === "string" && m.home_text.trim().length > 10) {
          homeStats = parseStatsHubText(m.home_text);
        }
        if (typeof m.away_text === "string" && m.away_text.trim().length > 10) {
          awayStats = parseStatsHubText(m.away_text);
        }

        const realVal = mDef.realFn(m);
        if (realVal === null) continue;

        const res = analisarJogoComDamping(homeStats, awayStats, level.factor);
        const predVal = res[mDef.predKey];

        preds.push(predVal);
        reals.push(realVal);
      }

      const sampleSize = preds.length;
      if (sampleSize === 0) return;

      const mediaPrev = preds.reduce((s, x) => s + x, 0) / sampleSize;
      const mediaReal = reals.reduce((s, y) => s + y, 0) / sampleSize;
      const vies = mediaPrev - mediaReal;
      const mae = preds.reduce((s, x, i) => s + Math.abs(x - reals[i]), 0) / sampleSize;
      const rmse = Math.sqrt(preds.reduce((s, x, i) => s + (x - reals[i]) ** 2, 0) / sampleSize);
      const r2 = calculateR2(preds, reals);

      let acertos = 0;
      for (let i = 0; i < sampleSize; i++) {
        const linha = Math.floor(preds[i]) + 0.5;
        if ((preds[i] >= linha) === (reals[i] > linha)) acertos++;
      }
      const winRate = ((acertos / sampleSize) * 100).toFixed(1);

      console.log(`  Mercado: ${mDef.label.padEnd(18)} | Prev: ${mediaPrev.toFixed(2)} | Real: ${mediaReal.toFixed(2)} | Viés: ${vies > 0 ? "+" : ""}${vies.toFixed(2)} | MAE: ${mae.toFixed(2)} | RMSE: ${rmse.toFixed(2)} | R²: ${r2.toFixed(3)} | Acerto: ${winRate}%`);
    });
    console.log("");
  }

  // ═══════════════════════════════════════════════════════════
  // PASSO 4 — ANÁLISE DE CORRELAÇÃO DE PEARSON POR FATOR INDIVIDUAL
  // ═══════════════════════════════════════════════════════════
  console.log("======================================================");
  console.log("PASSO 4 — CORRELAÇÃO DE PEARSON POR FATOR INDIVIDUAL (156 JOGOS)");
  console.log("======================================================\n");

  const problemMarkets = [
    {
      key: "corners_total",
      label: "ESCANTEIOS TOTAL",
      realFn: buildRealSum("corners_home", "corners_away"),
      factors: ["shots_on_target", "shots_in_box", "crosses", "touches_opp_box", "big_chance_missed", "total_shots", "clearances", "gk_saves"],
    },
    {
      key: "shots_on_target",
      label: "CHUTES NO GOL TOTAL",
      realFn: buildRealSum("shots_home", "shots_away"),
      factors: ["shots_on_target", "shots_in_box", "big_chance_created", "total_shots", "touches_opp_box", "clearances"],
    },
    {
      key: "fouls_total",
      label: "FALTAS TOTAL",
      realFn: buildRealSum("fouls_home", "fouls_away"),
      factors: ["fouls", "tackles", "interceptions", "dispossessed", "yellow_cards"],
    },
    {
      key: "total_shots",
      label: "CHUTES TOTAIS",
      realFn: buildRealSum("totalshots_home", "totalshots_away"),
      factors: ["total_shots", "shots_in_box", "touches_opp_box", "big_chance_created", "shots_on_target"],
    },
  ];

  for (const pM of problemMarkets) {
    console.log(`Mercado: ${pM.label}`);
    const tableData = [];

    for (const factorKey of pM.factors) {
      const arrHomeT = [];
      const arrHomeC = [];
      const arrAwayT = [];
      const arrSumT = [];
      const arrReal = [];

      for (const m of completed) {
        let homeStats = fixLegacyStats(m.home_stats);
        let awayStats = fixLegacyStats(m.away_stats);
        if (typeof m.home_text === "string" && m.home_text.trim().length > 10) {
          homeStats = parseStatsHubText(m.home_text);
        }
        if (typeof m.away_text === "string" && m.away_text.trim().length > 10) {
          awayStats = parseStatsHubText(m.away_text);
        }

        const realVal = pM.realFn(m);
        if (realVal === null) continue;

        const hT = g(homeStats, factorKey, "t");
        const hC = g(homeStats, factorKey, "c");
        const aT = g(awayStats, factorKey, "t");

        arrHomeT.push(hT);
        arrHomeC.push(hC);
        arrAwayT.push(aT);
        arrSumT.push(hT + aT);
        arrReal.push(realVal);
      }

      const rHomeT = pearsonR(arrHomeT, arrReal);
      const rHomeC = pearsonR(arrHomeC, arrReal);
      const rSumT = pearsonR(arrSumT, arrReal);

      tableData.push({
        fator: factorKey,
        r_home_faz: Math.round(rHomeT * 1000) / 1000,
        r_home_cede: Math.round(rHomeC * 1000) / 1000,
        r_soma_ambos: Math.round(rSumT * 1000) / 1000,
        avaliacao: Math.abs(rSumT) >= 0.25 ? "🔥 Forte Correlação" : Math.abs(rSumT) >= 0.10 ? "✓ Moderada" : "❌ Fraca / Ruído",
      });
    }

    console.table(tableData);
    console.log("");
  }
}

runDiagnosis().catch(console.error);
