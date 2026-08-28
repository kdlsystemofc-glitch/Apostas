// ══════════════════════════════════════════════════════════════
// PREDICTION ENGINE V2.3 — MOTOR AUTÔNOMO COM CAMADA DE RECALIBRAÇÃO ESTATÍSTICA (OLS)
// ══════════════════════════════════════════════════════════════
//
// 📌 NOTA DE DIREÇÃO FUTURA (DIRETRIZES DE LONGO PRAZO):
// 1. Mercados como Escanteios, Chutes no Gol, Faltas e Chutes Totais são reconhecidamente
//    mais difíceis de prever em futebol do que Gols/Cartões/Defesas. Dependem fortemente de
//    fatores contextuais específicos do jogo (arbitragem, estado do placar, tática).
// 2. Fonte de sinal futura não capturada atualmente: Identidade do Árbitro.
//    A inclusão de dados do árbitro pode melhorar significativamente os mercados de Faltas e Cartões.
// 3. Escalabilidade de amostra: Com mais dados (300-500+ jogos), regressões multivariadas
//    poderão ser reavaliadas através do botão de reavaliação na CalibrationView.
//

import { aplicarCalibracao } from "./calibrationLayer";

const STAT_MAP = {
  "Goals": "goals",
  "Corners": "corners",
  "Cards": "cards",
  "Yellow Cards": "yellow_cards",
  "Red Cards": "red_cards",
  "Crosses": "crosses",
  "Big Chance Created": "big_chance_created",
  "Big Chance Missed": "big_chance_missed",
  "Big Chance Scored": "big_chance_scored",
  "Expected Goals (xG)": "xg",
  "Shots On Target": "shots_on_target",
  "Shots In The Box": "shots_in_box",
  "Total Shots": "total_shots",
  "Shots Outside The Box": "shots_outside_box",
  "Clearances": "clearances",
  "Goalkeeper Saves": "gk_saves",
  "Fouls": "fouls",
  "Tackles": "tackles",
  "Possession": "possession",
  "Touches In Opp Box": "touches_opp_box",
  "Offsides": "offsides",
  "Passes": "passes",
  "Dispossessed": "dispossessed",
  "Interception Won": "interceptions",
  "Free Kicks": "free_kicks",
  "Throw Ins": "throw_ins",
  "Goal Kicks": "goal_kicks",
  "Errors Lead To Goal": "errors_goal",
  "Errors Lead To Shot": "errors_shot",
};

// ── Linhas Comerciais Reais de Apostas (Bet365 / Pinnacle / Superbet) ──
export const COMMERCIAL_LINES = {
  goals_total:        [1.5, 2.5, 3.5, 4.5],
  goals_team:         [0.5, 1.5, 2.5],
  corners_total:      [7.5, 8.5, 9.5, 10.5, 11.5, 12.5],
  corners_team:       [3.5, 4.5, 5.5, 6.5],
  cards_total:        [3.5, 4.5, 5.5, 6.5],
  cards_team:         [1.5, 2.5, 3.5],
  shots_target_total: [7.5, 8.5, 9.5, 10.5],
  shots_target_team:  [3.5, 4.5, 5.5],
  total_shots_total:  [21.5, 23.5, 25.5, 27.5],
  total_shots_team:   [10.5, 12.5, 14.5],
  saves_total:        [2.5, 3.5, 4.5, 5.5, 6.5, 7.5],
  saves_team:         [2.5, 3.5, 4.5],
  fouls_total:        [21.5, 23.5, 25.5, 27.5],
  fouls_team:         [10.5, 12.5, 14.5],
};

// ── Extração do Cabeçalho de Jogos (H/A, Placar, Data) ──
export function extrairCabecalhoJogos(text) {
  const lines = text.trim().split("\n");
  const jogos = [];
  let i = 0;

  while (i < lines.length && !lines[i].toLowerCase().includes("stat type")) i++;
  i++;

  const regexPlacar = /\d+\s*[-–—:]\s*\d+/;

  while (i < lines.length) {
    const linha = lines[i].trim();
    if (linha === "H" || linha === "A") {
      const mando = linha;
      const placar = lines[i + 1]?.trim() || null;
      const data = lines[i + 2]?.trim() || null;
      if (placar && regexPlacar.test(placar)) {
        jogos.push({ mando, placar, data });
        i += 3;
        continue;
      }
    }
    if (Object.keys(STAT_MAP).some(k => linha.toLowerCase().startsWith(k.toLowerCase()))) {
      break;
    }
    i++;
  }
  return jogos;
}

// ── Estatísticas Descritivas do Histórico ──
export function calcularMediaPorMando(historico, jogosHeader, mando) {
  if (!historico || !jogosHeader || historico.length === 0) return null;
  const valores = historico
    .filter((_, idx) => jogosHeader[idx]?.mando === mando)
    .map(valObj => (typeof valObj === "object" ? valObj.t : valObj));

  if (valores.length < 1) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

export function mediaComRecencia(historico, decaimento = 0.95) {
  if (!historico || historico.length === 0) return null;
  let somaPonderada = 0;
  let somaPesos = 0;

  historico.forEach((valObj, idx) => {
    const valor = typeof valObj === "object" ? valObj.t : valObj;
    const peso = Math.pow(decaimento, idx);
    somaPonderada += valor * peso;
    somaPesos += peso;
  });

  return somaPesos > 0 ? somaPonderada / somaPesos : null;
}

export function desvioPadrao(historico) {
  if (!historico || historico.length === 0) return 0;
  const valores = historico.map(valObj => (typeof valObj === "object" ? valObj.t : valObj));
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const variancia = valores.reduce((s, v) => s + Math.pow(v - media, 2), 0) / valores.length;
  return Math.sqrt(variancia);
}

// ── Parse pasted StatsHub data ──
export function parseStatsHubText(text) {
  const stats = {};
  const jogosHeader = extrairCabecalhoJogos(text);
  const lines = text.trim().split("\n");

  function extrairMedias(line) {
    const numbers = line.match(/\d+(?:\.\d+)?/g);
    if (!numbers || numbers.length < 3) {
      return null;
    }
    return {
      t: parseFloat(numbers[1]),
      c: parseFloat(numbers[2]),
    };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const [label, key] of Object.entries(STAT_MAP)) {
      if (line.toLowerCase() === label.toLowerCase() || line.toLowerCase().startsWith(label.toLowerCase())) {
        let values = null;
        let lineAvgIdx = -1;
        if (i + 1 < lines.length) {
          values = extrairMedias(lines[i + 1]);
          if (values) lineAvgIdx = i + 1;
        }
        if (!values) {
          values = extrairMedias(line);
          if (values) lineAvgIdx = i;
        }

        if (values) {
          stats[key] = { ...values };

          // Captura os valores jogo-a-jogo
          const gameValues = [];
          let j = lineAvgIdx + 1;

          while (j < lines.length && gameValues.length < (jogosHeader.length || 20)) {
            const lineJ = lines[j].trim();
            if (!lineJ) { j++; continue; }

            if (Object.keys(STAT_MAP).some(k => lineJ.toLowerCase().startsWith(k.toLowerCase()) && !lineJ.includes("\t"))) {
              break;
            }

            const nums = lineJ.split(/\s+/).map(v => parseFloat(v)).filter(n => !isNaN(n));
            if (nums.length >= 2) {
              gameValues.push({ t: nums[0], c: nums[1] });
              j++;
            } else if (nums.length === 1) {
              const lineNext = lines[j + 1]?.trim() || "";
              const numsNext = lineNext.split(/\s+/).map(v => parseFloat(v)).filter(n => !isNaN(n));
              if (numsNext.length >= 1) {
                gameValues.push({ t: nums[0], c: numsNext[0] });
                j += 2;
              } else {
                gameValues.push({ t: nums[0], c: 0 });
                j++;
              }
            } else {
              j++;
            }
          }

          if (gameValues.length > 0) {
            stats[key].historico = gameValues;
            if (jogosHeader.length > 0) {
              stats[key].media_casa = calcularMediaPorMando(gameValues, jogosHeader, "H");
              stats[key].media_fora = calcularMediaPorMando(gameValues, jogosHeader, "A");
            }
            stats[key].media_recente = mediaComRecencia(gameValues, 0.95);
            stats[key].desvio_padrao = desvioPadrao(gameValues);
          }
        }
        break;
      }
    }
  }

  if (jogosHeader.length > 0) {
    stats._jogos_header = jogosHeader;
  }

  return stats;
}

// ── Helper: get stat value ──
function g(stats, key, campo = "t") {
  return stats?.[key]?.[campo] || 0.0;
}

// ── Ponderação Bayesiana de Amostra (Bayesian Shrinkage) ──
export function bayesianShrinkage(val, mediaLiga = 1.35, k = 10, n = 5) {
  const w = n / (n + k);
  return w * val + (1 - w) * mediaLiga;
}

// ── Core model functions ──
export function indice(feito, cedido) {
  const ref = (feito + cedido) / 2;
  return ref > 0 ? feito / ref : 1.0;
}

export function resistencia(cedidoDef, feitoAtk, cap = 2.0) {
  if (feitoAtk <= 0) return 1.0;
  return Math.min(Math.log1p(cedidoDef) / Math.log1p(feitoAtk), cap);
}

export function ancora(timeFaz, advCede) {
  return (timeFaz + advCede) / 2;
}

export function pesosDinamicos(componentes) {
  const validos = {};
  for (const [k, [p, v]] of Object.entries(componentes)) {
    if (v > 0) validos[k] = [p, v];
  }
  if (Object.keys(validos).length === 0) return 1.0;
  const totalPeso = Object.values(validos).reduce((s, [p]) => s + p, 0);
  return Object.values(validos).reduce((s, [p, v]) => s + (p / totalPeso) * v, 0);
}

// ── Log-Gamma (Aproximação Lanczos para Binomial Negativa) ──
export function logGamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function factorial(n) {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function poissonOver(media, linha) {
  const k = Math.floor(linha);
  let under = 0;
  for (let i = 0; i <= k; i++) {
    under += Math.exp(-media) * Math.pow(media, i) / factorial(i);
  }
  return Math.max(0, Math.min(1, 1 - under));
}

// ── Distribuição Binomial Negativa (NB2 para Cartões e Faltas - Sobredispersão) ──
export function negativeBinomialOver(media, linha, r = 4.0) {
  if (media <= 0) return 0;
  const kMax = Math.floor(linha);
  let pUnder = 0;
  const p = r / (r + media);
  const logP = Math.log(p);
  const log1p = Math.log(1 - p);
  const logGammaR = logGamma(r);

  let logFact = 0;
  for (let k = 0; k <= kMax; k++) {
    if (k > 1) logFact += Math.log(k);
    const logPMF = logGamma(k + r) - logGammaR - logFact + r * logP + k * log1p;
    pUnder += Math.exp(logPMF);
  }
  return Math.max(0, Math.min(1, 1 - pUnder));
}

// ── Gestão de Banca e Risk Management via Quarter-Kelly ──
export function calcularQuarterKelly(prob, oddCasa) {
  const p = parseFloat(prob);
  const b = parseFloat(oddCasa) - 1;
  if (isNaN(p) || isNaN(b) || b <= 0 || p <= 0) return { stakePct: 0, isEVPlus: false, evPct: 0 };

  const q = 1 - p;
  const kellyFull = (p * b - q) / b;
  const kellyQuarter = Math.max(0, kellyFull * 0.25);
  const stakePct = Math.round(kellyQuarter * 100 * 10) / 10;
  const evPct = Math.round((p * (b + 1) - 1) * 100 * 10) / 10;

  return {
    stakePct,
    isEVPlus: kellyQuarter > 0 && evPct > 0,
    evPct,
  };
}

export function sinalPoisson(prob) {
  if (prob >= 0.65) return { label: "FORTE OVER", color: "green" };
  if (prob >= 0.55) return { label: "OVER", color: "yellow" };
  if (prob <= 0.35) return { label: "FORTE UNDER", color: "red" };
  if (prob <= 0.45) return { label: "UNDER", color: "gray" };
  return { label: "NEUTRO", color: "gray" };
}

export function sinalPoissonGols(prob) {
  if (prob >= 0.68) return { label: "FORTE OVER", color: "green" };
  if (prob >= 0.55) return { label: "OVER", color: "yellow" };
  if (prob <= 0.32) return { label: "FORTE UNDER", color: "red" };
  if (prob <= 0.45) return { label: "UNDER", color: "gray" };
  return { label: "NEUTRO", color: "gray" };
}

export function sinalBTTS(p) {
  if (p >= 0.60) return { label: "FORTE OVER", color: "green" };
  if (p >= 0.52) return { label: "OVER", color: "yellow" };
  if (p <= 0.38) return { label: "FORTE UNDER", color: "red" };
  if (p <= 0.48) return { label: "UNDER", color: "gray" };
  return { label: "NEUTRO", color: "gray" };
}

// ── Market 1: Corners ──
export function calcCorners(atk, def_, isHome = false) {
  const base = ancora(g(atk, "corners"), g(def_, "corners", "c"));

  const ofensivos = {
    shots_on_target:   [0.25, indice(g(atk, "shots_on_target"),   g(def_, "shots_on_target",   "c"))],
    shots_in_box:      [0.25, indice(g(atk, "shots_in_box"),      g(def_, "shots_in_box",      "c"))],
    crosses:           [0.20, indice(g(atk, "crosses"),           g(def_, "crosses",           "c"))],
    touches_opp_box:   [0.15, indice(g(atk, "touches_opp_box"),   g(def_, "touches_opp_box",   "c"))],
    big_chance_missed: [0.10, indice(g(atk, "big_chance_missed"), g(def_, "big_chance_missed", "c"))],
    total_shots:       [0.05, indice(g(atk, "total_shots"),       g(def_, "total_shots",       "c"))],
  };

  const defensivos = {
    clearances: [0.40, resistencia(g(def_, "clearances", "c"), g(atk, "shots_in_box"))],
    shots_ced:  [0.35, resistencia(g(def_, "shots_on_target", "c"), g(atk, "shots_on_target"))],
    gk_saves:   [0.25, resistencia(g(def_, "gk_saves", "t"), g(atk, "shots_on_target"))],
  };

  const io = pesosDinamicos(ofensivos);
  const id_ = pesosDinamicos(defensivos);
  const ic = 0.50 * io + 0.50 * id_;
  const raw = base * ic;
  let xc = raw;
  if (isHome) {
    xc *= 1.03;
  } else {
    xc *= 0.97;
  }

  return {
    value: Math.round(xc * 100) / 100,
    value_raw: Math.round(raw * 100) / 100,
    details: {
      base: Math.round(base * 1000) / 1000,
      indice_ofensivo: Math.round(io * 10000) / 10000,
      indice_defensivo: Math.round(id_ * 10000) / 10000,
      indice_composto: Math.round(ic * 10000) / 10000,
    },
  };
}

// ── Market 2: Goals ──
export function calcGols(atk, def_, isHome = false) {
  const base = ancora(g(atk, "goals"), g(def_, "goals", "c"));

  const ofensivos = {
    xg:                 [0.25, indice(g(atk, "xg"),                 g(def_, "xg",                 "c"))],
    shots_on_target:    [0.25, indice(g(atk, "shots_on_target"),    g(def_, "shots_on_target",    "c"))],
    big_chance_scored:  [0.20, indice(g(atk, "big_chance_scored"),  g(def_, "big_chance_scored",  "c"))],
    shots_in_box:       [0.15, indice(g(atk, "shots_in_box"),       g(def_, "shots_in_box",       "c"))],
    touches_opp_box:    [0.15, indice(g(atk, "touches_opp_box"),    g(def_, "touches_opp_box",    "c"))],
  };

  const defensivos = {
    shots_ced:  [0.45, resistencia(g(def_, "shots_on_target", "c"), g(atk, "shots_on_target"))],
    clearances: [0.25, resistencia(g(def_, "clearances", "c"), g(atk, "shots_in_box"))],
    errors:     [0.20, indice(g(atk, "errors_goal"), Math.max(g(def_, "errors_goal", "c"), 0.01))],
    gk_saves:   [0.10, resistencia(g(def_, "gk_saves", "t"), g(atk, "shots_on_target"))],
  };

  const io = pesosDinamicos(ofensivos);
  const id_ = pesosDinamicos(defensivos);
  const ic = 0.50 * io + 0.50 * id_;
  const raw = base * ic;
  let xg = raw;
  if (isHome) {
    xg *= 1.03;
  } else {
    xg *= 0.97;
  }

  return {
    value: Math.round(xg * 100) / 100,
    value_raw: Math.round(raw * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, io: Math.round(io * 10000) / 10000, id: Math.round(id_ * 10000) / 10000 },
  };
}

// ── Market 3: Shots on Target ──
export function calcShotsOnTarget(atk, def_, isHome = false) {
  const base = ancora(g(atk, "shots_on_target"), g(def_, "shots_on_target", "c"));

  const ofensivos = {
    shots_in_box:       [0.40, indice(g(atk, "shots_in_box"),       g(def_, "shots_in_box",       "c"))],
    big_chance_created: [0.25, indice(g(atk, "big_chance_created"), g(def_, "big_chance_created", "c"))],
    total_shots:        [0.20, indice(g(atk, "total_shots"),        g(def_, "total_shots",        "c"))],
    touches_opp_box:    [0.15, indice(g(atk, "touches_opp_box"),    g(def_, "touches_opp_box",    "c"))],
  };

  const defensivos = {
    shots_ced:  [0.60, resistencia(g(def_, "shots_on_target", "c"), g(atk, "shots_on_target"))],
    clearances: [0.40, resistencia(g(def_, "clearances", "c"), g(atk, "shots_in_box"))],
  };

  const io = pesosDinamicos(ofensivos);
  const id_ = pesosDinamicos(defensivos);
  const ic = 0.50 * io + 0.50 * id_;
  const raw = base * ic;
  let xs = raw;
  if (isHome) {
    xs *= 1.02;
  } else {
    xs *= 0.98;
  }

  return {
    value: Math.round(xs * 100) / 100,
    value_raw: Math.round(raw * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, ic: Math.round(ic * 10000) / 10000 },
  };
}

// ── Market 4: Cards ──
export function calcCartoes(atk, def_, isHome = false) {
  const baseMedia = ancora(g(atk, "cards"), g(def_, "cards", "c"));
  const baseMax = Math.max(g(atk, "cards"), g(def_, "cards", "c"));
  const base = baseMedia * 0.85 + baseMax * 0.15;

  const fatores = {
    yellow_hist:   [0.35, indice(g(atk, "yellow_cards"), Math.max(g(def_, "yellow_cards", "c"), 0.01))],
    fouls:         [0.30, indice(g(atk, "fouls"),         g(def_, "fouls",           "c"))],
    tackles:       [0.20, indice(g(atk, "tackles"),       g(def_, "tackles",         "c"))],
    interceptions: [0.15, indice(g(atk, "interceptions"), g(def_, "interceptions",   "c"))],
  };

  const ic = pesosDinamicos(fatores);
  const raw = base * ic;
  let xc = raw;
  if (isHome) {
    xc *= 0.97;
  }

  return {
    value: Math.round(xc * 100) / 100,
    value_raw: Math.round(raw * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, ic: Math.round(ic * 10000) / 10000 },
  };
}

// ── Market 5: Faltas ──
export function calcFaltas(atk, def_) {
  const base = ancora(g(atk, "fouls"), g(def_, "fouls", "c"));
  const fatores = {
    fouls:         [0.40, indice(g(atk, "fouls"),         g(def_, "fouls",         "c"))],
    tackles:       [0.30, indice(g(atk, "tackles"),       g(def_, "tackles",       "c"))],
    interceptions: [0.20, indice(g(atk, "interceptions"), g(def_, "interceptions", "c"))],
    dispossessed:  [0.10, indice(g(atk, "dispossessed"),  g(def_, "dispossessed",  "c"))],
  };
  const ic = pesosDinamicos(fatores);
  const raw = base * ic;
  return {
    value: Math.round(raw * 100) / 100,
    value_raw: Math.round(raw * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, ic: Math.round(ic * 10000) / 10000 },
  };
}

// ── Market 6: Defesas do Goleiro ──
export function calcSaves(atk, def_) {
  const base = ancora(g(def_, "gk_saves", "t"), g(atk, "shots_on_target", "c"));

  const fatores = {
    shots_on_target: [0.45, indice(g(atk, "shots_on_target"), g(def_, "shots_on_target", "c"))],
    shots_in_box:    [0.25, indice(g(atk, "shots_in_box"),    g(def_, "shots_in_box",    "c"))],
    big_chance:      [0.15, indice(g(atk, "big_chance_created"), g(def_, "big_chance_created", "c"))],
    total_shots:     [0.15, indice(g(atk, "total_shots"),     g(def_, "total_shots",     "c"))],
  };

  const ic = pesosDinamicos(fatores);
  const raw = base * ic;
  return {
    value: Math.round(raw * 100) / 100,
    value_raw: Math.round(raw * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, ic: Math.round(ic * 10000) / 10000 },
  };
}

// ── Market 7: Chutes Totais ──
export function calcTotalShots(atk, def_, isHome = false) {
  const base = ancora(g(atk, "total_shots"), g(def_, "total_shots", "c"));

  const fatores = {
    total_shots:     [0.40, indice(g(atk, "total_shots"),     g(def_, "total_shots",     "c"))],
    shots_in_box:    [0.25, indice(g(atk, "shots_in_box"),    g(def_, "shots_in_box",    "c"))],
    touches_opp_box: [0.20, indice(g(atk, "touches_opp_box"), g(def_, "touches_opp_box", "c"))],
    big_chance:      [0.15, indice(g(atk, "big_chance_created"), g(def_, "big_chance_created", "c"))],
  };

  const ic = pesosDinamicos(fatores);
  const raw = base * ic;
  let xt = raw;
  if (isHome) {
    xt *= 1.02;
  } else {
    xt *= 0.98;
  }
  return {
    value: Math.round(xt * 100) / 100,
    value_raw: Math.round(raw * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, ic: Math.round(ic * 10000) / 10000 },
  };
}

// ── Market 1X2, BTTS Bivariado e Handicaps (Matriz Dixon-Coles 8x8) ──
export function calcResultado(xgCasa, xgFora) {
  const maxGols = 8;
  let pCasa = 0, pEmpate = 0, pFora = 0;
  let pBTTS = 0;
  const placares = [];

  function poissonPMF(k, lambda) {
    let r = 1;
    for (let i = 1; i <= k; i++) r *= i;
    return Math.exp(-lambda) * Math.pow(lambda, k) / r;
  }

  function dixonColesTau(x, y, lambda1, lambda2, rho = -0.13) {
    let tau = 1.0;
    if (x === 0 && y === 0) tau = 1 - (lambda1 * lambda2 * rho);
    else if (x === 1 && y === 0) tau = 1 + (lambda1 * rho);
    else if (x === 0 && y === 1) tau = 1 + (lambda2 * rho);
    else if (x === 1 && y === 1) tau = 1 - rho;
    return Math.max(0, tau);
  }

  let totalP = 0;
  for (let i = 0; i <= maxGols; i++) {
    for (let j = 0; j <= maxGols; j++) {
      const pmfI = poissonPMF(i, xgCasa);
      const pmfJ = poissonPMF(j, xgFora);
      const tau = dixonColesTau(i, j, xgCasa, xgFora);
      const probScore = pmfI * pmfJ * tau;

      totalP += probScore;
      placares.push({ home: i, away: j, prob: probScore });

      if (i > j) pCasa += probScore;
      else if (i === j) pEmpate += probScore;
      else pFora += probScore;

      if (i >= 1 && j >= 1) pBTTS += probScore;
    }
  }

  if (totalP > 0) {
    pCasa /= totalP;
    pEmpate /= totalP;
    pFora /= totalP;
    pBTTS /= totalP;
  }

  placares.sort((a, b) => b.prob - a.prob);

  const dnbHome = pCasa / (pCasa + pFora || 1);
  const dnbAway = pFora / (pCasa + pFora || 1);

  let ahMinus15Home = 0;
  let ahMinus15Away = 0;
  placares.forEach(p => {
    if (p.home - p.away >= 2) ahMinus15Home += p.prob / (totalP || 1);
    if (p.away - p.home >= 2) ahMinus15Away += p.prob / (totalP || 1);
  });

  let resultadoEstrito = "Empate";
  let probVencedora = pEmpate;

  if (pCasa > pEmpate && pCasa > pFora) {
    resultadoEstrito = "Vitória Casa";
    probVencedora = pCasa;
  } else if (pFora > pCasa && pFora > pEmpate) {
    resultadoEstrito = "Vitória Fora";
    probVencedora = pFora;
  }

  const oddMinima = probVencedora > 0 ? (1 / probVencedora).toFixed(2) : "—";

  return {
    p_casa_vence: Math.round(pCasa * 10000) / 10000,
    p_empate:     Math.round(pEmpate * 10000) / 10000,
    p_fora_vence: Math.round(pFora * 10000) / 10000,
    p_btts:       Math.round(pBTTS * 10000) / 10000,
    handicaps: {
      dnb_home: Math.round(dnbHome * 10000) / 10000,
      dnb_away: Math.round(dnbAway * 10000) / 10000,
      ah_minus_15_home: Math.round(ahMinus15Home * 10000) / 10000,
      ah_minus_15_away: Math.round(ahMinus15Away * 10000) / 10000,
    },
    pick_1x2: {
      resultado: resultadoEstrito,
      prob: Math.round(probVencedora * 10000) / 10000,
      odd_minima: oddMinima,
    },
    placares_top5: placares.slice(0, 5).map(p => ({
      placar: `${p.home}×${p.away}`,
      prob: Math.round((p.prob / (totalP || 1)) * 10000) / 10000,
    })),
  };
}

// ── AVALIAÇÃO DE PALPITE EXPLÍCITO (GREEN / RED) PARA TODOS OS MERCADOS ──
export function avaliarPalpiteExplicit(mercadoKey, palpiteObj, realResults) {
  if (!realResults || Object.keys(realResults).length === 0) {
    return { status: "PENDENTE", isGreen: null };
  }

  const rr = realResults;
  let isGreen = false;

  switch (mercadoKey) {
    case "1x2": {
      const gh = Number(rr.goals_home ?? rr.real_goals_home);
      const ga = Number(rr.goals_away ?? rr.real_goals_away);
      if (isNaN(gh) || isNaN(ga)) return { status: "PENDENTE", isGreen: null };
      const pred = palpiteObj.palpite || palpiteObj.resultado;
      if (pred === "Vitória Casa" || pred?.startsWith("Vitória Mandante")) isGreen = gh > ga;
      else if (pred === "Vitória Fora" || pred?.startsWith("Vitória Visitante")) isGreen = ga > gh;
      else if (pred === "Empate") isGreen = gh === ga;
      break;
    }
    case "gols_total": {
      const real = Number(rr.goals_total ?? rr.real_goals_total);
      if (isNaN(real)) return { status: "PENDENTE", isGreen: null };
      isGreen = real > palpiteObj.linha;
      break;
    }
    case "gols_casa": {
      const real = Number(rr.goals_home ?? rr.real_goals_home);
      if (isNaN(real)) return { status: "PENDENTE", isGreen: null };
      isGreen = real > palpiteObj.linha;
      break;
    }
    case "gols_fora": {
      const real = Number(rr.goals_away ?? rr.real_goals_away);
      if (isNaN(real)) return { status: "PENDENTE", isGreen: null };
      isGreen = real > palpiteObj.linha;
      break;
    }
    case "corners_total": {
      const real = Number(rr.corners_total ?? rr.real_corners_total);
      if (isNaN(real)) return { status: "PENDENTE", isGreen: null };
      isGreen = real > palpiteObj.linha;
      break;
    }
    case "corners_casa": {
      const real = Number(rr.corners_home ?? rr.real_corners_home);
      if (isNaN(real)) return { status: "PENDENTE", isGreen: null };
      isGreen = real > palpiteObj.linha;
      break;
    }
    case "corners_fora": {
      const real = Number(rr.corners_away ?? rr.real_corners_away);
      if (isNaN(real)) return { status: "PENDENTE", isGreen: null };
      isGreen = real > palpiteObj.linha;
      break;
    }
    case "shots_total": {
      const real = Number(rr.shots_total ?? rr.real_shots_total);
      if (isNaN(real)) return { status: "PENDENTE", isGreen: null };
      isGreen = real > palpiteObj.linha;
      break;
    }
    case "cards_total": {
      const real = Number(rr.cards_total ?? rr.real_cards_total);
      if (isNaN(real)) return { status: "PENDENTE", isGreen: null };
      isGreen = real > palpiteObj.linha;
      break;
    }
    case "fouls_total": {
      const real = Number(rr.fouls_total ?? rr.real_fouls_total);
      if (isNaN(real)) return { status: "PENDENTE", isGreen: null };
      isGreen = real > palpiteObj.linha;
      break;
    }
    case "saves_total": {
      const real = Number(rr.saves_total ?? rr.real_saves_total);
      if (isNaN(real)) return { status: "PENDENTE", isGreen: null };
      isGreen = real > palpiteObj.linha;
      break;
    }
    case "totalshots_total": {
      const real = Number(rr.totalshots_total ?? rr.real_totalshots_total);
      if (isNaN(real)) return { status: "PENDENTE", isGreen: null };
      isGreen = real > palpiteObj.linha;
      break;
    }
    case "btts": {
      const realBTTS = Number(rr.btts ?? rr.real_btts);
      const gh = Number(rr.goals_home ?? rr.real_goals_home);
      const ga = Number(rr.goals_away ?? rr.real_goals_away);
      let isBothScored = realBTTS === 1;
      if (isNaN(realBTTS) && !isNaN(gh) && !isNaN(ga)) {
        isBothScored = gh > 0 && ga > 0;
      }
      isGreen = palpiteObj.palpite?.includes("SIM") ? isBothScored : !isBothScored;
      break;
    }
    default:
      return { status: "PENDENTE", isGreen: null };
  }

  return {
    status: isGreen ? "GREEN" : "RED",
    isGreen,
  };
}

// ── Seleção da Melhor Linha Comercial para Unificação das Apostas ──
export function melhorLinhaComercial(valor, linhasDisponiveis, probFn = poissonOver) {
  let melhor = null;
  for (const linha of linhasDisponiveis) {
    const prob = probFn(valor, linha);
    const distancia = Math.abs(prob - 0.5);
    if (!melhor || distancia > melhor.distancia) {
      melhor = { linha, prob, distancia };
    }
  }
  return melhor;
}

// ── Full match analysis (100% Autônomo com Recalibração OLS e Palpites Explícitos) ──
export function analisarJogo(statsCasa, statsFora) {
  const corners_casa = calcCorners(statsCasa, statsFora, true);
  const corners_fora = calcCorners(statsFora, statsCasa, false);
  const gols_casa = calcGols(statsCasa, statsFora, true);
  const gols_fora = calcGols(statsFora, statsCasa, false);
  const shots_casa = calcShotsOnTarget(statsCasa, statsFora, true);
  const shots_fora = calcShotsOnTarget(statsFora, statsCasa, false);
  const cartoes_casa = calcCartoes(statsCasa, statsFora, true);
  const cartoes_fora = calcCartoes(statsFora, statsCasa, false);
  const faltas_casa = calcFaltas(statsCasa, statsFora);
  const faltas_fora = calcFaltas(statsFora, statsCasa);
  const saves_casa = calcSaves(statsCasa, statsFora);
  const saves_fora = calcSaves(statsFora, statsCasa);
  const total_shots_casa = calcTotalShots(statsCasa, statsFora, true);
  const total_shots_fora = calcTotalShots(statsFora, statsCasa, false);

  // Camada 1 (Mecanística): Valores Brutos Somados Sem Ajustes
  const xc_total_bruto = Math.round(((corners_casa.value_raw || corners_casa.value) + (corners_fora.value_raw || corners_fora.value)) * 100) / 100;
  const xg_total_bruto = Math.round(((gols_casa.value_raw || gols_casa.value) + (gols_fora.value_raw || gols_fora.value)) * 100) / 100;
  const xs_total_bruto = Math.round(((shots_casa.value_raw || shots_casa.value) + (shots_fora.value_raw || shots_fora.value)) * 100) / 100;
  const xcard_total_bruto = Math.round(((cartoes_casa.value_raw || cartoes_casa.value) + (cartoes_fora.value_raw || cartoes_fora.value)) * 100) / 100;
  const xfouls_total_bruto = Math.round(((faltas_casa.value_raw || faltas_casa.value) + (faltas_fora.value_raw || faltas_fora.value)) * 100) / 100;
  const xsaves_total_bruto = Math.round(((saves_casa.value_raw || saves_casa.value) + (saves_fora.value_raw || saves_fora.value)) * 100) / 100;
  const xtotalshots_total_bruto = Math.round(((total_shots_casa.value_raw || total_shots_casa.value) + (total_shots_fora.value_raw || total_shots_fora.value)) * 100) / 100;

  // Camada 2 (Estatística): Recalibração OLS sobre o modelo mecanístico
  const xc_total = aplicarCalibracao(xc_total_bruto, "corners_total");
  const xg_total = aplicarCalibracao(xg_total_bruto, "goals_total");
  const xs_total = aplicarCalibracao(xs_total_bruto, "shots_on_target");
  const xcard_total = aplicarCalibracao(xcard_total_bruto, "cards_total");
  const xfouls_total = aplicarCalibracao(xfouls_total_bruto, "fouls_total");
  const xsaves_total = aplicarCalibracao(xsaves_total_bruto, "saves_total");
  const xtotalshots_total = aplicarCalibracao(xtotalshots_total_bruto, "total_shots");

  // Redistribuição proporcional mantendo a fração relativa de cada time
  const ratioCorners = xc_total_bruto > 0 ? xc_total / xc_total_bruto : 1.0;
  const val_corners_casa = Math.round(corners_casa.value * ratioCorners * 100) / 100;
  const val_corners_fora = Math.round(corners_fora.value * ratioCorners * 100) / 100;

  const ratioGols = xg_total_bruto > 0 ? xg_total / xg_total_bruto : 1.0;
  const val_gols_casa = Math.round(gols_casa.value * ratioGols * 100) / 100;
  const val_gols_fora = Math.round(gols_fora.value * ratioGols * 100) / 100;

  const ratioShots = xs_total_bruto > 0 ? xs_total / xs_total_bruto : 1.0;
  const val_shots_casa = Math.round(shots_casa.value * ratioShots * 100) / 100;
  const val_shots_fora = Math.round(shots_fora.value * ratioShots * 100) / 100;

  const ratioCards = xcard_total_bruto > 0 ? xcard_total / xcard_total_bruto : 1.0;
  const val_cards_casa = Math.round(cartoes_casa.value * ratioCards * 100) / 100;
  const val_cards_fora = Math.round(cartoes_fora.value * ratioCards * 100) / 100;

  const ratioFouls = xfouls_total_bruto > 0 ? xfouls_total / xfouls_total_bruto : 1.0;
  const val_faltas_casa = Math.round(faltas_casa.value * ratioFouls * 100) / 100;
  const val_faltas_fora = Math.round(faltas_fora.value * ratioFouls * 100) / 100;

  const ratioSaves = xsaves_total_bruto > 0 ? xsaves_total / xsaves_total_bruto : 1.0;
  const val_saves_casa = Math.round(saves_casa.value * ratioSaves * 100) / 100;
  const val_saves_fora = Math.round(saves_fora.value * ratioSaves * 100) / 100;

  const ratioTotalShots = xtotalshots_total_bruto > 0 ? xtotalshots_total / xtotalshots_total_bruto : 1.0;
  const val_total_shots_casa = Math.round(total_shots_casa.value * ratioTotalShots * 100) / 100;
  const val_total_shots_fora = Math.round(total_shots_fora.value * ratioTotalShots * 100) / 100;

  const resultado = calcResultado(val_gols_casa, val_gols_fora);

  // Seleção das melhores linhas comerciais padronizadas via COMMERCIAL_LINES
  const melhorGolsTotal = melhorLinhaComercial(xg_total, COMMERCIAL_LINES.goals_total);
  const melhorGolsCasa = melhorLinhaComercial(val_gols_casa, COMMERCIAL_LINES.goals_team);
  const melhorGolsFora = melhorLinhaComercial(val_gols_fora, COMMERCIAL_LINES.goals_team);
  const melhorCornersTotal = melhorLinhaComercial(xc_total, COMMERCIAL_LINES.corners_total);
  const melhorCornersCasa = melhorLinhaComercial(val_corners_casa, COMMERCIAL_LINES.corners_team);
  const melhorCornersFora = melhorLinhaComercial(val_corners_fora, COMMERCIAL_LINES.corners_team);
  const melhorShotsTotal = melhorLinhaComercial(xs_total, COMMERCIAL_LINES.shots_target_total);
  const melhorCardsTotal = melhorLinhaComercial(xcard_total, COMMERCIAL_LINES.cards_total, (v, l) => negativeBinomialOver(v, l, 4.0));
  const melhorFoulsTotal = melhorLinhaComercial(xfouls_total, COMMERCIAL_LINES.fouls_total, (v, l) => negativeBinomialOver(v, l, 12.0));
  const melhorSavesTotal = melhorLinhaComercial(xsaves_total, COMMERCIAL_LINES.saves_total);
  const melhorTotalShotsTotal = melhorLinhaComercial(xtotalshots_total, COMMERCIAL_LINES.total_shots_total);

  // GERAÇÃO DE PALPITES EXPLÍCITOS PARA CADA UM DOS MERCADOS
  const picks_explicitos = {
    pick_1x2: {
      palpite: resultado.pick_1x2.resultado,
      prob: resultado.pick_1x2.prob,
      odd_justa: resultado.pick_1x2.odd_minima,
    },
    gols_total: {
      palpite: `Over ${melhorGolsTotal.linha} Gols`,
      linha: melhorGolsTotal.linha,
      proj: xg_total,
      prob: melhorGolsTotal.prob,
      odd_justa: (1 / Math.max(0.01, melhorGolsTotal.prob)).toFixed(2),
    },
    gols_casa: {
      palpite: `Over ${melhorGolsCasa.linha} Gols Mandante`,
      linha: melhorGolsCasa.linha,
      proj: val_gols_casa,
      prob: melhorGolsCasa.prob,
      odd_justa: (1 / Math.max(0.01, melhorGolsCasa.prob)).toFixed(2),
    },
    gols_fora: {
      palpite: `Over ${melhorGolsFora.linha} Gols Visitante`,
      linha: melhorGolsFora.linha,
      proj: val_gols_fora,
      prob: melhorGolsFora.prob,
      odd_justa: (1 / Math.max(0.01, melhorGolsFora.prob)).toFixed(2),
    },
    corners_total: {
      palpite: `Over ${melhorCornersTotal.linha} Escanteios`,
      linha: melhorCornersTotal.linha,
      proj: xc_total,
      prob: melhorCornersTotal.prob,
      odd_justa: (1 / Math.max(0.01, melhorCornersTotal.prob)).toFixed(2),
    },
    corners_casa: {
      palpite: `Over ${melhorCornersCasa.linha} Escanteios Mandante`,
      linha: melhorCornersCasa.linha,
      proj: val_corners_casa,
      prob: melhorCornersCasa.prob,
      odd_justa: (1 / Math.max(0.01, melhorCornersCasa.prob)).toFixed(2),
    },
    corners_fora: {
      palpite: `Over ${melhorCornersFora.linha} Escanteios Visitante`,
      linha: melhorCornersFora.linha,
      proj: val_corners_fora,
      prob: melhorCornersFora.prob,
      odd_justa: (1 / Math.max(0.01, melhorCornersFora.prob)).toFixed(2),
    },
    shots_total: {
      palpite: `Over ${melhorShotsTotal.linha} Chutes no Gol`,
      linha: melhorShotsTotal.linha,
      proj: xs_total,
      prob: melhorShotsTotal.prob,
      odd_justa: (1 / Math.max(0.01, melhorShotsTotal.prob)).toFixed(2),
    },
    cards_total: {
      palpite: `Over ${melhorCardsTotal.linha} Cartões`,
      linha: melhorCardsTotal.linha,
      proj: xcard_total,
      prob: melhorCardsTotal.prob,
      odd_justa: (1 / Math.max(0.01, melhorCardsTotal.prob)).toFixed(2),
    },
    fouls_total: {
      palpite: `Over ${melhorFoulsTotal.linha} Faltas`,
      linha: melhorFoulsTotal.linha,
      proj: xfouls_total,
      prob: melhorFoulsTotal.prob,
      odd_justa: (1 / Math.max(0.01, melhorFoulsTotal.prob)).toFixed(2),
    },
    saves_total: {
      palpite: `Over ${melhorSavesTotal.linha} Defesas Goleiro`,
      linha: melhorSavesTotal.linha,
      proj: xsaves_total,
      prob: melhorSavesTotal.prob,
      odd_justa: (1 / Math.max(0.01, melhorSavesTotal.prob)).toFixed(2),
    },
    totalshots_total: {
      palpite: `Over ${melhorTotalShotsTotal.linha} Chutes Totais`,
      linha: melhorTotalShotsTotal.linha,
      proj: xtotalshots_total,
      prob: melhorTotalShotsTotal.prob,
      odd_justa: (1 / Math.max(0.01, melhorTotalShotsTotal.prob)).toFixed(2),
    },
    btts: {
      palpite: resultado.p_btts >= 0.50 ? "Ambas Marcam: SIM" : "Ambas Marcam: NÃO",
      prob: resultado.p_btts,
      odd_justa: resultado.p_btts > 0 ? (1 / resultado.p_btts).toFixed(2) : "—",
    },
  };

  return {
    raw_totals: {
      xg_total_bruto,
      xc_total_bruto,
      xs_total_bruto,
      xcard_total_bruto,
      xfouls_total_bruto,
      xsaves_total_bruto,
      xtotalshots_total_bruto,
    },

    xg_casa: val_gols_casa,
    xg_fora: val_gols_fora,
    xg_total,
    gols_details_casa: gols_casa.details,
    gols_details_fora: gols_fora.details,

    xc_casa: val_corners_casa,
    xc_fora: val_corners_fora,
    xc_total,
    corners_details_casa: corners_casa.details,
    corners_details_fora: corners_fora.details,

    xs_casa: val_shots_casa,
    xs_fora: val_shots_fora,
    xs_total,

    xcard_casa: val_cards_casa,
    xcard_fora: val_cards_fora,
    xcard_total,

    xfouls_casa: val_faltas_casa,
    xfouls_fora: val_faltas_fora,
    xfouls_total,

    xsaves_casa: val_saves_casa,
    xsaves_fora: val_saves_fora,
    xsaves_total,

    xtotalshots_casa: val_total_shots_casa,
    xtotalshots_fora: val_total_shots_fora,
    xtotalshots_total,

    p_casa_vence: resultado.p_casa_vence,
    p_empate:     resultado.p_empate,
    p_fora_vence: resultado.p_fora_vence,
    pick_1x2:     resultado.pick_1x2,
    placares_top5: resultado.placares_top5,
    handicaps:    resultado.handicaps,
    picks_explicitos,

    p_btts:       resultado.p_btts,
    db: {
      p_btts:       resultado.p_btts,
      p_casa_marca: Math.round((1 - Math.exp(-val_gols_casa)) * 10000) / 10000,
      p_fora_marca: Math.round((1 - Math.exp(-val_gols_fora)) * 10000) / 10000,
    },
  };
}