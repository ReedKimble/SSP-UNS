const SCALE_FACTOR = 65536;

export function encodeReal(value: number): number {
  return Math.max(-2147483648, Math.min(2147483647, Math.round(value * SCALE_FACTOR)));
}

export function decodeReal(word: number): number {
  return word / SCALE_FACTOR;
}

export function encodeProbability(probability: number): number {
  const amplitude = Math.sqrt(Math.max(0, probability));
  return encodeReal(amplitude);
}
