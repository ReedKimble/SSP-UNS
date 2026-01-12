# Domain-to-SSP Translator Specification
### (English → Concept Graph → SSP Lexemes → SSP Utterance)

This specification defines the complete pipeline for translating natural-language domain text into SSP (Sung Speech Protocol) utterances.  
It is a self-contained module and plugs directly into the SSP–UNS Integration Framework.

The translator produces **valid SSP utterances**, including:

- lexeme IDs  
- speaker assignments  
- emotion tags  
- SspNote sequences (base melodies)  
- full metadata needed for UNS encoding

This spec covers only the Domain→SSP side.  
(SSP→UNS is handled by the SSP–UNS Integration Spec.)

---

# 0. Translator Overview

The translator is a **four-stage pipeline**:

```

(1) English Text
↓
(2) Concept Graph
↓
(3) SSP Lexicalization
↓
(4) SSP Utterance

````

The output must conform to the SSP JSON schema:

- `tokens: string[]` where each token is `"lexemeId|speakerId"`
- `emotion: string`
- `base_notes` for each lexeme
- optional: synthesized note stream for UI preview

---

# 1. Stage 1 — English → Concept Graph

The translator must parse any English input into a **Concept Graph**, which is a normalized semantic structure representing entities, events, relations, and properties.

## 1.1 Concept Types

A ConceptGraph node MUST be one of the following:

```ts
type ConceptKind = "entity" | "event" | "property" | "relation";
````

### EntityConcept

* Derived from nouns
* Carries:

  * `id` (lemma + coarse sense)
  * `animacy` (animate/inanimate)
  * `domain` (animal, object, location, abstract, etc.)
  * optional semantic role hints

### EventConcept

* Derived from verbs
* Carries:

  * `aspect` (state, punctual, ongoing)
  * `polarity` (positive, negative)
  * optional direction / motion features

### PropertyConcept

* Derived from adjectives/adverbs
* Carries:

  * `scale` (danger, speed, size, intensity)
  * `degree` (low/mid/high)

### RelationConcept

* Derived from prepositions & relation verbs
* Carries:

  * `relationType` (in, near, have, on, between, etc.)

---

## 1.2 Edges: Semantic Roles

Edges in the Concept Graph encode **semantic dependencies**:

```ts
interface GraphRoleEdge {
  from: string;  // conceptId of event/relation
  to: string;    // conceptId of participant
  role: "agent" | "patient" | "experiencer" | "theme" | "location" | "target";
}
```

These roles must be derived from dependency parses:

| Dependency     | Role                           |
| -------------- | ------------------------------ |
| nsubj          | agent / experiencer            |
| dobj / obj     | patient / theme                |
| obl / nmod:loc | location                       |
| iobj           | indirect target                |
| advmod/amod    | property modifiers (not edges) |

---

## 1.3 Emotion Extraction

The translator must derive an **emotion label**:

* From lexical cues:

  * “danger”, “run!”, “help”, “wolf”, “predator” → `alert` / `afraid`
* From punctuation:

  * “!” increases tension
* From sentiment polarity:

  * neutral → `neutral`
  * positive sentiment → `calm` or `happy`

Emotion labels correspond to keys in `ssp.emotion_profiles`.

---

# 2. Stage 2 — Concept Graph → SSP Lexemes

The translator must map each ConceptGraph node to a **valid SSP lexeme**:

* If the concept already exists in `ssp.lexicon` → use that lexeme ID.
* Otherwise → auto-generate a NEW lexeme and insert it into the lexicon.

## 2.1 Lexeme Registry

Implement a persistent registry:

```
ConceptID → LexemeID
```

This guarantees consistent lexicalization across sessions.

---

## 2.2 Lexeme Generation Rules

When generating a new lexeme:

```ts
interface SspLexemeEntry {
  gloss: string;
  role: string | null;
  relation_type: string | null;
  preferred_phrase_position: "onset" | "medial" | "cadence";
  base_notes: SspNote[];
}
```

### Role assignment

Based on concept kind:

| Concept Kind       | SSP Role                         |
| ------------------ | -------------------------------- |
| entity (animate)   | agent                            |
| entity (inanimate) | patient                          |
| event              | action                           |
| location           | location                         |
| relation           | (null)                           |
| property           | handled via prosody, not lexemes |

### Phrase position assignment

Follow SSP canonical ordering:

* `onset` → agents, experiencers
* `medial` → event concepts
* `cadence` → patients, locations, complements

### Base note generation templates

The translator must produce a **short melodic pattern** for each lexeme:

**Entities**

* animate:

  * rising → falling 2–3 notes
* inanimate:

  * stable or flat contour

**Events**

* motion events:

  * small arpeggio up/down
* perception:

  * short upward “peek”
* state verbs:

  * sustained tone, minimal movement

**Locations**

* cadential 2-note motif with downward resolution

**Abstract concepts**

* soft timbre, mid-range pitch

**The translator MUST:**

* use speaker’s default timbre
* apply emotion biases (pitch/intensity) to build actual notes but preserve base patterns

---

# 3. Stage 3 — SSP Utterance Construction

An SSP utterance is:

```ts
interface SspExampleUtterance {
  id: string;
  tokens: string[];     // ["lexemeId|speakerId", ...]
  emotion: string;       // key in ssp.emotion_profiles
}
```

## 3.1 Token Ordering

Tokens must be ordered:

1. **Onset**

   * agents, experiencers
2. **Medial**

   * main events
3. **Cadence**

   * patients, themes, locations

Example ordering for:

> “I see the wolf here!”

→ `["I|Alice", "see|Alice", "wolf|Alice", "here|Alice"]`

## 3.2 Prosodic Modulation

Emotion and properties modify:

* `tempo_multiplier`
* `pitch_bias`
* `intensity_bias`
* `tension`

The translator should **compute local adjustments** for each lexeme’s realization based on properties (adjectives/adverbs).

---

## 3.3 Synthesized SspNote Stream (optional but recommended)

After producing tokens, the translator may optionally produce:

```ts
SspNote[]  // full performance ready for playback
```

Using:

* lexeme’s base notes
* speaker timbre
* emotion profile
* adjustments for intensity/length/etc.

This enables UI playback without external synthesizers.

---

# 4. Stage 4 — Output Format (Translator → Downstream)

The translator outputs:

### **A complete SSP Utterance:**

```ts
{
  utterance: SspExampleUtterance;
  notes: SspNote[];            // optional synthesis
  conceptGraph: ConceptGraph;  // kept for UNS mapping
  emotion: string;             // discrete label
}
```

This object feeds directly into:

* `encodeUtteranceToFrame()` (from the SSP–UNS integration)
* The UNS encoder
* The Web UI renderer
* The synthesizer (if included)

---

# 5. Implementation Notes

### 5.1 NLP stack

Any parser is allowed:

* spaCy
* Stanza
* HuggingFace transformers
* Your own custom parser
* Copilot-generated parser

### 5.2 Lexeme persistence

The translator must maintain a stable dictionary so repeated concepts always map to the same SSP lexeme.

### 5.3 Domain extensibility

This spec works with **any** domain that produces English descriptions:

* gameplay logs
* simulation outputs
* narrative descriptions
* sensor annotations
* chat/commands
* structured metadata converted to English

### 5.4 Losslessness guarantee

No conceptual information may be discarded:

* All concepts → lexemes
* All relations → ordering or modulation
* All properties → emotion/prosody

Everything must flow into the SSP layer.

---

# 6. Summary

This translator spec defines a clear, modular, and deterministic pipeline:

```
English → Concept Graph → SSP Lexicon → SSP Utterance
```

It ensures:

* consistent lexeme generation
* consistent token structure
* correct emotional/prosodic mapping
* correct melodic patterns
* full compatibility with SSP→UNS encoding
* direct use in UI and synthesis

This is the **canonical** front-end for any SSP-UNS-based application.

