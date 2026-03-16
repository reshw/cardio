import type { Workout } from '../../types';
import { parseWorkoutAPI } from '../../utils/ai/parseWorkoutAPI';

/**
 * New AI Parser using OpenAI gpt-4o-mini (Shredder + 3 Specialists)
 *
 * This replaces the old Gemini-based parser with a validated, high-accuracy
 * parser developed and tested in test-parser/.
 *
 * NOW RUNS SERVER-SIDE via Netlify Functions for security and stability.
 *
 * Key Features:
 * - Shredder: Splits complex input into individual workout segments
 * - Cardio Specialist: Handles cardio metrics (distance, speed, pace, floors)
 * - Strength Specialist: Handles strength metrics (weight, sets, reps)
 * - Snowboard Specialist: Handles snowboard-specific data
 *
 * @param text - User input text
 * @returns Promise<Workout[]> - Array of parsed workouts
 */
export const parseWithGPT = async (text: string): Promise<Workout[]> => {
  console.log('[AI Parser] Input text:', text);

  if (!text.trim()) {
    console.log('[AI Parser] Empty text, returning empty array');
    return [];
  }

  try {
    console.log('[AI Parser] Calling Netlify Function parse-workout...');
    const workouts = await parseWorkoutAPI(text);
    console.log('[AI Parser] Parsed workouts:', workouts);
    return workouts;
  } catch (err) {
    console.error('[AI Parser] Parsing error:', err);
    throw err;
  }
};
