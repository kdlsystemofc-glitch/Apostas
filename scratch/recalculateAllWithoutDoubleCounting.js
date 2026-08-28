import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText, analisarJogo } from "../src/lib/predictionEngine.js";

async function recalculateAllMatches() {
  console.log("==========================================================================");
  console.log("RECÁLCULO DE TODAS AS 203 PARTIDAS SEM DUPLA CONTAGEM DE MANDO DE CAMPO");
  console.log("==========================================================================\n");

  const matches = await base44.entities.Match.list("-created_date", 500);
  console.log(`Total de partidas no Supabase: ${matches.length}`);

  let comRawText = 0;
  let semRawText = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const rawHome = m.home_stats?._raw_text || m.home_text;
    const rawAway = m.away_stats?._raw_text || m.away_text;

    const temRawH = typeof rawHome === "string" && rawHome.trim().length > 10;
    const temRawA = typeof rawAway === "string" && rawAway.trim().length > 10;

    let homeStats = m.home_stats || {};
    let awayStats = m.away_stats || {};

    if (temRawH && temRawA) {
      homeStats = parseStatsHubText(rawHome);
      homeStats._raw_text = rawHome.trim();
      homeStats.dados_nao_verificados = false;

      awayStats = parseStatsHubText(rawAway);
      awayStats._raw_text = rawAway.trim();
      awayStats.dados_nao_verificados = false;
      comRawText++;
    } else {
      semRawText++;
    }

    const newResults = analisarJogo(homeStats, awayStats);

    await base44.entities.Match.update(m.id, {
      home_stats: homeStats,
      away_stats: awayStats,
      results: newResults,
    });
  }

  console.log(`\n==========================================================================`);
  console.log(`RELATÓRIO DE RECÁLCULO GLOBAL:`);
  console.log(`  - Total de partidas recalculadas com sucesso: ${matches.length}`);
  console.log(`  - Partidas re-parseadas com _raw_text:        ${comRawText}`);
  console.log(`  - Partidas legadas recalculadas via JSON:     ${semRawText}`);
  console.log(`==========================================================================\n`);
}

recalculateAllMatches().catch(console.error);
