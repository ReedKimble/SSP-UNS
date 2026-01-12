## Appendix B — Simulation Helper Specification

### Converting the SSP ProtoLanguage JSON into MIDI/Event Streams

This specification describes a **reference pipeline** for converting the SSP ProtoLanguage JSON model into MIDI-like event streams. It is intended as a **conceptual guide**, not a fixed implementation; different simulators may vary in internal details as long as they respect the same transformation logic.

---

### B.1 Goals and Scope

**Input:**

* A ProtoLanguage JSON file as defined in Appendix A:

  * `parameters`, `instruments`, `speakers`, `emotion_profiles`, `lexicon`,
  * `examples` (Utterances with `tokens` and `emotion` fields).

**Output:**

* A set of **event streams** (e.g., MIDI tracks), where each event includes:

  * timing (ticks or seconds),
  * pitch (MIDI note),
  * velocity/intensity,
  * duration,
  * instrument/program,
  * channel or speaker identity.

The simulator focuses on the **vocal melodic layer** only. Gesture, posture, and other modalities are out of scope and intentionally omitted.

---

### B.2 Core Data Structures (Conceptual)

Implementations may choose different names; this is a reference schema.

#### B.2.1 Event

```text
Event {
  time_ticks: int      // absolute time in ticks from start
  type: "NoteOn" | "NoteOff"
  pitch: int           // MIDI note number, 0–127
  velocity: int        // 0–127; 0 for NoteOff if using NoteOn-with-0 pattern
  channel: int         // MIDI channel or logical channel index
  program: int         // MIDI program number (instrument)
}
```

#### B.2.2 Track / Stream

```text
Track {
  id: string           // e.g., "Alice", "Bob", "Neutral"
  events: Event[]      // sorted by time_ticks
}
```

#### B.2.3 PerformanceContext

```text
PerformanceContext {
  json_model: object               // parsed ProtoLanguage JSON
  tempo_bpm: number                // effective tempo for this utterance
  tick_division: int               // from parameters.tick_division
  speaker: Speaker                 // from json_model.speakers
  emotion_profile: EmotionProfile  // from json_model.emotion_profiles
}
```

---

### B.3 Initialization from JSON

1. **Load the JSON model** into memory.
2. Read global parameters:

   * `tick_division`
   * `default_tempo_bpm`
   * `long_pause_ticks`
   * `sentence_break_ticks`
   * `octave_offsets` (Low/Medium/High).
3. Build lookup maps:

   * `instruments[timbre] -> MIDI program`
   * `speakers[name] -> Speaker`
   * `emotion_profiles[name] -> EmotionProfile`
   * `lexicon[word] -> Lexeme`

---

### B.4 Token Parsing

Each token in an `Utterance.tokens` array uses the `TokenForm` rule from Appendix A.

**Grammar:**

* Base pattern: `word[~Octave][|Speaker]`
* Special tokens:

  * `'|'` → explicit long pause / sentence break.
  * `'.'`, `'?'`, `'!'` → sentence-final punctuation (may appear as standalone tokens).

**Parsing steps:**

For each token string:

1. If token is exactly `'|'`:

   * classify as **PAUSE_LONG**.
2. Else if token is one of `'.'`, `'?'`, `'!'`:

   * classify as **PUNCTUATION** with type = `statement`, `question`, or `exclamation`.
3. Else:

   * Split into three logical pieces:

     * `word` (lexical key)
     * optional `~Octave` (Low/Medium/High)
     * optional `|Speaker` (e.g. `Alice`, `Bob`, `Neutral`)

Return a parsed structure:

```text
ParsedToken {
  kind: "WORD" | "PAUSE_LONG" | "PUNCT",
  word?: string,
  octave_override?: "Low" | "Medium" | "High",
  speaker_override?: string,
  punctuation_type?: "statement" | "question" | "exclamation"
}
```

---

### B.5 Utterance Processing Pipeline

Given an `Utterance` from the JSON:

```json
{
  "tokens": [ "I|Alice", "see|Alice", "wolf|Alice", "!" ],
  "emotion": "alert",
  ...
}
```

#### B.5.1 Establish Performance Context

1. Determine **emotion profile**:

   * Lookup `emotion_profiles[utterance.emotion]`.

2. Determine **default speaker**:

   * If the utterance explicitly uses only one speaker (e.g., all tokens contain `|Alice`), you may treat that as the default.
   * Otherwise, use `speakers.Neutral` as a default and let per-token overrides assign speakers.

3. Compute **effective tempo**:

   * `tempo_bpm = default_tempo_bpm * emotion_profile.tempo_multiplier`.

4. Decide **channel/track assignment**:

   * A simple rule: one track (channel) per `Speaker` identity actually used in the utterance.

#### B.5.2 Build Sentences and Phrases

Traverse parsed tokens:

* Start a new **sentence** at the beginning or after a `'|'` or a sentence-final punctuation.
* Sentence boundaries:

  * `PAUSE_LONG ('|')` → strong boundary with `long_pause_ticks`.
  * Punctuation `.` `?` `!` → sentence end with `sentence_break_ticks` insertion after melodic cadence.

This step is conceptual; implementation can simply insert special “rest” regions in the time stream at boundaries.

---

### B.6 Mapping Tokens to Note Events

#### B.6.1 Base Note Sequence

For each ParsedToken of kind `"WORD"`:

1. Lookup the corresponding Lexeme: `L = lexicon[word]`.
2. Copy `L.base_notes` as the starting melodic pattern for this token.

#### B.6.2 Determine Speaker and Instrument

1. If `ParsedToken.speaker_override` is present:

   * `speaker = speakers[ParsedToken.speaker_override]`.
2. Else:

   * use the **default speaker** for the utterance.

The speaker gives:

* `speaker.default_octave`
* `speaker.instrument` (timbre key)
* `speaker.base_intensity`

Lookup `program = instruments[speaker.instrument]`.

#### B.6.3 Apply Octave and Pitch Modifiers

Start with each base note’s `pitch`:

1. Apply speaker default octave:

   * `pitch += octave_offsets[speaker.default_octave]`.
2. If `ParsedToken.octave_override` is present:

   * Re-apply or add the override:

     * Either:

       * Replace: drop speaker octave and apply `octave_offsets[override]`, **or**
       * Add: `pitch += (octave_offsets[override] - octave_offsets["Medium"])`.
   * Choose one rule and stick to it (replacement is simpler and recommended).
3. Apply emotion pitch bias:

   * `pitch += emotion_profile.pitch_bias`.

Ensure pitch stays within `0–127` (clip if necessary).

#### B.6.4 Apply Intensity Modifiers

Starting from base note’s `intensity`:

1. Combine base note intensity with speaker base:

   * For example:
     `combined_intensity = clamp( base_intensity + (speaker.base_intensity - 96), 0, 127 )`
   * Or treat base note as the core and speaker as a mild bias; the spec allows either, but be consistent.
2. Apply emotion intensity bias:

   * `intensity = clamp(combined_intensity + emotion_profile.intensity_bias, 0, 127)`.

#### B.6.5 Timing, Rhythm, and Tempo

1. Use the note’s `duration` in ticks as given in `base_notes`.
2. The **tempo** (BPM) affects real-world seconds but not ticks; if generating raw MIDI:

   * set MIDI tempo meta-event according to `tempo_bpm`.
   * Keep tick durations as provided.
3. Maintain a running `current_time_ticks` per track (or per utterance):

   * For each note, insert:

     * `NoteOn` at `current_time_ticks`.
     * `NoteOff` at `current_time_ticks + duration`.
   * Then set `current_time_ticks += duration`.

---

### B.7 Sentence-Final Inflection

When a PUNCT token (`.`, `?`, `!`) closes a sentence, adjust the **final note** of the sentence:

Typical simple rules:

* **Statement (`.`)**:

  * Lower final note by e.g. `-2` semitones.
  * Optionally lengthen duration (e.g. ×1.2).
* **Question (`?`)**:

  * Raise final note by e.g. `+2` semitones.
  * Optionally shorten preceding note durations slightly.
* **Exclamation (`!`)**:

  * Increase final intensity (e.g. `+10`), maybe add slight upward or downward leap (implementation choice).

Implementation:

* Identify the last `NoteOn` event in the sentence.
* Modify its `pitch` and/or `velocity` and potentially its `NoteOff` duration.

After applying inflection, add a **rest**:

* Increment `current_time_ticks += sentence_break_ticks`.

---

### B.8 Long Pauses (`'|'` tokens)

For a `PAUSE_LONG` token:

* Do not emit notes.
* Simply add:

  * `current_time_ticks += long_pause_ticks`.

This marks explicit sentence or discourse boundaries.

---

### B.9 Channel and Track Assignment

A simple, SSP-consistent strategy:

* **One track/stream per speaker identity**:

  * Map each `Speaker` used (Alice, Bob, Neutral) to its own MIDI track and/or channel.
  * Assign `channel` based on a mapping:

    * Alice → channel 0
    * Bob → channel 1
    * Neutral → channel 2
  * Set the MIDI program for each channel based on `speaker.instrument` and `instruments[...]`.

This preserves speaker identity in the event structure and supports panned or timbral differentiation in actual playback.

---

### B.10 Example: ex-1-alert-wolf

For the example:

```json
{
  "id": "ex-1-alert-wolf",
  "tokens": [ "I|Alice", "see|Alice", "wolf|Alice", "!" ],
  "emotion": "alert"
}
```

**High-level expected simulator behavior:**

1. Set `tempo_bpm = default_tempo_bpm * emotion_profiles.alert.tempo_multiplier`.
2. Use `Alice`’s speaker defaults:

   * High octave, choir timbre, relatively high base intensity.
3. Convert `I`, `see`, `wolf` into melodic sequences with:

   * High octave pitch offsets,
   * Increased intensity from `alert` profile,
   * Slight upward pitch bias if specified.
4. Apply **exclamation** inflection:

   * Boost velocity on the final note of `wolf`.
   * Possibly a small upward leap in the last pitch.
5. Insert a sentence break rest using `sentence_break_ticks`.

The end result is a track for Alice with a short, urgent, high-register melodic phrase.

---

### B.11 Edge Cases and Implementation Notes

* **Missing Lexeme**:
  If a word is not found in `lexicon`, simulators may:

  * skip the token,
  * or insert a brief neutral “unknown” tone.
* **Emotion not found**:
  Fall back to `emotion_profiles.neutral`.
* **Speaker not found**:
  Fall back to `speakers.Neutral`.
* **Pitch saturation**:
  Ensure pitch stays within `[0, 127]` by clipping.

---

### B.12 Summary

To convert the SSP JSON into MIDI/event streams, simulators should:

1. Parse tokens into structured `ParsedToken`s.
2. Build performance context (speaker, emotion, tempo).
3. For each lexical token:

   * Start from `lexicon[word].base_notes`,
   * Apply octave offsets, emotion biases, and intensity adjustments,
   * Place notes sequentially in time.
4. Apply sentence-final inflections and pause handling.
5. Emit events into speaker-specific tracks with appropriate instrument programs.

This yields a **workable experimental platform** for comparing:

* high-dimensional melodic communication
  vs.
* compressed symbolic systems,

directly reflecting the theoretical constructs of the SSP hypothesis.

