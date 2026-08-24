import { base44 } from "../src/api/base44Client.js";
import { parseStatsHubText, analisarJogo } from "../src/lib/predictionEngine.js";

function fixLegacyStats(statsObj) {
  if (!statsObj || typeof statsObj !== "object") return statsObj;
  const fixed = {};
  for (const [key, val] of Object.entries(statsObj)) {
    if (val && typeof val === "object" && val.t !== undefined && val.c !== undefined) {
      if (val.t > val.c) {
        const teamMade = val.c;
        const conceded = Math.max(0, val.t - val.c);
        fixed[key] = { t: teamMade, c: conceded };
      } else {
        fixed[key] = val;
      }
    } else {
      fixed[key] = val;
    }
  }
  return fixed;
}

function calculateR2(preds, reals) {
  const n = preds.length;
  if (n < 5) return 0;
  const meanY = reals.reduce((s, y) => s + y, 0) / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (reals[i] - preds[i]) ** 2;
    ssTot += (reals[i] - meanY) ** 2;
  }
  return ssTot !== 0 ? 1 - ssRes / ssTot : 0;
}

function calculateMAE(preds, reals) {
  const n = preds.length;
  if (n === 0) return 0;
  return preds.reduce((s, p, i) => s + Math.abs(p - reals[i]), 0) / n;
}

function testePermutacaoBrier(errosModelo, errosBaseline, nPerm = 10000) {
  const n = errosModelo.length;
  const diffObs = errosBaseline.reduce((s, x) => s + x, 0) / n - errosModelo.reduce((s, x) => s + x, 0) / n;

  let contagem = 0;
  for (let p = 0; p < nPerm; p++) {
    let sumModPerm = 0, sumBasePerm = 0;
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.5) {
        sumModPerm += errosModelo[i];
        sumBasePerm += errosBaseline[i];
      } else {
        sumModPerm += errosBaseline[i];
        sumBasePerm += errosModelo[i];
      }
    }
    const diffPerm = (sumBasePerm / n) - (sumModPerm / n);
    if (diffPerm >= diffObs) contagem++;
  }
  return { diffObs, pValor: contagem / nPerm };
}

async function run1x2DeepVerification() {
  console.log("Buscando partidas do Supabase para verificação aprofundada do 1X2 e R² em produção...");
  const matches = await base44.entities.Match.list("-date", 500);

  const completed = matches.filter(m => m.status === "completed" || m.real_results);
  completed.sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));

  const totalN = completed.length;
  const trainSize = Math.floor(totalN * 0.80);
  const trainSet = completed.slice(0, trainSize);
  const testSet = completed.slice(trainSize);

  function getRealGoals(m) {
    const rr = m.real_results;
    if (!rr) return null;
    const h = rr.goals_home ?? rr.real_goals_home;
    const a = rr.goals_away ?? rr.real_goals_away;
    if (h === undefined || a === undefined) return null;
    return { h: Number(h), a: Number(a) };
  }

  // Frequências Médias no Treino
  let trainCasa = 0, trainEmpate = 0, trainFora = 0, trainN = 0;
  for (const m of trainSet) {
    const g = getRealGoals(m);
    if (!g) continue;
    trainN++;
    if (g.h > g.a) trainCasa++;
    else if (g.h === g.a) trainEmpate++;
    else trainFora++;
  }

  const pBaseCasa = trainCasa / trainN;
  const pBaseEmpate = trainEmpate / trainN;
  const pBaseFora = trainFora / trainN;

  // Vetores de erro por jogo no Teste
  const errosModelo = [];
  const errosBaseline = [];

  // Coleta de previsões em PRODUÇÃO de xg_casa e xg_fora
  const prodXgCasaPreds = [];
  const prodXgCasaReals = [];
  const prodXgForaPreds = [];
  const prodXgForaReals = [];

  for (const m of testSet) {
    const g = getRealGoals(m);
    if (!g) continue;

    let yVector = [0, 0, 0];
    if (g.h > g.a) yVector = [1, 0, 0];
    else if (g.h === g.a) yVector = [0, 1, 0];
    else yVector = [0, 0, 1];

    let homeStats = fixLegacyStats(m.home_stats);
    let awayStats = fixLegacyStats(m.away_stats);
    if (typeof m.home_text === "string" && m.home_text.trim().length > 10) homeStats = parseStatsHubText(m.home_text);
    if (typeof m.away_text === "string" && m.away_text.trim().length > 10) awayStats = parseStatsHubText(m.away_text);

    // Executa motor de PRODUÇÃO exatamente como no app
    const res = analisarJogo(homeStats, awayStats);
    const pCasaMod = res.pick_1x2?.p_casa ?? 0.45;
    const pEmpateMod = res.pick_1x2?.p_empate ?? 0.27;
    const pForaMod = res.pick_1x2?.p_fora ?? 0.28;

    const eMod = (pCasaMod - yVector[0]) ** 2 + (pEmpateMod - yVector[1]) ** 2 + (pForaMod - yVector[2]) ** 2;
    const eBase = (pBaseCasa - yVector[0]) ** 2 + (pBaseEmpate - yVector[1]) ** 2 + (pBaseFora - yVector[2]) ** 2;

    errosModelo.push(eMod);
    errosBaseline.push(eBase);

    // Salva gols previstos pela engine de produção (xg_casa e xg_fora)
    if (res.xg_casa != null && res.xg_fora != null) {
      prodXgCasaPreds.push(res.xg_casa);
      prodXgCasaReals.push(g.h);
      prodXgForaPreds.push(res.xg_fora);
      prodXgForaReals.push(g.a);
    }
  }

  console.log("======================================================");
  console.log("PARTE 1 — TESTE DE PERMUTAÇÃO (BOOTSTRAP 10.000 ITERAÇÕES) NO BRIER SCORE 1X2");
  console.log("======================================================");

  const permRes = testePermutacaoBrier(errosModelo, errosBaseline, 10000);
  const brierModelo = errosModelo.reduce((a, b) => a + b, 0) / errosModelo.length;
  const brierBaseline = errosBaseline.reduce((a, b) => a + b, 0) / errosBaseline.length;

  console.log(`- Brier Score Modelo (Dixon-Coles em Produção): ${brierModelo.toFixed(4)}`);
  console.log(`- Brier Score Baseline (Média Liga):             ${brierBaseline.toFixed(4)}`);
  console.log(`- Diferença Observada (diffObs = Base - Modelo):  +${permRes.diffObs.toFixed(4)}`);
  console.log(`- Teste de Permutação (10.000 iterações):`);
  console.log(`  - p-valor resultante = ${permRes.pValor.toFixed(4)}`);
  console.log(`  - Significância (p < 0.05): ${permRes.pValor < 0.05 ? "✅ ESTATISTICAMENTE SIGNIFICATIVO" : "❌ NÃO SIGNIFICATIVO (Diferença de Brier não se sustenta no teste de permutação)"}\n`);

  console.log("======================================================");
  console.log("PARTE 2 — AVALIAÇÃO R² OUT-OF-SAMPLE DA ENGINE DE PRODUÇÃO (xg_casa E xg_fora)");
  console.log("======================================================");

  const r2CasaProd = calculateR2(prodXgCasaPreds, prodXgCasaReals);
  const maeCasaProd = calculateMAE(prodXgCasaPreds, prodXgCasaReals);
  const r2ForaProd = calculateR2(prodXgForaPreds, prodXgForaReals);
  const maeForaProd = calculateMAE(prodXgForaPreds, prodXgForaReals);

  console.log(`Gols Casa em Produção (res.xg_casa vs real_goals_home em ${prodXgCasaPreds.length} jogos de teste):`);
  console.log(`  - R² no Teste Out-of-Sample: ${r2CasaProd.toFixed(4)}`);
  console.log(`  - MAE no Teste:              ${maeCasaProd.toFixed(2)} gols`);

  console.log(`\nGols Fora em Produção (res.xg_fora vs real_goals_away em ${prodXgForaPreds.length} jogos de teste):`);
  console.log(`  - R² no Teste Out-of-Sample: ${r2ForaProd.toFixed(4)}`);
  console.log(`  - MAE no Teste:              ${maeForaProd.toFixed(2)} gols\n`);

  console.log("======================================================");
  console.log("PARTE 3 — CONCLUSÃO E RECOMENDAÇÃO FINAL DO 1X2");
  console.log("======================================================");

  const passesBrierPermutation = permRes.pValor < 0.05;
  const passesR2Casa = r2CasaProd > 0;
  const passesR2Fora = r2ForaProd > 0;

  console.log(`Critérios de Validação do 1X2:`);
  console.log(`  1. Teste de Permutação Brier (p < 0.05): ${passesBrierPermutation ? "✅ PASSOU" : "❌ FALHOU (" + permRes.pValor.toFixed(4) + ")"}`);
  console.log(`  2. R² Out-of-Sample Gols Casa > 0:       ${passesR2Casa ? "✅ PASSOU" : "❌ FALHOU (" + r2CasaProd.toFixed(4) + ")"}`);
  console.log(`  3. R² Out-of-Sample Gols Fora > 0:       ${passesR2Fora ? "✅ PASSOU" : "❌ FALHOU (" + r2ForaProd.toFixed(4) + ")"}`);

  let recFinal1x2 = "";
  if (passesBrierPermutation && (passesR2Casa || passesR2Fora)) {
    recFinal1x2 = "MANTER EM PRODUÇÃO NORMAL (Com Nota de Confiança Moderada)";
  } else {
    recFinal1x2 = "MARCAR COMO BAIXA CONFIABILIDADE (⚠ EM ESTUDO)";
  }
  console.log(`\n👉 DECISÃO FINAL DO 1X2: ${recFinal1x2}\n`);
}

run1x2DeepVerification().catch(console.error);
