import { createFrameBuilder, DomainToSspTranslator, FrameBuilder } from 'uns-ssp'
import { demoModel } from './mockModel'

let frameBuilder: FrameBuilder | null = null
let translator: DomainToSspTranslator | null = null

function ensureFrameBuilder() {
  if (!frameBuilder) {
    frameBuilder = createFrameBuilder(demoModel)
  }
  return frameBuilder
}

function ensureTranslator() {
  if (!translator) {
    translator = new DomainToSspTranslator(demoModel)
  }
  return translator
}

export function getToolkit() {
  return {
    model: demoModel,
    frameBuilder: ensureFrameBuilder(),
    translator: ensureTranslator(),
  }
}
