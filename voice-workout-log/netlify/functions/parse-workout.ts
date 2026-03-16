import type { Handler, HandlerEvent } from "@netlify/functions";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

// ==========================================
// Inline Schemas
// ==========================================

const InternalCategoryEnum = z.enum(["cardio", "strength", "snowboard"]);

const ShreddedSegmentSchema = z.object({
  original_text: z.string().describe("Text segment for a specific workout"),
  category: InternalCategoryEnum.describe("Category: 'cardio' (includes cycle/rowing), 'strength', 'snowboard'"),
  item_name_hint: z.string().describe("Hint for exercise name (e.g., 'cycle', 'bench_press')"),
});

const ShredderResponseSchema = z.object({
  segments: z.array(ShreddedSegmentSchema),
});

// 걷기(walking)도 유산소에 추가
const CardioNames = z.enum([
  "running", "walking", "stepmill", "rowing", "cycle", "swimming",
  "hiking", "jump_rope", "elliptical", "other"
]);

// 🔥 [UPGRADE] 3대장 지표(Quality Metrics) 추가된 스키마
const CardioResultSchema = z.object({
  reasoning: z.string(),
  name: CardioNames,
  
  // Basic Metrics
  distance_km: z.union([z.number(), z.null()]),
  duration_min: z.union([z.number(), z.null()]),
  speed_kph: z.union([z.number(), z.null()]),
  pace: z.string().nullable(),
  floors: z.union([z.number(), z.null()]),
  
  // 🔥 New Quality Metrics
  resistance_level: z.union([z.number(), z.null()]).describe("Damper, Level, Gear, Incline"),
  cadence: z.union([z.number(), z.null()]).describe("RPM, SPM, Cadence"),
  watts: z.union([z.number(), z.null()]).describe("Power, Watts")
});

const StrengthResultSchema = z.object({
  reasoning: z.string(),
  name: z.string(),
  weight_kg: z.union([z.number(), z.null()]),
  sets: z.union([z.number(), z.null()]),
  reps: z.union([z.number(), z.null()]),
});

const SnowboardResultSchema = z.object({
  name: z.string(),
  duration_min: z.union([z.number(), z.null()]),
  run_count: z.union([z.number(), z.null()]),
  note: z.string().nullable(),
});

type ShreddedSegment = z.infer<typeof ShreddedSegmentSchema>;

// ==========================================
// OpenAI Client
// ==========================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const MODEL = "gpt-4o-mini";

// ==========================================
// 1. Shredder (Classification Fix)
// ==========================================

async function shredInput(input: string): Promise<ShreddedSegment[]> {
  const completion = await openai.beta.chat.completions.parse({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `
You are a Text Shredder. Split workout logs into distinct segments.

[CATEGORIZATION RULES - STRICT]
1. **Cardio**: Running, **Cycle (Bike, Spinning)**, Rowing, Stepmill, Walking, Swimming.
   - "사이클", "자전거", "스피닝", "따릉이" -> MUST be 'cardio'
2. **Strength**: Weights (Bench, Squat), Bodyweight (Pushups, Pullups), Machines.
3. **Snowboard**: Snowboarding, Skiing.

[EXAMPLES]
In: "사이클 30분 타고 벤치 60 5세트"
Out: [
  { original_text: "사이클 30분", category: "cardio", item_name_hint: "cycle" },
  { original_text: "벤치 60 5세트", category: "strength", item_name_hint: "bench_press" }
]

In: "로잉 20분 댐퍼4"
Out: [
  { original_text: "로잉 20분 댐퍼4", category: "cardio", item_name_hint: "rowing" }
]
`
      },
      { role: "user", content: input },
    ],
    response_format: zodResponseFormat(ShredderResponseSchema, "shredder_output"),
  });

  return completion.choices[0].message.parsed?.segments || [];
}

// ==========================================
// 2. Specialists (Metrics Update)
// ==========================================

async function parseCardio(text: string, hint: string) {
  const completion = await openai.beta.chat.completions.parse({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `
You are a Cardio Specialist.

[CRITICAL RULES]
1. **"~로"** -> Speed (e.g. "6km로" -> speed_kph: 6)
2. **"~를"** -> Distance (e.g. "6km를" -> distance_km: 6)
3. Stepmill: Use 'floors' field, NOT distance.
4. Use NULL for missing data.

[QUALITY METRICS - EXTRACT THESE!]
- **Resistance**: "damper 4", "level 10", "gear 5", "강도 3" -> resistance_level
- **Cadence**: "60rpm", "180spm", "cadence 90", "회전수 60" -> cadence
- **Power**: "200w", "200watts", "200와트" -> watts
`
      },
      { role: "user", content: `Hint: ${hint}\nInput: ${text}` },
    ],
    response_format: zodResponseFormat(CardioResultSchema, "cardio_result"),
  });
  return completion.choices[0].message.parsed || null;
}

async function parseStrength(text: string, hint: string) {
  const completion = await openai.beta.chat.completions.parse({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `
You are a Strength Specialist.

[RULES]
1. "kg" -> weight_kg
2. "set/세트" -> sets
3. "reps/회/개" -> reps
4. Bodyweight -> weight_kg = NULL
`
      },
      { role: "user", content: `Hint: ${hint}\nInput: ${text}` },
    ],
    response_format: zodResponseFormat(StrengthResultSchema, "strength_result"),
  });
  return completion.choices[0].message.parsed || null;
}

async function parseSnowboard(text: string) {
  // Simple regex fallback for snowboard
  const durationMatch = text.match(/(\d+)\s*(시간|분)/);
  const runCountMatch = text.match(/(\d+)\s*(회|번|런)/);

  return {
    name: "스노보드",
    duration_min: durationMatch ? (durationMatch[2] === '시간' ? parseInt(durationMatch[1]) * 60 : parseInt(durationMatch[1])) : null,
    run_count: runCountMatch ? parseInt(runCountMatch[1]) : null,
    note: text.includes('빡세게') ? '빡세게' : text.includes('가볍게') ? '가볍게' : null,
  };
}

// ==========================================
// 3. Mapper (Wiring it all together)
// ==========================================

function mapToWorkout(seg: ShreddedSegment, parsed: any) {
  const category = seg.category === 'cardio' ? 'gym' :
                   seg.category === 'strength' ? 'gym' :
                   seg.category === 'snowboard' ? 'snowboard' : 'other';

  const type = seg.category === 'cardio' ? 'cardio' :
               seg.category === 'strength' ? 'strength' :
               seg.category === 'snowboard' ? 'cardio' : 'unknown';

  const target = type === 'strength' ? determineTarget(parsed.name || '') : undefined;

  return {
    name: parsed.name || seg.item_name_hint,
    category,
    type,
    target,
    
    // Standard Metrics
    distance_km: parsed.distance_km ?? null,
    duration_min: parsed.duration_min ?? null,
    speed_kph: parsed.speed_kph ?? null,
    pace: parsed.pace ?? null,
    sets: parsed.sets ?? null,
    reps: parsed.reps ?? null,
    weight_kg: parsed.weight_kg ?? null,
    run_count: parsed.run_count ?? null,
    floors: parsed.floors ?? null,
    
    // 🔥 NEW QUALITY METRICS (Mapped here!)
    resistance_level: parsed.resistance_level ?? null,
    cadence: parsed.cadence ?? null,
    watts: parsed.watts ?? null,
    
    note: parsed.note ?? null,
  };
}

function determineTarget(name: string) {
  const lowerName = name.toLowerCase();
  if (['plank', 'crunch', 'core'].some(kw => lowerName.includes(kw))) return 'core';
  if (['bench', 'press', 'pull', 'row', 'lat', 'shoulder', 'chest'].some(kw => lowerName.includes(kw))) return 'upper';
  if (['squat', 'deadlift', 'leg', 'lunge', 'calf'].some(kw => lowerName.includes(kw))) return 'lower';
  if (['burpee', 'clean', 'snatch', 'kettlebell'].some(kw => lowerName.includes(kw))) return 'full';
  return 'none';
}

// ==========================================
// Main Handler
// ==========================================

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("🔥 FATAL: OPENAI_API_KEY is missing.");
    return { statusCode: 500, body: JSON.stringify({ error: "Server Configuration Error" }) };
  }

  try {
    const { text } = JSON.parse(event.body || "{}");
    if (!text) return { statusCode: 400, body: JSON.stringify({ error: "Missing text" }) };

    console.log("[parse-workout] Processing:", text);

    // 1. Shred
    const segments = await shredInput(text);
    
    // 2. Parse
    const results = await Promise.all(segments.map(async (seg) => {
      let parsed: any = null;
      
      // Specialist Routing
      if (seg.category === 'cardio') parsed = await parseCardio(seg.original_text, seg.item_name_hint);
      else if (seg.category === 'strength') parsed = await parseStrength(seg.original_text, seg.item_name_hint);
      else if (seg.category === 'snowboard') parsed = await parseSnowboard(seg.original_text);
      
      return parsed ? mapToWorkout(seg, parsed) : null;
    }));

    const workouts = results.filter(w => w !== null);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ workouts }),
    };

  } catch (error) {
    console.error("🔥 Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Processing Failed", details: String(error) }),
    };
  }
};