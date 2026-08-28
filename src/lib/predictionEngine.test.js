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
  extrairCabecalhoJogos,
  calcularMediaPorMando,
  mediaComRecencia,
  desvioPadrao,
} from "./predictionEngine";

describe("parseStatsHubText — dados reais do StatsHub com Histórico", () => {
  it("extrai corretamente o cabeçalho de jogos (_jogos_header)", () => {
    const texto = `Stat Type	
H
2-0
24 May
A
1-1
17 May
Goals
2.30	1.10	1.20	
2
0	
1
1`;
    const stats = parseStatsHubText(texto);
    expect(stats._jogos_header).toHaveLength(2);
    expect(stats._jogos_header[0]).toEqual({ mando: "H", placar: "2-0", data: "24 May" });
    expect(stats._jogos_header[1]).toEqual({ mando: "A", placar: "1-1", data: "17 May" });
  });

  it("extrai perfeitamente a sequência mista de 20 jogos H/A do Fulham", () => {
    const fulhamHeader = `Stat Type	
H
2-0
24 May
A
1-1
17 May
H
3-1
10 May
A
0-1
03 May
H
2-2
26 Apr
A
1-2
19 Apr
A
0-3
12 Apr
H
1-0
05 Apr
A
2-1
29 Mar
H
3-0
15 Mar
H
1-1
08 Mar
H
2-0
01 Mar
A
1-3
22 Feb
A
0-0
15 Feb
A
1-1
08 Feb
H
2-1
01 Feb
A
0-2
25 Jan
H
3-1
18 Jan
A
1-0
11 Jan
H
2-0
04 Jan
Goals
2.50	1.30	1.20`;

    const stats = parseStatsHubText(fulhamHeader);
    expect(stats._jogos_header).toHaveLength(20);
    const mandos = stats._jogos_header.map(j => j.mando).join(" ");
    expect(mandos).toBe("H A H A H A A H A H H H A A A H A H A H");
  });

  it("extrai valores jogo-a-jogo (historico), media_casa, media_recente e desvio_padrao", () => {
    const texto = `Stat Type	
H
2-0
24 May
A
1-1
17 May
H
3-1
10 May
Goals
2.30	1.10	1.20	
2
0	
1
1	
3
1`;
    const stats = parseStatsHubText(texto);
    expect(stats.goals.t).toBeCloseTo(1.10, 2);
    expect(stats.goals.c).toBeCloseTo(1.20, 2);
    expect(stats.goals.historico).toHaveLength(3);
    expect(stats.goals.historico[0]).toEqual({ t: 2, c: 0 });
    expect(stats.goals.historico[1]).toEqual({ t: 1, c: 1 });
    expect(stats.goals.historico[2]).toEqual({ t: 3, c: 1 });

    expect(stats.goals.media_casa).toBeCloseTo(2.5, 1); // (2 + 3) / 2
    expect(stats.goals.media_fora).toBeCloseTo(1.0, 1); // 1 / 1
    expect(stats.goals.media_recente).toBeGreaterThan(0);
    expect(stats.goals.desvio_padrao).toBeGreaterThan(0);
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

  it("calcGols() [Poisson GLM Podado] projeta expectativas de gols positivas", () => {
    const xgHome = calcGols(dummyStatsCasa, dummyStatsFora, true);
    const xgAway = calcGols(dummyStatsFora, dummyStatsCasa, false);
    expect(xgHome.value).toBeGreaterThan(0);
    expect(xgAway.value).toBeGreaterThan(0);
    // O GLM deve retornar os campos do modelo, não da heurística antiga
    expect(xgHome.details).toHaveProperty("modelo");
    expect(xgHome.details.modelo).toContain("Poisson GLM");
    expect(xgHome.details).toHaveProperty("eta");
    expect(xgHome.details).toHaveProperty("xg_atk");
  });

  it("calcGols() [Poisson GLM] — teste de regressão com inputs do primeiro jogo de teste out-of-sample", () => {
    // Ancoragem nos valores reais do primeiro jogo do conjunto de teste (split 80/20 cronológico sobre 202 jogos):
    // Home xG=0.33, Away goals_c=0.30, Away sot_c=0.50  -> predH=0.9779
    // Away xG=0.35, Home goals_c=0.25, Home sot_c=1.55  -> predA=1.0186
    // Total previsto: ~1.9965 (gols_real: home=1, away=1)
    const atkHome = { xg: { t: 0.33 } };
    const defFora = { goals: { c: 0.30 }, shots_on_target: { c: 0.50 } };
    const predHome = calcGols(atkHome, defFora, true);

    const atkAway = { xg: { t: 0.35 } };
    const defCasa = { goals: { c: 0.25 }, shots_on_target: { c: 1.55 } };
    const predAway = calcGols(atkAway, defCasa, false);

    expect(predHome.value).toBeCloseTo(0.98, 1);
    expect(predAway.value).toBeCloseTo(1.02, 1);
    expect(predHome.value + predAway.value).toBeCloseTo(2.00, 0);
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
