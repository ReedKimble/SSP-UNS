import { useEffect, useMemo, useState } from 'react'
import type { Performance } from 'uns-ssp'
import { audioEngine } from '@/lib/audioEngine'
import { useWorkspaceStore } from '@/state/useWorkspaceStore'
import { Button } from '@/components/ui/Button'
import { createPerformanceFromVector } from '@/lib/vectorPerformance'

interface AudioChoice {
  id: string
  label: string
  performance?: Performance
  source: 'translation' | 'mixer'
}

export default function AudioLabRoute() {
  const { translations, mixerPreview } = useWorkspaceStore()
  const mixerPerformance = useMemo(
    () => (mixerPreview ? createPerformanceFromVector(mixerPreview.vector, mixerPreview.label) : undefined),
    [mixerPreview],
  )

  const choices: AudioChoice[] = useMemo(() => {
    const base = translations.map<AudioChoice>((translation) => ({
      id: translation.id,
      label: translation.utterance.tokens.join(' '),
      performance: translation.notes,
      source: 'translation',
    }))
    if (mixerPreview && mixerPerformance) {
      base.unshift({
        id: mixerPreview.id,
        label: mixerPreview.label,
        performance: mixerPerformance,
        source: 'mixer',
      })
    }
    return base
  }, [translations, mixerPreview, mixerPerformance])

  const [selectedId, setSelectedId] = useState<string | null>(() => choices[0]?.id ?? null)

  useEffect(() => {
    if (choices.length && !choices.some((choice) => choice.id === selectedId)) {
      setSelectedId(choices[0].id)
    }
    if (!choices.length && selectedId) {
      setSelectedId(null)
    }
  }, [choices, selectedId])

  const selected = choices.find((choice) => choice.id === selectedId) ?? choices[0]
  const performance = selected?.performance

  useEffect(() => {
    return () => audioEngine.stop()
  }, [])

  const handlePlay = () => {
    if (performance) {
      audioEngine.play(performance)
    }
  }

  const handleStop = () => audioEngine.stop()

  if (!choices.length) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400">
        Generate a translation or send a mix from UNS Tools to unlock audio previews.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-300" htmlFor="performance-select">
            Choose preview source
          </label>
          <select
            id="performance-select"
            value={selected?.id ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          >
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.source === 'mixer' ? `${choice.label} (Mixer)` : choice.label}
              </option>
            ))}
          </select>
          <Button type="button" onClick={handlePlay} disabled={!performance}>
            Play preview
          </Button>
          <Button type="button" variant="ghost" onClick={handleStop}>
            Stop
          </Button>
          {!performance && (
            <p className="text-sm text-slate-400">
              Selected source has no performance data yet. Regenerate with preview enabled or resend from the mixer.
            </p>
          )}
          {selected?.source === 'mixer' && performance && (
            <p className="text-xs text-brand-200">
              Preview uses synthesized performance generated from the UNS mixer output.
            </p>
          )}
        </div>
      </section>
      {performance && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Tempo</p>
              <p className="text-2xl font-semibold text-white">{performance.tempoBpm} BPM</p>
              <p className="text-sm text-slate-400">Tick division {performance.tickDivision}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Tracks</p>
              <p className="text-2xl font-semibold text-white">{performance.tracks.length}</p>
              <p className="text-sm text-slate-400">Emotion envelope aligned to {performance.emotion?.tension ?? 0}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {performance.tracks.map((track) => (
              <div key={track.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200">
                <p className="text-base font-semibold text-white">{track.speaker}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{track.events.length} events</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {track.events.slice(0, 4).map((event, index) => (
                    <li key={`${track.id}-${index}`}>
                      tick {event.startTicks} · pitch {event.pitch} · vel {event.velocity}
                    </li>
                  ))}
                  {track.events.length > 4 && <li>…</li>}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
