import { useEffect, useState } from 'react'
import type { DomainToSspResult } from 'uns-ssp'
import type { FormEvent } from 'react'
import { translateNarrative } from '@/lib/translation'
import { useWorkspaceStore } from '@/state/useWorkspaceStore'
import { Button } from '@/components/ui/Button'
import { LexiconPanel } from '@/components/lexicon/LexiconPanel'

export default function TranslationRoute() {
  const { documents, activeDocumentId, addTranslation } = useWorkspaceStore()
  const activeDocument = documents.find((doc) => doc.id === activeDocumentId)
  const [draft, setDraft] = useState(activeDocument?.body ?? '')
  const [result, setResult] = useState<DomainToSspResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    setDraft(activeDocument?.body ?? '')
  }, [activeDocument?.id, activeDocument?.body])

  const handleTranslate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.trim()) {
      setError('Provide some source text to translate.')
      return
    }

    setError(null)
    setIsRunning(true)
    try {
      const fullResult = translateNarrative(draft, {
        defaultEmotion: 'alert',
        performancePreview: true,
      })
      setResult(fullResult)
      addTranslation(fullResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown translation error')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <form className="flex flex-col gap-4" onSubmit={handleTranslate}>
          <label className="text-sm text-slate-300" htmlFor="translation-input">
            Source narrative
          </label>
          <textarea
            id="translation-input"
            className="min-h-[220px] rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-base text-slate-100 focus:border-brand-500 focus:outline-none"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="E.g. “I see the wolf near the ridge. Keep calm until confirmed.”"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isRunning}>
              {isRunning ? 'Translating…' : 'Translate to SSP'}
            </Button>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {!error && result && <p className="text-sm text-slate-400">Tokens ready for playback.</p>}
          </div>
        </form>
        </section>
        {result && (
          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Utterance tokens</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.utterance.tokens.map((token) => (
                <span key={token} className="rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1 text-sm text-brand-100">
                  {token}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Concept graph</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {result.conceptGraph.concepts.map((concept) => (
                <div key={concept.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-sm font-semibold text-white">{concept.lemma}</p>
                  <p className="text-xs text-slate-400">{concept.kind.toUpperCase()}</p>
                  <p className="mt-1 text-sm text-slate-300">{concept.text}</p>
                </div>
              ))}
            </div>
          </div>
          {result.conceptGraph.edges.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Role edges</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                {result.conceptGraph.edges.map((edge) => (
                  <li key={`${edge.from}-${edge.to}-${edge.role}`}>
                    <span className="text-slate-400">{edge.role}</span> → {edge.from} → {edge.to}
                  </li>
                ))}
              </ul>
            </div>
          )}
          </section>
        )}
      </div>
      <LexiconPanel />
    </div>
  )
}
