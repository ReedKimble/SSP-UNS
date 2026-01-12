export type UnsVector = number[]

export interface UnsOperationResult {
  label: string
  vector: UnsVector
  notes: string
}

const EPSILON = 1e-6

function hashToken(token: string) {
  let hash = 0
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) | 0
  }
  return hash
}

export function normalizeVector(vector: UnsVector): UnsVector {
  const sum = vector.reduce((acc, value) => acc + Math.max(0, value), 0)
  if (sum <= EPSILON) {
    const uniform = 1 / vector.length
    return vector.map(() => uniform)
  }
  return vector.map((value) => Math.max(0, value) / sum)
}

export function mix(u: UnsVector, v: UnsVector, alpha: number): UnsOperationResult {
  const clampAlpha = Math.min(1, Math.max(0, alpha))
  const blended = u.map((value, index) => value * clampAlpha + v[index] * (1 - clampAlpha))
  return {
    label: 'MIX',
    vector: normalizeVector(blended),
    notes: `α=${clampAlpha.toFixed(2)} — convex mix preserving simplex mass`,
  }
}

export function mask(u: UnsVector, maskVector: UnsVector): UnsOperationResult {
  const masked = normalizeVector(u.map((value, index) => value * Math.max(0, maskVector[index])))
  return {
    label: 'MASK',
    vector: masked,
    notes: 'Component-wise attenuation followed by normalization',
  }
}

export function cancel(u: UnsVector, v: UnsVector): UnsOperationResult {
  const overlap = u.map((value, index) => Math.min(value, v[index]))
  const residualU = normalizeVector(u.map((value, index) => value - overlap[index]))
  const residualV = normalizeVector(v.map((value, index) => value - overlap[index]))
  const combined = normalizeVector(residualU.map((value, index) => value + residualV[index]))
  return {
    label: 'CANCEL',
    vector: combined,
    notes: 'Removes shared overlap and renormalizes residual energy',
  }
}

export function uniform(dim: number): UnsVector {
  return Array.from({ length: dim }, () => 1 / dim)
}

export function sampleVectors(dim = 8) {
  const base = normalizeVector(Array.from({ length: dim }, () => Math.random()))
  const contrast = normalizeVector(Array.from({ length: dim }, () => Math.random()))
  return { base, contrast }
}

export function vectorFromTokens(tokens: string[], dim = 8): UnsVector {
  if (tokens.length === 0) {
    return uniform(dim)
  }
  const accum = Array.from({ length: dim }, () => 0)
  tokens.forEach((rawToken, index) => {
    const token = rawToken.split('|')[0]
    const hash = Math.abs(hashToken(`${token}:${index}`)) % dim
    accum[hash] += 1
  })
  return normalizeVector(accum)
}
