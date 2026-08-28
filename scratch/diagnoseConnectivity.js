import { base44 } from "../src/api/base44Client.js";

async function diagnoseConnectivity() {
  const matches = await base44.entities.Match.list("-created_date", 500);
  console.log("==========================================================================");
  console.log(`DIAGNÓSTICO DE CONECTIVIDADE DA BASE DE TIMES (N = ${matches.length} JOGOS)`);
  console.log("==========================================================================\n");

  const teamCounts = {};
  const graph = {}; // team -> Set(opponentTeams)

  for (const m of matches) {
    const h = m.home_team?.trim();
    const a = m.away_team?.trim();
    if (!h || !a) continue;

    teamCounts[h] = (teamCounts[h] || 0) + 1;
    teamCounts[a] = (teamCounts[a] || 0) + 1;

    if (!graph[h]) graph[h] = new Set();
    if (!graph[a]) graph[a] = new Set();

    graph[h].add(a);
    graph[a].add(h);
  }

  const allTeams = Object.keys(teamCounts);
  const teamsWith3Plus = allTeams.filter(t => teamCounts[t] >= 3);

  // Algoritmo de BFS para encontrar componentes conectados
  const visited = new Set();
  const components = [];

  for (const team of allTeams) {
    if (!visited.has(team)) {
      const comp = [];
      const queue = [team];
      visited.add(team);

      while (queue.length > 0) {
        const curr = queue.shift();
        comp.push(curr);

        for (const neighbor of (graph[curr] || [])) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      components.push(comp);
    }
  }

  // Ordenar componentes por tamanho decrescente
  components.sort((a, b) => b.length - a.length);
  const largestComp = components[0] || [];
  const teamsInLargestCompWith3Plus = largestComp.filter(t => teamCounts[t] >= 3);

  console.log(`1. Total de Times Únicos no Banco:            ${allTeams.length}`);
  console.log(`2. Times com 3+ Jogos no Banco:              ${teamsWith3Plus.length}`);
  console.log(`3. Total de Componentes Conectados:          ${components.length}`);
  console.log(`4. Tamanho do Maior Componente Conectado:    ${largestComp.length} times`);
  console.log(`5. Times no Maior Componente com 3+ Jogos:   ${teamsInLargestCompWith3Plus.length} times\n`);

  console.log("--- DETALHAMENTO DOS MAIORES COMPONENTES CONECTADOS ---");
  components.slice(0, 5).forEach((comp, idx) => {
    const with3Plus = comp.filter(t => teamCounts[t] >= 3).length;
    console.log(`Componente ${idx + 1}: ${comp.length} times (${with3Plus} times com 3+ jogos) -> Ex: ${comp.slice(0, 4).join(", ")}`);
  });

  const is2AViable = teamsInLargestCompWith3Plus.length >= 15;
  console.log("\n==========================================================================");
  console.log(`DECISÃO METODOLÓGICA DE ARQUITETURA:`);
  if (is2AViable) {
    console.log(`✅ PARTE 2A (Dixon-Coles Clássico por Time) É VIÁVEL!`);
    console.log(`   O maior componente possui ${teamsInLargestCompWith3Plus.length} times com 3+ jogos.`);
  } else {
    console.log(`⚠️ PARTE 2B (Poisson GLM / Regressão Log-Poisson via IRLS) É NECESSÁRIA!`);
    console.log(`   Motivo: O maior componente conectado tem apenas ${teamsInLargestCompWith3Plus.length} times com 3+ jogos.`);
    console.log(`   A base é composta por jogos de múltiplas ligas isoladas sem repetição suficiente para Dixon-Coles clássico.`);
  }
  console.log("==========================================================================\n");
}

diagnoseConnectivity().catch(console.error);
