import { dataset55 } from "./dataset55.js";
import { analisarJogo } from "../src/lib/predictionEngine.js";

let stats = {
  gols_total: { ok: 0, fail: 0, viesSum: 0, maeSum: 0 },
  cantos_total: { ok: 0, fail: 0, viesSum: 0, maeSum: 0 },
  faltas_total: { ok: 0, fail: 0, viesSum: 0, maeSum: 0 },
  defesas_total: { ok: 0, fail: 0, viesSum: 0, maeSum: 0 },
  chutes_totais: { ok: 0, fail: 0, viesSum: 0, maeSum: 0 },
};

let count = 0;
dataset55.forEach(m => {
  const homeStats = {
    goals: { t: m.xg_casa || 1.4, c: 1.1 },
    corners: { t: m.xc_casa || 5.0, c: 4.5 },
    cards: { t: m.xcard_casa || 2.0, c: 2.0 },
    shots_on_target: { t: m.xs_casa || 4.5, c: 4.0 },
    fouls: { t: (m.xfouls_casa || 26) / 2, c: (m.xfouls_fora || 26) / 2 },
    gk_saves: { t: m.xsaves_casa || 3.0, c: 3.0 },
    total_shots: { t: m.xtotalshots_casa || 13.0, c: 12.0 },
  };

  const awayStats = {
    goals: { t: m.xg_fora || 1.2, c: 1.4 },
    corners: { t: m.xc_fora || 4.5, c: 5.0 },
    cards: { t: m.xcard_fora || 2.2, c: 1.8 },
    shots_on_target: { t: m.xs_fora || 4.0, c: 4.5 },
    fouls: { t: (m.xfouls_fora || 26) / 2, c: (m.xfouls_casa || 26) / 2 },
    gk_saves: { t: m.xsaves_fora || 3.0, c: 3.0 },
    total_shots: { t: m.xtotalshots_fora || 12.0, c: 13.0 },
  };

  const res = analisarJogo(homeStats, awayStats);

  const pGolsTot = res.xg_total;
  const rGolsTot = m.real_goals_total;
  if (rGolsTot !== undefined && rGolsTot !== null) {
    count++;
    const vies = pGolsTot - rGolsTot;
    stats.gols_total.viesSum += vies;
    stats.gols_total.maeSum += Math.abs(vies);
    const line = Math.floor(pGolsTot) + 0.5;
    const predOver = pGolsTot >= line;
    const realOver = rGolsTot > line;
    if (predOver === realOver) stats.gols_total.ok++;
    else stats.gols_total.fail++;
  }

  const pCantos = res.xc_total;
  const rCantos = m.real_corners_total;
  if (rCantos !== undefined && rCantos !== null) {
    const vies = pCantos - rCantos;
    stats.cantos_total.viesSum += vies;
    stats.cantos_total.maeSum += Math.abs(vies);
    const line = Math.floor(pCantos) + 0.5;
    const predOver = pCantos >= line;
    const realOver = rCantos > line;
    if (predOver === realOver) stats.cantos_total.ok++;
    else stats.cantos_total.fail++;
  }

  const pFaltas = res.xfouls_total;
  const rFaltas = m.real_fouls_total;
  if (rFaltas !== undefined && rFaltas !== null) {
    const vies = pFaltas - rFaltas;
    stats.faltas_total.viesSum += vies;
    stats.faltas_total.maeSum += Math.abs(vies);
    const line = Math.floor(pFaltas) + 0.5;
    const predOver = pFaltas >= line;
    const realOver = rFaltas > line;
    if (predOver === realOver) stats.faltas_total.ok++;
    else stats.faltas_total.fail++;
  }

  const pSaves = res.xsaves_total;
  const rSaves = m.real_saves_total;
  if (rSaves !== undefined && rSaves !== null) {
    const vies = pSaves - rSaves;
    stats.defesas_total.viesSum += vies;
    stats.defesas_total.maeSum += Math.abs(vies);
  }

  const pShotsTot = res.xtotalshots_total;
  const rShotsTot = m.real_totalshots_total;
  if (rShotsTot !== undefined && rShotsTot !== null) {
    const vies = pShotsTot - rShotsTot;
    stats.chutes_totais.viesSum += vies;
    stats.chutes_totais.maeSum += Math.abs(vies);
  }
});

console.log(`=== RE-CALIBRAÇÃO V2.1 EM ${count} JOGOS REAIS DO USUÁRIO ===`);
console.log(`Gols Total: Viés = ${(stats.gols_total.viesSum / count).toFixed(2)} | MAE = ${(stats.gols_total.maeSum / count).toFixed(2)} | WinRate = ${((stats.gols_total.ok / count)*100).toFixed(1)}%`);
console.log(`Cantos Total: Viés = ${(stats.cantos_total.viesSum / count).toFixed(2)} | MAE = ${(stats.cantos_total.maeSum / count).toFixed(2)} | WinRate = ${((stats.cantos_total.ok / count)*100).toFixed(1)}%`);
console.log(`Faltas Total: Viés = ${(stats.faltas_total.viesSum / count).toFixed(2)} | MAE = ${(stats.faltas_total.maeSum / count).toFixed(2)} | WinRate = ${((stats.faltas_total.ok / count)*100).toFixed(1)}%`);
console.log(`Defesas Total: Viés = ${(stats.defesas_total.viesSum / count).toFixed(2)} | MAE = ${(stats.defesas_total.maeSum / count).toFixed(2)}`);
console.log(`Chutes Totais: Viés = ${(stats.chutes_totais.viesSum / count).toFixed(2)} | MAE = ${(stats.chutes_totais.maeSum / count).toFixed(2)}`);
