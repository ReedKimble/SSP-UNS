import { Concept } from "./types.js";
import { NoteSpec, ProtoLanguageModel } from "../types/ssp.js";
import { clamp } from "../utils/math.js";

const DEFAULT_DURATION = 240;

export function generateBaseNotes(concept: Concept, model: ProtoLanguageModel): NoteSpec[] {
  const middleC = 60;
  const octaveOffsets = Object.values(model.parameters.octave_offsets);
  const avgOctave =
    octaveOffsets.reduce((sum, offset) => sum + offset, 0) / (octaveOffsets.length || 1);
  const basePitch = middleC + avgOctave;

  switch (concept.kind) {
    case "entity":
      return concept.animacy === "animate"
        ? risingThenFalling(basePitch)
        : steadyContour(basePitch - 3);
    case "event":
      return motionContour(basePitch + 2);
    case "relation":
      return cadenceContour(basePitch - 5);
    case "property":
    default:
      return steadyContour(basePitch);
  }
}

function risingThenFalling(pitch: number): NoteSpec[] {
  return [
    note(pitch, 90),
    note(pitch + 3, 95),
    note(pitch, 90),
  ];
}

function steadyContour(pitch: number): NoteSpec[] {
  return [note(pitch, 80), note(pitch, 80)];
}

function motionContour(pitch: number): NoteSpec[] {
  return [
    note(pitch, 88),
    note(pitch + 5, 92),
    note(pitch + 2, 88),
  ];
}

function cadenceContour(pitch: number): NoteSpec[] {
  return [note(pitch + 2, 85), note(pitch - 1, 75)];
}

function note(pitch: number, intensity: number): NoteSpec {
  return {
    pitch: clamp(pitch, 36, 84),
    duration: DEFAULT_DURATION,
    intensity,
  };
}
