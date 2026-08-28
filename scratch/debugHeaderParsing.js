import { base44 } from "../src/api/base44Client.js";
import { extrairCabecalhoJogos } from "../src/lib/predictionEngine.js";

async function debugHeader() {
  console.log("==========================================================================");
  console.log("DEBBUGGING extrairCabecalhoJogos() EM TODAS AS 29 PARTIDAS COM RAW TEXT");
  console.log("==========================================================================\n");

  const matches = await base44.entities.Match.list("-created_date", 500);
  const withRaw = matches.filter(m => m.home_stats?._raw_text || m.home_text);

  console.log(`Total de partidas com _raw_text: ${withRaw.length}`);

  for (let idx = 0; idx < withRaw.length; idx++) {
    const m = withRaw[idx];
    const rawHome = m.home_stats?._raw_text || m.home_text;
    const header = extrairCabecalhoJogos(rawHome);

    const mandos = header.map(j => j.mando).join(" ");
    const hCount = header.filter(j => j.mando === "H").length;
    const aCount = header.filter(j => j.mando === "A").length;

    console.log(`\nJogo ${idx + 1}: ${m.home_team} vs ${m.away_team}`);
    console.log(`  Header extraído (${header.length} jogos): H = ${hCount} | A = ${aCount}`);
    console.log(`  Sequência de mandos: ${mandos}`);
    if (header.length > 0) {
      console.log(`  Primeiros 3 jogos:`, header.slice(0, 3));
    } else {
      console.log("  ⚠️ NENHUM JOGO EXTRAÍDO DO CABEÇALHO!");
      console.log("  Primeiras 15 linhas do texto:");
      console.log(rawHome.split("\n").slice(0, 15).join("\n"));
    }
  }
}

debugHeader().catch(console.error);
