import { ProtoLanguageModel } from "./types/ssp.js";
import { FrameBuilder, FrameBuilderOptions } from "./frameBuilder.js";

export function parseProtoLanguageModel(source: string | ProtoLanguageModel): ProtoLanguageModel {
  if (typeof source === "string") {
    return JSON.parse(source) as ProtoLanguageModel;
  }
  return source;
}

export function createFrameBuilder(
  source: string | ProtoLanguageModel,
  options?: FrameBuilderOptions
): FrameBuilder {
  const model = parseProtoLanguageModel(source);
  return new FrameBuilder(model, options);
}
