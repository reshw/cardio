/**
 * Supabase 이관 스크립트: 싱가폴(fqtqvqkcftepohbiliyi) → 서울(xfgxanikgdtriytfcrxr)
 * 실행: node supabase/migrate.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OLD = 'fqtqvqkcftepohbiliyi';
const NEW = 'xfgxanikgdtriytfcrxr';
const TOKEN = fs.readFileSync('C:\\tools\\supabase\\sb-token.txt', 'utf8').trim();
const MGMT = 'https://api.supabase.com/v1';
const HEADERS = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

// FK 의존성 기반 테이블 삽입 순서
const TABLE_ORDER = [
  // 레벨 0: 의존성 없음
  'cardio_details', 'workout_types', 'users', 'workouts',
  // 레벨 1: users에만 의존
  'clubs', 'workout_logs', 'audit_logs', 'daily_todos',
  'race_records', 'system_settings', 'user_profiles',
  // 레벨 2: clubs/workout_logs에도 의존
  'club_feeds', 'club_members', 'club_mileage_configs',
  'challenges',          // self-ref
  'workout_comments',    // self-ref
  'workout_likes', 'club_nickname_history', 'club_workout_mileage',
  'hall_of_fame', 'user_blocks', 'reports',
  // 레벨 3: 위 테이블들에 의존
  'challenge_participants', 'comment_likes', 'notifications', 'todo_workouts',
];

async function sql(projectRef, query) {
  const res = await fetch(`${MGMT}/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data).substring(0, 300));
  return Array.isArray(data) ? data : [];
}

function escVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  // timestamp/uuid/text: 모두 문자열로 처리
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildInsert(table, rows, schema = 'public') {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0]).map(c => `"${c}"`).join(', ');
  const vals = rows.map(row =>
    `(${Object.values(row).map(escVal).join(', ')})`
  ).join(',\n');
  return `INSERT INTO ${schema}."${table}" (${cols}) VALUES\n${vals}\nON CONFLICT DO NOTHING;`;
}

async function migrateTable(table, batchSize = 500) {
  const countRes = await sql(OLD, `SELECT COUNT(*) as cnt FROM public."${table}"`);
  const total = parseInt(countRes[0]?.cnt || 0);
  if (total === 0) { console.log(`  ${table}: (empty)`); return; }

  const selfRef = ['challenges', 'workout_comments'].includes(table);
  let inserted = 0;

  for (let offset = 0; offset < total; offset += batchSize) {
    const rows = await sql(OLD, `SELECT * FROM public."${table}" ORDER BY 1 LIMIT ${batchSize} OFFSET ${offset}`);
    if (rows.length === 0) break;

    const insertSql = buildInsert(table, rows);
    const execSql = selfRef
      ? `SET session_replication_role = 'replica';\n${insertSql}\nSET session_replication_role = 'origin';`
      : insertSql;

    await sql(NEW, execSql);
    inserted += rows.length;
    process.stdout.write(`\r  ${table}: ${inserted}/${total}행...`);
  }
  console.log(`\r  ${table}: ${inserted}행 ✓         `);
}

async function main() {
  // ── Phase 1: 마이그레이션 파일 적용 (이미 완료, skip) ──
  // console.log('\n═══ Phase 1: 스키마 마이그레이션 ═══');
  console.log('Phase 1 skip (already done)');
  const migsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migsDir).filter(f => f.endsWith('.sql')).sort();

  // (Phase 1 files loop skip)

  // ── Phase 2: auth.users 이관 (이미 완료, skip) ──
  console.log('Phase 2 skip (already done)');

  // ── Phase 2b: auth.identities 이관 ──
  const identities = await sql(OLD, `
    SELECT id, user_id, identity_data, provider, last_sign_in_at,
           created_at, updated_at, provider_id
    FROM auth.identities ORDER BY created_at
  `);
  console.log(`  identities 수: ${identities.length}`);

  if (identities.length > 0) {
    const insertSql = buildInsert('identities', identities, 'auth');
    await sql(NEW, insertSql);
    console.log('  auth.identities ✓');
  }

  // ── Phase 3: public 테이블 이관 (실패했던 테이블만 재실행) ──
  console.log('\n═══ Phase 3: 실패 테이블 재이관 ═══');
  const RETRY_TABLES = ['notifications'];
  for (const table of RETRY_TABLES) {
    try {
      await migrateTable(table);
    } catch (e) {
      console.error(`  ${table} ✗: ${e.message.substring(0, 200)}`);
    }
  }

  console.log('\n✅ 이관 완료!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
