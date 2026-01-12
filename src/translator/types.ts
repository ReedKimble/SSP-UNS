import { NoteSpec, ProtoLanguageModel, UtteranceToken } from "../types/ssp.js";
import { Performance } from "../audio/types.js";

export type ConceptKind = "entity" | "event" | "property" | "relation";

export interface ConceptBase {
  id: string;
  lemma: string;
  text: string;
  kind: ConceptKind;
  animacy?: "animate" | "inanimate";
  domain?: string;
  roleHint?: string;
}

export interface EntityConcept extends ConceptBase {
  kind: "entity";
}

export interface EventConcept extends ConceptBase {
  kind: "event";
  aspect?: "state" | "punctual" | "ongoing";
  polarity?: "positive" | "negative";
}

export interface PropertyConcept extends ConceptBase {
  kind: "property";
  scale?: string;
  degree?: "low" | "mid" | "high";
}

export interface RelationConcept extends ConceptBase {
  kind: "relation";
  relationType?: string;
}

export type Concept = EntityConcept | EventConcept | PropertyConcept | RelationConcept;

export type RoleName = "agent" | "patient" | "experiencer" | "theme" | "location" | "target";

export interface GraphRoleEdge {
  from: string;
  to: string;
  role: RoleName;
}

export interface ConceptGraph {
  concepts: Concept[];
  edges: GraphRoleEdge[];
  emotionHints: string[];
}

export interface LexemeRegistry {
  getOrCreateLexeme(concept: Concept): string;
}

export interface TranslatorOptions {
  defaultSpeaker?: string;
  defaultEmotion?: string;
  autoAddLexemes?: boolean;
  performancePreview?: boolean;
}

export interface DomainToSspResult {
  utterance: UtteranceToken;
  conceptGraph: ConceptGraph;
  notes?: Performance;
}

export type BaseNoteGenerator = (concept: Concept, model: ProtoLanguageModel) => NoteSpec[];
