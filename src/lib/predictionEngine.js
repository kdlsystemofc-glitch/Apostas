// ══════════════════════════════════════════════════════════════
// PREDICTION ENGINE — Port of Python predict.py
// ══════════════════════════════════════════════════════════════

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

// ── Parse pasted StatsHub data ──
// Detecta automaticamente o formato: Excel (nome + médias na mesma linha)
// ou StatsHub direto (nome do stat em linha isolada, médias na linha seguinte)
export function parseStatsHubText(text) {
  const stats = {};
  const lines = text.trim().split("\n");

  function extrairMedias(line) {
    // Pega todos os números da linha (inteiros e decimais)
    const parts = line.split("\t").map(p => p.trim()).filter(p => p);
    const nums = parts
      .map(p => parseFloat(p))
      .filter(n => !isNaN(n));
    // Precisa de ao menos 3 números: total, time, cedida
    return nums.length >= 3 ? nums : null;
  }

  // Tenta formato EXCEL primeiro (mais rápido — verifica a 1ª linha válida)
  const primeiraLinhaValida = lines.find(l => {
    const cols = l.split("\t");
    return cols[0]?.trim() && STAT_MAP[cols[0]?.trim()];
  });

  if (primeiraLinhaValida) {
    const cols = primeiraLinhaValida.split("\t");
    const nums = extrairMedias(primeiraLinhaValida.split("\t").slice(1).join("\t"));
    if (nums && nums.length >= 3 && cols.length >= 4) {
      // ── FORMATO EXCEL ──────────────────────────────────────
      for (const line of lines) {
        if (!line.trim()) continue;
        const cols = line.split("\t");
        const statName = cols[0]?.trim();
        if (statName && STAT_MAP[statName]) {
          const nums = extrairMedias(cols.slice(1).join("\t"));
          if (nums && nums.length >= 3) {
            stats[STAT_MAP[statName]] = { t: nums[1], c: nums[2] };
          }
        }
      }
      return stats;
    }
  }

  // ── FORMATO STATSHUB DIRETO ──────────────────────────────
  // Nome do stat em linha isolada, médias na linha seguinte
  let i = 0;
  while (i < lines.length) {
    const lineName = lines[i].split("\t")[0]?.trim();

    if (lineName && STAT_MAP[lineName]) {
      const key = STAT_MAP[lineName];
      // Busca a linha das médias nas próximas 4 linhas
      let found = false;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nums = extrairMedias(lines[j]);
        if (nums && nums.length >= 3) {
          stats[key] = { t: nums[1], c: nums[2] };
          i = j + 1;
          found = true;
          break;
        }
      }
      if (!found) i++;
    } else {
      i++;
    }
  }

  return stats;
}

// ── Helper: get stat value ──
function g(stats, key, campo = "t") {
  return stats?.[key]?.[campo] || 0.0;
}

// ── Core model functions ──
function indice(feito, cedido) {
  const ref = (feito + cedido) / 2;
  return ref > 0 ? feito / ref : 1.0;
}

function resistencia(cedidoDef, feitoAtk, cap = 2.0) {
  if (feitoAtk <= 0) return 1.0;
  return Math.min(Math.log1p(cedidoDef) / Math.log1p(feitoAtk), cap);
}

function ancora(timeFaz, advCede) {
  return (timeFaz + advCede) / 2;
}

function pesosDinamicos(componentes) {
  const validos = {};
  for (const [k, [p, v]] of Object.entries(componentes)) {
    if (v > 0) validos[k] = [p, v];
  }
  if (Object.keys(validos).length === 0) return 1.0;
  const totalPeso = Object.values(validos).reduce((s, [p]) => s + p, 0);
  return Object.values(validos).reduce((s, [p, v]) => s + (p / totalPeso) * v, 0);
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

export function sinalPoisson(prob) {
  if (prob >= 0.75) return { label: "FORTE OVER", color: "green" };
  if (prob >= 0.65) return { label: "OVER", color: "yellow" };
  if (prob <= 0.25) return { label: "FORTE UNDER", color: "red" };
  if (prob <= 0.35) return { label: "UNDER", color: "gray" };
  return { label: "NEUTRO", color: "gray" };
}

export function sinalPoissonGols(prob) {
  // Threshold mais alto que o padrão — gols têm zona OVER pouco confiável
  if (prob >= 0.78) return { label: "FORTE OVER", color: "green" };
  if (prob >= 0.70) return { label: "OVER", color: "yellow" };
  if (prob <= 0.22) return { label: "FORTE UNDER", color: "red" };
  if (prob <= 0.32) return { label: "UNDER", color: "gray" };
  return { label: "NEUTRO", color: "gray" };
}

// ── Market 1: Corners ──
function calcCorners(atk, def_, isHome = false) {
  const base = ancora(g(atk, "corners"), g(def_, "corners", "c"));

  const ofensivos = {
    shots_on_target:   [0.27, indice(g(atk, "shots_on_target"),   g(def_, "shots_on_target",   "c"))],
    shots_in_box:      [0.22, indice(g(atk, "shots_in_box"),      g(def_, "shots_in_box",      "c"))],
    big_chance_missed: [0.13, indice(g(atk, "big_chance_missed"), g(def_, "big_chance_missed", "c"))],
    crosses:           [0.13, indice(g(atk, "crosses"),           g(def_, "crosses",           "c"))],
    touches_opp_box:   [0.13, indice(g(atk, "touches_opp_box"),   g(def_, "touches_opp_box",   "c"))],
    total_shots:       [0.10, indice(g(atk, "total_shots"),       g(def_, "total_shots",       "c"))],
    possession:        [0.08, indice(g(atk, "possession", "t"),   g(def_, "possession", "c"))],
  };

  const defensivos = {
    gk_saves: [0.50, resistencia(g(def_, "gk_saves", "c"), g(atk, "shots_on_target"))],
    clearances: [0.25, resistencia(g(def_, "clearances", "c"), g(atk, "shots_in_box"))],
    shots_ced: [0.25, resistencia(g(def_, "shots_on_target", "c"), g(atk, "shots_on_target"))],
  };

  const io = pesosDinamicos(ofensivos);
  const id_ = pesosDinamicos(defensivos);
  const ic = 0.60 * io + 0.40 * id_;
  let xc = base * ic;
  if (isHome) {
    xc *= 1.15;
  }

  return {
    value: Math.round(xc * 100) / 100,
    details: {
      base: Math.round(base * 1000) / 1000,
      indice_ofensivo: Math.round(io * 10000) / 10000,
      indice_defensivo: Math.round(id_ * 10000) / 10000,
      indice_composto: Math.round(ic * 10000) / 10000,
      detalhes_of: Object.fromEntries(
        Object.entries(ofensivos).map(([k, [p, v]]) => [k, [p, Math.round(v * 1000) / 1000]])
      ),
      detalhes_def: Object.fromEntries(
        Object.entries(defensivos).map(([k, [p, v]]) => [k, [p, Math.round(v * 1000) / 1000]])
      ),
    },
  };
}

// ── Market 2: Goals ──
function calcGols(atk, def_, isHome = false) {
  const base = ancora(g(atk, "goals"), g(def_, "goals", "c"));

  const ofensivos = {
    xg:                 [0.22, indice(g(atk, "xg"),                 g(def_, "xg",                 "c"))],
    big_chance_scored:  [0.20, indice(g(atk, "big_chance_scored"),  g(def_, "big_chance_scored",  "c"))],
    shots_on_target:    [0.20, indice(g(atk, "shots_on_target"),    g(def_, "shots_on_target",    "c"))],
    shots_in_box:       [0.13, indice(g(atk, "shots_in_box"),       g(def_, "shots_in_box",       "c"))],
    touches_opp_box:    [0.13, indice(g(atk, "touches_opp_box"),    g(def_, "touches_opp_box",    "c"))],
    big_chance_created: [0.12, indice(g(atk, "big_chance_created"), g(def_, "big_chance_created", "c"))],
  };

  const defensivos = {
    gk_saves:   [0.42, resistencia(g(def_, "gk_saves", "c"), g(atk, "shots_on_target"))],
    shots_ced:  [0.26, resistencia(g(def_, "shots_on_target", "c"), g(atk, "shots_on_target"))],
    clearances: [0.16, resistencia(g(def_, "clearances", "c"), g(atk, "shots_in_box"))],
    errors:     [0.16, indice(g(atk, "errors_goal"), Math.max(g(def_, "errors_goal", "c"), 0.01))],
  };

  const io = pesosDinamicos(ofensivos);
  const id_ = pesosDinamicos(defensivos);
  const ic = 0.55 * io + 0.45 * id_;
  let xg = base * ic;
  if (!isHome) {
    xg *= 0.92;
  }

  return {
    value: Math.round(xg * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, io: Math.round(io * 10000) / 10000, id: Math.round(id_ * 10000) / 10000 },
  };
}

// ── Market 3: Shots on Target ──
function calcShotsOnTarget(atk, def_) {
  const base = ancora(g(atk, "shots_on_target"), g(def_, "shots_on_target", "c"));

  const ofensivos = {
    shots_in_box:       [0.36, indice(g(atk, "shots_in_box"),       g(def_, "shots_in_box",       "c"))],
    big_chance_created: [0.23, indice(g(atk, "big_chance_created"), g(def_, "big_chance_created", "c"))],
    total_shots:        [0.18, indice(g(atk, "total_shots"),        g(def_, "total_shots",        "c"))],
    touches_opp_box:    [0.13, indice(g(atk, "touches_opp_box"),    g(def_, "touches_opp_box",    "c"))],
    possession:         [0.10, indice(g(atk, "possession", "t"),    g(def_, "possession", "c"))],
  };

  const defensivos = {
    gk_saves: [0.60, resistencia(g(def_, "gk_saves", "c"), g(atk, "shots_on_target"))],
    clearances: [0.40, resistencia(g(def_, "clearances", "c"), g(atk, "shots_in_box"))],
  };

  const io = pesosDinamicos(ofensivos);
  const id_ = pesosDinamicos(defensivos);
  const ic = 0.60 * io + 0.40 * id_;
  const xs = base * ic;

  return {
    value: Math.round(xs * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, io: Math.round(io * 10000) / 10000, id: Math.round(id_ * 10000) / 10000 },
  };
}

// ── Market 4: BTTS ──
function calcBTTS(statsCasa, statsFora) {
  const xgCasa = calcGols(statsCasa, statsFora).value;
  const xgFora = calcGols(statsFora, statsCasa).value;

  const pCasaMarca = 1 - Math.exp(-xgCasa);
  const pForaMarca = 1 - Math.exp(-xgFora);
  let pBtts = pCasaMarca * pForaMarca;

  // Correção de correlação negativa: jogos de baixo xG total tendem a
  // ser mais defensivos, reduzindo a chance real de ambos marcarem
  // além do que a independência estatística sugere.
  const xgTotal = xgCasa + xgFora;
  if (xgTotal < 2.0) {
    pBtts *= 0.65;
  } else if (xgTotal < 3.0) {
    pBtts *= 0.78;
  } else if (xgTotal < 3.8) {
    pBtts *= 0.88;
  } else if (xgTotal < 4.5) {
    pBtts *= 0.94;
  }
  pBtts = Math.max(0, Math.min(1, pBtts));

  return {
    value: Math.round(pBtts * 10000) / 10000,
    details: {
      xg_casa: xgCasa,
      xg_fora: xgFora,
      p_casa_marca: Math.round(pCasaMarca * 10000) / 10000,
      p_fora_marca: Math.round(pForaMarca * 10000) / 10000,
    },
  };
}

// ── Market 5: Cards ──
function calcCartoes(atk, def_, isHome = false) {
  const baseMedia = ancora(g(atk, "cards"), g(def_, "cards", "c"));
  const baseMax = Math.max(g(atk, "cards"), g(def_, "cards", "c"));
  const base = baseMedia * 0.85 + baseMax * 0.15;

  const fatores = {
    fouls:           [0.25, indice(g(atk, "fouls"),           g(def_, "fouls",           "c"))],
    tackles:         [0.20, indice(g(atk, "tackles"),         g(def_, "tackles",         "c"))],
    interceptions:   [0.16, indice(g(atk, "interceptions"),   g(def_, "interceptions",   "c"))],
    dispossessed:    [0.15, indice(g(atk, "dispossessed"),    g(def_, "dispossessed",    "c"))],
    free_kicks_ced:  [0.12, indice(g(def_, "free_kicks"), Math.max(g(atk, "free_kicks"), 0.01))],
    yellow_hist:     [0.07, indice(g(atk, "yellow_cards"), Math.max(g(def_, "yellow_cards", "c"), 0.01))],
    offsides:        [0.05, indice(g(atk, "offsides"), Math.max(g(def_, "offsides", "c"), 0.01))],
  };

  const ic = pesosDinamicos(fatores);
  let xc = base * ic;
  if (isHome) {
    xc *= 0.92;
  }

  return {
    value: Math.round(xc * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, ic: Math.round(ic * 10000) / 10000 },
  };
}

// ── Market 6: Faltas ──
function calcFaltas(atk, def_) {
  const baseRaw = ancora(g(atk, "fouls"), g(def_, "fouls", "c"));
  const mult = baseRaw < 18 ? 1.28 : baseRaw < 22 ? 1.18 : 1.10;
  const base = baseRaw * mult;
  const fatores = {
    fouls:         [0.30, indice(g(atk, "fouls"),         g(def_, "fouls",         "c"))],
    tackles:       [0.22, indice(g(atk, "tackles"),       g(def_, "tackles",       "c"))],
    interceptions: [0.18, indice(g(atk, "interceptions"), g(def_, "interceptions", "c"))],
    dispossessed:  [0.15, indice(g(atk, "dispossessed"),  g(def_, "dispossessed",  "c"))],
    crosses:       [0.10, indice(g(atk, "crosses"),       g(def_, "crosses",       "c"))],
    offsides:      [0.05, indice(g(atk, "offsides"),      Math.max(g(def_, "offsides", "c"), 0.01))],
  };
  const ic = pesosDinamicos(fatores);
  return {
    value: Math.round(base * ic * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, ic: Math.round(ic * 10000) / 10000 },
  };
}

// ── Market 7: Defesas do Goleiro ──
// atk = time que ataca (gera os chutes), def_ = time cujo goleiro defende
function calcSaves(atk, def_) {
  const base = ancora(g(def_, "gk_saves", "t"), g(atk, "gk_saves", "c"));

  const fatores = {
    shots_on_target: [0.35, indice(g(atk, "shots_on_target"), g(def_, "shots_on_target", "c"))],
    shots_in_box:    [0.22, indice(g(atk, "shots_in_box"),    g(def_, "shots_in_box",    "c"))],
    big_chance_crtd: [0.18, indice(g(atk, "big_chance_created"), g(def_, "big_chance_created", "c"))],
    total_shots:     [0.13, indice(g(atk, "total_shots"),     g(def_, "total_shots",     "c"))],
    xg:              [0.12, indice(g(atk, "xg"), Math.max(g(def_, "xg", "c"), 0.01))],
  };

  const ic = pesosDinamicos(fatores);
  return {
    value: Math.round(base * ic * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, ic: Math.round(ic * 10000) / 10000 },
  };
}

// ── Market 9: Chutes Totais ──
function calcTotalShots(atk, def_) {
  const base = ancora(g(atk, "total_shots"), g(def_, "total_shots", "c"));
  const fatores = {
    shots_in_box:       [0.26, indice(g(atk, "shots_in_box"),       g(def_, "shots_in_box",       "c"))],
    touches_opp_box:    [0.26, indice(g(atk, "touches_opp_box"),    g(def_, "touches_opp_box",    "c"))],
    big_chance_created: [0.22, indice(g(atk, "big_chance_created"), g(def_, "big_chance_created", "c"))],
    possession:         [0.13, indice(g(atk, "possession", "t"),    g(def_, "possession", "c"))],
    crosses:            [0.13, indice(g(atk, "crosses"),            g(def_, "crosses",            "c"))],
  };
  const ic = pesosDinamicos(fatores);
  return {
    value: Math.round(base * ic * 100) / 100,
    details: { base: Math.round(base * 1000) / 1000, ic: Math.round(ic * 10000) / 10000 },
    lowConfidence: true,
  };
}

// ── Full match analysis ──
export function analisarJogo(statsCasa, statsFora) {
  const corners_casa = calcCorners(statsCasa, statsFora, true);
  const corners_fora = calcCorners(statsFora, statsCasa, false);
  const gols_casa = calcGols(statsCasa, statsFora, true);
  const gols_fora = calcGols(statsFora, statsCasa, false);

  const shots_casa = calcShotsOnTarget(statsCasa, statsFora);
  const shots_fora = calcShotsOnTarget(statsFora, statsCasa);
  const btts = calcBTTS(statsCasa, statsFora);
  const cards_casa = calcCartoes(statsCasa, statsFora, true);
  const cards_fora = calcCartoes(statsFora, statsCasa, false);

  const fouls_casa = calcFaltas(statsCasa, statsFora);
  const fouls_fora = calcFaltas(statsFora, statsCasa);

  const saves_goleiro_casa = calcSaves(statsFora, statsCasa);
  const saves_goleiro_fora = calcSaves(statsCasa, statsFora);

  const totalshots_casa = calcTotalShots(statsCasa, statsFora);
  const totalshots_fora = calcTotalShots(statsFora, statsCasa);

  return {
    xc_casa: corners_casa.value,
    xc_fora: corners_fora.value,
    xc_total: Math.round((corners_casa.value + corners_fora.value) * 100) / 100,
    dc: corners_casa.details,
    df: corners_fora.details,

    xg_casa: gols_casa.value,
    xg_fora: gols_fora.value,
    xg_total: Math.round((gols_casa.value + gols_fora.value) * 100) / 100,

    xs_casa: shots_casa.value,
    xs_fora: shots_fora.value,
    xs_total: Math.round((shots_casa.value + shots_fora.value) * 100) / 100,

    p_btts: btts.value,
    db: btts.details,

    xcard_casa: cards_casa.value,
    xcard_fora: cards_fora.value,
    xcard_total: Math.round((cards_casa.value + cards_fora.value) * 100) / 100,

    xfouls_casa: fouls_casa.value,
    xfouls_fora: fouls_fora.value,
    xfouls_total: Math.round((fouls_casa.value + fouls_fora.value) * 100) / 100,

    xsaves_casa: saves_goleiro_casa.value,
    xsaves_fora: saves_goleiro_fora.value,
    xsaves_total: Math.round((saves_goleiro_casa.value + saves_goleiro_fora.value) * 100) / 100,

    xtotalshots_casa: totalshots_casa.value,
    xtotalshots_fora: totalshots_fora.value,
    xtotalshots_total: Math.round((totalshots_casa.value + totalshots_fora.value) * 100) / 100,

  };
}

export function sinalBTTS(p) {
  if (p >= 0.72) return { label: "PROVÁVEL", color: "green" };
  if (p >= 0.60) return { label: "POSSÍVEL", color: "yellow" };
  return { label: "IMPROVÁVEL", color: "red" };
}