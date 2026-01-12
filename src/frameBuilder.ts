import { ProtoLanguageModel, UtteranceToken, EmotionProfile, Speaker } from "./types/ssp.js";
import {
  AcousticMicrostateKey,
  MicrostateSpaces,
  ProsodyMicrostateKey,
  SemanticMicrostateKey,
  StructuralMicrostateKey,
  UState32,
  SspUnsFrame,
} from "./types/uns.js";
import { parseTokens, ParsedToken, ParsedWordToken } from "./parser/tokenParser.js";
import { resolveMicrostateConfig, bucketizeToken, selectPhrasePositionId } from "./microstates.js";
import { SpaceBuilder } from "./utils/spaceBuilder.js";
import { MicrostateConfig } from "./microstates.js";
import { normalizeNonNegativeVector, quantize, clamp } from "./utils/math.js";
import { encodeProbability } from "./utils/fixedPoint.js";

const DEFAULT_PITCH_RANGE: [number, number] = [0, 127];
const DEFAULT_DURATION_RANGE: [number, number] = [30, 1920];
const DEFAULT_INTENSITY_RANGE: [number, number] = [0, 127];
const DEFAULT_TEMPO_RANGE: [number, number] = [0.5, 1.5];
const DEFAULT_INTENSITY_BIAS_RANGE: [number, number] = [-32, 32];
const DEFAULT_PITCH_BIAS_RANGE: [number, number] = [-12, 12];
const DEFAULT_TENSION_RANGE: [number, number] = [0, 1];

export interface FrameBuilderOptions {
  microstateConfig?: MicrostateConfig;
  pitchRange?: [number, number];
  durationRange?: [number, number];
  intensityRange?: [number, number];
  tempoRange?: [number, number];
  intensityBiasRange?: [number, number];
  pitchBiasRange?: [number, number];
  tensionRange?: [number, number];
}

export interface FrameEncodingResult extends SspUnsFrame {
  spaces: MicrostateSpaces;
  parsedTokens: ParsedToken[];
}

type ResolvedMicrostateConfig = ReturnType<typeof resolveMicrostateConfig>;

export class FrameBuilder {
  private readonly model: ProtoLanguageModel;
  private readonly config: ResolvedMicrostateConfig;
  private readonly lexemeIdMap: Record<string, number> = {};
  private readonly roleIdMap: Record<string, number> = {};
  private readonly speakerIdMap: Record<string, number> = {};
  private readonly emotionIdMap: Record<string, number> = {};
  private readonly instrumentIdMap: Record<string, number> = {};
  private readonly articulationIdMap: Record<string, number> = {};
  private readonly ranges: Required<FrameBuilderRangeOptions>;

  constructor(model: ProtoLanguageModel, options?: FrameBuilderOptions) {
    this.model = model;
    this.config = resolveMicrostateConfig(options?.microstateConfig);
    this.ranges = {
      pitchRange: options?.pitchRange ?? DEFAULT_PITCH_RANGE,
      durationRange: options?.durationRange ?? DEFAULT_DURATION_RANGE,
      intensityRange: options?.intensityRange ?? DEFAULT_INTENSITY_RANGE,
      tempoRange: options?.tempoRange ?? DEFAULT_TEMPO_RANGE,
      intensityBiasRange: options?.intensityBiasRange ?? DEFAULT_INTENSITY_BIAS_RANGE,
      pitchBiasRange: options?.pitchBiasRange ?? DEFAULT_PITCH_BIAS_RANGE,
      tensionRange: options?.tensionRange ?? DEFAULT_TENSION_RANGE,
    };
    this.prepareIdMaps();
  }

  encodeUtterance(utterance: UtteranceToken): FrameEncodingResult {
    const parsedTokens = parseTokens(utterance.tokens);
    return this.encodeStates(utterance, parsedTokens);
  }

  private prepareIdMaps() {
    Object.keys(this.model.lexicon).forEach((lexeme, index) => {
      this.lexemeIdMap[lexeme] = index;
    });

    const roles = new Set(
      Object.values(this.model.lexicon)
        .map((lexeme) => lexeme.role ?? "")
        .filter(Boolean)
    );
    let roleIndex = 0;
    roles.forEach((role) => {
      this.roleIdMap[role] = roleIndex++;
    });

    Object.keys(this.model.speakers).forEach((speaker, index) => {
      this.speakerIdMap[speaker] = index;
    });

    Object.keys(this.model.emotion_profiles).forEach((emotion, index) => {
      this.emotionIdMap[emotion] = index;
    });

    Object.keys(this.model.instruments).forEach((instrument, index) => {
      this.instrumentIdMap[instrument] = index;
    });
  }

  private encodeStates(
    utterance: UtteranceToken,
    parsedTokens: ParsedToken[]
  ): FrameEncodingResult {
    const wordTokens = parsedTokens.filter((token): token is ParsedWordToken => token.kind === "word");
    const semanticBuilder = new SpaceBuilder<SemanticMicrostateKey>();
    const structuralBuilder = new SpaceBuilder<StructuralMicrostateKey>();
    const acousticBuilder = new SpaceBuilder<AcousticMicrostateKey>();
    const prosodyBuilder = new SpaceBuilder<ProsodyMicrostateKey>();

    const semanticCounts: number[] = [];
    const structuralCounts: number[] = [];
    const acousticCounts: number[] = [];
    const prosodyCounts: number[] = [];

    const clauseAssignments = this.assignClauses(parsedTokens);
    const totalWordTokens = wordTokens.length;

    wordTokens.forEach((token, index) => {
      const lexeme = this.model.lexicon[token.word];
      if (!lexeme) {
        throw new Error(`Unknown lexeme '${token.word}'.`);
      }
      const speakerName = this.resolveSpeakerName(token, utterance);
      const speaker = this.model.speakers[speakerName];
      const semanticKey: SemanticMicrostateKey = {
        conceptId: this.lexemeIdMap[token.word] ?? -1,
        roleId: lexeme.role ? this.roleIdMap[lexeme.role] ?? -1 : -1,
        speakerId: this.speakerIdMap[speakerName] ?? -1,
      };
      incrementSpace(semanticBuilder, semanticCounts, semanticKey, 1);

      const structuralKey: StructuralMicrostateKey = {
        tokenBucket: bucketizeToken(index, totalWordTokens, this.config.structural.tokenBuckets),
        phrasePositionId: selectPhrasePositionId(lexeme.preferred_phrase_position),
        clauseId: Math.min(clauseAssignments[index] ?? 0, this.config.structural.clauseBins - 1),
      };
      incrementSpace(structuralBuilder, structuralCounts, structuralKey, 1);

      const noteCount = lexeme.base_notes.length;
      for (let noteIndex = 0; noteIndex < noteCount; noteIndex++) {
        const perf = this.computeNotePerformance(
          lexeme.base_notes[noteIndex],
          token,
          speaker,
          utterance,
          noteIndex,
          noteCount
        );
        const acousticKey: AcousticMicrostateKey = {
          timeBucket: bucketizeToken(noteIndex, noteCount, this.config.acoustic.timeBuckets),
          pitchBin: quantize(perf.pitch, this.config.acoustic.pitchBins, ...this.ranges.pitchRange),
          durationBin: quantize(
            perf.duration,
            this.config.acoustic.durationBins,
            ...this.ranges.durationRange
          ),
          intensityBin: quantize(
            perf.intensity,
            this.config.acoustic.intensityBins,
            ...this.ranges.intensityRange
          ),
          timbreId: this.instrumentIdMap[speaker.instrument] ?? 0,
          articulationId: this.resolveArticulationId(lexeme.base_notes[noteIndex].articulation),
        };
        incrementSpace(acousticBuilder, acousticCounts, acousticKey, 1);
      }
    });

    const emotionProfile = this.resolveEmotionProfile(utterance);
    const prosodyKey: ProsodyMicrostateKey = {
      emotionId: this.emotionIdMap[utterance.emotion ?? "neutral"] ?? 0,
      tempoBin: quantize(
        emotionProfile.tempo_multiplier,
        this.config.prosody.tempoBins,
        ...this.ranges.tempoRange
      ),
      intensityBiasBin: quantize(
        emotionProfile.intensity_bias,
        this.config.prosody.intensityBiasBins,
        ...this.ranges.intensityBiasRange
      ),
      pitchBiasBin: quantize(
        emotionProfile.pitch_bias,
        this.config.prosody.pitchBiasBins,
        ...this.ranges.pitchBiasRange
      ),
      tensionBin: quantize(
        emotionProfile.tension,
        this.config.prosody.tensionBins,
        ...this.ranges.tensionRange
      ),
    };
    incrementSpace(prosodyBuilder, prosodyCounts, prosodyKey, 1);

    ensureMinimumSpace(semanticBuilder, semanticCounts, { conceptId: -1, roleId: -1, speakerId: -1 });
    ensureMinimumSpace(structuralBuilder, structuralCounts, {
      tokenBucket: 0,
      phrasePositionId: 0,
      clauseId: 0,
    });
    ensureMinimumSpace(acousticBuilder, acousticCounts, {
      timeBucket: 0,
      pitchBin: 0,
      durationBin: 0,
      intensityBin: 0,
      timbreId: 0,
      articulationId: 0,
    });

    const semanticState = countsToState(semanticBuilder, semanticCounts);
    const structuralState = countsToState(structuralBuilder, structuralCounts);
    const acousticState = countsToState(acousticBuilder, acousticCounts);
    const prosodyState = countsToState(prosodyBuilder, prosodyCounts);

    const spaces: MicrostateSpaces = {
      semantic: semanticBuilder.finalize(),
      structural: structuralBuilder.finalize(),
      acoustic: acousticBuilder.finalize(),
      prosody: prosodyBuilder.finalize(),
    };

    return {
      semanticState,
      structuralState,
      acousticState,
      prosodyState,
      spaces,
      parsedTokens,
    };
  }

  private resolveSpeakerName(token: ParsedWordToken, utterance: UtteranceToken): string {
    const candidate = token.speakerOverride ?? utterance.speaker;
    if (candidate && this.model.speakers[candidate]) {
      return candidate;
    }
    const neutral = Object.keys(this.model.speakers)[0];
    if (!neutral) {
      throw new Error("Model has no speakers defined.");
    }
    return neutral;
  }

  private resolveEmotionProfile(utterance: UtteranceToken): EmotionProfile {
    const emotionName = utterance.emotion ?? "neutral";
    return this.model.emotion_profiles[emotionName] ?? this.getFirstEmotionProfile();
  }

  private getFirstEmotionProfile(): EmotionProfile {
    const first = Object.values(this.model.emotion_profiles)[0];
    if (!first) {
      throw new Error("Model has no emotion profiles defined.");
    }
    return first;
  }

  private assignClauses(parsedTokens: ParsedToken[]): number[] {
    const clauseAssignments: number[] = [];
    let currentClause = 0;
    parsedTokens.forEach((token) => {
      if (token.kind === "word") {
        clauseAssignments.push(currentClause);
      } else if (token.kind === "punct" || token.kind === "pause") {
        currentClause += 1;
      }
    });
    return clauseAssignments;
  }

  private computeNotePerformance(
    note: { pitch: number; duration: number; intensity: number },
    token: ParsedWordToken,
    speaker: Speaker,
    utterance: UtteranceToken,
    noteIndex: number,
    noteCount: number
  ) {
    const emotion = this.resolveEmotionProfile(utterance);
    const octaveOffsets = this.model.parameters.octave_offsets;
    const octaveName = token.octaveOverride ?? speaker.default_octave;
    const octaveOffset = octaveOffsets[octaveName] ?? 0;
    const pitch = clamp(note.pitch + octaveOffset + emotion.pitch_bias, ...this.ranges.pitchRange);
    const speakerBias = speaker.base_intensity - 64;
    const intensity = clamp(
      note.intensity + speakerBias + emotion.intensity_bias,
      ...this.ranges.intensityRange
    );
    return {
      pitch,
      duration: note.duration,
      intensity,
      noteIndex,
      noteCount,
    };
  }

  private resolveArticulationId(articulation?: string): number {
    if (!articulation) return 0;
    if (!(articulation in this.articulationIdMap)) {
      this.articulationIdMap[articulation] = Object.keys(this.articulationIdMap).length + 1;
    }
    return this.articulationIdMap[articulation];
  }
}

interface FrameBuilderRangeOptions {
  pitchRange: [number, number];
  durationRange: [number, number];
  intensityRange: [number, number];
  tempoRange: [number, number];
  intensityBiasRange: [number, number];
  pitchBiasRange: [number, number];
  tensionRange: [number, number];
}

function incrementSpace<K extends object>(
  builder: SpaceBuilder<K>,
  counts: number[],
  key: K,
  amount: number
) {
  const index = builder.register(key);
  counts[index] = (counts[index] ?? 0) + amount;
}

function ensureMinimumSpace<K extends object>(
  builder: SpaceBuilder<K>,
  counts: number[],
  fallbackKey: K
) {
  if (builder.size === 0 || counts.every((value) => !value)) {
    incrementSpace(builder, counts, fallbackKey, 1);
  }
}

function countsToState<K extends object>(builder: SpaceBuilder<K>, counts: number[]): UState32 {
  const vector = builder.size
    ? Array.from({ length: builder.size }, (_, index) => counts[index] ?? 0)
    : counts;
  const normalized = normalizeNonNegativeVector(vector.length ? vector : [1]);
  return {
    data: normalized.map((probability) => ({ real: encodeProbability(probability), imag: 0 })),
  };
}
