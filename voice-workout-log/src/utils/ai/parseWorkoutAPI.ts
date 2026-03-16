import type { Workout } from '../../types';

/**
 * Call the Netlify Function to parse workout text using OpenAI
 * This replaces the insecure browser-side OpenAI calls
 */
export async function parseWorkoutAPI(text: string): Promise<Workout[]> {
  if (!text.trim()) {
    return [];
  }

  try {
    console.log('[parseWorkoutAPI] Calling Netlify Function with text:', text);

    const response = await fetch('/.netlify/functions/parse-workout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    console.log('[parseWorkoutAPI] Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[parseWorkoutAPI] Error response:', errorData);

      // Show detailed error from backend
      const errorMsg = errorData.details
        ? `${errorData.error}: ${errorData.details}`
        : errorData.error || response.statusText;

      throw new Error(`API Error (${response.status}): ${errorMsg}`);
    }

    const data = await response.json();
    console.log('[parseWorkoutAPI] Success, parsed workouts:', data.workouts);
    return data.workouts || [];
  } catch (error) {
    console.error('[parseWorkoutAPI] Failed to parse workout:', error);
    throw new Error('운동 파싱에 실패했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}
