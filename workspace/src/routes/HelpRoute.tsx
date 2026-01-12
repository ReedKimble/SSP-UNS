const manuals = [
  {
    title: 'SSP.md',
    description: 'Core sonic grammar and lexicon overview used by the translator.',
  },
  {
    title: 'UNS_Runtime32_Spec.md',
    description: 'Runtime orchestration plus safety envelopes for the UNS interpreter.',
  },
  {
    title: 'UNS-SSP_Integration.md',
    description: 'Bridging notes for moving between symbolic SSP tokens and UNS vectors.',
  },
]

const phases = [
  {
    title: 'Capture',
    detail: 'Draft directives or field observations in the Editor. Keep sentences short and explicit about actors and targets.',
  },
  {
    title: 'Translate',
    detail: 'Use Translation Studio to convert prose into SSP tokens. Review the concept graph for missing lexemes.',
  },
  {
    title: 'Validate',
    detail: 'Analyzer highlights dictionary coverage while Audio Lab confirms acoustic feel before exporting.',
  },
]

export default function HelpRoute() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <p className="text-xs uppercase tracking-wide text-slate-400">Workflow primer</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {phases.map((phase) => (
            <div key={phase.title} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-white">{phase.title}</p>
              <p className="mt-2 text-sm text-slate-300">{phase.detail}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <p className="text-xs uppercase tracking-wide text-slate-400">Reference briefs</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {manuals.map((manual) => (
            <div key={manual.title} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-white">{manual.title}</p>
              <p className="mt-2 text-sm text-slate-300">{manual.description}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/20 p-6 text-sm text-slate-300">
        <p className="font-semibold text-white">Need more context?</p>
        <p className="mt-2 text-slate-300">
          Consult the markdown dossiers in the repository root for deeper specs or drop new annotations
          directly into the Editor so they remain version-controlled.
        </p>
      </section>
    </div>
  )
}
