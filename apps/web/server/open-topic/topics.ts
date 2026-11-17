import type { SourceReference } from "@gaps/contracts";
import { CURRICULUM_TOPICS } from "@gaps/content";
import { scrubPii } from "@gaps/ai";
import { listAdaptiveLessons } from "../teaching/adaptive-lessons";
import { OBJECTIVE_SOURCE_PACKS, type ObjectiveSourcePack } from "../lesson/planner-source-pack";

/**
 * Turns a topic typed by a learner into something the server can act on,
 * without any per-topic code: an authored lesson when the request is exactly a
 * topic we have authored, the approved sources that cover it when there are
 * any, and otherwise nothing (generation then runs from model knowledge and is
 * labelled as such).
 */

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "to",
  "in",
  "on",
  "and",
  "for",
  "about",
  "with",
  "what",
  "is",
  "are",
  "how",
  "why",
  "do",
  "does",
  "i",
  "me",
  "my",
  "want",
  "learn",
  "teach",
  "explain",
  "understand",
  "please",
  "class",
  "grade",
  "topic",
  "basic",
  "basics",
  "introduction",
  "intro",
  "simple",
]);

/** Lowercase tokens with trivial plural folding. */
export function topicTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}

function significantTokens(text: string): string[] {
  return topicTokens(text).filter((t) => !STOPWORDS.has(t));
}

/** The learner's topic with contact details removed and whitespace collapsed. */
export function sanitizeTopic(raw: string): string {
  return scrubPii(raw).replace(/\s+/g, " ").trim().slice(0, 120);
}

export function topicSlug(text: string): string {
  return significantTokens(text).join("-").slice(0, 60) || "topic";
}

/**
 * Words that fully describe each authored engine-driven lesson. A request is
 * routed to an authored lesson only when every significant word of it is in
 * that lesson's vocabulary, so "equivalent fractions" or "series circuits" is
 * never silently replaced by a neighbouring authored topic.
 */
const AUTHORED_VOCABULARY: Readonly<Record<string, readonly string[]>> = {
  "maths-frac-part": ["fraction", "part", "whole", "numerator", "denominator", "share", "equal"],
  "sci-elec-circuits": [
    "electric",
    "electrical",
    "circuit",
    "current",
    "closed",
    "open",
    "switch",
    "bulb",
    "electricity",
  ],
};

/** At least one of these must be present for the vocabulary match to count. */
const AUTHORED_ANCHORS: Readonly<Record<string, readonly string[]>> = {
  "maths-frac-part": ["fraction", "numerator", "denominator"],
  "sci-elec-circuits": ["circuit"],
};

export interface AuthoredMatch {
  readonly lessonId: string;
  readonly topicId: string;
  readonly title: string;
}

export function findAuthoredLesson(topic: string): AuthoredMatch | undefined {
  const tokens = significantTokens(topic);
  if (tokens.length === 0) return undefined;
  for (const def of listAdaptiveLessons()) {
    const vocabulary = AUTHORED_VOCABULARY[def.topicId];
    const anchors = AUTHORED_ANCHORS[def.topicId];
    if (!vocabulary || !anchors) continue;
    if (tokens.every((t) => vocabulary.includes(t)) && tokens.some((t) => anchors.includes(t))) {
      const topicTitle =
        CURRICULUM_TOPICS.find((t) => t.id === def.topicId)?.studentTitle ?? def.title;
      return { lessonId: def.lessonId, topicId: def.topicId, title: topicTitle };
    }
  }
  return undefined;
}

export interface TopicSources {
  readonly references: SourceReference[];
  /** Source text supplied to the model, keyed by reference id. */
  readonly packs: ObjectiveSourcePack[];
}

/**
 * Approved source packs that cover the topic: every significant word of the
 * request must appear in the pack. The packs are curated but not yet
 * educator-reviewed, and are reported with that status.
 */
export function findSources(topic: string): TopicSources {
  const tokens = significantTokens(topic);
  const packs =
    tokens.length === 0
      ? []
      : Object.values(OBJECTIVE_SOURCE_PACKS).filter((pack) => {
          const haystack = new Set(
            topicTokens([pack.title, pack.strand, ...pack.coreConcepts].join(" ")),
          );
          return tokens.every((t) => haystack.has(t));
        });
  return {
    packs,
    references: packs.map((pack) => ({
      id: `source-pack:${pack.objectiveId}`,
      title: pack.title,
      reviewStatus: "draft" as const,
    })),
  };
}

/** Tested simulations and the topic words that make each one relevant. */
const SIMULATION_TOPIC_WORDS: Readonly<Record<string, readonly string[]>> = {
  fraction_strip: ["fraction", "numerator", "denominator", "half", "quarter", "third"],
  circuit_loop: [
    "circuit",
    "switch",
    "bulb",
    "conductor",
    "insulator",
    "electric",
    "electricity",
    "current",
  ],
};

/** Simulations a generated lesson on this topic may use. Empty for most topics. */
export function allowedSimulations(topic: string): string[] {
  const tokens = new Set(topicTokens(topic));
  return Object.entries(SIMULATION_TOPIC_WORDS)
    .filter(([, words]) => words.some((w) => tokens.has(w)))
    .map(([kind]) => kind);
}
