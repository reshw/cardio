import { z } from "zod";

// ==========================================
// AI Parser Zod Schemas
// ==========================================

// Internal category enum (maps to Workout.type)
export const InternalCategoryEnum = z.enum(["cardio", "strength", "snowboard"]);

// Cardio exercise names
// (걷기도 포함하여 더 완벽하게 만듭니다)
export const CardioNames = z.enum([
  "running",    // 러닝, 트레드밀, 조깅
  "walking",    // 걷기, 산책, 워킹
  "stepmill",   // 천국의 계단, 스텝밀, 마이마운틴
  "rowing",     // 로잉머신
  "cycle",      // 사이클, 자전거, 따릉이, 스피닝
  "swimming",   // 수영
  "hiking",     // 등산
  "jump_rope",  // 줄넘기
  "elliptical", // 엘립티컬
  "other",      // 그 외
]);

// ==========================================
// Shredder (Input Splitter) Schema
// ==========================================
export const ShreddedSegmentSchema = z.object({
  original_text: z.string().describe("운동별로 분리된 문장 (예: '사이클 댐퍼4 60rpm 30분')"),
  category: InternalCategoryEnum.describe("해당 문장을 처리할 담당 부서"),
  item_name_hint: z.string().describe("운동 이름 힌트 (영어). 예: cycle, stepmill"),
});

export const ShredderResponseSchema = z.object({
  segments: z.array(ShreddedSegmentSchema),
});

// ==========================================
// Cardio Specialist Schema (UPGRADED 🔥)
// ==========================================
export const CardioResultSchema = z.object({
  reasoning: z.string().describe("값 추출 근거 (예: '댐퍼' 키워드로 저항값 판단)"),
  name: CardioNames.describe("표준화된 운동 이름"),

  // Basic Metrics
  distance_km: z.union([z.number(), z.null()]).describe("거리(km). 없으면 null."),
  duration_min: z.union([z.number(), z.null()]).describe("시간(분). 없으면 null."),
  speed_kph: z.union([z.number(), z.null()]).describe("속도(km/h). 없으면 null."),
  pace: z.string().nullable().describe("페이스 (예: '6:30'). 없으면 null."),
  
  // 🔥 Quality Metrics (질적 데이터) - 1군 승격
  resistance_level: z.union([z.number(), z.null()]).describe("저항/강도. 키워드: '댐퍼', '레벨', '기어', '강도', '인클라인'. 없으면 null."),
  cadence: z.union([z.number(), z.null()]).describe("회전수/빈도. 키워드: 'rpm', 'spm', '케이던스'. 없으면 null."),
  watts: z.union([z.number(), z.null()]).describe("파워/출력. 키워드: '와트', 'w', 'watts'. 없으면 null."),
  
  floors: z.union([z.number(), z.null()]).describe("층수(스텝밀 전용). 없으면 null."),
});

// ==========================================
// Strength Specialist Schema
// ==========================================
export const StrengthResultSchema = z.object({
  reasoning: z.string().describe("값 추출 근거"),
  name: z.string().describe("운동 이름 (영어)"),

  weight_kg: z.union([z.number(), z.null()]).describe("무게(kg). 맨몸운동이거나 없으면 null."),
  sets: z.union([z.number(), z.null()]).describe("세트 수. 없으면 null."),
  reps: z.union([z.number(), z.null()]).describe("회수. 없으면 null."),
});

// ==========================================
// Snowboard Specialist Schema
// ==========================================
export const SnowboardResultSchema = z.object({
  name: z.string().describe("스노보드 활동 이름"),
  duration_min: z.union([z.number(), z.null()]).describe("시간(분). 없으면 null."),
  run_count: z.union([z.number(), z.null()]).describe("런 수 (몇번 탔는지). 없으면 null."),
  note: z.string().nullable().describe("추가 메모 (스타일, 강도 등)"),
});

// Types
export type InternalCategory = z.infer<typeof InternalCategoryEnum>;
export type CardioResult = z.infer<typeof CardioResultSchema>;
export type StrengthResult = z.infer<typeof StrengthResultSchema>;
export type SnowboardResult = z.infer<typeof SnowboardResultSchema>;
export type ShreddedSegment = z.infer<typeof ShreddedSegmentSchema>;