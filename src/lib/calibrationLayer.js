// ══════════════════════════════════════════════════════════════
// CAMADA DE RECALIBRAÇÃO ESTATÍSTICA (OLS) & CONFIABILIDADE DE MERCADOS
// ══════════════════════════════════════════════════════════════

export const CALIBRATION_ENABLED = false; // Desativado temporariamente para isolar a Camada 1

// Fonte única da verdade de mercados sob validação estatística ("⚠ EM ESTUDO")
export const MERCADOS_EM_ESTUDO = [
  "goals_total",
  "cards_total",
  "saves_total",
  "corners_total",
  "shots_on_target_total",
  "fouls_total",
  "total_shots_total",
  "btts",
  "goals_home",
  "goals_away",
  "corners_home",
  "corners_away",
  "result_1x2",
  // Aliases curtos/chaves de interface
  "gols",
  "cartoes",
  "saves",
  "corners",
  "chutesgol",
  "faltas",
  "totalshots",
  "gols_casa",
  "gols_fora",
  "corners_casa",
  "corners_fora",
  "1x2",
  "pick_1x2",
];

export function isMercadoEmEstudo(key) {
  if (!key) return false;
  return MERCADOS_EM_ESTUDO.includes(key);
}

export const CALIBRATION_COEFFICIENTS = {
  corners_total:      { intercept: 0, slope: 1, fitted_on: 0, r_squared: null },
  goals_total:        { intercept: 0, slope: 1, fitted_on: 0, r_squared: null },
  cards_total:        { intercept: 0, slope: 1, fitted_on: 0, r_squared: null },
  shots_on_target:    { intercept: 0, slope: 1, fitted_on: 0, r_squared: null },
  fouls_total:        { intercept: 0, slope: 1, fitted_on: 0, r_squared: null },
  saves_total:        { intercept: 0, slope: 1, fitted_on: 0, r_squared: null },
  total_shots:        { intercept: 0, slope: 1, fitted_on: 0, r_squared: null },
};

export function setCalibrationCoefficients(newCoefs) {
  for (const key of Object.keys(CALIBRATION_COEFFICIENTS)) {
    if (newCoefs[key]) {
      CALIBRATION_COEFFICIENTS[key] = {
        ...CALIBRATION_COEFFICIENTS[key],
        ...newCoefs[key],
      };
    }
  }
}

export function aplicarCalibracao(valorBruto, mercadoKey) {
  if (!CALIBRATION_ENABLED) return valorBruto;
  const coef = CALIBRATION_COEFFICIENTS[mercadoKey];
  if (!coef) return valorBruto;
  const calibrado = coef.intercept + coef.slope * valorBruto;
  return Math.max(0, Math.round(calibrado * 100) / 100);
}

// Regressão OLS simples (y = a + bx) — usado pelo script de fit
export function fitOLS(pares) {
  const n = pares.length;
  if (n < 10) return null;

  const sumX = pares.reduce((s, [x]) => s + x, 0);
  const sumY = pares.reduce((s, [, y]) => s + y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0, den = 0;
  for (const [x, y] of pares) {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  }
  const slope = den !== 0 ? num / den : 1;
  const intercept = meanY - slope * meanX;

  let ssRes = 0, ssTot = 0;
  for (const [x, y] of pares) {
    ssRes += (y - (intercept + slope * x)) ** 2;
    ssTot += (y - meanY) ** 2;
  }
  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  return {
    intercept: Math.round(intercept * 100) / 100,
    slope: Math.round(slope * 100) / 100,
    r_squared: Math.round(rSquared * 1000) / 1000,
    fitted_on: n,
  };
}

// ── Classificação de Mercados por Evidência Estatística Rigorosa ──
export function classificarMercado(r2Test, pValor, nTestes = 12, vies = 0, mae = 0) {
  const alphaCorrigido = 0.05 / nTestes; // Correção de Bonferroni (0.05 / 12 = 0.004167)
  const pValNum = typeof pValor === "string" ? parseFloat(pValor) : Number(pValor);
  const r2Num = typeof r2Test === "string" ? parseFloat(r2Test) : Number(r2Test);
  const viesNum = typeof vies === "string" ? parseFloat(vies) : Number(vies);

  const temSinalReal = r2Num > 0.10 && pValNum < alphaCorrigido;
  const acertoFraco = pValNum > 0.30;

  if (temSinalReal) return "✓ VALIDADO (sinal confirmado)";
  if (acertoFraco && Math.abs(viesNum) < 0.30) return "⚠ Viés baixo, sem sinal discriminativo";
  return "⚠ EM ESTUDO";
}

// ── Regra Estrita de Substituição de Modelo (Proteção de Sinal Binário) ──
export function decidirSubstituicao(heuristico, candidato) {
  const heurAcerto = typeof heuristico.acerto === "string" ? parseFloat(heuristico.acerto) : Number(heuristico.acerto || heuristico.winRate || 0);
  const candAcerto = typeof candidato.acerto === "string" ? parseFloat(candidato.acerto) : Number(candidato.acerto || candidato.winRate || 0);

  const heurR2 = typeof heuristico.r2 === "string" ? parseFloat(heuristico.r2) : Number(heuristico.r2 || heuristico.r2Test || 0);
  const candR2 = typeof candidato.r2 === "string" ? parseFloat(candidato.r2) : Number(candidato.r2 || candidato.r2Test || 0);

  // NUNCA substituir se o candidato piorar a taxa de acerto em mais de 3%,
  // mesmo que melhore R²/MAE — a taxa de acerto (decisão binária) é o que importa para apostas.
  if (candAcerto < heurAcerto - 3.0) {
    return {
      substituir: false,
      motivo: "Candidato piora taxa de acerto apesar de R²/MAE melhores — rejeitado por proteção de sinal binário",
    };
  }

  // Só considera substituição se candidato for pelo menos igual ou melhor em AMBAS as dimensões (R² E acerto)
  if (candR2 > heurR2 && candAcerto >= heurAcerto) {
    return { substituir: true, motivo: "Melhora em ambas as dimensões (R² e acerto)" };
  }

  return { substituir: false, motivo: "Sem melhora clara em ambas as dimensões" };
}
