import { base44 } from "../src/api/base44Client.js";
import { isMercadoEmEstudo } from "../src/lib/calibrationLayer.js";

function calcBloco(matches) {
  function buildRealSum(homeKey, awayKey) {
    return m => {
      const rr = m.real_results;
      if (!rr) return null;
      const h = rr[homeKey] ?? rr[`real_${homeKey}`];
      const a = rr[awayKey] ?? rr[`real_${awayKey}`];
      if (h === undefined && a === undefined) return null;
      return (Number(h) || 0) + (Number(a) || 0);
    };
  }

  const mercados = [
    { key: "corners",     name: "Escanteios Total",       prev: m => m.results?.xc_total,          real: buildRealSum("corners_home", "corners_away"), lowConfidence: true },
    { key: "gols",        name: "Gols Total",             prev: m => m.results?.xg_total,          real: buildRealSum("goals_home", "goals_away"), lowConfidence: false },
    { key: "cartoes",     name: "Cartões Total",          prev: m => m.results?.xcard_total,       real: buildRealSum("cards_home", "cards_away"), lowConfidence: false },
    { key: "chutesgol",   name: "Chutes no Gol Total",    prev: m => m.results?.xs_total,          real: buildRealSum("shots_home", "shots_away"), lowConfidence: true },
    { key: "faltas",      name: "Faltas Total",           prev: m => m.results?.xfouls_total,      real: buildRealSum("fouls_home", "fouls_away"), lowConfidence: true },
    { key: "saves",       name: "Defesas Goleiro Total",  prev: m => m.results?.xsaves_total,      real: buildRealSum("saves_home", "saves_away"), lowConfidence: false },
    { key: "totalshots",  name: "Chutes Totais",          prev: m => m.results?.xtotalshots_total, real: buildRealSum("totalshots_home", "totalshots_away"), lowConfidence: true },
    { key: "btts",        name: "Ambas Marcam (BTTS)",    prev: m => m.results?.p_btts,            real: m => {
      const rr = m.real_results;
      if (!rr) return null;
      const b = rr.btts ?? rr.real_btts;
      if (b === undefined || b === null) return null;
      return Number(b);
    }, lowConfidence: true },
    { key: "gols_casa",   name: "Gols Mandante (Casa)",   prev: m => m.results?.xg_casa,           real: m => m.real_results?.goals_home ?? m.real_goals_home, lowConfidence: true },
    { key: "gols_fora",   name: "Gols Visitante (Fora)",  prev: m => m.results?.xg_fora,           real: m => m.real_results?.goals_away ?? m.real_goals_away, lowConfidence: true },
    { key: "corners_casa",name: "Escanteios Casa",        prev: m => m.results?.xc_casa,           real: m => m.real_results?.corners_home ?? m.real_corners_home, lowConfidence: true },
    { key: "corners_fora",name: "Escanteios Fora",        prev: m => m.results?.xc_fora,           real: m => m.real_results?.corners_away ?? m.real_corners_away, lowConfidence: true },
  ];

  return mercados.map(({ key, name, prev, real, lowConfidence }) => {
    const dados = matches
      .map(m => ({ p: prev(m), r: real(m) }))
      .filter(d => d.p !== null && d.p !== undefined && d.r !== null && d.r !== undefined);

    if (dados.length === 0) return { key, name, n: 0, status: "insuficiente", lowConfidence };

    const mediaPrev = dados.reduce((s, d) => s + d.p, 0) / dados.length;
    const mediaReal = dados.reduce((s, d) => s + d.r, 0) / dados.length;
    const vies = mediaPrev - mediaReal;
    const mae = dados.reduce((s, d) => s + Math.abs(d.p - d.r), 0) / dados.length;

    let acertos = 0;
    for (const d of dados) {
      if (key === "btts") {
        const predBTTS = d.p >= 0.5 ? 1 : 0;
        if (predBTTS === d.r) acertos++;
      } else {
        const linhaPrincipal = Math.floor(d.p) + 0.5;
        if ((d.p >= linhaPrincipal) === (d.r > linhaPrincipal)) acertos++;
      }
    }
    const winRate = ((acertos / dados.length) * 100).toFixed(1);

    return {
      key,
      name,
      n: dados.length,
      lowConfidence,
      mediaPrev: mediaPrev.toFixed(2),
      mediaReal: mediaReal.toFixed(2),
      vies: vies.toFixed(2),
      mae: mae.toFixed(2),
      winRate: `${winRate}%`,
      status: lowConfidence ? "⚠ EM ESTUDO" : Math.abs(vies) < 0.35 ? "✓ Calibrado" : "⚠ Leve viés",
    };
  });
}

async function runReport() {
  const matches = await base44.entities.Match.list("-created_date", 500);
  const valid = matches.filter(m => (m.status === "completed" || m.real_results) && m.home_stats?.dados_nao_verificados === false);

  console.log(`======================================================`);
  console.log(`RELATÓRIO DE CALIBRAÇÃO COM DADOS RE-PARSEADOS E VERIFICADOS DO TEXTO ORIGINAL (${valid.length} jogos)`);
  console.log(`======================================================\n`);

  const report = calcBloco(valid);
  console.table(report);

  console.log("\nJSON do Relatório de Exportação:\n");
  console.log(JSON.stringify(report, null, 2));
}

runReport().catch(console.error);
