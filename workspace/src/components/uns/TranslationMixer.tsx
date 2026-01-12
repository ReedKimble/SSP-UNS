import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspaceStore } from '@/state/useWorkspaceStore'
import { Button } from '@/components/ui/Button'
import { cancel, mask, mix, vectorFromTokens, normalizeVector } from '@/lib/unsWrappers'

const DIMENSION = 8
const OP_OPTIONS = [
  { value: 'mix', label: 'Mix (blend)' },
  { value: 'mask', label: 'Mask (filter)' },
  { value: 'cancel', label: 'Cancel (subtract)' },
] as const

type OperationType = (typeof OP_OPTIONS)[number]['value']

interface ChainStep {
  type: OperationType
  alpha: number
}

function describeTranslation(tokens: string[]) {
  if (tokens.length === 0) {
    return '∅ (no tokens)'
  }
  const preview = tokens.slice(0, 4).join(' · ')
  return tokens.length > 4 ? `${preview} …` : preview
}

function formatVector(vector: number[]) {
  return vector.map((value) => value.toFixed(2)).join(' · ')
}

export function TranslationMixer() {
  const { translations, setMixerPreview } = useWorkspaceStore()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [chain, setChain] = useState<ChainStep[]>([])
  const [sendStatus, setSendStatus] = useState<string | null>(null)
  const navigate = useNavigate()

  const selectedTranslations = useMemo(() => {
    return selectedIds
      .map((id) => translations.find((translation) => translation.id === id))
      .filter((translation): translation is NonNullable<typeof translation> => Boolean(translation))
  }, [selectedIds, translations])

  const selectedVectors = useMemo(() => {
    return selectedTranslations.map((translation) => vectorFromTokens(translation.utterance.tokens, DIMENSION))
  }, [selectedTranslations])

  useEffect(() => {
    const needed = Math.max(0, selectedTranslations.length - 1)
    setChain((prev) => {
      if (prev.length === needed) {
        return prev
      }
      if (prev.length < needed) {
        return [...prev, ...Array.from({ length: needed - prev.length }, () => ({ type: 'mix' as OperationType, alpha: 0.5 }))]
      }
      return prev.slice(0, needed)
    })
  }, [selectedTranslations.length])

  const pipeline = useMemo(() => {
    if (selectedVectors.length === 0) {
      return { steps: [], final: null }
    }
    const steps: Array<{ label: string; vector: number[] }> = [
      {
        label: `Source · ${describeTranslation(selectedTranslations[0].utterance.tokens)}`,
        vector: selectedVectors[0],
      },
    ]
    let current = selectedVectors[0]
    for (let index = 1; index < selectedVectors.length; index += 1) {
      const operation = chain[index - 1] ?? { type: 'mix', alpha: 0.5 }
      const nextVec = selectedVectors[index]
      if (!nextVec) {
        break
      }
      if (operation.type === 'mix') {
        current = mix(current, nextVec, operation.alpha).vector
      } else if (operation.type === 'mask') {
        current = mask(current, nextVec).vector
      } else {
        current = cancel(current, nextVec).vector
      }
      steps.push({
        label: `${operation.type.toUpperCase()} → ${describeTranslation(selectedTranslations[index].utterance.tokens)}`,
        vector: current,
      })
    }
    return { steps, final: current }
  }, [chain, selectedTranslations, selectedVectors])

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((entry) => entry !== id)
      }
      return [...prev, id]
    })
  }

  const handleChainChange = (index: number, partial: Partial<ChainStep>) => {
    setChain((prev) => prev.map((step, stepIndex) => (stepIndex === index ? { ...step, ...partial } : step)))
  }

  const handleSelectAll = () => {
    setSelectedIds(translations.map((translation) => translation.id))
  }

  const handleClear = () => {
    setSelectedIds([])
    setChain([])
  }

  const combinedVector = pipeline.final ? pipeline.final : normalizeVector(Array.from({ length: DIMENSION }, () => 0))

  const handleSendToAudio = () => {
    if (!pipeline.final) {
      return
    }
    const id = globalThis.crypto?.randomUUID?.() ?? `mix-${Date.now()}`
    const label = `UNS mix (${selectedTranslations.length} src)`
    setMixerPreview({ id, label, vector: pipeline.final })
    setSendStatus('Sent to Audio Lab')
    navigate('/workspace/audio')
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">UNS Mixer</p>
          <p className="text-sm text-slate-300">Chain UNS filters across translated utterances.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={handleSelectAll} disabled={translations.length === 0}>
            Select all
          </Button>
          <Button type="button" variant="ghost" onClick={handleClear}>
            Clear
          </Button>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Sentences</p>
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {translations.length === 0 && <p className="text-sm text-slate-500">Run translations to populate mixer sources.</p>}
            {translations.map((translation) => (
              <label
                key={translation.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  selectedIds.includes(translation.id)
                    ? 'border-brand-500 bg-brand-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedIds.includes(translation.id)}
                  onChange={() => toggleSelection(translation.id)}
                />
                <div>
                  <p className="font-semibold">{translation.utterance.tokens.join(' ') || 'Untitled utterance'}</p>
                  <p className="text-xs text-slate-400">{new Date(translation.createdAt).toLocaleString()}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Filter chain</p>
          {chain.length === 0 && selectedTranslations.length <= 1 && (
            <p className="text-sm text-slate-500">Select at least two sentences to configure UNS filters.</p>
          )}
          {chain.map((step, index) => (
            <div key={`chain-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step {index + 1}</span>
                <label className="sr-only" htmlFor={`chain-type-${index}`}>
                  Filter operation for step {index + 1}
                </label>
                <select
                  id={`chain-type-${index}`}
                  className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white"
                  value={step.type}
                  onChange={(event) => handleChainChange(index, { type: event.target.value as OperationType })}
                >
                  {OP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-slate-900 text-white">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {step.type === 'mix' && (
                <div className="mt-3">
                  <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor={`alpha-${index}`}>
                    α coefficient ({step.alpha.toFixed(2)})
                  </label>
                  <input
                    id={`alpha-${index}`}
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={step.alpha}
                    onChange={(event) => handleChainChange(index, { alpha: Number(event.target.value) })}
                    className="mt-2 w-full"
                  />
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">Source → {selectedTranslations[index + 1]?.utterance.tokens.join(' ') ?? '…'}</p>
            </div>
          ))}
        </div>
      </div>
      {pipeline.steps.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Chain output</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {pipeline.steps.map((step) => (
              <div key={step.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-sm font-semibold text-white">{step.label}</p>
                <p className="mt-2 font-mono text-xs text-slate-200">{formatVector(step.vector)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-brand-500/40 bg-brand-500/10 p-3">
            <p className="text-sm font-semibold text-brand-50">Final mix vector</p>
            <p className="font-mono text-xs text-brand-100">{formatVector(combinedVector)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={handleSendToAudio} disabled={!pipeline.final}>
                Send to Audio Lab
              </Button>
              {sendStatus && <p className="text-xs text-brand-200">{sendStatus}</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
