import { describe, it, expect } from "vitest";
import {
  parseStatsHubText,
  ancora,
  indice,
  resistencia,
  pesosDinamicos,
  poissonOver,
  negativeBinomialOver,
  bayesianShrinkage,
  calcularQuarterKelly,
  logGamma,
  calcGols,
  calcCorners,
  calcResultado,
  analisarJogo,
  COMMERCIAL_LINES,
} from "./predictionEngine";

describe("parseStatsHubText — dados reais do StatsHub", () => {
  it("extrai corretamente Goals de uma amostra real colada", () => {
    const texto = `Stat Type	
H
2-0
24 May
Goals
2.30	1.10	1.20	
2
0	
1
1`;
    const stats = parseStatsHubText(texto);
    expect(stats.goals.t).toBeCloseTo(1.10, 2);
    expect(stats.goals.c).toBeCloseTo(1.20, 2);
  });

  it("extrai corretamente Fouls de uma amostra real colada", () => {
    const texto = `Fouls
20.10	10.40	9.70	
13
6`;
    const stats = parseStatsHubText(texto);
    expect(stats.fouls.t).toBeCloseTo(10.40, 2);
    expect(stats.fouls.c).toBeCloseTo(9.70, 2);
  });
});

describe("Prediction Engine V2 — Primitivas Matemáticas e Estatísticas", () => {
  it("ancora() calcula a média entre ataque feito e defesa cedida", () => {
    expect(ancora(2.0, 1.0)).toBe(1.5);
    expect(ancora(0, 0)).toBe(0);
  });

  it("indice() calcula a intensidade relativa com trava de segurança em zero", () => {
    expect(indice(2.0, 1.0)).toBe(2.0 / 1.5);
    expect(indice(0, 0)).toBe(1.0);
  });

  it("resistencia() aplica compressão logarítmica com teto de 2.0", () => {
    expect(resistencia(1.5, 1.5)).toBeCloseTo(1.0, 2);
    expect(resistencia(10.0, 0.1)).toBeLessThanOrEqual(2.0);
  });

  it("pesosDinamicos() re-normaliza a soma dos pesos para 1.0 quando faltam estatísticas", () => {
    const comps = {
      fatorA: [0.5, 1.2],
      fatorB: [0.5, 0.8],
    };
    expect(pesosDinamicos(comps)).toBeCloseTo(1.0, 5);
  });

  it("bayesianShrinkage() encolhe médias de amostras curtas em direção à liga", () => {
    const res = bayesianShrinkage(3.0, 1.35, 10, 5);
    expect(res).toBeLessThan(3.0);
    expect(res).toBeGreaterThan(1.35);
  });

  it("logGamma() calcula logaritmo da função Gamma para Binomial Negativa", () => {
    expect(logGamma(1)).toBeCloseTo(0, 5);
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 4);
  });

  it("negativeBinomialOver() calcula probabilidade sobredispersa em cartões/faltas", () => {
    const probNB = negativeBinomialOver(4.5, 3.5, 4.0);
    expect(probNB).toBeGreaterThan(0);
    expect(probNB).toBeLessThan(1);
  });

  it("calcularQuarterKelly() sugere stake proporcional de gestão de risco", () => {
    const k = calcularQuarterKelly(0.60, 2.00);
    expect(k.isEVPlus).toBe(true);
    expect(k.stakePct).toBeGreaterThan(0);
    expect(k.evPct).toBeCloseTo(20.0, 1);
  });

  it("poissonOver() retorna probabilidades coerentes entre 0 e 1", () => {
    const p15 = poissonOver(2.5, 1.5);
    expect(p15).toBeGreaterThan(0.5);
    expect(p15).toBeLessThan(1.0);
  });
});

describe("Prediction Engine V2 — Motor Preditivo de Mercados", () => {
  const dummyStatsCasa = {
    goals: { t: 2.0, c: 0.8 },
    corners: { t: 6.0, c: 3.5 },
    cards: { t: 2.0, c: 1.5 },
    yellow_cards: { t: 1.8, c: 1.4 },
    xg: { t: 1.9, c: 0.9 },
    shots_on_target: { t: 5.5, c: 3.0 },
    shots_in_box: { t: 8.0, c: 4.0 },
    total_shots: { t: 14.0, c: 9.0 },
    clearances: { t: 18.0, c: 15.0 },
    gk_saves: { t: 2.5, c: 3.5 },
    fouls: { t: 12.0, c: 10.0 },
    tackles: { t: 15.0, c: 14.0 },
    interceptions: { t: 9.0, c: 8.0 },
  };

  const dummyStatsFora = {
    goals: { t: 1.2, c: 1.5 },
    corners: { t: 4.5, c: 5.0 },
    cards: { t: 2.5, c: 2.0 },
    yellow_cards: { t: 2.3, c: 1.8 },
    xg: { t: 1.1, c: 1.6 },
    shots_on_target: { t: 3.8, c: 4.8 },
    shots_in_box: { t: 5.0, c: 7.0 },
    total_shots: { t: 10.0, c: 13.0 },
    clearances: { t: 20.0, c: 16.0 },
    gk_saves: { t: 3.5, c: 2.8 },
    fouls: { t: 14.0, c: 11.0 },
    tackles: { t: 16.0, c: 12.0 },
    interceptions: { t: 8.0, c: 10.0 },
  };

  it("calcGols() projeta expectativas de gols positivas", () => {
    const xgHome = calcGols(dummyStatsCasa, dummyStatsFora, true);
    const xgAway = calcGols(dummyStatsFora, dummyStatsCasa, false);
    expect(xgHome.value).toBeGreaterThan(0);
    expect(xgAway.value).toBeGreaterThan(0);
  });

  it("calcCorners() calcula escanteios com multiplicador de mando", () => {
    const cHome = calcCorners(dummyStatsCasa, dummyStatsFora, true);
    expect(cHome.value).toBeGreaterThan(0);
  });

  it("calcResultado() gera matriz Dixon-Coles com BTTS Bivariado e Handicaps", () => {
    const res = calcResultado(1.8, 1.1);
    expect(res.p_casa_vence + res.p_empate + res.p_fora_vence).toBeCloseTo(1.0, 2);
    expect(["Vitória Casa", "Empate", "Vitória Fora"]).toContain(res.pick_1x2.resultado);
    expect(res.p_btts).toBeGreaterThan(0);
    expect(res.handicaps).toHaveProperty("dnb_home");
    expect(res.handicaps).toHaveProperty("ah_minus_15_home");
  });

  it("analisarJogo() executa o pipeline completo sem erros na V2 Engine", () => {
    const resultado = analisarJogo(dummyStatsCasa, dummyStatsFora);
    expect(resultado).toHaveProperty("xg_total");
    expect(resultado).toHaveProperty("xc_total");
    expect(resultado).toHaveProperty("pick_1x2");
    expect(resultado).toHaveProperty("handicaps");
    expect(resultado).toHaveProperty("p_btts");
  });
});

describe("Dicionário de Linhas Comerciais", () => {
  it("COMMERCIAL_LINES contém todas as linhas padrão Bet365/Pinnacle", () => {
    expect(COMMERCIAL_LINES.goals_total).toEqual([1.5, 2.5, 3.5, 4.5]);
    expect(COMMERCIAL_LINES.corners_total).toEqual([7.5, 8.5, 9.5, 10.5, 11.5, 12.5]);
    expect(COMMERCIAL_LINES.cards_total).toEqual([3.5, 4.5, 5.5, 6.5]);
  });
});
