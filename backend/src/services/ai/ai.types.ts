export interface GenerateInput {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Not used by anything yet — a ready extension point for future
   * structured-output callers (CV analysis, matching). Whether a given
   * model actually honors JSON mode is provider/model-dependent; that
   * detail stays inside groqAi.service.ts, not here.
   */
  responseFormat?: "text" | "json_object";
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Provider-neutral response shape. Deliberately excludes anything specific
 * to Groq's raw API response (choice index, finish_reason, id, headers,
 * etc.) — callers depend on this, never on the provider SDK's own types.
 */
export interface AIResponse {
  content: string;
  model: string;
  usage?: AIUsage;
}

/**
 * AI abstraction the rest of TalentIQ depends on, instead of the Groq SDK
 * directly. Swapping providers later means changing only ai.service.ts's
 * export, not any future business logic that already consumes this
 * interface. Tests mock this entire module.
 */
export interface AIService {
  generate(input: GenerateInput): Promise<AIResponse>;
}

/**
 * Internal failure categories a caller might reasonably need to react to
 * differently later (e.g. "not_configured" vs "rate_limited"). Not tied to
 * an HTTP status code — no controller exists yet, and mapping these to
 * responses is a decision for whichever future ticket adds one.
 */
export type AIErrorCode =
  | "not_configured"
  | "unavailable"
  | "rate_limited"
  | "malformed_response"
  | "provider_error";

export class AIServiceError extends Error {
  public readonly code: AIErrorCode;

  constructor(code: AIErrorCode, message: string) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
  }
}
