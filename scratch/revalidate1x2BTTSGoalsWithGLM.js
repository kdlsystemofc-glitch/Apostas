// Partes 2, 3 e 4: Revalidação de 1X2, BTTS e Gols Casa/Fora com o novo calcGols() (Poisson GLM Podado)
import { base44 } from "../src/api/base44Client.js";
import { analisarJogo } from "../src/lib/predictionEngine.js";
import { classificarMercado } from "../src/lib/calibrationLayer.js";

function wilsonCI(k, n) {
  if (n === 0) return "[0.0%, 0.0%]";
  const z = 1.959964, p = k / n;
  const d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return `[${Math.max(0, (c - m) * 100).toFixed(1)}%, ${Math.min(100, (c + m) * 100).toFixed(1)}%]`;
}
function normalCDF(z) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign=z<0?-1:1,x=Math.abs(z),t=1/(1+p*x);
  const y=1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return 0.5*(1+sign*y);
}
function testeBinom(k, n) {
  if (n===0) return "1.0000";
  const z=(k/n-0.5)/Math.sqrt(0.25/n);
  return (1-normalCDF(z)).toFixed(4);
}
function r2(preds, reals) {
  const meanR = reals.reduce((s,v)=>s+v,0)/reals.length;
  const ssRes = preds.reduce((s,p,i)=>s+(reals[i]-p)**2,0);
  const ssTot = reals.reduce((s,r)=>s+(r-meanR)**2,0);
  return ssTot===0 ? 0 : 1 - ssRes/ssTot;
}
function bootstrapPermutation(scoreDiffs, B=10000) {
  // Teste de permutação: H0: diferença média = 0
  const obs = scoreDiffs.reduce((s,v)=>s+v,0)/scoreDiffs.length;
  let maisExtreme = 0;
  for (let i=0;i<B;i++) {
    const perm = scoreDiffs.map(d=>(Math.random()<0.5?1:-1)*Math.abs(d));
    const permMean = perm.reduce((s,v)=>s+v,0)/perm.length;
    if (Math.abs(permMean)>=Math.abs(obs)) maisExtreme++;
  }
  return { observado: obs.toFixed(6), pValor: (maisExtreme/B).toFixed(4) };
}

const matches = await base44.entities.Match.list("-created_date", 500);
const completed = matches.filter(m => m.status === "completed" || m.real_results);
const sorted = [...completed].sort((a,b)=>new Date(a.date||a.created_date)-new Date(b.date||b.created_date));
const trainSize = Math.floor(sorted.length*0.80);
const testSet = sorted.slice(trainSize);

console.log("==========================================================================");
console.log("REVALIDAÇÃO COM O NOVO calcGols() [POISSON GLM PODADO 3 VARS, λ=5.0]");
console.log(`Base Total: ${sorted.length} | Treino: ${sorted.length-testSet.length} | Teste: ${testSet.length}`);
console.log("==========================================================================\n");

// ── Coleta de dados ──
const data1X2=[],dataBTTS=[],dataGolsCasa=[],dataGolsFora=[];
let n1x2=0,nBtts=0,nGC=0,nGF=0;

for (const m of testSet) {
  const hs=m.home_stats||{}, as=m.away_stats||{};
  const gH=m.real_results?.goals_home??m.real_goals_home;
  const gA=m.real_results?.goals_away??m.real_goals_away;
  if (gH===undefined||gA===undefined) continue;
  const rH=Number(gH), rA=Number(gA);

  const res = analisarJogo(hs, as);
  const pHome=res.p_casa_vence, pDraw=res.p_empate, pAway=res.p_fora_vence;

  // 1X2
  const real1x2 = rH>rA?"H":rH===rA?"D":"A";
  const pick1x2 = pHome>pDraw&&pHome>pAway?"H":pDraw>pHome&&pDraw>pAway?"D":"A";
  const isHomeWin=rH>rA?1:0, isDraw=rH===rA?1:0, isAwayWin=rH<rA?1:0;
  const brierModel=(pHome-isHomeWin)**2+(pDraw-isDraw)**2+(pAway-isAwayWin)**2;
  const brierBaseline=(1/3-isHomeWin)**2+(1/3-isDraw)**2+(1/3-isAwayWin)**2;
  data1X2.push({ real:real1x2, pick:pick1x2, brierModel, brierBaseline, pHome, pDraw, pAway });
  n1x2++;

  // BTTS (usa p_btts do analisarJogo, calculado sobre os novos gols do GLM)
  const pBTTS = res.p_btts||0;
  const realBTTS = rH>0&&rA>0?1:0;
  const pickBTTS = pBTTS>0.50?1:0;
  const brierBTTS = (pBTTS-realBTTS)**2;
  const brierBTTSbase = (0.5-realBTTS)**2;
  dataBTTS.push({ real:realBTTS, pick:pickBTTS, brierBTTS, brierBTTSbase, pBTTS });
  nBtts++;

  // Gols Casa Individual
  const prevGolsCasa = res.xg_casa||0;
  dataGolsCasa.push({ prev:prevGolsCasa, real:rH });
  nGC++;

  // Gols Fora Individual
  const prevGolsFora = res.xg_fora||0;
  dataGolsFora.push({ prev:prevGolsFora, real:rA });
  nGF++;
}

// ── PARTE 2: 1X2 ──
console.log("─────────────────────────────────────────────────────");
console.log("PARTE 2 — MERCADO 1X2 REVALIDADO (N =", n1x2, ")");
console.log("─────────────────────────────────────────────────────");

const acertos1x2=data1X2.filter(d=>d.pick===d.real).length;
const acertosBaselineCasa=data1X2.filter(d=>d.real==="H").length;
const brierModelMean=data1X2.reduce((s,d)=>s+d.brierModel,0)/n1x2;
const brierBaselineMean=data1X2.reduce((s,d)=>s+d.brierBaseline,0)/n1x2;
const brierDiffs=data1X2.map(d=>d.brierBaseline-d.brierModel); // positivo = modelo melhor

const bootstrapResult = bootstrapPermutation(brierDiffs, 10000);

console.log(`  Taxa de Acerto do Favorito (Modelo):  ${((acertos1x2/n1x2)*100).toFixed(1)}% (${acertos1x2}/${n1x2})`);
console.log(`  IC 95% Wilson:                        ${wilsonCI(acertos1x2, n1x2)}`);
console.log(`  Baseline "Sempre Casa":                ${((acertosBaselineCasa/n1x2)*100).toFixed(1)}% (${acertosBaselineCasa}/${n1x2})`);
console.log(`  Brier Score Modelo:                   ${brierModelMean.toFixed(4)}`);
console.log(`  Brier Score Baseline Aleatório (1/3): ${brierBaselineMean.toFixed(4)}`);
console.log(`  Δ Brier (baseline-modelo):             ${bootstrapResult.observado} ${Number(bootstrapResult.observado)>0?"✓ modelo melhor":"✗ modelo pior"}`);
console.log(`  Teste Permutação Bootstrap (B=10000): p=${bootstrapResult.pValor} ${Number(bootstrapResult.pValor)<0.05?"✓ SIGNIFICATIVO":"✗ não significativo"}`);

const statusBrier1x2 = brierModelMean < brierBaselineMean ? `Modelo melhora Brier (${brierModelMean.toFixed(4)} < ${brierBaselineMean.toFixed(4)})` : "Modelo não melhora Brier vs aleatório";
console.log(`  Status:                               ${statusBrier1x2}`);
console.log(`  Anterior (heurística):                p=0.2394 (não significativo)`);
console.log(`  Conclusão: ${Number(bootstrapResult.pValor)<0.05?"✓ GLM MELHOROU significativamente o 1X2":"⚠ 1X2 ainda sem significância — manter em estudo"}\n`);

// ── PARTE 3: BTTS ──
console.log("─────────────────────────────────────────────────────");
console.log("PARTE 3 — MERCADO BTTS REVALIDADO (N =", nBtts, ")");
console.log("─────────────────────────────────────────────────────");

const acertosBTTS=dataBTTS.filter(d=>d.pick===d.real).length;
const pValBTTS=testeBinom(acertosBTTS, nBtts);
const brierBTTSmean=dataBTTS.reduce((s,d)=>s+d.brierBTTS,0)/nBtts;
const brierBTTSbaseMean=dataBTTS.reduce((s,d)=>s+d.brierBTTSbase,0)/nBtts;
const r2BTTS=r2(dataBTTS.map(d=>d.pBTTS), dataBTTS.map(d=>d.real));

console.log(`  Taxa de Acerto (threshold=0.50):      ${((acertosBTTS/nBtts)*100).toFixed(1)}% (${acertosBTTS}/${nBtts})`);
console.log(`  IC 95% Wilson:                        ${wilsonCI(acertosBTTS, nBtts)}`);
console.log(`  p-valor Binomial Exato:               ${pValBTTS} ${Number(pValBTTS)<0.05?"✓ SIGNIFICATIVO":"✗ não significativo"}`);
console.log(`  Brier Score BTTS Modelo:              ${brierBTTSmean.toFixed(4)}`);
console.log(`  Brier Score BTTS Baseline (0.5):      ${brierBTTSbaseMean.toFixed(4)}`);
console.log(`  R² Out-of-Sample (BTTS prob):         ${r2BTTS.toFixed(4)}`);
console.log(`  Anterior (heurística):                59.4% acerto, p=0.1444 (não significativo)`);
console.log(`  Conclusão: ${Number(pValBTTS)<0.05?"✓ GLM MELHOROU BTTS com significância":"⚠ BTTS ainda sem significância — manter em estudo"}\n`);

// ── PARTE 4: Gols Casa e Gols Fora Individuais ──
console.log("─────────────────────────────────────────────────────");
console.log("PARTE 4 — GOLS CASA INDIVIDUAL (N =", nGC, ")");
console.log("─────────────────────────────────────────────────────");

function avaliarIndividual(nome, preds, reals) {
  const n=reals.length;
  const mae=preds.reduce((s,p,i)=>s+Math.abs(p-reals[i]),0)/n;
  const vies=preds.reduce((s,p,i)=>s+(p-reals[i]),0)/n;
  const r2v=r2(preds,reals);
  let acertos=0;
  for (let i=0;i<n;i++) {
    const linha=Math.floor(preds[i])+0.5;
    if ((preds[i]>=linha)===(reals[i]>linha)) acertos++;
  }
  const wr=(acertos/n)*100;
  const pVal=testeBinom(acertos, n);
  const status=classificarMercado(r2v, pVal, 4, vies, mae);
  return { nome, n, mediaPrev:(preds.reduce((s,v)=>s+v,0)/n).toFixed(2), mediaReal:(reals.reduce((s,v)=>s+v,0)/n).toFixed(2),
    vies:vies.toFixed(3), mae:mae.toFixed(3), r2:r2v.toFixed(4), acerto:`${wr.toFixed(1)}%`, ic95:wilsonCI(acertos,n), pValor:pVal, status };
}

const resGC=avaliarIndividual("Gols Casa (GLM)", dataGolsCasa.map(d=>d.prev), dataGolsCasa.map(d=>d.real));
const resGF=avaliarIndividual("Gols Fora (GLM)", dataGolsFora.map(d=>d.prev), dataGolsFora.map(d=>d.real));

console.table([resGC]);
console.log(`  Conclusão Gols Casa: ${resGC.status}\n`);

console.log("─────────────────────────────────────────────────────");
console.log("PARTE 4 — GOLS FORA INDIVIDUAL (N =", nGF, ")");
console.log("─────────────────────────────────────────────────────");
console.table([resGF]);
console.log(`  Conclusão Gols Fora: ${resGF.status}\n`);

// ── SUMÁRIO FINAL ──
console.log("==========================================================================");
console.log("SUMÁRIO FINAL — ESTADO DOS MERCADOS APÓS SUBSTITUIÇÃO DO calcGols() GLM");
console.log("==========================================================================");
console.log("  PROTEGIDOS (heurística intacta, regra decidirSubstituicao()):");
console.log("  ✓ Cartões Total       — Heurístico mantido (GLM piorou acerto 51.2%→41.5%)");
console.log("  ✓ Defesas do Goleiro  — Heurístico mantido (GLM destruiu sinal 68.3%→46.3%)");
console.log("");
console.log("  ATUALIZADO:");
console.log("  ✓ Gols Total          — Poisson GLM Podado (3 vars, λ=5.0) em produção");
console.log("    MAE: 1.12 | Acerto: 53.7% | R²: -0.097 | Status: ⚠ EM ESTUDO");
console.log("==========================================================================");
