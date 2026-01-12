import type { ProtoLanguageModel } from 'uns-ssp'

export const demoModel: ProtoLanguageModel = {
  title: 'Demo SSP Model',
  version: '0.0.1',
  instruments: {
    choir: 52,
    flute: 73,
  },
  speakers: {
    Alice: {
      default_octave: 'High',
      instrument: 'choir',
      base_intensity: 104,
    },
    Bob: {
      default_octave: 'Low',
      instrument: 'flute',
      base_intensity: 96,
    },
  },
  emotion_profiles: {
    neutral: {
      tempo_multiplier: 1,
      intensity_bias: 0,
      pitch_bias: 0,
      tension: 0.4,
    },
    alert: {
      tempo_multiplier: 1.1,
      intensity_bias: 12,
      pitch_bias: 2,
      tension: 0.85,
    },
    calm: {
      tempo_multiplier: 0.9,
      intensity_bias: -6,
      pitch_bias: -1,
      tension: 0.25,
    },
  },
  lexicon: {
    I: {
      gloss: 'speaker-as-agent',
      role: 'agent',
      relation_type: null,
      preferred_phrase_position: 'onset',
      base_notes: [
        { pitch: 62, duration: 240, intensity: 90 },
        { pitch: 67, duration: 240, intensity: 95 },
      ],
    },
    see: {
      gloss: 'perceive',
      role: 'experiencer',
      relation_type: 'perceive',
      preferred_phrase_position: 'medial',
      base_notes: [
        { pitch: 66, duration: 240, intensity: 85 },
        { pitch: 69, duration: 240, intensity: 88 },
      ],
    },
    wolf: {
      gloss: 'predator alert',
      role: 'theme',
      relation_type: 'exist',
      preferred_phrase_position: 'cadence',
      base_notes: [
        { pitch: 70, duration: 240, intensity: 92 },
        { pitch: 65, duration: 360, intensity: 96 },
      ],
    },
    here: {
      gloss: 'deictic location',
      role: 'location',
      relation_type: 'location',
      preferred_phrase_position: 'cadence',
      base_notes: [
        { pitch: 60, duration: 240, intensity: 80 },
        { pitch: 57, duration: 240, intensity: 78 },
      ],
    },
  },
  parameters: {
    tick_division: 480,
    default_tempo_bpm: 96,
    long_pause_ticks: 960,
    sentence_break_ticks: 960,
    octave_offsets: {
      Low: -12,
      Medium: 0,
      High: 12,
    },
  },
}
