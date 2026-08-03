// ══════════════════════════════════════════════════════════════
// AJUSTE DE LIGA — calibra previsões com o padrão histórico
// do campeonato (dados do FootyStats via LeagueProfile).
//
// ARQUITETURA HÍBRIDA:
//   1. Ajusta o xValor pelo ratio liga/app
//   2. Para mercados com Over histórico no CSV, blenda
//      Poisson com a frequência real da liga (peso 30%)
//   3. Para mercados sem histórico, usa só o fator
// ══════════════════════════════════════════════════════════════

// Médias globais do app (recalcular manualmente a cada ~50 jogos)
// Representa a média de TODOS os jogos já analisados no app
export const APP_GLOBALS = {
  avg_goals:   2.69,
  avg_corners: 9.67,
  avg_cards:   2.94,
};

// Peso do histórico da liga na calibração de probabilidade
// 0.30 = 30% liga, 70% modelo (ajustar para 0.40 com 200+ jogos na liga)
const LEAGUE_WEIGHT = 0.30;

// ── Interpolação linear do histórico de Over da liga ──────────
// Recebe o map de linhas→pct e a linha solicitada
// Interpolando entre as linhas disponíveis
function interpolarOverLiga(overMap, linha) {
  const linhas = Object.keys(overMap).map(Number).sort((a, b) => a - b);
  if (linha <= linhas[0]) return overMap[linhas[0]] / 100;
  if (linha >= linhas[linhas.length - 1]) return overMap[linhas[linhas.length - 1]] / 100;
  for (let i = 0; i < linhas.length - 1; i++) {
    if (linha >= linhas[i] && linha <= linhas[i + 1]) {
      const t = (linha - linhas[i]) / (linhas[i + 1] - linhas[i]);
      return ((overMap[linhas[i]] * (1 - t)) + (overMap[linhas[i + 1]] * t)) / 100;
    }
  }
  return null;
}

// ── Fator multiplicador de xValor ─────────────────────────────
export function fatorLiga(avgLiga, avgApp) {
  if (!avgLiga || !avgApp || avgApp === 0) return 1.0;
  // Suavização logarítmica — mesmo padrão do SofaScore que usávamos
  // Limita o fator entre 0.80 e 1.20 para não distorcer demais
  const ratio = avgLiga / avgApp;
  const fator = 1 + 0.5 * Math.log(ratio);
  return Math.max(0.80, Math.min(1.20, fator));
}

// ── Calibração de probabilidade com histórico da liga ─────────
export function calibrarProb(probPoisson, overMapLiga, linha) {
  if (!overMapLiga) return probPoisson;
  const probLiga = interpolarOverLiga(overMapLiga, linha);
  if (probLiga === null) return probPoisson;
  return probPoisson * (1 - LEAGUE_WEIGHT) + probLiga * LEAGUE_WEIGHT;
}

// ── Monta os overMaps a partir do LeagueProfile ───────────────
export function buildOverMaps(lp) {
  if (!lp) return { goals: null, corners: null, cards: null };

  const goals = {};
  if (lp.over_05_goals_pct != null) goals[0.5]  = lp.over_05_goals_pct;
  if (lp.over_15_goals_pct != null) goals[1.5]  = lp.over_15_goals_pct;
  if (lp.over_25_goals_pct != null) goals[2.5]  = lp.over_25_goals_pct;
  if (lp.over_35_goals_pct != null) goals[3.5]  = lp.over_35_goals_pct;
  if (lp.over_45_goals_pct != null) goals[4.5]  = lp.over_45_goals_pct;
  if (lp.over_55_goals_pct != null) goals[5.5]  = lp.over_55_goals_pct;

  const corners = {};
  if (lp.over_65_corners_pct  != null) corners[6.5]  = lp.over_65_corners_pct;
  if (lp.over_75_corners_pct  != null) corners[7.5]  = lp.over_75_corners_pct;
  if (lp.over_85_corners_pct  != null) corners[8.5]  = lp.over_85_corners_pct;
  if (lp.over_95_corners_pct  != null) corners[9.5]  = lp.over_95_corners_pct;
  if (lp.over_105_corners_pct != null) corners[10.5] = lp.over_105_corners_pct;
  if (lp.over_115_corners_pct != null) corners[11.5] = lp.over_115_corners_pct;
  if (lp.over_125_corners_pct != null) corners[12.5] = lp.over_125_corners_pct;
  if (lp.over_135_corners_pct != null) corners[13.5] = lp.over_135_corners_pct;

  const cards = {};
  if (lp.over_05_cards_pct != null) cards[0.5] = lp.over_05_cards_pct;
  if (lp.over_15_cards_pct != null) cards[1.5] = lp.over_15_cards_pct;
  if (lp.over_25_cards_pct != null) cards[2.5] = lp.over_25_cards_pct;
  if (lp.over_35_cards_pct != null) cards[3.5] = lp.over_35_cards_pct;
  if (lp.over_45_cards_pct != null) cards[4.5] = lp.over_45_cards_pct;
  if (lp.over_55_cards_pct != null) cards[5.5] = lp.over_55_cards_pct;

  return {
    goals:   Object.keys(goals).length   > 0 ? goals   : null,
    corners: Object.keys(corners).length > 0 ? corners : null,
    cards:   Object.keys(cards).length   > 0 ? cards   : null,
  };
}

// ── BTTS ajustado pela liga ────────────────────────────────────
export function ajustarBTTS(pBtts, leagueProfile) {
  if (!leagueProfile?.btts_pct) return pBtts;
  const bttsLiga = leagueProfile.btts_pct / 100;
  return pBtts * (1 - LEAGUE_WEIGHT) + bttsLiga * LEAGUE_WEIGHT;
}