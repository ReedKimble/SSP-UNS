export interface StructuralSpaceConfig {
  tokenBuckets: number;
  clauseBins: number;
}

export interface AcousticSpaceConfig {
  timeBuckets: number;
  pitchBins: number;
  durationBins: number;
  intensityBins: number;
  timbreIds: number;
  articulationIds: number;
}

export interface ProsodySpaceConfig {
  tempoBins: number;
  intensityBiasBins: number;
  pitchBiasBins: number;
  tensionBins: number;
}

export interface MicrostateConfig {
  structural?: Partial<StructuralSpaceConfig>;
  acoustic?: Partial<AcousticSpaceConfig>;
  prosody?: Partial<ProsodySpaceConfig>;
}

export const STRUCTURAL_DEFAULTS: StructuralSpaceConfig = {
  tokenBuckets: 3,
  clauseBins: 4,
};

export const ACOUSTIC_DEFAULTS: AcousticSpaceConfig = {
  timeBuckets: 32,
  pitchBins: 32,
  durationBins: 16,
  intensityBins: 16,
  timbreIds: 8,
  articulationIds: 8,
};

export const PROSODY_DEFAULTS: ProsodySpaceConfig = {
  tempoBins: 8,
  intensityBiasBins: 8,
  pitchBiasBins: 8,
  tensionBins: 8,
};

export function resolveMicrostateConfig(config?: MicrostateConfig) {
  return {
    structural: { ...STRUCTURAL_DEFAULTS, ...(config?.structural ?? {}) },
    acoustic: { ...ACOUSTIC_DEFAULTS, ...(config?.acoustic ?? {}) },
    prosody: { ...PROSODY_DEFAULTS, ...(config?.prosody ?? {}) },
  };
}

export function bucketizeToken(index: number, total: number, buckets: number): number {
  if (buckets <= 1) return 0;
  if (total <= 1) return 0;
  const ratio = index / (total - 1);
  return Math.min(buckets - 1, Math.floor(ratio * buckets));
}

export function selectPhrasePositionId(position?: string): number {
  switch (position) {
    case "onset":
      return 0;
    case "cadence":
      return 2;
    case "medial":
    default:
      return 1;
  }
}
