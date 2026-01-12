import { buildPerformance } from "./eventBuilder.js";
import { synthesizePerformance, SynthesisOptions } from "./synth.js";
import { encodeWav } from "./wav.js";
import { ProtoLanguageModel, UtteranceToken } from "../types/ssp.js";

export function renderUtteranceToWav(
  model: ProtoLanguageModel,
  utterance: UtteranceToken,
  options?: SynthesisOptions
): Uint8Array {
  const performance = buildPerformance(model, utterance);
  const samples = synthesizePerformance(performance, options);
  return encodeWav(samples, options?.sampleRate ?? 44100);
}
