import { OctaveName } from "../types/ssp.js";

export type ParsedWordToken = {
  kind: "word";
  word: string;
  octaveOverride?: OctaveName;
  speakerOverride?: string;
};

export type ParsedPauseToken = {
  kind: "pause";
};

export type ParsedPunctuationToken = {
  kind: "punct";
  punctuation: "statement" | "question" | "exclamation";
};

export type ParsedToken = ParsedWordToken | ParsedPauseToken | ParsedPunctuationToken;

const PUNCTUATION_MAP: Record<string, ParsedPunctuationToken["punctuation"]> = {
  ".": "statement",
  "?": "question",
  "!": "exclamation",
};

const OCTAVE_SET = new Set<OctaveName>(["Low", "Medium", "High"]);

export function parseToken(rawToken: string): ParsedToken {
  const token = rawToken.trim();
  if (token === "|") {
    return { kind: "pause" };
  }
  if (PUNCTUATION_MAP[token]) {
    return { kind: "punct", punctuation: PUNCTUATION_MAP[token] };
  }
  const [base, speakerOverride] = token.split("|");
  const [word, octaveRaw] = base.split("~");
  const normalizedWord = word.trim();
  if (!normalizedWord) {
    throw new Error(`Invalid token '${token}' — missing lexeme name.`);
  }
  let octaveOverride: OctaveName | undefined;
  if (octaveRaw) {
    const candidate = octaveRaw.trim() as OctaveName;
    if (!OCTAVE_SET.has(candidate)) {
      throw new Error(`Invalid octave override '${octaveRaw}' in token '${token}'.`);
    }
    octaveOverride = candidate;
  }
  const speaker = speakerOverride?.trim() || undefined;
  return {
    kind: "word",
    word: normalizedWord,
    octaveOverride,
    speakerOverride: speaker,
  };
}

export function parseTokens(tokens: string[]): ParsedToken[] {
  return tokens.map(parseToken);
}
