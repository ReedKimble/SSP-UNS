import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cancel, mask, mix, sampleVectors } from '@/lib/unsWrappers'
import { TranslationMixer } from '@/components/uns/TranslationMixer'

const DIMENSION = 8

function formatVector(vector: number[]) {
  return vector.map((value) => value.toFixed(2)).join(' · ')
}

export default function UnsToolsRoute() {
  const [vectors, setVectors] = useState(() => sampleVectors(DIMENSION))
  const [alpha, setAlpha] = useState(0.5)

  const mixResult = useMemo(() => mix(vectors.base, vectors.contrast, alpha), [alpha, vectors])
  const maskResult = useMemo(() => mask(vectors.base, vectors.contrast), [vectors])
  const cancelResult = useMemo(() => cancel(vectors.base, vectors.contrast), [vectors])

  const handleResample = () => setVectors(sampleVectors(DIMENSION))

  return (
    <div className="space-y-6">
      <TranslationMixer />
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="alpha-slider">
              α mixing coefficient
            </label>
            <input
              id="alpha-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={alpha}
              onChange={(event) => setAlpha(Number(event.target.value))}
              className="mt-2 w-64"
            />
            <p className="text-sm text-slate-300">Current α = {alpha.toFixed(2)}</p>
          </div>
          <Button type="button" variant="secondary" onClick={handleResample}>
            Resample vectors
          </Button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Primary vector</p>
            <p className="mt-2 font-mono text-slate-200">{formatVector(vectors.base)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Contrast vector</p>
            <p className="mt-2 font-mono text-slate-200">{formatVector(vectors.contrast)}</p>
          </div>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[mixResult, maskResult, cancelResult].map((result) => (
          <div key={result.label} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-sm font-semibold text-white">{result.label}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">Notes</p>
            <p className="text-sm text-slate-300">{result.notes}</p>
            <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">Vector</p>
            <p className="font-mono text-slate-100">{formatVector(result.vector)}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
