jest.mock("../src/services/ai/groqAi.service", () => ({
  groqAiService: { generate: jest.fn() },
}));

import { aiService } from "../src/services/ai/ai.service";
import { groqAiService } from "../src/services/ai/groqAi.service";

describe("aiService (provider-neutral swap point)", () => {
  afterEach(() => {
    (groqAiService.generate as jest.Mock).mockReset();
  });

  it("delegates generate() to the Groq implementation with the same input and returns its result unchanged", async () => {
    const mockResponse = { content: "OK", model: "openai/gpt-oss-120b", usage: undefined };
    (groqAiService.generate as jest.Mock).mockResolvedValueOnce(mockResponse);

    const input = { userPrompt: "Hi", systemPrompt: "Be concise." };
    const result = await aiService.generate(input);

    expect(groqAiService.generate).toHaveBeenCalledTimes(1);
    expect(groqAiService.generate).toHaveBeenCalledWith(input);
    expect(result).toBe(mockResponse);
  });

  it("propagates a rejection from the Groq implementation unchanged", async () => {
    const error = new Error("boom");
    (groqAiService.generate as jest.Mock).mockRejectedValueOnce(error);

    await expect(aiService.generate({ userPrompt: "Hi" })).rejects.toBe(error);
  });
});
