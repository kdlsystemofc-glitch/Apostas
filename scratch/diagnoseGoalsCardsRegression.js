import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText, ancora, pesosDinamicos, indice, resistencia } from "../src/lib/predictionEngine.js";

function g(stats, key, campo = "t") {
  return stats?.[key]?.[campo] || 0.0;
}

function calcGolsPuro(atk, def_) {
  const base = ancora(g(atk, "goals"), g(def_, "goals", "c"));
  const ofensivos = {
    xg:                 [0.25, indice(g(atk, "xg"),                 g(def_, "xg",                 "c"))],
    shots_on_target:    [0.25, indice(g(atk, "shots_on_target"),    g(def_, "shots_on_target",    "c"))],
    big_chance_scored:  [0.20, indice(g(atk, "big_chance_scored"),  g(def_, "big_chance_scored",  "c"))],
    shots_in_box:       [0.15, indice(g(atk, "shots_in_box"),       g(def_, "shots_in_box",       "c"))],
    touches_opp_box:    [0.15, indice(g(atk, "touches_opp_box"),    g(def_, "touches_opp_box",    "c"))],
  };
  const defensivos = {
    shots_ced:  [0.45, resistencia(g(def_, "shots_on_target", "c"), g(atk, "shots_on_target"))],
    clearances: [0.25, resistencia(g(def_, "clearances", "c"), g(atk, "shots_in_box"))],
    errors:     [0.20, indice(g(atk, "errors_goal"), Math.max(g(def_, "errors_goal", "c"), 0.01))],
    gk_saves:   [0.10, resistencia(g(def_, "gk_saves", "t"), g(atk, "shots_on_target"))],
  };
  const io = pesosDinamicos(ofensivos);
  const id_ = pesosDinamicos(defensivos);
  const ic = 0.50 * io + 0.50 * id_;
  return { base, ic, raw: base * ic };
}

function calcCartoesPuro(atk, def_) {
  const baseMedia = ancora(g(atk, "cards"), g(def_, "cards", "c"));
  const baseMax = Math.max(g(atk, "cards"), g(def_, "cards", "c"));
  const base = baseMedia * 0.85 + baseMax * 0.15;
  const fatores = {
    yellow_hist:   [0.35, indice(g(atk, "yellow_cards"), Math.max(g(def_, "yellow_cards", "c"), 0.01))],
    fouls:         [0.30, indice(g(atk, "fouls"),         g(def_, "fouls",           "c"))],
    tackles:       [0.20, indice(g(atk, "tackles"),       g(def_, "tackles",         "c"))],
    interceptions: [0.15, indice(g(atk, "interceptions"), g(def_, "interceptions",   "c"))],
  };
  const ic = pesosDinamicos(fatores);
  return { base, ic, raw: base * ic };
}

async function diagnose() {
  const matches = await base44.entities.Match.list("-created_date", 500);
  const completed = matches.filter(m => m.status === "completed" || m.real_results);
  const sorted = [...completed].sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));

  const trainSize = Math.floor(sorted.length * 0.80);
  const testSet = sorted.slice(trainSize);

  console.log("==========================================================================");
  console.log(`DIAGNÓSTICO DA REGRESSÃO DE GOLS E CARTÕES (N_TESTE = ${testSet.length} PARTIDAS)`);
  console.log("==========================================================================\n");

  const diffGols = [];
  const diffCartoes = [];

  for (let i = 0; i < testSet.length; i++) {
    const m = testSet[i];
    const hs = m.home_stats || {};
    const as = m.away_stats || {};

    const realGolsHome = m.real_results?.goals_home ?? m.real_goals_home ?? 0;
    const realGolsAway = m.real_results?.goals_away ?? m.real_goals_away ?? 0;
    const realGolsTotal = realGolsHome + realGolsAway;

    const realCardsHome = m.real_results?.cards_home ?? m.real_cards_home ?? 0;
    const realCardsAway = m.real_results?.cards_away ?? m.real_cards_away ?? 0;
    const realCardsTotal = realCardsHome + realCardsAway;

    // Gols Puros (Sem multiplicadores)
    const gHomePuro = calcGolsPuro(hs, as);
    const gAwayPuro = calcGolsPuro(as, hs);
    const xgPuroTotal = gHomePuro.raw + gAwayPuro.raw;

    // Gols com Multiplicadores Antigos (x1.03 / x0.97)
    const xgAntigoTotal = (gHomePuro.raw * 1.03) + (gAwayPuro.raw * 0.97);

    // Gols com Multiplicadores Teoricos Antigos (x1.08 / x0.92)
    const xgTeoricoTotal = (gHomePuro.raw * 1.08) + (gAwayPuro.raw * 0.92);

    // Cartoes Puros
    const cHomePuro = calcCartoesPuro(hs, as);
    const cAwayPuro = calcCartoesPuro(as, hs);
    const xcPuroTotal = cHomePuro.raw + cAwayPuro.raw;
    const xcAntigoTotal = (cHomePuro.raw * 0.97) + cAwayPuro.raw;

    diffGols.push({
      jogo: `${m.home_team} vs ${m.away_team}`,
      real: realGolsTotal,
      ancoraBaseTotal: (gHomePuro.base + gAwayPuro.base).toFixed(2),
      prevPura: xgPuroTotal.toFixed(2),
      prevMult103: xgAntigoTotal.toFixed(2),
      prevMult108: xgTeoricoTotal.toFixed(2),
      errPuro: Math.abs(xgPuroTotal - realGolsTotal).toFixed(2),
      errMult103: Math.abs(xgAntigoTotal - realGolsTotal).toFixed(2),
      errMult108: Math.abs(xgTeoricoTotal - realGolsTotal).toFixed(2),
    });

    diffCartoes.push({
      jogo: `${m.home_team} vs ${m.away_team}`,
      real: realCardsTotal,
      ancoraBaseTotal: (cHomePuro.base + cAwayPuro.base).toFixed(2),
      prevPura: xcPuroTotal.toFixed(2),
      prevMultAntigo: xcAntigoTotal.toFixed(2),
      errPuro: Math.abs(xcPuroTotal - realCardsTotal).toFixed(2),
      errMultAntigo: Math.abs(xcAntigoTotal - realCardsTotal).toFixed(2),
    });
  }

  // Medias Agregadas do Teste
  const avgRealGols = diffGols.reduce((s, d) => s + d.real, 0) / testSet.length;
  const avgAncoraGols = diffGols.reduce((s, d) => s + Number(d.ancoraBaseTotal), 0) / testSet.length;
  const avgPuraGols = diffGols.reduce((s, d) => s + Number(d.prevPura), 0) / testSet.length;
  const avg103Gols = diffGols.reduce((s, d) => s + Number(d.prevMult103), 0) / testSet.length;
  const avg108Gols = diffGols.reduce((s, d) => s + Number(d.prevMult108), 0) / testSet.length;

  const avgRealCards = diffCartoes.reduce((s, d) => s + d.real, 0) / testSet.length;
  const avgAncoraCards = diffCartoes.reduce((s, d) => s + Number(d.ancoraBaseTotal), 0) / testSet.length;
  const avgPuraCards = diffCartoes.reduce((s, d) => s + Number(d.prevPura), 0) / testSet.length;
  const avgAntigoCards = diffCartoes.reduce((s, d) => s + Number(d.prevMultAntigo), 0) / testSet.length;

  console.log("--- 1. ANÁLISE COMPARATIVA DE GOLS TOTAL (N = 41 TESTE) ---");
  console.log(`Média Real de Gols:                  ${avgRealGols.toFixed(2)}`);
  console.log(`Média da Âncora Base (Sem Ajuste):    ${avgAncoraGols.toFixed(2)} (Viés: ${(avgAncoraGols - avgRealGols).toFixed(2)})`);
  console.log(`Média Prevista Pura (Com IC/ID):     ${avgPuraGols.toFixed(2)} (Viés: ${(avgPuraGols - avgRealGols).toFixed(2)})`);
  console.log(`Média Prevista com x1.03/x0.97:       ${avg103Gols.toFixed(2)} (Viés: ${(avg103Gols - avgRealGols).toFixed(2)})`);
  console.log(`Média Prevista com x1.08/x0.92:       ${avg108Gols.toFixed(2)} (Viés: ${(avg108Gols - avgRealGols).toFixed(2)})\n`);

  console.log("--- 2. ANÁLISE COMPARATIVA DE CARTÕES TOTAL (N = 41 TESTE) ---");
  console.log(`Média Real de Cartões:               ${avgRealCards.toFixed(2)}`);
  console.log(`Média da Âncora Base (Sem Ajuste):    ${avgAncoraCards.toFixed(2)} (Viés: ${(avgAncoraCards - avgRealCards).toFixed(2)})`);
  console.log(`Média Prevista Pura (Com IC/ID):     ${avgPuraCards.toFixed(2)} (Viés: ${(avgPuraCards - avgRealCards).toFixed(2)})`);
  console.log(`Média Prevista com x0.97 Mandante:   ${avgAntigoCards.toFixed(2)} (Viés: ${(avgAntigoCards - avgRealCards).toFixed(2)})\n`);

  // Análise de Subestimativa da Âncora em Cartões e Gols
  console.log("--- 3. VERIFICAÇÃO DE SUBESTIMATIVA DA ÂNCORA PURA ---");
  console.log(`Subestimativa Sistemática em Gols:    ${(avgRealGols - avgPuraGols).toFixed(2)} gols por jogo`);
  console.log(`Subestimativa Sistemática em Cartões: ${avgRealCards - avgPuraCards > 0 ? "SIM (" + (avgRealCards - avgPuraCards).toFixed(2) + " cartões abaixo do real)" : "NÃO"}`);
}

diagnose().catch(console.error);
