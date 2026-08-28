import { base44 } from "../src/api/base44Client.js";

async function inspectAllStats() {
  const matches = await base44.entities.Match.list("-created_date", 500);
  const withRaw = matches.filter(m => m.home_stats?._raw_text || m.home_text);

  const m = withRaw[0];
  console.log(`=== TODOS OS NOMES DE STATS EM: ${m.home_team} vs ${m.away_team} ===`);
  const txt = m.home_stats?._raw_text || m.home_text;
  const lines = txt.split("\n");
  lines.forEach((line, idx) => {
    if (line.includes("\t") && lines[idx - 1] && !lines[idx - 1].includes("Stat Type")) {
      console.log(`Linha ${idx - 1}: Stat = "${lines[idx - 1].trim()}" | Médias = "${line.trim()}"`);
    }
  });
}

inspectAllStats().catch(console.error);
