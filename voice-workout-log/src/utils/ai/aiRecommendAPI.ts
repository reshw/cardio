export type AIProvider = 'gemini' | 'openai';

interface GenerateTextOptions {
  temperature?: number;
  maxTokens?: number;
  provider?: AIProvider;
  model?: string;
}

/**
 * 통합 AI 텍스트 생성 함수 (서버사이드 호출)
 */
export const generateTextWithAI = async (
  systemPrompt: string,
  userPrompt: string,
  options?: GenerateTextOptions
): Promise<string> => {
  const response = await fetch('/.netlify/functions/ai-recommend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'recommend',
      systemPrompt,
      userPrompt,
      options
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: 'Unknown error'
    }));
    throw new Error(`AI API Error (${response.status}): ${errorData.error || response.statusText}`);
  }

  const data = await response.json();
  return data.result;
};

/**
 * 사용 가능한 AI 제공자 확인
 */
export const getAvailableProviders = (): AIProvider[] => {
  // 서버에서 양쪽 제공자를 모두 지원
  return ['gemini', 'openai'];
};

/**
 * 기본 AI 제공자 결정
 */
export const getDefaultProvider = (): AIProvider => {
  // OpenAI 우선
  return 'openai';
};
