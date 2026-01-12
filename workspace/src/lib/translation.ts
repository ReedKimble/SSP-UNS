import type { Concept, ConceptGraph, DomainToSspResult, EventConcept, RelationConcept, RoleName } from 'uns-ssp'
import { buildPerformance } from 'uns-ssp/dist/audio/eventBuilder.js'
import { inferEmotionLabel } from 'uns-ssp/dist/translator/emotion.js'
import { MemoryLexemeRegistry } from 'uns-ssp/dist/translator/lexemeRegistry.js'
import { getToolkit } from './toolkit'

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at', 'by', 'is', 'are', 'was', 'were', 'be', 'it'])
const RELATION_WORDS = new Set(['in', 'on', 'near', 'with', 'at', 'to', 'into', 'toward', 'across', 'against', 'beyond', 'around'])
const LOCATION_HINTS = new Set(['ridge', 'camp', 'base', 'den', 'nest', 'line', 'river', 'village', 'forest', 'north', 'south', 'east', 'west', 'perimeter', 'station', 'trail', 'peak'])
const ACTION_VERBS = new Set(['run', 'walk', 'move', 'go', 'flee', 'approach', 'monitor', 'scan', 'hold', 'confirm', 'cover', 'secure', 'wait', 'track', 'observe', 'escort', 'signal', 'stabilize', 'assist'])
const PERCEPTION_VERBS = new Set(['see', 'hear', 'watch', 'spot', 'sense', 'detect'])
const ALERT_TOKENS = new Set(['danger', 'threat', 'alert', 'wolf', 'predator', 'hostile', 'attack', 'panic'])
const CALM_TOKENS = new Set(['calm', 'steady', 'easy', 'quiet', 'hold'])
const AGENT_WORDS = new Set(['i', 'we', 'team', 'pack', 'unit', 'patrol'])
const POSITION_ORDER = { onset: 0, medial: 1, cadence: 2 } as const

const toolkit = getToolkit()
const registry = new MemoryLexemeRegistry(toolkit.model, { prefix: 'auto' })

interface TranslateOptions {
  defaultEmotion?: string
  performancePreview?: boolean
}

export function translateNarrative(text: string, options?: TranslateOptions): DomainToSspResult {
  const baselineTokens = extractKeyTokens(text)
  try {
    const result = toolkit.translator.translate(text, {
      autoAddLexemes: true,
      defaultEmotion: options?.defaultEmotion,
      performancePreview: options?.performancePreview,
    })
    if (!shouldFallbackFromPrimary(result, baselineTokens)) {
      return result
    }
  } catch (error) {
    console.warn('Primary translator failed, switching to fallback', error)
  }
  return buildFallbackTranslation(text, options)
}

function shouldFallbackFromPrimary(result: DomainToSspResult, baselineTokens: string[]) {
  if (baselineTokens.length === 0) {
    return result.utterance.tokens.length === 0
  }
  const normalizedConcepts = result.conceptGraph.concepts.map((concept) => normalizeWord(concept.lemma ?? concept.text ?? ''))
  const matchedConcepts = normalizedConcepts.filter((concept) => concept && baselineTokens.includes(concept))
  const coverage = matchedConcepts.length / baselineTokens.length
  const hasAlertToken = baselineTokens.some((token) => ALERT_TOKENS.has(token))
  const capturesAlertToken = normalizedConcepts.some((concept) => ALERT_TOKENS.has(concept))
  return (
    result.utterance.tokens.length === 0 ||
    coverage < 0.45 ||
    (hasAlertToken && !capturesAlertToken)
  )
}

function buildFallbackTranslation(text: string, options?: TranslateOptions): DomainToSspResult {
  const graph = buildAugmentedConceptGraph(text)
  const speaker = resolveSpeaker()
  const tokens = lexicalizeConcepts(graph.concepts, speaker)
  const emotion = inferEmotionLabel(text, options?.defaultEmotion ?? graph.emotionHints[0])
  const utterance = {
    tokens,
    emotion,
    speaker,
    description: text,
  }
  const notes = options?.performancePreview ? buildPerformance(toolkit.model, utterance) : undefined
  return { utterance, conceptGraph: graph, notes }
}

function resolveSpeaker() {
  const first = Object.keys(toolkit.model.speakers)[0]
  if (!first) {
    throw new Error('Model does not define any speakers.')
  }
  return first
}

function lexicalizeConcepts(concepts: Concept[], speaker: string) {
  return concepts
    .filter((concept) => concept.kind !== 'relation')
    .map((concept) => {
      const lexemeId = registry.getOrCreateLexeme(concept)
      const phrasePosition = toolkit.model.lexicon[lexemeId]?.preferred_phrase_position ?? inferPhrasePosition(concept)
      return { lexemeId, phrasePosition }
    })
    .sort((a, b) => (POSITION_ORDER[a.phrasePosition] ?? 1) - (POSITION_ORDER[b.phrasePosition] ?? 1))
    .map((item) => `${item.lexemeId}|${speaker}`)
}

function inferPhrasePosition(concept: Concept) {
  if (concept.kind === 'event') {
    return 'onset'
  }
  if (LOCATION_HINTS.has(concept.lemma ?? '')) {
    return 'cadence'
  }
  return 'medial'
}

function buildAugmentedConceptGraph(text: string): ConceptGraph {
  const rawTokens = tokenize(text)
  const concepts: Concept[] = []
  const edges: ConceptGraph['edges'] = []
  const emotionHints: string[] = []
  let lastEventId: string | undefined

  rawTokens.forEach((token, index) => {
    const normalized = normalizeWord(token)
    if (!normalized) {
      return
    }
    const kind = classifyToken(normalized)
    if (!kind) {
      return
    }
    const concept: Concept = {
      id: `${kind}_${index}_${normalized}`,
      lemma: normalized,
      text: normalized,
      kind,
    }
    if (kind === 'event') {
      ;(concept as EventConcept).aspect = PERCEPTION_VERBS.has(normalized) ? 'punctual' : 'ongoing'
      lastEventId = concept.id
    }
    if (kind === 'relation') {
      ;(concept as RelationConcept).relationType = normalized
    }
    concepts.push(concept)

    if (kind === 'entity' && lastEventId) {
      edges.push({ from: lastEventId, to: concept.id, role: inferRole(normalized) })
    }

    if (ALERT_TOKENS.has(normalized) || token.includes('!')) {
      emotionHints.push('alert')
    }
    if (CALM_TOKENS.has(normalized)) {
      emotionHints.push('calm')
    }
  })

  if (concepts.length === 0) {
    concepts.push({ id: 'entity_0_signal', lemma: 'signal', text: 'signal', kind: 'entity' })
  }
  if (emotionHints.length === 0) {
    emotionHints.push('neutral')
  }

  return { concepts, edges, emotionHints }
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s!]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !STOP_WORDS.has(normalizeWord(token)))
}

function classifyToken(token: string): Concept['kind'] | undefined {
  if (RELATION_WORDS.has(token)) {
    return 'relation'
  }
  if (ACTION_VERBS.has(token) || PERCEPTION_VERBS.has(token)) {
    return 'event'
  }
  return 'entity'
}

function inferRole(token: string): RoleName {
  if (AGENT_WORDS.has(token)) {
    return 'agent'
  }
  if (LOCATION_HINTS.has(token)) {
    return 'location'
  }
  if (ALERT_TOKENS.has(token)) {
    return 'theme'
  }
  return 'patient'
}

function normalizeWord(token: string) {
  return token.replace(/[^a-z0-9]/g, '')
}

function extractKeyTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s!]/g, ' ')
    .split(/\s+/)
    .map((token) => normalizeWord(token))
    .filter((token) => token.length > 0)
}
