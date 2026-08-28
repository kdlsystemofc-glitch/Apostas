import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText } from "../src/lib/predictionEngine.js";

async function testParser() {
  const matches = await base44.entities.Match.list("-created_date", 500);
  const withRaw = matches.filter(m => m.home_stats?._raw_text || m.home_text);

  console.log(`Testando novo parser em ${withRaw.length} partidas com texto bruto...`);

  for (let i = 0; i < Math.min(3, withRaw.length); i++) {
    const m = withRaw[i];
    const txt = m.home_stats?._raw_text || m.home_text;
    const parsed = parseStatsHubText(txt);

    console.log(`\n=== JOGO ${i + 1}: ${m.home_team} vs ${m.away_team} ===`);
    console.log(`Jogos no cabeçalho (_jogos_header): ${parsed._jogos_header?.length || 0}`);
    if (parsed._jogos_header) {
      console.log("Primeiros 3 jogos do cabeçalho:", parsed._jogos_header.slice(0, 3));
    }

    console.log("Stats extraídos:");
    for (const [key, val] of Object.entries(parsed)) {
      if (key.startsWith("_")) continue;
      console.log(`  - ${key}: t=${val.t}, c=${val.c}, historico.length=${val.historico?.length || 0}, media_casa=${val.media_casa?.toFixed(2) || "N/A"}, media_fora=${val.media_fora?.toFixed(2) || "N/A"}`);
      if (val.historico && val.historico.length > 0) {
        console.log(`    Primeiros 3 jogos historico:`, val.historico.slice(0, 3));
      }
    }
  }
}

testParser().catch(console.error);
