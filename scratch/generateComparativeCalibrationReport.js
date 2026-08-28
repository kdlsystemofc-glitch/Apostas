import { base44 } from "../src/api/base44Client.js";
import { isMercadoEmEstudo } from "../src/lib/calibrationLayer.js";

// Função para calcular o Intervalo de Confiança 95% de Wilson Score
function wilsonScoreInterval(k, n) {
  if (n === 0) return "[0.0%, 0.0%]";
  const z = 1.959964;
  const p = k / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;

  const lower = Math.max(0, (centre - margin) * 100);
  const upper = Math.min(100, (centre + margin) * 100);
  return `[${lower.toFixed(1)}%, ${upper.toFixed(1)}%]`;
}

function normalCDF(z) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function testeBinomial(k, n, pNull = 0.5) {
  if (n === 0) return { pValor: "1.0000", sig: false };
  const pHat = k / n;
  const se = Math.sqrt(pNull * (1 - pNull) / n);
  const z = (pHat - pNull) / (se || 1);
  const pValor = 1 - normalCDF(z);
  return { pValor: pValor.toFixed(4), sig: pValor < 0.05 };
}

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
    { key: "gols",        name: "Gols Total",             prev: m => m.results?.xg_total,          real: buildRealSum("goals_home", "goals_away"), lowConfidence: isMercadoEmEstudo("gols") },
    { key: "cartoes",     name: "Cartões Total",          prev: m => m.results?.xcard_total,       real: buildRealSum("cards_home", "cards_away"), lowConfidence: isMercadoEmEstudo("cartoes") },
    { key: "saves",       name: "Defesas Goleiro Total",  prev: m => m.results?.xsaves_total,      real: buildRealSum("saves_home", "saves_away"), lowConfidence: isMercadoEmEstudo("saves") },
    { key: "corners",     name: "Escanteios Total",       prev: m => m.results?.xc_total,          real: buildRealSum("corners_home", "corners_away"), lowConfidence: isMercadoEmEstudo("corners") },
    { key: "chutesgol",   name: "Chutes no Gol Total",    prev: m => m.results?.xs_total,          real: buildRealSum("shots_home", "shots_away"), lowConfidence: isMercadoEmEstudo("chutesgol") },
    { key: "faltas",      name: "Faltas Total",           prev: m => m.results?.xfouls_total,      real: buildRealSum("fouls_home", "fouls_away"), lowConfidence: isMercadoEmEstudo("faltas") },
    { key: "totalshots",  name: "Chutes Totais",          prev: m => m.results?.xtotalshots_total, real: buildRealSum("totalshots_home", "totalshots_away"), lowConfidence: isMercadoEmEstudo("totalshots") },
    { key: "btts",        name: "Ambas Marcam (BTTS)",    prev: m => m.results?.p_btts,            real: m => {
      const rr = m.real_results;
      if (!rr) return null;
      const b = rr.btts ?? rr.real_btts;
      if (b === undefined || b === null) return null;
      return Number(b);
    }, lowConfidence: isMercadoEmEstudo("btts") },
    { key: "gols_casa",   name: "Gols Mandante (Casa)",   prev: m => m.results?.xg_casa,           real: m => m.real_results?.goals_home ?? m.real_goals_home, lowConfidence: isMercadoEmEstudo("gols_casa") },
    { key: "gols_fora",   name: "Gols Visitante (Fora)",  prev: m => m.results?.xg_fora,           real: m => m.real_results?.goals_away ?? m.real_goals_away, lowConfidence: isMercadoEmEstudo("gols_fora") },
    { key: "corners_casa",name: "Escanteios Casa",        prev: m => m.results?.xc_casa,           real: m => m.real_results?.corners_home ?? m.real_corners_home, lowConfidence: isMercadoEmEstudo("corners_casa") },
    { key: "corners_fora",name: "Escanteios Fora",        prev: m => m.results?.xc_fora,           real: m => m.real_results?.corners_away ?? m.real_corners_away, lowConfidence: isMercadoEmEstudo("corners_fora") },
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

    const ssRes = dados.reduce((s, d) => s + (d.r - d.p) ** 2, 0);
    const ssTot = dados.reduce((s, d) => s + (d.r - mediaReal) ** 2, 0);
    const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

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
    const winRateNum = (acertos / dados.length) * 100;
    const winRateStr = `${winRateNum.toFixed(1)}%`;
    const ic95 = wilsonScoreInterval(acertos, dados.length);
    const binTest = testeBinomial(acertos, dados.length);

    let avaliacao = "✗ Revisar";
    if (lowConfidence) {
      avaliacao = "⚠ EM ESTUDO";
    } else if (Math.abs(vies) < 0.35) {
      avaliacao = "✓ Calibrado";
    } else if (Math.abs(vies) < 0.70) {
      avaliacao = "⚠ Leve viés";
    }

    return {
      key,
      name,
      n: dados.length,
      lowConfidence,
      mediaPrev: mediaPrev.toFixed(2),
      mediaReal: mediaReal.toFixed(2),
      vies: vies.toFixed(2),
      mae: mae.toFixed(2),
      r2: r2.toFixed(4),
      winRate: winRateStr,
      ic95,
      pValorBinomial: binTest.pValor,
      status: avaliacao,
    };
  });
}

async function runReport() {
  const matches = await base44.entities.Match.list("-created_date", 500);
  const completed = matches.filter(m => m.status === "completed" || m.real_results);

  console.log("==========================================================================");
  console.log(`RELATÓRIO DE CALIBRAÇÃO GERAL APÓS REMOÇÃO DA DUPLA CONTAGEM DE MANDO`);
  console.log(`Base de Dados Completa: ${completed.length} partidas no Supabase`);
  console.log("==========================================================================\n");

  const sorted = [...completed].sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));
  const trainSize = Math.floor(sorted.length * 0.80);
  const trainSet = sorted.slice(0, trainSize);
  const testSet = sorted.slice(trainSize);

  console.log(`Split Cronológico 80/20: Treino N = ${trainSet.length} | Teste N = ${testSet.length} partidas\n`);

  console.log("--- 1. DESEMPENHO NO CONJUNTO DE TESTE OUT-OF-SAMPLE (N = 41 Partidas de Teste) ---");
  const testReport = calcBloco(testSet);
  console.table(testReport);

  console.log("\n--- 2. DESEMPENHO NO CONJUNTO GERAL COMPLETO (N = 203 Partidas) ---");
  const overallReport = calcBloco(completed);
  console.table(overallReport);

  console.log("\nJSON do Relatório Completo de Exportação (Conjunto de Teste Out-of-Sample):\n");
  console.log(JSON.stringify(testReport, null, 2));
}

runReport().catch(console.error);
