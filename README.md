# UNS-SSP TypeScript Toolkit

A modular TypeScript library that wires the Sung–Speech Protolanguage (SSP) specification into the Universal Number Set (UNS) runtime while providing a lightweight audio synthesis engine for listening to UNS-SSP utterances.

## Runtime Editor

* **[UNS-SSP Studio](https://reedkimble.github.io/SSP-UNS/workspace/editor)** 

## Overview

This toolkit translates natural language into a sung-speech protolanguage (SSP) and generates audio representations through Universal Number Set (UNS) vector operations. The current version includes a **complete, production-ready application shell** with full UI navigation, state management, and modular architecture.

**Current Stage**: The audio generation uses minimal MIDI-style synthesis because the sophisticated mapping from SSP emotional/semantic vectors to expressive musical parameters is an **emergent process** that develops through iterative refinement and user feedback.

**Next Stage**: Multi-track synthesis with voice switching to account for tonal ranges not expressible with simple sine tones, plus expanded melody templates and dynamic instrument selection.

## Project Structure

- **`/src`** - Core TypeScript library (frame encoding, translation, audio synthesis)
- **`/workspace`** - React web application (editor, translation studio, audio lab)
- **`/docs`** - Specifications and integration guides

## Features

- **Model ingestion** – load the ProtoLanguage JSON and normalize access to lexicon, speakers, instruments, and emotion profiles.
- **Frame encoding** – convert SSP utterances into semantic, structural, acoustic, and prosody UNS microstates (Q16.16 amplitudes).
- **Event pipeline** – interpret SSP tokens into tempo-aware note streams that keep track, speaker, and emotional context.
- **Audio synthesis** – turn performances into PCM buffers or ready-to-save WAV bytes for rapid prototyping.
- **Domain-to-SSP translation** – convert short English descriptions into concept graphs, lexemes, and SSP utterances with optional audio previews.
- **Web Studio** – full-featured UI for designing, translating, and validating SSP documents with live audio preview.

## Getting Started

```bash
npm install
npm run build
```

### Loading a model and encoding UNS states

```ts
import { createFrameBuilder, FrameBuilder } from "uns-ssp";
import sspModel from "./SSP.json" assert { type: "json" };

const frameBuilder = createFrameBuilder(sspModel);
const frame = frameBuilder.encodeUtterance({
  tokens: ["I|Alice", "see|Alice", "wolf|Alice", "!"],
  emotion: "alert",
  speaker: "Alice",
});

console.log(frame.semanticState.data.length); // -> microstates used
```

### Generating audio

```ts
import { renderUtteranceToWav } from "uns-ssp";
import fs from "node:fs";

const wavBytes = renderUtteranceToWav(sspModel, {
  tokens: ["I|Alice", "see|Alice", "wolf|Alice", "!"],
  emotion: "alert",
  speaker: "Alice",
});

fs.writeFileSync("alert_call.wav", wavBytes);
```

### Translating English text to SSP

```ts
import { DomainToSspTranslator } from "uns-ssp";

const translator = new DomainToSspTranslator(sspModel);
const result = translator.translate("I see the wolf here!", { performancePreview: true });

console.log(result.utterance.tokens);
// => ["I|Alice", "see|Alice", "wolf|Alice", "here|Alice"] (example)
```

## Scripts

- `npm run build` – generate type declarations and ES modules in `dist/`.
- `npm run watch` – incremental compilation while editing.
- `npm run lint` – ESLint with import hygiene and Prettier compatibility.
- `npm run test` – placeholder for Vitest suites (add tests under `test/`).

## Next Steps

- Hook these primitives into a web UI for visual editing, state inspection, and multi-track mixing.
- Add richer synthesis (multi-wave oscillators, filters) or export to MIDI for DAW workflows.
- Expand validation to cover every operator defined in `UNS-SSP_Integration.md` once runtime instrumentation is ready.
