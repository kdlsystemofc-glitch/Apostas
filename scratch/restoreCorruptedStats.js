import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText, analisarJogo } from "../src/lib/predictionEngine.js";

async function restoreAllMatches() {
  console.log("======================================================");
  console.log("RESTAURAÇÃO E LIMPEZA DE DADOS CORROMPIDOS NO SUPABASE");
  console.log("======================================================");

  const matches = await base44.entities.Match.list("-created_date", 500);
  console.log(`Total de partidas encontradas no Supabase: ${matches.length}`);

  let restaurados = 0;
  let mantidosOk = 0;
  let marcadosNaoVerificados = 0;

  for (const m of matches) {
    const rawHome = m.home_stats?._raw_text || m.home_text;
    const rawAway = m.away_stats?._raw_text || m.away_text;

    const temTextoHome = typeof rawHome === "string" && rawHome.trim().length > 10;
    const temTextoAway = typeof rawAway === "string" && rawAway.trim().length > 10;

    if (temTextoHome && temTextoAway) {
      // Re-parseia diretamente do texto original colado pelo usuário (fonte da verdade)
      const cleanHomeStats = parseStatsHubText(rawHome);
      cleanHomeStats._raw_text = rawHome.trim();
      cleanHomeStats.dados_nao_verificados = false;

      const cleanAwayStats = parseStatsHubText(rawAway);
      cleanAwayStats._raw_text = rawAway.trim();
      cleanAwayStats.dados_nao_verificados = false;

      const newResults = analisarJogo(cleanHomeStats, cleanAwayStats);

      const homeCardsAntigo = m.home_stats?.cards?.t ?? m.home_stats?.yellow_cards?.t;
      const homeCardsNovo = cleanHomeStats?.cards?.t ?? cleanHomeStats?.yellow_cards?.t;

      const eraDiferente = JSON.stringify(m.home_stats?.cards) !== JSON.stringify(cleanHomeStats?.cards) ||
                            JSON.stringify(m.home_stats?.gk_saves) !== JSON.stringify(cleanHomeStats?.gk_saves);

      await base44.entities.Match.update(m.id, {
        home_stats: cleanHomeStats,
        away_stats: cleanAwayStats,
        results: newResults,
      });

      if (eraDiferente) {
        restaurados++;
        console.log(`  🔧 RESTAURADO: [${m.home_team} vs ${m.away_team}] (Cards anterior: ${homeCardsAntigo} → Novo: ${homeCardsNovo})`);
      } else {
        mantidosOk++;
      }
    } else {
      // Sem texto bruto salvo — marca como dados_nao_verificados dentro do objeto jsonb home_stats
      const updatedHomeStats = { ...(m.home_stats || {}), dados_nao_verificados: true };
      await base44.entities.Match.update(m.id, {
        home_stats: updatedHomeStats,
      });
      marcadosNaoVerificados++;
      console.log(`  ⚠️ SEM TEXTO BRUTO: [${m.home_team} vs ${m.away_team}] (Marcado dados_nao_verificados = true)`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`RELATÓRIO FINAL DE RESTAURAÇÃO:`);
  console.log(`  - Total de jogos no banco:       ${matches.length}`);
  console.log(`  - Jogos verificados e OK:        ${mantidosOk}`);
  console.log(`  - Jogos corrompidos RESTAURADOS: ${restaurados}`);
  console.log(`  - Jogos sem texto (NÃO VERIFICÁVEIS): ${marcadosNaoVerificados}`);
  console.log(`======================================================\n`);
}

restoreAllMatches().catch(console.error);
