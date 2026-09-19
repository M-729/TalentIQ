import Groq, { APIConnectionError, APIError, RateLimitError } from "groq-sdk";
import { env } from "../../config/env";
import { AIServiceError } from "./ai.types";
import type { AIResponse, AIService, GenerateInput } from "./ai.types";

// Centralized, deterministic/conservative defaults for recruitment
// analysis — every future AI feature (CV analysis, matching, etc.) goes
// through generate() and inherits these unless it explicitly overrides
// them, rather than each feature picking its own values.
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 1024;
// Groq's SDK supports a per-request timeout directly (see ClientOptions /
// RequestOptions in groq-sdk) — no custom abort/retry plumbing is needed.
const DEFAULT_TIMEOUT_MS = 30_000;

let cachedClient: Groq | null = null;

function ensureConfigured(): { client: Groq; model: string } {
  if (!env.GROQ_API_KEY) {
    throw new AIServiceError(
      "not_configured",
      "Groq AI is not configured. Set GROQ_API_KEY (and optionally GROQ_MODEL) in backend/.env."
    );
  }

  if (!cachedClient) {
    cachedClient = new Groq({ apiKey: env.GROQ_API_KEY });
  }

  return { client: cachedClient, model: env.GROQ_MODEL };
}

// Translates Groq SDK failures into the small, safe error taxonomy callers
// can react to — never the raw provider error (which may carry response
// headers/bodies we don't want propagating through the app).
function toAIServiceError(err: unknown): AIServiceError {
  if (err instanceof RateLimitError) {
    return new AIServiceError("rate_limited", "AI provider rate limit exceeded.");
  }
  // Covers connection failures and the SDK's own connection-timeout
  // subclass — both mean the provider was unreachable, not that it
  // rejected the request.
  if (err instanceof APIConnectionError) {
    return new AIServiceError("unavailable", "AI provider is unavailable.");
  }
  if (err instanceof APIError) {
    return new AIServiceError("provider_error", "AI provider request failed.");
  }
  return new AIServiceError("provider_error", "AI request failed.");
}

export const groqAiService: AIService = {
  async generate(input: GenerateInput): Promise<AIResponse> {
    const { client, model } = ensureConfigured();

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (input.systemPrompt) {
      messages.push({ role: "system", content: input.systemPrompt });
    }
    messages.push({ role: "user", content: input.userPrompt });

    const startedAt = Date.now();
    let response;
    try {
      response = await client.chat.completions.create(
        {
          model,
          messages,
          temperature: input.temperature ?? DEFAULT_TEMPERATURE,
          max_completion_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
          ...(input.responseFormat === "json_object" ? { response_format: { type: "json_object" } } : {}),
        },
        { timeout: DEFAULT_TIMEOUT_MS }
      );
    } catch (err) {
      const safeError = toAIServiceError(err);
      // Safe metadata only — never the prompt, never the response content,
      // never headers/keys. err.status exists on Groq's own APIError.
      console.error("[ai] groq request failed", {
        provider: "groq",
        model,
        durationMs: Date.now() - startedAt,
        code: safeError.code,
        status: err instanceof APIError ? err.status : undefined,
      });
      throw safeError;
    }

    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      console.error("[ai] groq returned an empty or malformed response", {
        provider: "groq",
        model,
        durationMs: Date.now() - startedAt,
      });
      throw new AIServiceError("malformed_response", "AI provider returned an empty or malformed response.");
    }

    const usage = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined;

    return {
      content,
      model: response.model ?? model,
      usage,
    };
  },
};
