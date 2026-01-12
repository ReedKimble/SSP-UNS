import type { Performance } from 'uns-ssp'
import { getToolkit } from './toolkit'
import { normalizeVector } from './unsWrappers'

const BASE_PITCH = 58
const PITCH_STEP = 3
const MIN_VELOCITY = 18

export function createPerformanceFromVector(vector: number[], label: string): Performance {
  const { model } = getToolkit()
  const tickDivision = model.parameters.tick_division
  const tempoBpm = model.parameters.default_tempo_bpm
  const speaker = Object.keys(model.speakers)[0]
  const emotionName = Object.keys(model.emotion_profiles)[0]
  const emotion = model.emotion_profiles[emotionName]
  const normalized = normalizeVector(vector)
  const events = normalized.map((value, index) => ({
    startTicks: index * tickDivision,
    durationTicks: tickDivision,
    pitch: BASE_PITCH + index * PITCH_STEP,
    velocity: Math.min(127, Math.max(MIN_VELOCITY, Math.round(value * 127))),
    speaker: speaker ?? 'MixSpeaker',
    noteIndex: index,
    lexeme: `mix-${index}`,
  }))
  return {
    utterance: {
      tokens: events.map((event) => `${event.lexeme}|${speaker ?? 'MixSpeaker'}`),
      speaker: speaker,
      emotion: emotionName,
      description: label,
    },
    emotion,
    tempoBpm,
    tickDivision,
    tracks: [
      {
        id: 'mix-track',
        speaker: speaker ?? 'MixSpeaker',
        channel: 0,
        events,
      },
    ],
  }
}
