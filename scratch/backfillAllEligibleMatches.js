import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText, analisarJogo } from "../src/lib/predictionEngine.js";

async function backfillAll() {
  console.log("==========================================================================");
  console.log("EXECUÇÃO DE BACKFILL DO PARSER COMPLETO EM TODAS AS PARTIDAS DO SUPABASE");
  console.log("==========================================================================\n");

  const matches = await base44.entities.Match.list("-created_date", 500);
  console.log(`Total de partidas no Supabase: ${matches.length}`);

  let atualizadas = 0;
  let semTextoBruto = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const rawHome = m.home_stats?._raw_text || m.home_text;
    const rawAway = m.away_stats?._raw_text || m.away_text;

    const temRawH = typeof rawHome === "string" && rawHome.trim().length > 10;
    const temRawA = typeof rawAway === "string" && rawAway.trim().length > 10;

    if (temRawH && temRawA) {
      const cleanHomeStats = parseStatsHubText(rawHome);
      cleanHomeStats._raw_text = rawHome.trim();
      cleanHomeStats.dados_nao_verificados = false;

      const cleanAwayStats = parseStatsHubText(rawAway);
      cleanAwayStats._raw_text = rawAway.trim();
      cleanAwayStats.dados_nao_verificados = false;

      const newResults = analisarJogo(cleanHomeStats, cleanAwayStats);

      await base44.entities.Match.update(m.id, {
        home_stats: cleanHomeStats,
        away_stats: cleanAwayStats,
        results: newResults,
      });
      atualizadas++;
    } else {
      semTextoBruto++;
    }
  }

  console.log(`\n==========================================================================`);
  console.log(`RELATÓRIO DE BACKFILL:`);
  console.log(`  - Partidas com _raw_text enriquecidas com o novo parser: ${atualizadas}`);
  console.log(`  - Partidas sem _raw_text original no banco (legado sem texto): ${semTextoBruto}`);
  console.log(`==========================================================================\n`);
}

backfillAll().catch(console.error);
