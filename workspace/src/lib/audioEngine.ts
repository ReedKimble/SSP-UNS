import type { Performance } from 'uns-ssp'

const MAX_GAIN = 0.25

function midiToFrequency(pitch: number) {
  return 440 * Math.pow(2, (pitch - 69) / 12)
}

class AudioEngine {
  private context: AudioContext | null = null
  private activeSources: Array<{ oscillator: OscillatorNode; gain: GainNode }> = []

  private ensureContext() {
    if (!this.context) {
      this.context = new AudioContext()
    }
    return this.context
  }

  stop() {
    this.activeSources.forEach(({ oscillator, gain }) => {
      oscillator.stop()
      oscillator.disconnect()
      gain.disconnect()
    })
    this.activeSources = []
  }

  play(performance: Performance) {
    const ctx = this.ensureContext()
    const secondsPerTick = 60 / (performance.tempoBpm * performance.tickDivision)
    const now = ctx.currentTime + 0.05
    this.stop()

    performance.tracks.forEach((track, index) => {
      const detune = index * 2
      track.events.forEach((event) => {
        const start = now + event.startTicks * secondsPerTick
        const duration = Math.max(0.05, event.durationTicks * secondsPerTick)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        gain.gain.value = (event.velocity / 127) * MAX_GAIN
        osc.type = 'sine'
        osc.detune.value = detune
        osc.frequency.setValueAtTime(midiToFrequency(event.pitch), start)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + duration)
        this.activeSources.push({ oscillator: osc, gain })
      })
    })
  }
}

export const audioEngine = new AudioEngine()
