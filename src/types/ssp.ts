export type OctaveName = "Low" | "Medium" | "High";
export type PhrasePosition = "onset" | "medial" | "cadence";
export type EmotionName = string;
export type SpeakerName = string;
export type LexemeName = string;

export interface NoteSpec {
  pitch: number;
  duration: number;
  intensity: number;
  articulation?: string;
}

export interface Lexeme {
  gloss: string;
  role: string | null;
  relation_type: string | null;
  preferred_phrase_position?: PhrasePosition;
  base_notes: NoteSpec[];
}

export interface Speaker {
  default_octave: OctaveName;
  instrument: string;
  base_intensity: number;
  id_color?: string;
}

export interface EmotionProfile {
  tempo_multiplier: number;
  intensity_bias: number;
  pitch_bias: number;
  tension: number;
}

export interface ProtoLanguageModel {
  title: string;
  version: string;
  description?: string;
  instruments: Record<string, number>;
  speakers: Record<SpeakerName, Speaker>;
  emotion_profiles: Record<EmotionName, EmotionProfile>;
  lexicon: Record<LexemeName, Lexeme>;
  parameters: {
    tick_division: number;
    default_tempo_bpm: number;
    long_pause_ticks: number;
    sentence_break_ticks: number;
    octave_offsets: Record<OctaveName, number>;
  };
}

export interface UtteranceToken {
  tokens: string[];
  emotion?: EmotionName;
  speaker?: SpeakerName;
  description?: string;
}

export interface ProtoLanguageExamples {
  examples: UtteranceToken[];
}
