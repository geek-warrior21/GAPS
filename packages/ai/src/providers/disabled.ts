import type { GenerateRequest, GenerateResult, LLMProvider, ModerationResult } from "../types";

export class DisabledProvider implements LLMProvider {
  readonly name = "disabled" as const;

  async generate<T>(_req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    return { ok: false, reason: "disabled" };
  }

  async moderate(_text: string): Promise<ModerationResult> {
    return { ok: true, flagged: false, categories: [] };
  }
}
