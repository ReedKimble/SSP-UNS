import { useWorkspaceStore } from '@/state/useWorkspaceStore'
import { ROUTES } from '@/routes/routeMeta'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

function nextUntitledLabel(count: number) {
  return `Untitled ${count + 1}`
}

export default function TopBar() {
  const { pathname } = useLocation()
  const route = ROUTES.find((item) => pathname.startsWith(item.path)) ?? ROUTES[0]
  const { documents, activeDocumentId, setActiveDocument, upsertDocument } = useWorkspaceStore()

  const handleCreateDocument = () => {
    const newId = upsertDocument({ title: nextUntitledLabel(documents.length), body: '' })
    setActiveDocument(newId)
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/60 px-6 py-4 backdrop-blur">
      <div>
        <p className="text-sm text-slate-400">{route?.label}</p>
        <h2 className="text-xl font-semibold text-white">{route?.description}</h2>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400" htmlFor="doc-select">
          Active document
        </label>
        <select
          id="doc-select"
          value={activeDocumentId ?? ''}
          onChange={(event) => setActiveDocument(event.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-white focus:border-brand-500 focus:outline-none"
        >
          {documents.length === 0 && <option value="">No documents</option>}
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id} className="bg-slate-900 text-white">
              {doc.title}
            </option>
          ))}
        </select>
        <Button variant="secondary" type="button" onClick={handleCreateDocument}>
          New Document
        </Button>
      </div>
    </header>
  )
}
