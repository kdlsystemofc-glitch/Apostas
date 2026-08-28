// Script auxiliar: calcula os betas finais do Poisson GLM Podado (3 vars, λ=5.0)
// sobre os 161 jogos de treino e reporta os valores para hard-coding em calcGols()
import { base44 } from "../src/api/base44Client.js";
import { fitPoissonGLM, predictPoissonGLM } from "./fitAndValidatePoissonGLM.js";

function g(stats, key, campo = "t") {
  return stats?.[key]?.[campo] || 0.0;
}

const matches = await base44.entities.Match.list("-created_date", 500);
const completed = matches.filter(m => m.status === "completed" || m.real_results);
const sorted = [...completed].sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));

const trainSize = Math.floor(sorted.length * 0.80);
const trainSet = sorted.slice(0, trainSize);
const testSet = sorted.slice(trainSize);

console.log(`Total: ${sorted.length} | Treino: ${trainSet.length} | Teste: ${testSet.length}`);

// Montar matriz de features [1, xg_atk, gols_cedidos_adv, sot_cedidos_adv]
const X3 = [], y3 = [];
for (const m of trainSet) {
  const hs = m.home_stats || {};
  const as = m.away_stats || {};
  const gH = m.real_results?.goals_home ?? m.real_goals_home;
  const gA = m.real_results?.goals_away ?? m.real_goals_away;
  if (gH !== undefined && gH !== null) {
    X3.push([1.0, g(hs, "xg"), g(as, "goals", "c"), g(as, "shots_on_target", "c")]);
    y3.push(Number(gH));
  }
  if (gA !== undefined && gA !== null) {
    X3.push([1.0, g(as, "xg"), g(hs, "goals", "c"), g(hs, "shots_on_target", "c")]);
    y3.push(Number(gA));
  }
}

console.log(`Amostras de treino (home+away): ${X3.length}`);

const beta = fitPoissonGLM(X3, y3, 5.0);
console.log("\n=== BETAS FINAIS (λ=5.0, treino completo) ===");
console.log(`β0 = ${beta[0].toFixed(6)}  (intercepto log-base, exp=${Math.exp(beta[0]).toFixed(4)})`);
console.log(`β1 = ${beta[1].toFixed(6)}  (xG atacante)`);
console.log(`β2 = ${beta[2].toFixed(6)}  (gols cedidos adv)`);
console.log(`β3 = ${beta[3].toFixed(6)}  (chutes no gol cedidos adv)`);

// Verificar sinais
console.log(`\nVerificação de sinais:`);
console.log(`  β1 (xG): ${beta[1] > 0 ? "✓ POSITIVO" : "✗ NEGATIVO"}`);
console.log(`  β2 (gols_ced): ${beta[2] > 0 ? "✓ POSITIVO" : "✗ NEGATIVO"}`);
console.log(`  β3 (sot_ced): ${beta[3] > 0 ? "✓ POSITIVO" : "✗ NEGATIVO"}`);

// Calcular um jogo do conjunto de teste como ponto de ancoragem para o teste de regressão
const testMatch = testSet[0];
const hsTM = testMatch.home_stats || {};
const asTM = testMatch.away_stats || {};
const rowH_test = [1.0, g(hsTM, "xg"), g(asTM, "goals", "c"), g(asTM, "shots_on_target", "c")];
const rowA_test = [1.0, g(asTM, "xg"), g(hsTM, "goals", "c"), g(hsTM, "shots_on_target", "c")];
const predH = predictPoissonGLM(rowH_test, beta);
const predA = predictPoissonGLM(rowA_test, beta);
console.log(`\n=== JOGO DE ANCORAGEM PARA TESTE DE REGRESSÃO (primeiro do teste) ===`);
console.log(`  Home xG=${g(hsTM,"xg")}, Away goals_c=${g(asTM,"goals","c")}, Away sot_c=${g(asTM,"shots_on_target","c")}`);
console.log(`  -> predH=${predH.toFixed(6)}`);
console.log(`  Away xG=${g(asTM,"xg")}, Home goals_c=${g(hsTM,"goals","c")}, Home sot_c=${g(hsTM,"shots_on_target","c")}`);
console.log(`  -> predA=${predA.toFixed(6)}`);
console.log(`  Total previsto: ${(predH + predA).toFixed(6)}`);
console.log(`  Real goals_home=${testMatch.real_results?.goals_home ?? testMatch.real_goals_home}, goals_away=${testMatch.real_results?.goals_away ?? testMatch.real_goals_away}`);

// Avaliar no conjunto de teste (validação final)
let acertos = 0, sumVies = 0, sumAE = 0;
const testEval = [];
for (const m of testSet) {
  const hs = m.home_stats || {};
  const as = m.away_stats || {};
  const gH = m.real_results?.goals_home ?? m.real_goals_home;
  const gA = m.real_results?.goals_away ?? m.real_goals_away;
  if (gH === undefined || gA === undefined) continue;
  const real = Number(gH) + Number(gA);
  const pH = predictPoissonGLM([1.0, g(hs, "xg"), g(as, "goals", "c"), g(as, "shots_on_target", "c")], beta);
  const pA = predictPoissonGLM([1.0, g(as, "xg"), g(hs, "goals", "c"), g(hs, "shots_on_target", "c")], beta);
  const pred = pH + pA;
  const linha = Math.floor(pred) + 0.5;
  if ((pred >= linha) === (real > linha)) acertos++;
  sumVies += pred - real;
  sumAE += Math.abs(pred - real);
  testEval.push({ pred, real });
}
const n = testEval.length;
const meanReal = testEval.reduce((s, d) => s + d.real, 0) / n;
const ssRes = testEval.reduce((s, d) => s + (d.real - d.pred) ** 2, 0);
const ssTot = testEval.reduce((s, d) => s + (d.real - meanReal) ** 2, 0);
const r2 = 1 - ssRes / ssTot;

console.log(`\n=== VALIDAÇÃO OUT-OF-SAMPLE FINAL (N=${n}) ===`);
console.log(`  MAE: ${(sumAE/n).toFixed(4)}`);
console.log(`  Viés: ${(sumVies/n).toFixed(4)}`);
console.log(`  R²: ${r2.toFixed(4)}`);
console.log(`  Acerto: ${((acertos/n)*100).toFixed(1)}% (${acertos}/${n})`);
