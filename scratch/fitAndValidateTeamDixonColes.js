import { base44 } from "../src/api/base44Client.js";
import { classificarMercado } from "../src/lib/calibrationLayer.js";

function wilsonScoreInterval(k, n) {
  if (n === 0) return "[0.0%, 0.0%]";
  const z = 1.959964;
  const p = k / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
  return `[${Math.max(0, (centre - margin) * 100).toFixed(1)}%, ${Math.min(100, (centre + margin) * 100).toFixed(1)}%]`;
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
  if (n === 0) return { pValor: "1.0000" };
  const pHat = k / n;
  const se = Math.sqrt(pNull * (1 - pNull) / n);
  const z = (pHat - pNull) / (se || 1);
  const pValor = 1 - normalCDF(z);
  return { pValor: pValor.toFixed(4) };
}

async function runTeamDixonColes() {
  const matches = await base44.entities.Match.list("-created_date", 500);
  const completed = matches.filter(m => m.status === "completed" || m.real_results);

  // Identificar Componente 1 (Maior Componente Conectado)
  const graph = {};
  for (const m of completed) {
    const h = m.home_team?.trim();
    const a = m.away_team?.trim();
    if (!h || !a) continue;
    if (!graph[h]) graph[h] = new Set();
    if (!graph[a]) graph[a] = new Set();
    graph[h].add(a);
    graph[a].add(h);
  }

  const visited = new Set();
  const components = [];
  for (const team of Object.keys(graph)) {
    if (!visited.has(team)) {
      const comp = [];
      const queue = [team];
      visited.add(team);
      while (queue.length > 0) {
        const curr = queue.shift();
        comp.push(curr);
        for (const neighbor of graph[curr]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      components.push(comp);
    }
  }

  components.sort((a, b) => b.length - a.length);
  const comp1Teams = new Set(components[0] || []);

  const comp1Matches = completed.filter(m => comp1Teams.has(m.home_team?.trim()) && comp1Teams.has(m.away_team?.trim()));
  const sorted = [...comp1Matches].sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));

  console.log("==========================================================================");
  console.log(`AVALIAÇÃO DO DIXON-COLES CLÁSSICO POR TIME NO COMPONENTE 1`);
  console.log(`Base Componente 1: ${sorted.length} partidas entre ${comp1Teams.size} times conectados`);
  console.log("==========================================================================\n");

  const trainSize = Math.floor(sorted.length * 0.80);
  const trainSet = sorted.slice(0, trainSize);
  const testSet = sorted.slice(trainSize);

  // Mapear times para índices [0...T-1]
  const teamList = Array.from(comp1Teams);
  const teamIdxMap = new Map(teamList.map((t, idx) => [t, idx]));
  const T = teamList.length;

  // Parâmetros: mu (1), gamma (1), alpha[T], beta[T]
  // Estimar via Gradient Descent no Treino
  let mu = 0.2;
  let gamma = 0.1;
  let alpha = new Array(T).fill(0);
  let defBeta = new Array(T).fill(0);

  const lr = 0.01;
  const epochs = 300;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let gradMu = 0;
    let gradGamma = 0;
    const gradAlpha = new Array(T).fill(0);
    const gradBeta = new Array(T).fill(0);

    for (const m of trainSet) {
      const hIdx = teamIdxMap.get(m.home_team?.trim());
      const aIdx = teamIdxMap.get(m.away_team?.trim());
      if (hIdx === undefined || aIdx === undefined) continue;

      const yH = Number(m.real_results?.goals_home ?? m.real_goals_home ?? 0);
      const yA = Number(m.real_results?.goals_away ?? m.real_goals_away ?? 0);

      const lambdaH = Math.exp(mu + alpha[hIdx] - defBeta[aIdx] + gamma);
      const lambdaA = Math.exp(mu + alpha[aIdx] - defBeta[hIdx]);

      // Gradientes Poisson
      const errH = yH - lambdaH;
      const errA = yA - lambdaA;

      gradMu += errH + errA;
      gradGamma += errH;

      gradAlpha[hIdx] += errH;
      gradBeta[aIdx] -= errH;

      gradAlpha[aIdx] += errA;
      gradBeta[hIdx] -= errA;
    }

    mu += lr * (gradMu / trainSet.length);
    gamma += lr * (gradGamma / trainSet.length);

    for (let t = 0; t < T; t++) {
      alpha[t] += lr * (gradAlpha[t] / trainSet.length);
      defBeta[t] += lr * (gradBeta[t] / trainSet.length);
    }

    // Restrição de identificabilidade: sum(alpha) = 0, sum(beta) = 0
    const meanAlpha = alpha.reduce((s, v) => s + v, 0) / T;
    const meanBeta = defBeta.reduce((s, v) => s + v, 0) / T;
    alpha = alpha.map(v => v - meanAlpha);
    defBeta = defBeta.map(v => v - meanBeta);
  }

  // Avaliação no conjunto de teste do Componente 1
  const evalHeuristico = [];
  const evalDixonColes = [];

  for (const m of testSet) {
    const hIdx = teamIdxMap.get(m.home_team?.trim());
    const aIdx = teamIdxMap.get(m.away_team?.trim());
    if (hIdx === undefined || aIdx === undefined) continue;

    const realGHome = m.real_results?.goals_home ?? m.real_goals_home;
    const realGAway = m.real_results?.goals_away ?? m.real_goals_away;
    if (realGHome === undefined || realGAway === undefined) continue;
    const realTotal = Number(realGHome) + Number(realGAway);

    const prevHeuristica = m.results?.xg_total || 0;

    const lambdaH = Math.exp(mu + alpha[hIdx] - defBeta[aIdx] + gamma);
    const lambdaA = Math.exp(mu + alpha[aIdx] - defBeta[hIdx]);
    const prevDC = lambdaH + lambdaA;

    evalHeuristico.push({ prev: prevHeuristica, real: realTotal });
    evalDixonColes.push({ prev: prevDC, real: realTotal });
  }

  function avaliar(nome, dados) {
    const n = dados.length;
    if (n === 0) return { Modelo: nome, Amostra: 0 };
    const mediaPrev = dados.reduce((s, d) => s + d.prev, 0) / n;
    const mediaReal = dados.reduce((s, d) => s + d.real, 0) / n;
    const vies = mediaPrev - mediaReal;
    const mae = dados.reduce((s, d) => s + Math.abs(d.prev - d.real), 0) / n;

    const ssRes = dados.reduce((s, d) => s + (d.real - d.prev) ** 2, 0);
    const ssTot = dados.reduce((s, d) => s + (d.real - mediaReal) ** 2, 0);
    const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    let acertos = 0;
    for (const d of dados) {
      const linha = Math.floor(d.prev) + 0.5;
      if ((d.prev >= linha) === (d.real > linha)) acertos++;
    }

    const winRate = (acertos / n) * 100;
    const ic95 = wilsonScoreInterval(acertos, n);
    const binTest = testeBinomial(acertos, n);
    const status = classificarMercado(r2, binTest.pValor, 12, vies, mae);

    return {
      Modelo: nome,
      Amostra: n,
      "Média Prevista": mediaPrev.toFixed(2),
      "Média Real": mediaReal.toFixed(2),
      Viés: vies.toFixed(2),
      MAE: mae.toFixed(2),
      "R² Out-of-Sample": r2.toFixed(4),
      "Taxa Acerto": `${winRate.toFixed(1)}%`,
      "IC 95% Wilson": ic95,
      "p-valor Binomial": binTest.pValor,
      Status: status,
    };
  }

  console.log("--- RESULTADOS NO TESTE DO COMPONENTE 1 ---");
  console.table([
    avaliar("Modelo Heurístico Atual", evalHeuristico),
    avaliar("Dixon-Coles Clássico por Time (MLE)", evalDixonColes),
  ]);
}

runTeamDixonColes().catch(console.error);
