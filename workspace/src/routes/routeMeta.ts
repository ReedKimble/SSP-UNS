export interface RouteDefinition {
  id: string
  path: string
  label: string
  description: string
}

export const ROUTES: RouteDefinition[] = [
  {
    id: 'editor',
    path: '/workspace/editor',
    label: 'Editor',
    description: 'Create and edit SSP/UNS documents with live schema validation.',
  },
  {
    id: 'translation',
    path: '/workspace/translation',
    label: 'Translation Studio',
    description: 'Convert English field notes into SSP lexemes and tokens.',
  },
  {
    id: 'analyzer',
    path: '/workspace/analyzer',
    label: 'Analyzer',
    description: 'Inspect UNS frames, microstates, and invariants.',
  },
  {
    id: 'audio',
    path: '/workspace/audio',
    label: 'Audio Lab',
    description: 'Preview multi-voice playback and export audio artifacts.',
  },
  {
    id: 'uns-tools',
    path: '/workspace/uns-tools',
    label: 'UNS Tools',
    description: 'Apply domain-friendly wrappers for MIX, MASK, MERGE, and more.',
  },
  {
    id: 'help',
    path: '/workspace/help',
    label: 'Help & Briefings',
    description: 'Embedded handbook for SSP + UNS workflows.',
  },
]
