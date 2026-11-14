import type { GenerateRequest, GenerateResult, LLMProvider, ModerationResult } from "../types";

export interface OpenAiProviderOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model?: string;
}

export class OpenAiProvider implements LLMProvider {
  readonly name = "openai" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: OpenAiProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    this.model = options.model ?? "gpt-4o-mini";
  }

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    const url = `${this.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), req.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.input },
          ],
          max_tokens: req.maxOutputTokens,
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 400 || response.status === 422) {
          return { ok: false, reason: "refused" };
        }
        return { ok: false, reason: "error" };
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const rawContent = body.choices?.[0]?.message?.content;
      if (!rawContent) {
        return { ok: false, reason: "invalid_output" };
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawContent);
      } catch {
        return { ok: false, reason: "invalid_output" };
      }

      const schemaResult = req.schema.safeParse(parsedJson);
      if (!schemaResult.success) {
        return { ok: false, reason: "invalid_output" };
      }

      return {
        ok: true,
        value: schemaResult.data,
        usage: {
          inTok: body.usage?.prompt_tokens ?? 0,
          outTok: body.usage?.completion_tokens ?? 0,
        },
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: false, reason: "timeout" };
      }
      return { ok: false, reason: "error" };
    }
  }

  async moderate(text: string): Promise<ModerationResult> {
    const url = `${this.baseUrl}/moderations`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ input: text }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { ok: false };
      }

      const body = (await response.json()) as {
        results?: Array<{
          flagged?: boolean;
          categories?: Record<string, boolean>;
        }>;
      };

      const firstResult = body.results?.[0];
      if (!firstResult) {
        return { ok: false };
      }

      const categories: string[] = [];
      if (firstResult.categories) {
        for (const [cat, flagged] of Object.entries(firstResult.categories)) {
          if (flagged) {
            categories.push(cat);
          }
        }
      }

      return {
        ok: true,
        flagged: Boolean(firstResult.flagged),
        categories,
      };
    } catch {
      clearTimeout(timeoutId);
      return { ok: false };
    }
  }
}
