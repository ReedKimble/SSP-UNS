import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useWorkspaceStore } from '@/state/useWorkspaceStore'
import { Button } from '@/components/ui/Button'
import { translateNarrative } from '@/lib/translation'

export function LexiconPanel() {
  const { dictionary, addTranslation } = useWorkspaceStore()
  const [isOpen, setIsOpen] = useState(true)
  const [samplePhrase, setSamplePhrase] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [recentLexemes, setRecentLexemes] = useState<string[]>([])
  const sortedDictionary = useMemo(() => [...dictionary].sort((a, b) => a.id.localeCompare(b.id)), [dictionary])

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = samplePhrase.trim()
    if (!trimmed) {
      setStatus('Enter a short phrase that includes the new word.')
      return
    }
    try {
      const existing = new Set(dictionary.map((entry) => entry.id))
      const translation = translateNarrative(trimmed, {
        defaultEmotion: 'neutral',
        performancePreview: false,
      })
      if (translation.utterance.tokens.length === 0) {
        setStatus('Translator did not produce any tokens for this phrase.')
        return
      }
      addTranslation(translation)
      const created = translation.utterance.tokens
        .map((token) => token.split('|')[0])
        .filter((lexeme) => !existing.has(lexeme))
      setRecentLexemes(created)
      setSamplePhrase('')
      setStatus(
        created.length > 0
          ? `Translator added ${created.length} lexeme${created.length > 1 ? 's' : ''}.`
          : 'Phrase already covered existing lexemes.',
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unexpected translator error')
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Lexicon</p>
          <p className="text-sm text-slate-300">Known SSP tokens</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-xs font-semibold uppercase tracking-wide text-brand-300"
        >
          {isOpen ? 'Collapse' : 'Expand'}
        </button>
      </header>
      {isOpen && (
        <div className="space-y-4 p-5">
          <form className="space-y-3" onSubmit={handleAdd}>
            <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="lexicon-phrase">
              Add new lexeme via translator
            </label>
            <textarea
              id="lexicon-phrase"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              rows={3}
              placeholder="e.g. Fenrir scouts the east ridge"
              value={samplePhrase}
              onChange={(event) => setSamplePhrase(event.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button type="submit">Run Translator</Button>
              {status && <p className="text-xs text-slate-400">{status}</p>}
            </div>
          </form>
          {recentLexemes.length > 0 && (
            <div className="rounded-xl border border-brand-500/50 bg-brand-500/10 p-3 text-xs text-brand-100">
              <p className="font-semibold">Recent additions</p>
              <p className="mt-1 break-words text-brand-50">{recentLexemes.join(', ')}</p>
            </div>
          )}
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {sortedDictionary.map((entry) => (
              <details
                key={entry.id}
                className={`rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm transition-colors ${
                  recentLexemes.includes(entry.id) ? 'border-brand-500/60 bg-brand-500/5' : ''
                }`}
              >
                <summary className="flex cursor-pointer items-center justify-between text-white">
                  <span className="font-semibold">{entry.id}</span>
                  {entry.role && <span className="text-xs uppercase tracking-wide text-slate-400">{entry.role}</span>}
                </summary>
                <p className="mt-2 text-slate-300">{entry.gloss || 'auto-generated gloss'}</p>
              </details>
            ))}
            {sortedDictionary.length === 0 && (
              <p className="text-xs text-slate-500">No lexemes yet. Run a translation to seed the dictionary.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
