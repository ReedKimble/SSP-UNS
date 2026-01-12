import { ProtoLanguageModel, Speaker, UtteranceToken } from "../types/ssp.js";
import { parseTokens, ParsedWordToken } from "../parser/tokenParser.js";
import { Performance, Track } from "./types.js";
import { clamp } from "../utils/math.js";

export function buildPerformance(model: ProtoLanguageModel, utterance: UtteranceToken): Performance {
  const parsedTokens = parseTokens(utterance.tokens);
  const emotionName = utterance.emotion ?? "neutral";
  const emotion = model.emotion_profiles[emotionName] ?? firstValue(model.emotion_profiles);
  const tempoBpm = model.parameters.default_tempo_bpm * emotion.tempo_multiplier;
  const tickDivision = model.parameters.tick_division;

  const tracksBySpeaker = new Map<string, Track>();
  const channelAllocator = createChannelAllocator();
  const sentenceNotes: { track: Track; eventIndex: number }[] = [];

  let currentTime = 0;

  parsedTokens.forEach((token) => {
    if (token.kind === "pause") {
      flushSentence(sentenceNotes);
      currentTime += model.parameters.long_pause_ticks;
      return;
    }
    if (token.kind === "punct") {
      applySentenceInflection(sentenceNotes, token.punctuation);
      flushSentence(sentenceNotes);
      currentTime += model.parameters.sentence_break_ticks;
      return;
    }
    const lexeme = model.lexicon[token.word];
    if (!lexeme) {
      throw new Error(`Unknown lexeme '${token.word}'.`);
    }
    const speakerName = resolveSpeakerName(model, token, utterance);
    const speaker = model.speakers[speakerName];
    if (!speaker) {
      throw new Error(`Unknown speaker '${speakerName}'.`);
    }
    const track = getOrCreateTrack(tracksBySpeaker, speakerName, channelAllocator);
    lexeme.base_notes.forEach((note, noteIndex) => {
      const pitch = computePitch(model, note.pitch, token, speaker, emotion);
      const velocity = computeVelocity(note.intensity, speaker, emotion);
      const event = {
        startTicks: currentTime,
        durationTicks: note.duration,
        pitch,
        velocity,
        speaker: speakerName,
        noteIndex,
        lexeme: token.word,
      };
      track.events.push(event);
      sentenceNotes.push({ track, eventIndex: track.events.length - 1 });
      currentTime += note.duration;
    });
  });

  return {
    utterance,
    emotion,
    tempoBpm,
    tickDivision,
    tracks: Array.from(tracksBySpeaker.values()).map((track) => ({
      ...track,
      events: track.events.sort((a, b) => a.startTicks - b.startTicks),
    })),
  };
}

function computePitch(
  model: ProtoLanguageModel,
  basePitch: number,
  token: ParsedWordToken,
  speaker: Speaker,
  emotion: { pitch_bias: number }
): number {
  const octaveName = token.octaveOverride ?? speaker.default_octave;
  const octaveOffset = model.parameters.octave_offsets[octaveName] ?? 0;
  return clamp(basePitch + octaveOffset + emotion.pitch_bias, 0, 127);
}

function computeVelocity(
  baseIntensity: number,
  speaker: Speaker,
  emotion: { intensity_bias: number }
): number {
  const speakerBias = speaker.base_intensity - 64;
  return clamp(baseIntensity + speakerBias + emotion.intensity_bias, 0, 127);
}

function resolveSpeakerName(
  model: ProtoLanguageModel,
  token: ParsedWordToken,
  utterance: UtteranceToken
): string {
  const candidate = token.speakerOverride ?? utterance.speaker;
  if (candidate && model.speakers[candidate]) {
    return candidate;
  }
  const fallback = Object.keys(model.speakers)[0];
  if (!fallback) {
    throw new Error("No speakers defined in model.");
  }
  return fallback;
}

function getOrCreateTrack(
  tracksBySpeaker: Map<string, Track>,
  speaker: string,
  allocateChannel: () => number
): Track {
  const existing = tracksBySpeaker.get(speaker);
  if (existing) return existing;
  const track: Track = { id: speaker, speaker, channel: allocateChannel(), events: [] };
  tracksBySpeaker.set(speaker, track);
  return track;
}

function createChannelAllocator() {
  let next = 0;
  return () => next++;
}

function applySentenceInflection(
  sentenceNotes: { track: Track; eventIndex: number }[],
  punctuation: "statement" | "question" | "exclamation"
) {
  if (!sentenceNotes.length) return;
  const lastRef = sentenceNotes[sentenceNotes.length - 1];
  const event = lastRef.track.events[lastRef.eventIndex];
  if (!event) return;
  switch (punctuation) {
    case "statement":
      event.pitch = clamp(event.pitch - 1, 0, 127);
      event.durationTicks = Math.round(event.durationTicks * 1.15);
      break;
    case "question":
      event.pitch = clamp(event.pitch + 2, 0, 127);
      break;
    case "exclamation":
      event.velocity = clamp(event.velocity + 15, 0, 127);
      break;
  }
}

function flushSentence(sentenceNotes: { track: Track; eventIndex: number }[]) {
  sentenceNotes.splice(0, sentenceNotes.length);
}

function firstValue<T>(record: Record<string, T>): T {
  const value = Object.values(record)[0];
  if (!value) {
    throw new Error("Expected at least one entry but found none.");
  }
  return value;
}
