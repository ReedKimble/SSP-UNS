import { ProtoLanguageModel } from "../types/ssp.js";
import { Concept, ConceptKind, LexemeRegistry } from "./types.js";
import { NoteSpec } from "../types/ssp.js";
import { generateBaseNotes } from "./melodyTemplates.js";

export interface MemoryLexemeRegistryOptions {
  prefix?: string;
}

export class MemoryLexemeRegistry implements LexemeRegistry {
  private readonly model: ProtoLanguageModel;
  private readonly prefix: string;
  private readonly map = new Map<string, string>();

  constructor(model: ProtoLanguageModel, options?: MemoryLexemeRegistryOptions) {
    this.model = model;
    this.prefix = options?.prefix ?? "auto";
  }

  getOrCreateLexeme(concept: Concept): string {
    const key = this.serializeConcept(concept);
    const existing = this.map.get(key);
    if (existing) {
      return existing;
    }
    const lexemeId = this.createLexemeId(concept);
    const base_notes = generateBaseNotes(concept, this.model);
    this.model.lexicon[lexemeId] = {
      gloss: concept.text,
      role: inferRoleFromConcept(concept.kind, concept.animacy),
      relation_type: concept.kind === "relation" ? concept.relationType ?? null : null,
      preferred_phrase_position: inferPhrasePosition(concept.kind, concept.animacy),
      base_notes,
    };
    this.map.set(key, lexemeId);
    return lexemeId;
  }

  private serializeConcept(concept: Concept): string {
    return [concept.kind, concept.lemma, concept.animacy ?? "", concept.domain ?? ""].join(":");
  }

  private createLexemeId(concept: Concept): string {
    const slug = concept.lemma.replace(/[^a-z0-9]/g, "") || concept.kind;
    let candidate = `${this.prefix}_${slug}`;
    let counter = 1;
    while (this.model.lexicon[candidate]) {
      candidate = `${this.prefix}_${slug}_${counter++}`;
    }
    return candidate;
  }
}

function inferRoleFromConcept(kind: ConceptKind, animacy?: string | undefined): string | null {
  if (kind === "entity" && animacy === "animate") return "agent";
  if (kind === "entity" && animacy === "inanimate") return "patient";
  if (kind === "event") return "experiencer";
  if (kind === "relation") return null;
  return null;
}

function inferPhrasePosition(kind: ConceptKind, animacy?: string | undefined): "onset" | "medial" | "cadence" {
  if (kind === "entity" && animacy === "animate") return "onset";
  if (kind === "event") return "medial";
  return "cadence";
}
