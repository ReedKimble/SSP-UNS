import { Performance } from "./types.js";

export interface SynthesisOptions {
  sampleRate?: number;
  gain?: number;
  sustainFactor?: number;
}

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_GAIN = 0.3;
const DEFAULT_SUSTAIN = 1.0;

export function synthesizePerformance(
  performance: Performance,
  options?: SynthesisOptions
): Float32Array {
  const sampleRate = options?.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const gain = options?.gain ?? DEFAULT_GAIN;
  const sustainFactor = options?.sustainFactor ?? DEFAULT_SUSTAIN;
  const secondsPerTick = 60 / (performance.tempoBpm * performance.tickDivision);

  const totalDuration = performance.tracks.reduce((max, track) => {
    const trackMax = track.events.reduce((acc, event) => {
      const endTicks = event.startTicks + event.durationTicks * sustainFactor;
      return Math.max(acc, endTicks);
    }, 0);
    return Math.max(max, trackMax);
  }, 0);

  const totalSeconds = totalDuration * secondsPerTick;
  const totalSamples = Math.max(1, Math.ceil(totalSeconds * sampleRate));
  const buffer = new Float32Array(totalSamples);

  performance.tracks.forEach((track) => {
    track.events.forEach((event) => {
      const startSample = Math.floor(event.startTicks * secondsPerTick * sampleRate);
      const durationSamples = Math.max(
        1,
        Math.floor(event.durationTicks * sustainFactor * secondsPerTick * sampleRate)
      );
      const endSample = Math.min(buffer.length, startSample + durationSamples);
      const frequency = midiToFrequency(event.pitch);
      for (let sample = startSample; sample < endSample; sample++) {
        const t = (sample - startSample) / sampleRate;
        const env = 1 - (sample - startSample) / durationSamples;
        const amplitude = (event.velocity / 127) * gain * Math.max(env, 0);
        buffer[sample] += amplitude * Math.sin(2 * Math.PI * frequency * t);
      }
    });
  });

  const maxAmplitude = buffer.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  if (maxAmplitude > 1) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] /= maxAmplitude;
    }
  }

  return buffer;
}

function midiToFrequency(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}
