/**
 * Lottery calculator x operator.
 * Distinct permutations of 2- or 3-digit strings, including leading zeros.
 * Examples: 112x -> x3, 122x -> x3, 123x -> x6, 111x -> x1.
 *
 * IMPORTANT: import xMultiplier inside the existing authoritative
 * numberCalRules.js; preserve your existing ':' and '>' calculations.
 */
export function xMultiplier(numberText) {
  const number = String(numberText ?? '').trim();
  if (!/^\d{2,3}$/.test(number)) {
    throw new Error('x requires a 2- or 3-digit number');
  }
  const unique = new Set(number).size;
  if (number.length === 2) return unique === 2 ? 2 : 1;
  if (unique === 3) return 6;
  if (unique === 2) return 3;
  return 1;
}

export function calculateXScore(numberText, baseValue) {
  const amount = Number(baseValue);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }
  return amount * xMultiplier(numberText);
}
