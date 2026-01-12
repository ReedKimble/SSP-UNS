import { Concept, ConceptGraph, ConceptKind, GraphRoleEdge, RoleName } from "./types.js";

const RELATION_WORDS = new Set(["in", "on", "near", "with", "at", "to"]);
const LOCATION_HINTS = new Set(["here", "there", "inside", "outside", "village", "forest"]);
const ANIMATE_PRONOUNS = new Set(["i", "you", "we", "they", "he", "she", "wolf", "animal"]);
const MOTION_VERBS = new Set(["run", "walk", "move", "go", "flee", "approach"]);
const PERCEPTION_VERBS = new Set(["see", "hear", "watch", "spot", "sense"]);
const DANGER_WORDS = new Set(["danger", "wolf", "predator", "warning", "attack"]);

export function buildConceptGraph(text: string): ConceptGraph {
  const tokens = tokenize(text);
  const concepts: Concept[] = [];
  const edges: GraphRoleEdge[] = [];
  const emotionHints: string[] = [];

  let lastEventId: string | undefined;
  tokens.forEach((token, index) => {
    const kind = inferKind(token);
    if (!kind) return;
    const concept: Concept = {
      id: `${kind}_${index}_${token}`,
      lemma: token,
      text: token,
      kind,
      ...(kind === "entity"
        ? { animacy: ANIMATE_PRONOUNS.has(token) ? "animate" : "inanimate" }
        : {}),
      ...(kind === "event" ? { aspect: inferAspect(token) } : {}),
      ...(kind === "property" ? { scale: "intensity", degree: inferDegree(token) } : {}),
      ...(kind === "relation" ? { relationType: token } : {}),
    } as Concept;
    concepts.push(concept);

    if (kind === "event") {
      lastEventId = concept.id;
    } else if (kind === "entity" && lastEventId) {
      const role = inferRole(token);
      edges.push({ from: lastEventId, to: concept.id, role });
    }

    if (DANGER_WORDS.has(token)) {
      emotionHints.push("alert");
    }
    if (token.endsWith("!")) {
      emotionHints.push("exclamation");
    }
  });

  return { concepts, edges, emotionHints };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s!]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function inferKind(token: string): ConceptKind | undefined {
  if (RELATION_WORDS.has(token)) return "relation";
  if (MOTION_VERBS.has(token) || PERCEPTION_VERBS.has(token)) return "event";
  if (LOCATION_HINTS.has(token)) return "entity";
  if (ANIMATE_PRONOUNS.has(token)) return "entity";
  if (DANGER_WORDS.has(token)) return "entity";
  if (token.endsWith("!")) return undefined;
  if (token.length <= 3) return undefined;
  return "entity";
}

function inferAspect(token: string): EventConcept["aspect"] {
  if (MOTION_VERBS.has(token)) return "ongoing";
  if (PERCEPTION_VERBS.has(token)) return "punctual";
  return "state";
}

function inferDegree(_token: string): "low" | "mid" | "high" {
  return "high";
}

function inferRole(token: string): RoleName {
  if (ANIMATE_PRONOUNS.has(token)) return "agent";
  if (LOCATION_HINTS.has(token)) return "location";
  if (DANGER_WORDS.has(token)) return "theme";
  return "patient";
}

type EventConcept = Extract<Concept, { kind: "event" }>;
