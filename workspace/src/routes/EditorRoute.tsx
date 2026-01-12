import { useMemo, useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useWorkspaceStore } from '@/state/useWorkspaceStore'
import { Button } from '@/components/ui/Button'

export default function EditorRoute() {
  const { documents, dictionary, activeDocumentId, setActiveDocument, upsertDocument } = useWorkspaceStore()
  const activeDocument = documents.find((doc) => doc.id === activeDocumentId) ?? documents[0]
  const [title, setTitle] = useState(activeDocument?.title ?? '')
  const [body, setBody] = useState(activeDocument?.body ?? '')

  useEffect(() => {
    setTitle(activeDocument?.title ?? '')
    setBody(activeDocument?.body ?? '')
  }, [activeDocument?.id])

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    const nextId = upsertDocument({ id: activeDocument?.id, title: title.trim() || 'Untitled', body })
    setActiveDocument(nextId)
  }

  const isDirty = useMemo(() => {
    if (!activeDocument) {
      return title.trim().length > 0 || body.trim().length > 0
    }
    return title !== (activeDocument.title ?? '') || body !== (activeDocument.body ?? '')
  }, [activeDocument, body, title])

  if (!activeDocument) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
        <p className="text-lg text-slate-300">Create your first document to get started.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Documents</p>
          <p className="text-sm text-slate-500">Switch between SSP/UNS payloads.</p>
        </div>
        <div className="space-y-2">
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setActiveDocument(doc.id)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                doc.id === activeDocument.id
                  ? 'border-brand-500 bg-brand-500/10 text-white'
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-900'
              }`}
            >
              <p className="font-semibold">{doc.title}</p>
              <p className="text-xs text-slate-400 truncate">{doc.body || 'Empty body'}</p>
            </button>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
          <p>Lexemes tracked: {dictionary.length}</p>
          <p>Words per current doc: {body.split(/\s+/).filter(Boolean).length}</p>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <form className="flex flex-col gap-4" onSubmit={handleSave}>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-slate-300" htmlFor="doc-title">
              Title
            </label>
            <input
              id="doc-title"
              className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-base text-white focus:border-brand-500 focus:outline-none"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Pack briefing..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-slate-300" htmlFor="doc-body">
              Narrative / directives
            </label>
            <textarea
              id="doc-body"
              className="min-h-[360px] rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-base text-slate-100 focus:border-brand-500 focus:outline-none"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Describe the field event in natural language..."
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!isDirty}>
              {isDirty ? 'Save Changes' : 'Synced'}
            </Button>
            <p className="text-sm text-slate-400">
              {isDirty ? 'Unsaved edits impact translation graphs.' : 'Ready for translation and playback.'}
            </p>
          </div>
        </form>
      </section>
    </div>
  )
}
