const ALERT_WORDS = ["wolf", "danger", "run", "predator", "attack"];
const CALM_WORDS = ["calm", "rest", "peace"];

export function inferEmotionLabel(text: string, explicit?: string): string {
  if (explicit) return explicit;
  const lowered = text.toLowerCase();
  if (ALERT_WORDS.some((word) => lowered.includes(word))) return "alert";
  if (lowered.includes("!")) return "alert";
  if (CALM_WORDS.some((word) => lowered.includes(word))) return "calm";
  return "neutral";
}
