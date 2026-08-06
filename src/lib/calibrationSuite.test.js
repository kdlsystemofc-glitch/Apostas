import { describe, it, expect } from "vitest";
import {
  analisarJogo,
  negativeBinomialOver,
  bayesianShrinkage,
  calcularQuarterKelly
} from "./predictionEngine";

describe("Phase 6 — Suíte de Testes Estatísticos e Calibração V2", () => {
  // Amostra Benchmark de 20 Jogos de Alta Relevância
  const datasetBenchmark = Array.from({ length: 20 }, (_, i) => {
    const xGHomeReal = 1.2 + (i % 5) * 0.3;
    const xGAwayReal = 0.9 + (i % 4) * 0.2;
    return {
      id: i + 1,
      home: {
        goals: { t: 1.8 + (i % 3) * 0.2, c: 1.0 },
        corners: { t: 5.5 + (i % 4) * 0.5, c: 4.0 },
        cards: { t: 2.1, c: 1.8 },
        fouls: { t: 11.5, c: 10.0 },
        xg: { t: xGHomeReal, c: 1.1 },
        shots_on_target: { t: 4.8, c: 3.5 },
      },
      away: {
        goals: { t: 1.1, c: 1.6 },
        corners: { t: 4.2, c: 5.8 },
        cards: { t: 2.4, c: 1.5 },
        fouls: { t: 13.0, c: 11.0 },
        xg: { t: xGAwayReal, c: 1.5 },
        shots_on_target: { t: 3.6, c: 4.5 },
      },
      real: {
        goals_home: Math.round(xGHomeReal),
        goals_away: Math.round(xGAwayReal),
        corners_total: 9 + (i % 3),
        cards_total: 4 + (i % 2),
        fouls_total: 24 + (i % 4),
      }
    };
  });

  it("1. Viés Global de Expectativa de Gols (xG) deve estar dentro da margem de segurança (|Viés| < 0.30)", () => {
    let sumPrev = 0;
    let sumReal = 0;

    datasetBenchmark.forEach(m => {
      const res = analisarJogo(m.home, m.away);
      sumPrev += res.xg_total;
      sumReal += (m.real.goals_home + m.real.goals_away);
    });

    const mediaPrev = sumPrev / datasetBenchmark.length;
    const mediaReal = sumReal / datasetBenchmark.length;
    const vies = mediaPrev - mediaReal;

    expect(Math.abs(vies)).toBeLessThan(0.30);
  });

  it("2. Calibração Brier Score em Probabilidade 1X2 deve ser < 0.60 (Modelo Superior ao Aleatório 0.666)", () => {
    let brierScoreSum = 0;

    datasetBenchmark.forEach(m => {
      const res = analisarJogo(m.home, m.away);
      const isHomeWin = m.real.goals_home > m.real.goals_away ? 1 : 0;
      const isDraw = m.real.goals_home === m.real.goals_away ? 1 : 0;
      const isAwayWin = m.real.goals_home < m.real.goals_away ? 1 : 0;

      const pHome = res.p_casa_vence;
      const pDraw = res.p_empate;
      const pAway = res.p_fora_vence;

      const score = Math.pow(pHome - isHomeWin, 2) + Math.pow(pDraw - isDraw, 2) + Math.pow(pAway - isAwayWin, 2);
      brierScoreSum += score;
    });

    const brierMean = brierScoreSum / datasetBenchmark.length;
    expect(brierMean).toBeLessThan(0.60);
  });

  it("3. Distribuição de Binomial Negativa (NB2) deve conter a variação real de Faltas", () => {
    const probFoulsOver225 = negativeBinomialOver(24.5, 22.5, 12.0);
    expect(probFoulsOver225).toBeGreaterThan(0.50);
    expect(probFoulsOver225).toBeLessThan(0.85);
  });

  it("4. Critério de Quarter-Kelly deve manter stakes seguras abaixo de 10% da Banca", () => {
    const kelly = calcularQuarterKelly(0.65, 1.85);
    expect(kelly.isEVPlus).toBe(true);
    expect(kelly.stakePct).toBeLessThanOrEqual(10.0);
  });

  it("5. Teste de Consistência entre Amostras Curtas via Bayesian Shrinkage", () => {
    const obsVal = 4.0;
    const mediaLiga = 1.35;
    const valShrunk = bayesianShrinkage(obsVal, mediaLiga, 10, 5);

    // Amortece 66.7% da volatilidade em direção à liga
    expect(valShrunk).toBeCloseTo(2.23, 2);
  });
});
