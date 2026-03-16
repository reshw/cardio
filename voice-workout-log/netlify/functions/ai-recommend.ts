import type { Handler, HandlerEvent } from "@netlify/functions";
import { generateTextWithAI } from "./utils/ai-providers";

interface AIRecommendRequest {
  action: 'recommend' | 'chat_profile' | 'generate_profile' | 'chat_recommendation' | 'extract_workouts';
  systemPrompt: string;
  userPrompt: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
    provider?: 'gemini' | 'openai';
    model?: string;
  };
}

interface AIRecommendResponse {
  result: string;
  provider: string;
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const requestData: AIRecommendRequest = JSON.parse(event.body || "{}");

    if (!requestData.systemPrompt || !requestData.userPrompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing systemPrompt or userPrompt" })
      };
    }

    console.log(`[ai-recommend] Processing action: ${requestData.action}`);

    const { result, provider } = await generateTextWithAI(
      requestData.systemPrompt,
      requestData.userPrompt,
      requestData.options
    );

    const response: AIRecommendResponse = {
      result,
      provider
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error("[ai-recommend] Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "AI processing failed",
        details: error instanceof Error ? error.message : String(error)
      })
    };
  }
};
