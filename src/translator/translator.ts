import { ProtoLanguageModel, UtteranceToken } from "../types/ssp.js";
import { buildConceptGraph } from "./conceptGraph.js";
import { MemoryLexemeRegistry } from "./lexemeRegistry.js";
import { inferEmotionLabel } from "./emotion.js";
import { buildPerformance } from "../audio/eventBuilder.js";
import {
  Concept,
  DomainToSspResult,
  LexemeRegistry,
  TranslatorOptions,
} from "./types.js";

const POSITION_ORDER: Record<string, number> = {
  onset: 0,
  medial: 1,
  cadence: 2,
};

export class DomainToSspTranslator {
  private readonly model: ProtoLanguageModel;
  private readonly registry: LexemeRegistry;

  constructor(model: ProtoLanguageModel, registry?: LexemeRegistry) {
    this.model = model;
    this.registry = registry ?? new MemoryLexemeRegistry(model);
  }

  translate(text: string, options?: TranslatorOptions): DomainToSspResult {
    const graph = buildConceptGraph(text);
    const speaker = this.resolveSpeaker(options?.defaultSpeaker);
    const emotion = inferEmotionLabel(text, options?.defaultEmotion ?? graph.emotionHints[0]);

    const lexicalConcepts = graph.concepts.filter((concept) => concept.kind !== "property");
    const tokens = this.lexicalize(lexicalConcepts, speaker);
    const utterance: UtteranceToken = {
      tokens,
      emotion,
      speaker,
      description: text,
    };

    const notes = options?.performancePreview ? buildPerformance(this.model, utterance) : undefined;
    return { utterance, conceptGraph: graph, notes };
  }

  private lexicalize(concepts: Concept[], speaker: string): string[] {
    const decorated = concepts.map((concept) => {
      const lexemeId = this.registry.getOrCreateLexeme(concept);
      const phrasePosition = this.model.lexicon[lexemeId]?.preferred_phrase_position ?? "medial";
      return {
        lexemeId,
        phrasePosition,
      };
    });
    return decorated
      .sort((a, b) => (POSITION_ORDER[a.phrasePosition] ?? 1) - (POSITION_ORDER[b.phrasePosition] ?? 1))
      .map((item) => `${item.lexemeId}|${speaker}`);
  }

  private resolveSpeaker(preferred?: string): string {
    if (preferred && this.model.speakers[preferred]) {
      return preferred;
    }
    const first = Object.keys(this.model.speakers)[0];
    if (!first) {
      throw new Error("Model does not define any speakers.");
    }
    return first;
  }
}
