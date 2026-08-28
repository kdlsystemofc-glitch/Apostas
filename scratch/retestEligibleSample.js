import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText, analisarJogo } from "../src/lib/predictionEngine.js";

async function retestSample() {
  console.log("==========================================================================");
  console.log("REPROCESSAMENTO DE BACKFILL E CONTAGEM DE CRITÉRIO C (3+ H E 3+ A)");
  console.log("==========================================================================\n");

  const matches = await base44.entities.Match.list("-created_date", 500);
  const withRaw = matches.filter(m => (m.home_stats?._raw_text || m.home_text) && (m.away_stats?._raw_text || m.away_text));

  console.log(`Total de partidas no Supabase com texto bruto para ambos os times: ${withRaw.length}`);

  let elegiveisCriterioC = 0;
  const detalheJogos = [];

  for (let i = 0; i < withRaw.length; i++) {
    const m = withRaw[i];
    const rawHome = m.home_stats?._raw_text || m.home_text;
    const rawAway = m.away_stats?._raw_text || m.away_text;

    const hs = parseStatsHubText(rawHome);
    hs._raw_text = rawHome.trim();
    hs.dados_nao_verificados = false;

    const as = parseStatsHubText(rawAway);
    as._raw_text = rawAway.trim();
    as.dados_nao_verificados = false;

    const newResults = analisarJogo(hs, as);

    await base44.entities.Match.update(m.id, {
      home_stats: hs,
      away_stats: as,
      results: newResults,
    });

    const hHomeGames = hs._jogos_header?.filter(j => j.mando === "H")?.length || 0;
    const hAwayGames = hs._jogos_header?.filter(j => j.mando === "A")?.length || 0;

    const aHomeGames = as._jogos_header?.filter(j => j.mando === "H")?.length || 0;
    const aAwayGames = as._jogos_header?.filter(j => j.mando === "A")?.length || 0;

    const tem3H_3A_Mandante = hHomeGames >= 3 && hAwayGames >= 3;
    const tem3H_3A_Visitante = aHomeGames >= 3 && aAwayGames >= 3;
    const elegivelC = tem3H_3A_Mandante && tem3H_3A_Visitante;

    if (elegivelC) elegiveisCriterioC++;

    detalheJogos.push({
      jogo: `${m.home_team} vs ${m.away_team}`,
      mandoHome: `H=${hHomeGames}, A=${hAwayGames}`,
      mandoAway: `H=${aHomeGames}, A=${aAwayGames}`,
      elegivelC: elegivelC ? "✓ SIM" : "✗ NÃO",
    });
  }

  console.log(`\n==========================================================================`);
  console.log(`RESULTADO DA RE-AVALIAÇÃO DO CRITÉRIO C:`);
  console.log(`  - Total de jogos com _raw_text no banco: ${withRaw.length}`);
  console.log(`  - Partidas com 3+ H e 3+ A (Mandante E Visitante): ${elegiveisCriterioC}`);
  console.log(`==========================================================================\n`);

  console.table(detalheJogos);
}

retestSample().catch(console.error);
