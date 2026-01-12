export function normalizeNonNegativeVector(values: number[], epsilon = 1e-9): number[] {
  const sum = values.reduce((acc, value) => acc + Math.max(0, value), 0);
  if (sum <= epsilon) {
    const uniform = 1 / values.length;
    return values.map(() => uniform);
  }
  return values.map((value) => Math.max(0, value) / sum);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function quantize(value: number, bins: number, min: number, max: number): number {
  if (bins <= 1) return 0;
  const clamped = clamp(value, min, max);
  const normalized = (clamped - min) / (max - min);
  return Math.min(bins - 1, Math.floor(normalized * bins));
}
