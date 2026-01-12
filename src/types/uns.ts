export interface Complex32 {
  real: number;
  imag: number;
}

export type Word32 = number;

export interface UValue32 {
  data: Complex32[];
}

export interface UState32 extends UValue32 {}

export interface MicrostateSpace<K> {
  readonly size: number;
  readonly keys: K[];
  readonly indexByKey: Map<string, number>;
}

export type SemanticMicrostateKey = {
  conceptId: number;
  roleId: number;
  speakerId: number;
};

export type StructuralMicrostateKey = {
  tokenBucket: number;
  phrasePositionId: number;
  clauseId: number;
};

export type AcousticMicrostateKey = {
  timeBucket: number;
  pitchBin: number;
  durationBin: number;
  intensityBin: number;
  timbreId: number;
  articulationId: number;
};

export type ProsodyMicrostateKey = {
  emotionId: number;
  tempoBin: number;
  intensityBiasBin: number;
  pitchBiasBin: number;
  tensionBin: number;
};

export interface MicrostateSpaces {
  semantic: MicrostateSpace<SemanticMicrostateKey>;
  structural: MicrostateSpace<StructuralMicrostateKey>;
  acoustic: MicrostateSpace<AcousticMicrostateKey>;
  prosody: MicrostateSpace<ProsodyMicrostateKey>;
}

export interface SspUnsFrame {
  semanticState: UState32;
  structuralState: UState32;
  acousticState: UState32;
  prosodyState: UState32;
}
