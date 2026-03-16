import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type AIProvider = 'gemini' | 'openai';

interface GenerateTextOptions {
  temperature?: number;
  maxTokens?: number;
  provider?: AIProvider;
  model?: string;
}

// OpenAI Client (Server-side only)
let openaiClient: OpenAI | null = null;

const getOpenAIClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
    });
  }

  return openaiClient;
};

// Gemini Client (Server-side only)
let geminiClient: GoogleGenerativeAI | null = null;

const getGeminiClient = (): GoogleGenerativeAI => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(apiKey);
  }

  return geminiClient;
};

// Generate text with OpenAI
export const generateTextWithOpenAI = async (
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }
): Promise<string> => {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: options?.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  });

  return completion.choices[0]?.message?.content || '';
};

// Generate text with Gemini
export const generateTextWithGemini = async (
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<string> => {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 2048,
    },
  });

  const response = result.response;
  return response.text();
};

// Transcribe audio with Gemini
export const transcribeAudioWithGemini = async (audioBase64: string, mimeType: string): Promise<string> => {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: '이 음성을 한국어로 텍스트로 변환해주세요. 운동 관련 내용입니다. 변환된 텍스트만 출력하고 다른 설명은 생략하세요.',
          },
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
        ],
      },
    ],
  });

  return result.response.text();
};

// Unified AI text generation with fallback
export const generateTextWithAI = async (
  systemPrompt: string,
  userPrompt: string,
  options?: GenerateTextOptions
): Promise<{ result: string; provider: AIProvider }> => {
  const provider = options?.provider || getDefaultProvider();

  try {
    if (provider === 'openai') {
      const result = await generateTextWithOpenAI(systemPrompt, userPrompt, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        model: options?.model,
      });
      return { result, provider: 'openai' };
    } else {
      const result = await generateTextWithGemini(systemPrompt, userPrompt, {
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      });
      return { result, provider: 'gemini' };
    }
  } catch (error) {
    console.error(`[AI] ${provider} failed:`, error);

    // Fallback to other provider
    const fallbackProvider: AIProvider = provider === 'openai' ? 'gemini' : 'openai';
    console.log(`[AI] Fallback to ${fallbackProvider}`);

    if (fallbackProvider === 'openai') {
      const result = await generateTextWithOpenAI(systemPrompt, userPrompt, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });
      return { result, provider: 'openai' };
    } else {
      const result = await generateTextWithGemini(systemPrompt, userPrompt, {
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      });
      return { result, provider: 'gemini' };
    }
  }
};

// Get available providers
export const getAvailableProviders = (): AIProvider[] => {
  const providers: AIProvider[] = [];

  if (process.env.GEMINI_API_KEY) {
    providers.push('gemini');
  }

  if (process.env.OPENAI_API_KEY) {
    providers.push('openai');
  }

  return providers;
};

// Get default provider
export const getDefaultProvider = (): AIProvider => {
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }

  return 'gemini';
};
