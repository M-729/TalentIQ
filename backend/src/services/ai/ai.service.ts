import { groqAiService } from "./groqAi.service";
import type { AIService } from "./ai.types";

// The single point the rest of TalentIQ depends on. Swapping providers
// later (a different hosted model, a different SDK) means changing only
// this file's export, not any business logic that already consumes the
// AIService interface. Tests mock this entire module.
export const aiService: AIService = groqAiService;

export { AIServiceError } from "./ai.types";
export type { AIService, AIErrorCode, AIResponse, AIUsage, GenerateInput } from "./ai.types";
