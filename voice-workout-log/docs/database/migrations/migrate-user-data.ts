// Migration Tool: Transfer workout_logs from one user to another
// 사용법: npx tsx migrate-user-data.ts

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// Supabase 클라이언트 설정
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase credentials not found in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 사용자 입력을 받는 함수
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

// UUID 유효성 검사
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// 사용자 정보 조회
async function getUserInfo(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, email, provider, kakao_id')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

// workout_logs 개수 조회
async function getWorkoutLogsCount(userId: string) {
  const { count, error } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return count || 0;
}

// 마이그레이션 실행
async function migrateUserData(fromUserId: string, toUserId: string) {
  console.log('\n🔄 Starting migration...');

  // workout_logs 업데이트
  const { error: logsError } = await supabase
    .from('workout_logs')
    .update({ user_id: toUserId })
    .eq('user_id', fromUserId);

  if (logsError) {
    console.error('❌ Error updating workout_logs:', logsError);
    throw logsError;
  }

  // user_profiles 업데이트 (있다면)
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ user_id: toUserId })
    .eq('user_id', fromUserId);

  // user_profiles가 없을 수도 있으므로 에러 무시
  if (profileError && profileError.code !== 'PGRST116') {
    console.warn('⚠️  Warning: Could not update user_profiles:', profileError);
  }

  console.log('✅ Migration completed successfully!');
}

// 메인 함수
async function main() {
  console.log('====================================');
  console.log('🔧 User Data Migration Tool');
  console.log('====================================\n');

  try {
    // Step 1: 모든 사용자 조회
    console.log('📋 Fetching all users...\n');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, display_name, provider, kakao_id')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    console.log('Available users:');
    console.log('----------------------------------------');
    for (const user of users || []) {
      const logsCount = await getWorkoutLogsCount(user.id);
      console.log(
        `${user.username.padEnd(25)} | ${user.display_name.padEnd(15)} | ${user.provider.padEnd(8)} | ${logsCount} logs | ID: ${user.id}`
      );
    }
    console.log('----------------------------------------\n');

    // Step 2: 원본 사용자 ID 입력
    const fromUserId = await askQuestion(
      'Enter SOURCE user ID (데이터를 옮길 원본 사용자 ID): '
    );

    if (!isValidUUID(fromUserId.trim())) {
      console.error('❌ Error: Invalid UUID format');
      process.exit(1);
    }

    const fromUser = await getUserInfo(fromUserId.trim());
    const fromLogsCount = await getWorkoutLogsCount(fromUserId.trim());

    console.log(`\n✅ Source user found:`);
    console.log(`   Username: ${fromUser.username}`);
    console.log(`   Display Name: ${fromUser.display_name}`);
    console.log(`   Provider: ${fromUser.provider}`);
    console.log(`   Workout Logs: ${fromLogsCount}`);

    // Step 3: 대상 사용자 ID 입력
    const toUserId = await askQuestion(
      '\nEnter TARGET user ID (데이터를 받을 대상 사용자 ID): '
    );

    if (!isValidUUID(toUserId.trim())) {
      console.error('❌ Error: Invalid UUID format');
      process.exit(1);
    }

    const toUser = await getUserInfo(toUserId.trim());
    const toLogsCount = await getWorkoutLogsCount(toUserId.trim());

    console.log(`\n✅ Target user found:`);
    console.log(`   Username: ${toUser.username}`);
    console.log(`   Display Name: ${toUser.display_name}`);
    console.log(`   Provider: ${toUser.provider}`);
    console.log(`   Current Workout Logs: ${toLogsCount}`);

    // Step 4: 확인
    console.log('\n⚠️  WARNING: This will transfer ALL workout logs!');
    console.log(`   FROM: ${fromUser.username} (${fromLogsCount} logs)`);
    console.log(`   TO:   ${toUser.username} (currently ${toLogsCount} logs)`);
    console.log(`   TOTAL after migration: ${fromLogsCount + toLogsCount} logs\n`);

    const confirm = await askQuestion(
      'Are you sure you want to proceed? (yes/no): '
    );

    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Migration cancelled.');
      process.exit(0);
    }

    // Step 5: 마이그레이션 실행
    await migrateUserData(fromUserId.trim(), toUserId.trim());

    // Step 6: 결과 확인
    const finalFromCount = await getWorkoutLogsCount(fromUserId.trim());
    const finalToCount = await getWorkoutLogsCount(toUserId.trim());

    console.log('\n📊 Migration Results:');
    console.log(`   ${fromUser.username}: ${fromLogsCount} → ${finalFromCount} logs`);
    console.log(`   ${toUser.username}: ${toLogsCount} → ${finalToCount} logs`);

    // Step 7: 원본 사용자 삭제 옵션
    if (finalFromCount === 0) {
      console.log('\n💡 The source user now has 0 workout logs.');
      const deleteUser = await askQuestion(
        'Do you want to DELETE the source user? (yes/no): '
      );

      if (deleteUser.toLowerCase() === 'yes') {
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', fromUserId.trim());

        if (deleteError) {
          console.error('❌ Error deleting user:', deleteError);
        } else {
          console.log('✅ Source user deleted successfully!');
        }
      }
    }

    console.log('\n✨ All done!\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
