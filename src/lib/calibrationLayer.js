// ══════════════════════════════════════════════════════════════
// CAMADA DE RECALIBRAÇÃO ESTATÍSTICA (OLS)
//
// Corrige o viés sistemático do modelo mecanístico usando regressão
// linear simples ajustada sobre o histórico real de jogos.
// ══════════════════════════════════════════════════════════════

export const CALIBRATION_ENABLED = false; // Desativado temporariamente para isolar a Camada 1

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
  // pares = [[valorBruto, valorReal], ...]
  const n = pares.length;
  if (n < 10) return null; // amostra insuficiente para confiar

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

  // R² (coeficiente de determinação)
  let ssRes = 0, ssTot = 0;
  for (const [x, y] of pares) {
    const pred = intercept + slope * x;
    ssRes += (y - pred) ** 2;
    ssTot += (y - meanY) ** 2;
  }
  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  return {
    intercept: Math.round(intercept * 1000) / 1000,
    slope: Math.round(slope * 1000) / 1000,
    fitted_on: n,
    r_squared: Math.round(rSquared * 1000) / 1000,
  };
}
