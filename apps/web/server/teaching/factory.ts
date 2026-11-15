import type { TeachingDecisionEngine } from "./types";
import { AuthoredTeachingDecisionEngine } from "./authored-engine";
import { LlmTeachingDecisionEngine } from "./llm-engine";
import { isAiRuntimeEnabled } from "@gaps/ai";

export function getTeachingDecisionEngine(options?: {
  preferLlm?: boolean;
}): TeachingDecisionEngine {
  if (options?.preferLlm && isAiRuntimeEnabled()) {
    return new LlmTeachingDecisionEngine();
  }
  return new AuthoredTeachingDecisionEngine();
}
