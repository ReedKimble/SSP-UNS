````markdown
# SSP–UNS Full-Fidelity Integration Specification
### (“Lossless SSP Representation via Multistate UNS Encoding”)
### Version 1.0 — Implementation Guide for LLMs

This document defines how to integrate the **Sung Speech Protocol (SSP)** with the **Universal Number Set (UNS)** in a way that preserves **all SSP information** while providing **UNS-based representations** for semantic, structural, acoustic, and prosodic reasoning.

This is a *language-agnostic integration guide* intended for use by LLMs or developers implementing the system in any language (TypeScript, Rust, Python, C++, Zig, etc.).  
The implementer must have access to:

- **SSP specification & schema**
- **UNS Machine-First Specification** (Module 9)
- **UNS Runtime32 Specification**  
- Optionally: UNS higher-level libraries (if provided)

---

# 0. Purpose and High-Level Architecture

SSP is a multidimensional communication protocol containing:

- Lexical meaning and semantic role metadata  
- Full melodic note-level detail (pitch, duration, intensity, timbre, articulation)  
- Emotion profiles (discrete and continuous)  
- Speaker identities and instrument metadata  
- Structural ordering (phrases, clauses, onset/medial/cadence)  
- Raw audio realizations (optional but supported)

UNS is a finite-microstate computational algebra capable of representing and manipulating **probability distributions** over arbitrary finite spaces. UNS itself contains:

- No strings  
- No symbolic names  
- Only numeric microstate indices  
- `UValue32` and `UState32` arrays of Q16.16 complex numbers  
- Normalization, mixing, merging, masking, cancellation, and observables (`read(f | ψ)`)

**The goal of this integration:**  
Represent *all* SSP information faithfully in a set of **parallel UNS state spaces**, each capturing one modality of the utterance, while keeping the raw SSP content externally associated with these UNS states.

We use a composite structure:

> **SSP–UNS Frame** =  
> - *Raw SSP data* (utterance, notes, concept graph, audio, lexicon)  
> - *Semantic UNS state*  
> - *Structural UNS state*  
> - *Acoustic UNS state*  
> - *Prosody UNS state*

All four UNS states together represent *everything necessary to reason about the utterance at any resolution*, while the raw SSP view remains available for reconstruction, synthesis, and faithful replay.

---

# 1. SSP–UNS Frame

The main representation for an utterance is a **Frame** possessing both SSP and UNS content:

```ts
interface SspUnsFrame {
  // === Raw SSP data (lossless) ===
  sspUtterance: SspExampleUtterance;
  sspNotes: SspNote[];            // complete realized note stream
  conceptGraph: ConceptGraph;     // from semantic parsing
  audioBuffer?: Float32Array;     // optional raw waveform

  // === UNS state spaces (indexed microstates) ===
  semanticSpace: SemanticMicrostateSpace;
  structuralSpace: StructuralMicrostateSpace;
  acousticSpace: AcousticMicrostateSpace;
  prosodySpace: ProsodyMicrostateSpace;

  // === UNS states for each space ===
  semanticState: UState32;
  structuralState: UState32;
  acousticState: UState32;
  prosodyState: UState32;
}
````

A Frame is always constructed in two phases:

1. **Extract SSP information** (lexemes, roles, tokens, note stream, emotion profile).
2. **Encode** each dimensional layer into its corresponding UNS space.

---

# 2. Microstate Design Philosophy

UNS requires that each state lives over a finite index set:
`X = {0, 1, …, M−1}`.

To preserve all SSP information without building a single enormous microstate space, we divide SSP information into **four orthogonal dimensions**, each with its own finite microstate space.

## 2.1 Semantic Microstates

Captures **meaning**, roles, speaker, and conceptual identity.

**Key structure:**

```ts
type SemanticMicrostateKey = {
  conceptId: number;        // int enum from concept registry
  roleId: number;           // agent/patient/location/etc.
  speakerId: number;        // speaker enum
};
```

**Allowed values:**

* `conceptId`: integers assigned via a Concept Registry
* `roleId`: integers assigned from SSP roles
* `speakerId`: integers from SSP speakers

**Index formula (example):**

```
index = conceptId * (maxRoles * maxSpeakers)
      + roleId    * (maxSpeakers)
      + speakerId
```

All naming (concepts, roles, speakers) must be handled via **host-side enums**; UNS stores only indices.

---

## 2.2 Structural Microstates

Captures **token order**, phrase group, clause structure.

```ts
type StructuralMicrostateKey = {
  tokenBucket: number;         // binned token index
  phrasePositionId: number;    // onset = 1, medial = 2, cadence = 3
  clauseId: number;
};
```

Token indices can be binned into coarse-grained regions to keep the space finite:

* Bucket 0: onset region
* Bucket 1: medial region
* Bucket 2: tail/cadence region

This preserves phrase structure and ordering *without needing a microstate for every absolute index*.

---

## 2.3 Acoustic Microstates

Captures **note-level performance**: pitch, duration, intensity, timbre, articulation, time position.

```ts
type AcousticMicrostateKey = {
  timeBucket: number;        // discretized onset time
  pitchBucket: number;       // pitch or semitone bins
  durationBucket: number;    // duration bins
  intensityBucket: number;   // dynamic bins (0..127 → 8–32 bins)
  timbreId: number;          // speaker/instrument timbre enum
  articulationId: number;    // staccato/legato/accent/etc.
};
```

This representation can be made arbitrarily fine or coarse, depending on desired resolution.
All timbre and articulation labels are replaced by numeric **enums**.

---

## 2.4 Prosody Microstates

Captures **continuous emotional/prosodic modulation**, discretized into bins.

```ts
type ProsodyMicrostateKey = {
  emotionId: number;         // discrete emotion (alert, afriad, calm)
  tempoBin: number;
  intensityBiasBin: number;
  pitchBiasBin: number;
  tensionBin: number;
};
```

The emotion profile in SSP contains:
`tempo_multiplier`, `intensity_bias`, `pitch_bias`, `tension`.
These continuous numbers must be **quantized into bins**.

---

# 3. Encoding Procedure (Lossless SSP → UNS)

## Step 1 — Build all microstate spaces

The host implementation constructs four spaces:

```ts
semanticSpace = buildSemanticSpace(concepts, roles, speakers)
structuralSpace = buildStructuralSpace(numTokenBuckets, phrasePositions, clauseIds)
acousticSpace = buildAcousticSpace(pitchBins, durationBins, intensityBins, timbreIds, articulationIds)
prosodySpace = buildProsodySpace(emotionIds, tempoBins, intensityBiasBins, pitchBiasBins, tensionBins)
```

Each space produces:

* `size M`
* `indexByKey` map
* `keys[]` array (reverse mapping)

All **key types** use integers; UNS receives only indices.

---

## Step 2 — Produce Raw Count Vectors

For each space, create a Float64 count vector of size `M`.

### 2.1 Semantic

For each SSP token:

1. Determine the underlying **conceptId**
2. Determine **roleId** (via lexeme metadata or concept graph)
3. Extract **speakerId**
4. Use `(conceptId, roleId, speakerId)` to get index `i`
5. Increment: `semanticRaw[i] += 1`

### 2.2 Structural

For each SSP token:

1. Map token index to a **tokenBucket**
2. Map phrase position to `phrasePositionId`
3. Determine or infer `clauseId`
4. Index → `structRaw[i] += 1`

### 2.3 Acoustic

For each SSP note (not token):

1. Quantize onset time → `timeBucket`
2. Quantize `pitch`, `duration`, `intensity`
3. Map timbre & articulation to enums
4. Index → `acousticRaw[i] += 1`

### 2.4 Prosody

For the utterance-level emotion profile:

1. Get `emotionId`
2. Quantize `tempo_multiplier`, `intensity_bias`, `pitch_bias`, `tension`
3. Set that microstate index to 1
   (`prosodyRaw[i] = 1`)

---

## Step 3 — Normalize to UNS States

For each raw vector:

1. Convert to a `UValue32`:

   * Convert each Float64 component to Q16.16 complex `(re = value, im = 0)`
2. Apply UNS normalization:

   * If sum > 0: divide by sum
   * If sum == 0: output uniform
3. Produce a valid `UState32`

These states are then bound in the UNS environment as:

```
state ψ_semantic = <preloaded>
state ψ_struct   = <preloaded>
state ψ_acoustic = <preloaded>
state ψ_prosody  = <preloaded>
```

---

# 4. Observables, Queries, and UNS Programs

UNS observables (`UValue32`) can be used to probe any dimension, provided they operate in the correct microstate space.

Examples:

### 4.1 Semantic danger observable

Constructed in the host:

```ts
let f_danger_sem = new UValue32(semanticSpace.size);
for each microstate i:
    if conceptId(i) ∈ {WOLF, FIRE, PREDATOR} and emotion ∈ {alert, afraid}:
         f_danger_sem[i] = 1
     else f_danger_sem[i] = 0
```

UNS program:

```
let dangerSem = read(f_danger_sem | ψ_semantic)
```

### 4.2 Acoustic brightness observable

(using pitch/intensity buckets)

```
let brightAc = read(f_brightness | ψ_acoustic)
```

### 4.3 Prosodic tension comparison

```
let tension = read(f_tension | ψ_prosody)
```

Observables must be defined on **the matching microstate space**.

---

# 5. Losslessness Guarantee

This design ensures that:

### ✔ All SSP information is preserved

* Raw audio remains in the frame.
* Full note stream is preserved exactly.
* Lexemes, roles, lexicon metadata preserved.
* Concept graph preserved.
* Emotion profiles preserved.
* Structural positions preserved.
* Every element is either:

  * Represented exactly in a UNS microstate; or
  * Stored verbatim in the SSP portion of the frame.

### ✔ UNS states do *not* need to store strings

All symbolic labels (lexemes, roles, instruments, articulations, emotion IDs) are mapped to integer **enums** before indexing.

### ✔ UNS states only represent **probability distributions**

They do not replace SSP; they provide a mathematical view over each modality.

### ✔ Each state is finite and well-defined

UNS normalization, cancellation, mixing, and observables work as intended.

### ✔ Reconstruction is lossless

Given a `SspUnsFrame`, you can reconstitute:

* the original token sequence
* the original melodic sequence
* the original continuous emotion profile
* the full concept graph
* or regenerate a canonical SSP rendering

Nothing needed for SSP expression is discarded.

---

# 6. Reference Implementation Sketch (Language-Independent)

Below is the core algorithm in neutral pseudocode.

```
function encodeUtteranceToFrame(utterance, lexicon, conceptGraph, rawNotes, audio):
    frame = new SspUnsFrame()

    frame.sspUtterance = utterance
    frame.sspNotes      = rawNotes
    frame.conceptGraph  = conceptGraph
    frame.audioBuffer   = audio

    // 1. Build microstate spaces
    frame.semanticSpace   = buildSemanticSpace(conceptGraph)
    frame.structuralSpace = buildStructuralSpace(utterance)
    frame.acousticSpace   = buildAcousticSpace(rawNotes)
    frame.prosodySpace    = buildProsodySpace(utterance.emotionProfile)

    // 2. Generate raw count vectors
    semanticRaw   = buildSemanticRaw(utterance, conceptGraph, frame.semanticSpace)
    structuralRaw = buildStructuralRaw(utterance, frame.structuralSpace)
    acousticRaw   = buildAcousticRaw(rawNotes, frame.acousticSpace)
    prosodyRaw    = buildProsodyRaw(utterance.emotionProfile, frame.prosodySpace)

    // 3. Convert to UNS states
    frame.semanticState   = normalizeToUNS(semanticRaw)
    frame.structuralState = normalizeToUNS(structuralRaw)
    frame.acousticState   = normalizeToUNS(acousticRaw)
    frame.prosodyState    = normalizeToUNS(prosodyRaw)

    return frame
```

All functions are deterministic and do not require strings inside UNS.

---

# 7. Usage Pattern

For any SSP utterance:

```
frame = encodeUtteranceToFrame(utterance, lexicon, graph, notes, audio)

semanticDanger = read(f_danger_semantic  | frame.semanticState)
structuralShape = read(f_phrase_profile  | frame.structuralState)
brightness      = read(f_brightness      | frame.acousticState)
tensionMeasure  = read(f_tension         | frame.prosodyState)
```

For comparisons:

```
similarity_sem   = dot(frameA.semanticState, frameB.semanticState)
distance_ac      = dist_L1(frameA.acousticState, frameB.acousticState)
cancel_sem       = CANCEL(frameA.semanticState, frameB.semanticState)
merged_prosody   = MERGE({frameA.prosodyState, frameB.prosodyState})
```

---

# 8. Requirements for Any Implementation

An LLM or developer implementing this must:

1. **Never store strings in UNS** — all symbolic concepts, roles, speakers, articulations, emotions must be mapped to integers before UNS indexing.
2. **Preserve raw SSP data** in the frame sidecar.
3. **Match observable dimensionality**: each observable must be created in the correct microstate space.
4. **Normalize every UNS state** with UNS `NORM` semantics.
5. **Maintain stable enum registries** for reproducibility.

---

# 9. Optional Extensions

* Add **Pragmatics State** for focus marking, discourse structure, register.
* Add **Lexical-Morphological State** if the SSP front-end develops more morphology.
* Add **Gestural/Visual State** if SSP is extended to multimodal signaling.
* Introduce **hierarchical UNS spaces** for phrase-level vs note-level distributions.

---

# 10. Summary

This specification describes a **lossless multi-state mapping** from SSP to UNS:

* **Semantic State** — conceptual & role meaning
* **Structural State** — token order & phrase structure
* **Acoustic State** — detailed musical realization
* **Prosody State** — continuous emotional modulation

Together with raw SSP data stored externally, this system preserves every detail of the sung utterance while enabling UNS-based algebraic reasoning.

This is the canonical way to implement SSP–UNS integration in any programming language.

```
```
