import { create } from 'zustand'
import type { DomainToSspResult, UtteranceToken } from 'uns-ssp'

export interface DocumentRecord {
  id: string
  title: string
  body: string
}

export interface LexemeEntry {
  id: string
  gloss: string
  role?: string | null
}

export interface TranslationRecord extends DomainToSspResult {
  id: string
  createdAt: string
}

export interface MixerPreviewRecord {
  id: string
  label: string
  vector: number[]
}

interface WorkspaceState {
  documents: DocumentRecord[]
  activeDocumentId: string | null
  dictionary: LexemeEntry[]
  translations: TranslationRecord[]
  currentUtterance?: UtteranceToken
  mixerPreview?: MixerPreviewRecord
  setActiveDocument: (id: string) => void
  upsertDocument: (doc: Partial<DocumentRecord> & { id?: string }) => string
  addTranslation: (result: DomainToSspResult) => void
  setCurrentUtterance: (utterance?: UtteranceToken) => void
  setMixerPreview: (preview?: MixerPreviewRecord) => void
}

const initialDocuments: DocumentRecord[] = [
  {
    id: 'doc-1',
    title: 'Field Notes – Pack 7',
    body: 'I see the wolf near the ridge. Everyone stay calm until we confirm.',
  },
]

const initialDictionary: LexemeEntry[] = [
  { id: 'I', gloss: 'speaker-as-agent', role: 'agent' },
  { id: 'see', gloss: 'perceive/monitor', role: 'experiencer' },
  { id: 'wolf', gloss: 'predator alert', role: 'theme' },
  { id: 'here', gloss: 'location indicator', role: 'location' },
]

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2, 8)}`

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  documents: initialDocuments,
  activeDocumentId: initialDocuments[0]?.id ?? null,
  dictionary: initialDictionary,
  translations: [],
  currentUtterance: undefined,
  mixerPreview: undefined,
  setActiveDocument: (id) => set({ activeDocumentId: id }),
  upsertDocument: (doc) => {
    const documents = get().documents
    let nextId = doc.id ?? uid()
    const existingIndex = documents.findIndex((item) => item.id === nextId)
    const nextDoc: DocumentRecord = {
      id: nextId,
      title: doc.title ?? 'Untitled',
      body: doc.body ?? '',
    }
    const updated = [...documents]
    if (existingIndex >= 0) {
      updated[existingIndex] = nextDoc
    } else {
      updated.push(nextDoc)
    }
    set({ documents: updated })
    return nextId
  },
  addTranslation: (result) => {
    const record: TranslationRecord = {
      ...result,
      id: uid(),
      createdAt: new Date().toISOString(),
    }
    const dictionary = [...get().dictionary]
    result.utterance.tokens.forEach((token) => {
      const [lexemeId] = token.split('|')
      if (!dictionary.some((entry) => entry.id === lexemeId)) {
        dictionary.push({ id: lexemeId, gloss: 'auto-generated' })
      }
    })
    set({
      translations: [record, ...get().translations],
      dictionary,
      currentUtterance: result.utterance,
    })
  },
  setCurrentUtterance: (utterance) => set({ currentUtterance: utterance }),
  setMixerPreview: (preview) => set({ mixerPreview: preview }),
}))
