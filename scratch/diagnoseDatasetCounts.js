import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText } from "../src/lib/predictionEngine.js";

async function diagnoseCounts() {
  console.log("==========================================================================");
  console.log("DIAGNÓSTICO DA BASE DE DADOS DO SUPABASE PARA EXPERIMENTOS ESTATÍSTICOS");
  console.log("==========================================================================\n");

  const matches = await base44.entities.Match.list("-created_date", 500);
  console.log(`1. Total de partidas registradas no banco: ${matches.length}`);

  let countTemRawHome = 0;
  let countTemRawBoth = 0;

  let countParsedHistHome = 0;
  let countParsedHistBoth = 0;

  let countMando5Home = 0;
  let countMando5Both = 0;

  for (const m of matches) {
    const rawHome = m.home_stats?._raw_text || m.home_text;
    const rawAway = m.away_stats?._raw_text || m.away_text;

    const temRawH = typeof rawHome === "string" && rawHome.trim().length > 10;
    const temRawA = typeof rawAway === "string" && rawAway.trim().length > 10;

    if (temRawH) countTemRawHome++;
    if (temRawH && temRawA) countTemRawBoth++;

    const hs = temRawH ? parseStatsHubText(rawHome) : null;
    const as = temRawA ? parseStatsHubText(rawAway) : null;

    const hasHistH = hs && hs.goals?.historico && hs.goals.historico.length >= 3;
    const hasHistA = as && as.goals?.historico && as.goals.historico.length >= 3;

    if (hasHistH) countParsedHistHome++;
    if (hasHistH && hasHistA) countParsedHistBoth++;

    // Verifica se tem 5+ jogos em casa e 5+ fora no cabeçalho/historico
    const hHomeGames = hs?._jogos_header?.filter(j => j.mando === "H")?.length || 0;
    const hAwayGames = hs?._jogos_header?.filter(j => j.mando === "A")?.length || 0;

    const aHomeGames = as?._jogos_header?.filter(j => j.mando === "H")?.length || 0;
    const aAwayGames = as?._jogos_header?.filter(j => j.mando === "A")?.length || 0;

    const has5MandoH = hHomeGames >= 3 && hAwayGames >= 3;
    const has5MandoA = aHomeGames >= 3 && aAwayGames >= 3;

    if (has5MandoH) countMando5Home++;
    if (has5MandoH && has5MandoA) countMando5Both++;
  }

  console.log(`\nCRITÉRIO A: _raw_text Salvo (Mandante apenas):  ${countTemRawHome}`);
  console.log(`CRITÉRIO A: _raw_text Salvo (Mandante E Visitante): ${countTemRawBoth}`);

  console.log(`\nCRITÉRIO B: Histórico Jogo-a-Jogo Extraído (Mandante apenas):  ${countParsedHistHome}`);
  console.log(`CRITÉRIO B: Histórico Jogo-a-Jogo Extraído (Mandante E Visitante): ${countParsedHistBoth}`);

  console.log(`\nCRITÉRIO C: Amostra Mando 3+ H e 3+ A (Mandante apenas):  ${countMando5Home}`);
  console.log(`CRITÉRIO C: Amostra Mando 3+ H e 3+ A (Mandante E Visitante): ${countMando5Both}`);
}

diagnoseCounts().catch(console.error);
