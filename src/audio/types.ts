import { EmotionProfile, ProtoLanguageModel, SpeakerName, UtteranceToken } from "../types/ssp.js";

export interface NoteEvent {
  startTicks: number;
  durationTicks: number;
  pitch: number;
  velocity: number;
  speaker: SpeakerName;
  noteIndex: number;
  lexeme: string;
}

export interface Track {
  id: string;
  speaker: SpeakerName;
  channel: number;
  events: NoteEvent[];
}

export interface Performance {
  utterance: UtteranceToken;
  emotion: EmotionProfile;
  tempoBpm: number;
  tickDivision: number;
  tracks: Track[];
}

export interface PerformanceOptions {
  tempoScale?: number;
}

export interface PerformanceContext {
  model: ProtoLanguageModel;
  utterance: UtteranceToken;
  emotion: EmotionProfile;
  tempoBpm: number;
  tickDivision: number;
}
