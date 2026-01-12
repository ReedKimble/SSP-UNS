import { useWorkspaceStore } from '@/state/useWorkspaceStore'

export default function AnalyzerRoute() {
  const { translations, dictionary, currentUtterance } = useWorkspaceStore()
  const focusedUtterance = currentUtterance ?? translations[0]?.utterance

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <p className="text-xs uppercase tracking-wide text-slate-400">Utterance focus</p>
        {focusedUtterance ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {focusedUtterance.tokens.map((token) => (
                <span key={token} className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-sm">
                  {token}
                </span>
              ))}
            </div>
            <div className="mt-4 text-sm text-slate-300">
              <p>Emotion: {focusedUtterance.emotion ?? 'not specified'}</p>
              <p>Speaker: {focusedUtterance.speaker ?? 'auto'}</p>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Translate a document to populate analysis artifacts.</p>
        )}
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-400">Lexeme dictionary</p>
          <p className="text-xs text-slate-500">{dictionary.length} entries</p>
        </div>
        <div className="mt-4 max-h-[320px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Lexeme</th>
                <th className="px-3 py-2 font-medium">Gloss</th>
                <th className="px-3 py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {dictionary.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-800 text-slate-200">
                  <td className="px-3 py-2 font-semibold">{entry.id}</td>
                  <td className="px-3 py-2">{entry.gloss}</td>
                  <td className="px-3 py-2 capitalize">{entry.role ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-400">Translation history</p>
          <p className="text-xs text-slate-500">{translations.length} runs</p>
        </div>
        {translations.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Run the translator to accumulate history.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {translations.map((translation) => (
              <div key={translation.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs text-slate-500">{new Date(translation.createdAt).toLocaleTimeString()}</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {translation.utterance.tokens.slice(0, 3).join(' · ')}
                  {translation.utterance.tokens.length > 3 ? '…' : ''}
                </p>
                <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">Concepts</p>
                <p className="text-sm text-slate-300">{translation.conceptGraph.concepts.length} nodes</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
