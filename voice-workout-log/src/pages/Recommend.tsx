import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllLogs, getUserProfile, saveUserProfile, deleteUserProfile } from '../storage/supabaseStorage';
import { saveTodo, getTodayTodo, getAllTodos, generateId, formatDate } from '../storage/logStorage';
import type { WorkoutLog, UserProfile, DailyTodo, TodoWorkout } from '../types';
import { generateTextWithAI, getAvailableProviders, getDefaultProvider } from '../utils/ai/aiRecommendAPI';

type ViewMode = 'profile-chat' | 'ready' | 'loading' | 'recommendation-chat' | 'finalized';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export const Recommend = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('ready');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todayFeeling, setTodayFeeling] = useState('');
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<string>('');

  // 대화형 프로필 설정
  const [profileChatMessages, setProfileChatMessages] = useState<ChatMessage[]>([]);
  const [profileChatInput, setProfileChatInput] = useState('');
  const [isProfileChatProcessing, setIsProfileChatProcessing] = useState(false);

  // 대화형 추천
  const [recommendationChatMessages, setRecommendationChatMessages] = useState<ChatMessage[]>([]);
  const [recommendationChatInput, setRecommendationChatInput] = useState('');
  const [isRecommendationChatProcessing, setIsRecommendationChatProcessing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<string>('');
  const [currentRecommendation, setCurrentRecommendation] = useState<string>('');

  useEffect(() => {
    loadProfile();

    // AI 제공자 정보 표시
    const providers = getAvailableProviders();
    const defaultProvider = getDefaultProvider();
    const providerNames = {
      gemini: 'Gemini',
      openai: 'OpenAI GPT',
    };

    if (providers.length > 0) {
      const providerList = providers.map(p => providerNames[p]).join(', ');
      setAiInfo(`사용 가능한 AI: ${providerList} (추천: ${providerNames[defaultProvider]})`);
    } else {
      setAiInfo('AI 설정 필요');
    }
  }, []);

  const loadProfile = async () => {
    const savedProfile = await getUserProfile();
    setProfile(savedProfile);
    if (!savedProfile) {
      setViewMode('profile-chat');
      // 첫 메시지: AI가 대화 시작
      startProfileChat();
    } else {
      setViewMode('ready');
    }
  };

  const startProfileChat = async () => {
    const welcomeMessage: ChatMessage = {
      role: 'assistant',
      content: '안녕하세요! 맞춤 운동 추천을 위해 몇 가지 질문을 드릴게요. 편하게 답변해주시면 됩니다.\n\n먼저, 운동 경험이 얼마나 되셨나요? (예: 처음이에요, 6개월 정도요, 2년 넘었어요 등)',
      timestamp: Date.now(),
    };
    setProfileChatMessages([welcomeMessage]);
  };

  const handleProfileChatSubmit = async () => {
    if (!profileChatInput.trim()) return;

    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      role: 'user',
      content: profileChatInput,
      timestamp: Date.now(),
    };

    const newMessages = [...profileChatMessages, userMessage];
    setProfileChatMessages(newMessages);
    setProfileChatInput('');
    setIsProfileChatProcessing(true);

    try {
      // AI에게 대화 이력과 함께 다음 질문 요청
      const conversationContext = newMessages
        .map((m) => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
        .join('\n');

      const systemPrompt = `당신은 친절한 피트니스 코치입니다. 사용자와 대화하며 다음 정보를 자연스럽게 수집하세요:

1. 나이, 성별, 키, 체중
2. 운동 경험 (얼마나 했는지)
3. 운동 목표 (근육, 체력, 다이어트, 스포츠 등)
4. 선호/회피 운동
5. 부상 이력
6. 사용 가능 장비 (집, 헬스장 등)
7. 가용 시간 (주 몇 회, 회당 몇 분)
8. 생활 패턴 (활동량, 수면)

**대화 규칙:**
- 한 번에 1-2가지만 물어보세요
- 사용자가 답한 내용을 요약해주세요
- 아직 모르는 정보가 있으면 자연스럽게 다음 질문을 하세요
- 충분한 정보를 얻었다면 "좋습니다! 이제 프로필을 생성하겠습니다." 라고 말하고 [COMPLETE] 태그를 붙여주세요

**출력 형식:**
- 일반 질문: 그냥 질문 내용
- 완료: "좋습니다! 이제 프로필을 생성하겠습니다. [COMPLETE]"`;

      const aiResponse = await generateTextWithAI(
        systemPrompt,
        conversationContext,
        { temperature: 0.7, maxTokens: 300 }
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
      };

      setProfileChatMessages([...newMessages, assistantMessage]);

      // [COMPLETE] 태그가 있으면 프로필 생성
      if (aiResponse.includes('[COMPLETE]')) {
        await generateProfileFromChat(newMessages);
      }
    } catch (error) {
      console.error('[Profile Chat] Error:', error);
      setError('대화 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProfileChatProcessing(false);
    }
  };

  const generateProfileFromChat = async (messages: ChatMessage[]) => {
    setIsGeneratingProfile(true);

    try {
      const conversationText = messages
        .filter((m) => m.role !== 'system')
        .map((m) => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
        .join('\n');

      const systemPrompt = `당신은 데이터 분석 전문가입니다. 대화 내용을 분석하여 사용자 프로필을 JSON 형식으로 생성해주세요.

**필요한 정보:**
{
  "age": 숫자 또는 null,
  "gender": "male" | "female" | "other" | null,
  "height": 숫자(cm) 또는 null,
  "weight": 숫자(kg) 또는 null,
  "experienceLevel": "beginner" | "intermediate" | "advanced" | null,
  "experienceMonths": 숫자 또는 null,
  "goals": "목표 요약 문장",
  "primaryGoal": "muscle_gain" | "strength" | "endurance" | "weight_loss" | "sport_performance" | "general_fitness" | null,
  "preferredWorkouts": ["운동1", "운동2"] 또는 [],
  "avoidedWorkouts": ["운동1"] 또는 [],
  "injuries": ["부상1"] 또는 [],
  "availableEquipment": "home" | "gym" | "bodyweight" | "mixed" | null,
  "availableTime": {"sessionsPerWeek": 숫자, "minutesPerSession": 숫자} 또는 null,
  "activityLevel": "sedentary" | "moderate" | "active" | "very_active" | null,
  "sleepHours": 숫자 또는 null,
  "stressLevel": "low" | "medium" | "high" | null,
  "preferredIntensity": {
    "weight": "conservative" | "moderate" | "progressive",
    "volume": "low" | "medium" | "high"
  } 또는 null
}

대화에서 언급되지 않은 항목은 null로 설정하세요. goals는 반드시 포함해주세요.
JSON만 출력하고 다른 설명은 하지 마세요.`;

      const profileJson = await generateTextWithAI(
        systemPrompt,
        conversationText,
        { temperature: 0.3, maxTokens: 800 }
      );

      // JSON 파싱
      const jsonMatch = profileJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('프로필 JSON 파싱 실패');
      }

      const parsedProfile = JSON.parse(jsonMatch[0]);

      const newProfile: UserProfile = {
        ...parsedProfile,
        conversationHistory: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            question: m.role === 'assistant' ? m.content : '',
            answer: m.role === 'user' ? m.content : '',
            timestamp: m.timestamp,
          })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveUserProfile(newProfile);
      setProfile(newProfile);
      setViewMode('ready');
      setProfileChatMessages([]);
    } catch (error) {
      console.error('[Generate Profile] Error:', error);
      setError('프로필 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingProfile(false);
    }
  };


  const handleEditProfile = () => {
    setViewMode('profile-chat');
    startProfileChat();
  };

  const handleDeleteProfile = async () => {
    if (confirm('프로필을 삭제하시겠습니까? 운동 기록은 유지됩니다.')) {
      try {
        await deleteUserProfile();
        setProfile(null);
        setViewMode('profile-chat');
        startProfileChat();
      } catch (err) {
        setError('프로필 삭제에 실패했습니다.');
      }
    }
  };

  const parseRecommendationToWorkouts = (recommendationText: string): TodoWorkout[] => {
    const workouts: TodoWorkout[] = [];
    const lines = recommendationText.split('\n');

    for (const line of lines) {
      // 운동명, 세트, 횟수, 무게 등을 추출하는 간단한 파싱
      // 예: "스쿼트 80kg 4세트 8회" or "벤치프레스: 60kg, 3세트 10회"
      const workoutMatch = line.match(/([가-힣a-zA-Z\s]+)\s*:?\s*(\d+(?:\.\d+)?)\s*kg/i);
      const setsRepsMatch = line.match(/(\d+)\s*세트\s*[×x]?\s*(\d+)\s*회/i);
      const durationMatch = line.match(/(\d+)\s*분/i);

      if (workoutMatch || setsRepsMatch || durationMatch) {
        const name = workoutMatch ? workoutMatch[1].trim() : line.trim().split(/[:\-,]/)[0].trim();
        const weight_kg = workoutMatch ? parseFloat(workoutMatch[2]) : undefined;
        const sets = setsRepsMatch ? parseInt(setsRepsMatch[1]) : undefined;
        const reps = setsRepsMatch ? parseInt(setsRepsMatch[2]) : undefined;
        const duration_min = durationMatch ? parseInt(durationMatch[1]) : undefined;

        if (name && name.length > 0 && name.length < 50) {
          workouts.push({
            name,
            sets,
            reps,
            weight_kg,
            duration_min,
            completed: false,
          });
        }
      }
    }

    return workouts;
  };


  const generateRecommendation = async () => {
    setViewMode('loading');
    setError(null);

    try {
      const logs = await getAllLogs();

      if (logs.length === 0) {
        setError('운동 기록이 없습니다. 먼저 운동을 기록해주세요.');
        setViewMode('ready');
        return;
      }

      const recentLogs = logs.slice(0, 10); // 최근 10일로 확대
      const workoutSummary = analyzeWorkouts(recentLogs);

      // === 최근 5일간의 대화 히스토리 가져오기 ===
      const allTodos = getAllTodos();
      const recentTodosWithChat = allTodos
        .filter(todo => todo.aiRecommendation?.conversationHistory && todo.aiRecommendation.conversationHistory.length > 0)
        .slice(0, 5); // 최근 5개

      let conversationHistoryContext = '';
      if (recentTodosWithChat.length > 0) {
        conversationHistoryContext = '\n\n**최근 5일간의 AI 추천 대화 히스토리:**\n';
        recentTodosWithChat.forEach((todo, index) => {
          const dayNum = index + 1;
          conversationHistoryContext += `\n[${dayNum}일 전 - ${todo.date}]\n`;

          if (todo.aiRecommendation?.conversationHistory) {
            const chatSummary = todo.aiRecommendation.conversationHistory
              .map(msg => `${msg.role === 'user' ? '사용자' : 'AI'}: ${msg.content}`)
              .join('\n');
            conversationHistoryContext += chatSummary + '\n';
          }
        });

        conversationHistoryContext += '\n→ 이전 대화에서 사용자의 선호도, 불편함, 피드백을 참고하여 오늘의 추천에 반영하세요.\n';
      }

      // === STEP 1: 데이터 분석 AI ===
      const analysisPrompt = `당신은 데이터 분석 전문가입니다. 사용자의 운동 기록을 분석하고 핵심 인사이트를 추출해주세요.

**분석 목적:**
- 운동 패턴과 트렌드 파악
- 강점과 약점 식별
- 발전도 평가
- 밸런스 분석

**출력 형식 (JSON 형태로 구조화):**
{
  "patterns": "주요 운동 패턴 (예: 주 3-4회 운동, 하체 위주)",
  "strengths": "강점 (예: 스쿼트 무게 꾸준히 증가, 규칙적인 운동)",
  "weaknesses": "약점 또는 부족한 부분 (예: 상체 운동 부족, 유산소 운동 없음)",
  "trends": "발전 트렌드 (예: 지난주 대비 무게 증가, 운동 빈도 증가)",
  "balance": "운동 밸런스 평가 (예: 근력 70% / 유산소 30%)",
  "risk": "주의사항 (예: 같은 부위 연속, 휴식 부족)"
}

간결하게 작성하고, 데이터에 기반한 객관적인 분석을 제공하세요.`;

      console.log('[STEP 1] 데이터 분석 중...');
      const analysisResult = await generateTextWithAI(
        analysisPrompt,
        workoutSummary,
        { temperature: 0.3, maxTokens: 800, provider: 'gemini' } // 분석은 Gemini 사용
      );

      console.log('[STEP 1] 분석 완료:', analysisResult);

      // === STEP 2: 추천 생성 AI ===
      const feelingContext = todayFeeling.trim()
        ? `\n\n**오늘의 컨디션:**\n${todayFeeling}\n`
        : '';

      const recommendPrompt = profile
        ? `당신은 친절한 피트니스 코치입니다. 사용자의 운동 목표와 데이터 분석 결과를 바탕으로 오늘의 운동을 추천해주세요.

**사용자 운동 목표:**
${profile.goals}${feelingContext}

**데이터 분석 결과:**
${analysisResult}${conversationHistoryContext}

**추천 작성 가이드:**
1. 분석 요약 (2-3문장): 최근 운동을 칭찬하고, 강점과 개선점을 언급
2. 오늘의 추천 이유: 왜 이 운동들을 추천하는지 (목표, 컨디션, 밸런스 고려)
3. 구체적인 운동 리스트:
   - 운동명 무게kg 세트수세트 횟수회 형식으로
   - 각 운동에 대한 간단한 팁 (한 줄)
4. 마무리 격려 (1-2문장)

**주의사항:**
- 사용자 목표를 최우선으로 고려
- 오늘 컨디션에 맞춰 강도 조절
- 발전 가능하지만 무리하지 않는 수준
- 친근하고 격려하는 톤

운동 리스트는 반드시 명확한 형식으로 작성해주세요.`
        : `당신은 친절한 피트니스 코치입니다. 데이터 분석 결과를 바탕으로 오늘의 운동을 추천해주세요.${feelingContext}

**데이터 분석 결과:**
${analysisResult}${conversationHistoryContext}

**추천 작성 가이드:**
1. 분석 요약 (2-3문장): 최근 운동을 칭찬하고, 강점과 개선점을 언급
2. 오늘의 추천 이유: 왜 이 운동들을 추천하는지 (컨디션, 밸런스 고려)
3. 구체적인 운동 리스트:
   - 운동명 무게kg 세트수세트 횟수회 형식으로
   - 각 운동에 대한 간단한 팁 (한 줄)
4. 마무리 격려 (1-2문장)

**주의사항:**
- 오늘 컨디션에 맞춰 강도 조절
- 발전 가능하지만 무리하지 않는 수준
- 친근하고 격려하는 톤

운동 리스트는 반드시 명확한 형식으로 작성해주세요.`;

      console.log('[STEP 2] 추천 생성 중...');
      const aiProvider = getDefaultProvider();
      console.log(`[STEP 2] 사용 AI: ${aiProvider}`);

      const recommendationText = await generateTextWithAI(
        recommendPrompt,
        `위 정보를 바탕으로 오늘의 운동을 추천해주세요.`,
        {
          temperature: 0.8,
          maxTokens: 1500,
          provider: aiProvider
        }
      );

      console.log('[STEP 2] 추천 완료');

      if (recommendationText) {
        // 분석과 추천 결과 저장
        setCurrentAnalysis(analysisResult);
        setCurrentRecommendation(recommendationText);

        // 대화형 추천 모드로 전환
        const initialMessage: ChatMessage = {
          role: 'assistant',
          content: recommendationText + '\n\n─────────────────────\n\n어떠신가요? 🤔\n\n조정이 필요한 부분이 있으면 편하게 말씀해주세요!\n\n💬 예시:\n• "다리가 아파서 하체 운동 빼주세요"\n• "스쿼트 무게 너무 높아요"\n• "시간이 30분밖에 없어요"\n• "유산소 운동 추가해주세요"\n• "더 강하게 해주세요"\n\n완벽하시면 "확정" 또는 "좋아요"라고 말씀해주세요! ✅',
          timestamp: Date.now(),
        };

        setRecommendationChatMessages([initialMessage]);
        setViewMode('recommendation-chat');
      } else {
        throw new Error('추천 결과를 받지 못했습니다.');
      }
    } catch (err) {
      console.error('Recommendation error:', err);
      setError(`추천 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      setViewMode('ready');
    }
  };

  const handleRecommendationChatSubmit = async () => {
    if (!recommendationChatInput.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: recommendationChatInput,
      timestamp: Date.now(),
    };

    const newMessages = [...recommendationChatMessages, userMessage];
    setRecommendationChatMessages(newMessages);
    setRecommendationChatInput('');
    setIsRecommendationChatProcessing(true);

    try {
      // 대화 맥락 구성
      const conversationContext = newMessages
        .map((m) => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
        .join('\n');

      const systemPrompt = `당신은 10년 경력의 전문 퍼스널 트레이너입니다. 친절하되 강단있게, 사용자의 목표 달성을 최우선으로 조언합니다.

**원래 분석 결과:**
${currentAnalysis}

**현재 추천:**
${currentRecommendation}

**사용자 프로필:**
${profile?.goals || '정보 없음'}

**핵심 원칙 (절대 지켜야 함):**

1. **사용자 목표를 최우선으로!**
   - 목표: ${profile?.goals || '정보 없음'}
   - 모든 조정은 이 목표 달성에 도움이 되어야 함
   - 목표와 맞지 않는 요청은 전문가로서 반대 의견 제시
   - 예: 스노보드가 목표인데 상체만 하겠다 → "하체 근력이 스노보드에 필수입니다. 대신 무게를 낮춰보면 어떨까요?"

2. **밸런스 있는 성장 강조!**
   - 특정 부위만 과도하게 하거나 빼는 것은 권장하지 않음
   - 사용자가 운동을 빼자고 하면 → 왜 필요한지 설명 후 대안 제시
   - 전신 균형, 부상 방지, 목표 달성을 고려한 조언

3. **전문가답게 강단있게!**
   - 단순히 요청대로 바꾸지 마세요
   - 잘못된 요청: "이 운동은 당신의 목표에 중요합니다. 대신 이렇게 조정하면 어떨까요?"
   - 올바른 요청: 수용하되, 추가 조언 제공
   - 예: "고블릿 스쿼트로 바꾸고 싶어요" → "고블릿 스쿼트도 좋지만, 일반 스쿼트가 스노보드에 더 효과적입니다. 무게를 낮춰서 계속하시면 어떨까요? 정 원하시면 고블릿으로도 가능하지만, 무게는 더 낮춰야 합니다."

4. **운동 종류는 신중하게 변경!**
   - 사용자가 명확히 요청해도, 목표에 맞지 않으면 반대 의견 제시
   - 무게/세트/횟수만 조정하는 것을 우선 제안
   - 예: "스쿼트 60kg 너무 높아요" → 스쿼트 10kg으로 조정 (고블릿 스쿼트로 바꾸지 마세요!)

5. **문맥을 정확히 파악!**
   - 사용자가 다른 운동을 언급하는 것은 종종 "비교/참고"입니다
   - 예: "고블릿 스쿼트 12kg도 힘들었어요" → 이건 스쿼트 무게가 과하다는 근거
     → 올바른 대응: 스쿼트를 10-12kg으로 낮춤 (덤벨 양손 5-6kg)
     → 잘못된 대응: 스쿼트를 고블릿 스쿼트로 바꿈 ❌

6. **무게 조정 기준:**
   - 사용자가 다른 운동의 무게를 언급하면, 그것을 참고로 적정 무게를 추정
   - "고블릿 스쿼트 12kg 힘들었어요" → 일반 스쿼트는 10-15kg 적당
   - "벤치프레스 40kg 여유있어요" → 40kg 이상 제안

**대화 규칙:**

**1. 무게 조절 피드백:**
   - "무게 너무 높아요" / "XXkg도 힘들어요"
     → 현재 추천 무게에서 20-30% 낮춤
     → 운동 종류는 그대로 유지!
   - "너무 쉬워요" / "더 빡세게"
     → 무게 10-15% 증량 또는 세트 추가
   - 사용자가 참고로 다른 운동 무게를 언급하면, 그 무게를 기준으로 적정선을 찾으세요

**2. 신체 불편 관련:**
   - "다리/무릎 아파요" → 하체 운동 무게 30-40% 낮춤 또는 제외, 대체 운동 제안
   - "허리 뻐근해요" → 스쿼트/데드리프트 제외하거나 무게 대폭 낮춤, 코어 운동 추가
   - "어깨 아파요" → 숄더프레스 제외, 가벼운 사이드레터럴 제안
   - 명확한 요청이 아니면 운동 종류는 유지하고 무게만 조정!

**3. 시간 관련:**
   - "시간이 30분밖에 없어요" → 핵심 3-4개만 남기고 슈퍼셋 제안
   - "빨리 끝내고 싶어요" → HIIT 스타일 제안

**4. 운동 선호도 (명확한 요청만):**
   - "스쿼트 싫어요" / "스쿼트 빼주세요" → 레그프레스, 런지 등으로 대체
   - "유산소 추가해주세요" → 러닝, 자전거 추가
   - 명확한 대체 요청이 없으면 원래 운동 유지!

**5. 컨디션 관련:**
   - "피곤해요" → 전체 무게 20% 낮춤
   - "에너지 넘쳐요" → 무게/세트 증가

**응답 형식 (전문가답게):**
1. 피드백 이해 확인 (공감하되 전문적으로)
2. 전문가 의견 제시
   - 요청이 목표에 부합하면: "좋은 선택입니다. ~때문에 효과적입니다."
   - 요청이 목표에 맞지 않으면: "이해하지만, ~때문에 권장하지 않습니다. 대신 이렇게 하면 어떨까요?"
3. 조정 내용 명확히 설명 (왜 이렇게 하는지)
4. 수정된 운동 목록 (형식: "운동명 무게kg 세트수세트 횟수회")
5. 목표 달성을 위한 추가 조언
6. 강단있게 마무리: "이렇게 하시면 ~목표에 더 가까워집니다. 어떠신가요?"

**잘못된 예시 (유순한 코치 - 하지 마세요):**
❌ 사용자: "고블릿 스쿼트로 바꾸고 싶어요"
   AI: "네, 고블릿 스쿼트 8kg으로 바꾸겠습니다!"
   (→ 목표 고려 없이 무조건 수용)

❌ 사용자: "하체 운동 빼주세요"
   AI: "알겠습니다! 하체 운동 제외하겠습니다."
   (→ 스노보드 목표에 필수인데 빼줌)

**올바른 예시 (전문가 코치 - 이렇게 하세요):**
✅ 사용자: "고블릿 스쿼트로 바꾸고 싶어요"
   AI: "고블릿 스쿼트로 바꾸고 싶으신 이유를 이해합니다. 하지만 스노보드를 위해서는 일반 스쿼트가 더 효과적입니다. 고블릿은 전면부 중심이지만, 스쿼트는 후면 체인 전체를 강화해 스노보드 턴에 필수적인 힘을 기릅니다.

   대신 무게를 12kg (덤벨 양손 6kg)으로 낮춰서 스쿼트를 계속하시면 어떨까요? 정 원하시면 고블릿으로도 가능하지만, 그럴 경우 무게를 8kg으로 더 낮춰야 하고, 스노보드 목표 달성은 조금 느려질 수 있습니다. 어떻게 하시겠어요?"

✅ 사용자: "하체 너무 힘들어요. 빼주세요"
   AI: "최근 하체 운동이 많아서 힘드신 것 이해합니다. 하지만 스노보드는 80%가 하체 근력입니다. 완전히 빼면 목표 달성이 어려워집니다.

   대신 이렇게 조정하면 어떨까요?
   1. 하체 운동 무게를 30% 낮춤
   2. 세트 수를 줄임 (4세트 → 3세트)
   3. 회복을 위한 스트레칭 추가

   이렇게 하면 부담은 줄이면서도 스노보드에 필요한 근력은 유지할 수 있습니다. 어떠신가요?"

**확정 조건:**
"좋아요", "확정", "이대로 할게요", "됐어요", "완벽해요", "갈게요", "시작할게요"
→ "완벽합니다! 오늘 운동 파이팅하세요! 💪 Todo로 저장하시겠어요? [FINALIZE]"

**절대 원칙:**
- 운동 기록의 다른 운동 무게는 "참고 정보"입니다. 요청이 아닙니다!
- 명확한 대체 요청이 없으면 운동 종류를 바꾸지 마세요!
- 무게만 조정하세요!`;

      const aiResponse = await generateTextWithAI(
        systemPrompt,
        conversationContext,
        { temperature: 0.7, maxTokens: 500 }
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
      };

      setRecommendationChatMessages([...newMessages, assistantMessage]);

      // 추천 업데이트
      if (!aiResponse.includes('[FINALIZE]')) {
        // 조정된 내용을 현재 추천에 반영
        setCurrentRecommendation(currentRecommendation + '\n\n--- 조정 내용 ---\n' + aiResponse);
      }
    } catch (error) {
      console.error('[Recommendation Chat] Error:', error);
      setError('대화 처리 중 오류가 발생했습니다.');
    } finally {
      setIsRecommendationChatProcessing(false);
    }
  };

  const handleFinalizeRecommendation = async () => {
    const existingTodo = getTodayTodo();

    if (existingTodo) {
      if (!confirm('오늘의 Todo가 이미 존재합니다. 덮어쓰시겠습니까?')) {
        return;
      }
    }

    try {
      // 최종 추천에서 운동 파싱
      const parsedWorkouts = parseRecommendationToWorkouts(currentRecommendation);

      if (parsedWorkouts.length === 0) {
        // 파싱 실패 시 AI에게 재요청
        const systemPrompt = `다음 운동 추천 텍스트에서 구체적인 운동 목록만 추출해주세요.
각 줄마다 하나의 운동을 다음 형식으로 작성:
운동명 무게kg 세트수세트 횟수회

예:
스쿼트 80kg 4세트 8회
벤치프레스 60kg 3세트 10회
러닝 20분`;

        const structuredWorkouts = await generateTextWithAI(systemPrompt, currentRecommendation, {
          temperature: 0.3,
          maxTokens: 500,
        });

        const extractedWorkouts = parseRecommendationToWorkouts(structuredWorkouts);

        if (extractedWorkouts.length === 0) {
          setError('운동 목록을 추출할 수 없습니다. 추천 내용을 확인해주세요.');
          return;
        }

        saveTodoWithRecommendation(extractedWorkouts);
      } else {
        saveTodoWithRecommendation(parsedWorkouts);
      }
    } catch (err) {
      console.error('Finalize error:', err);
      setError('Todo 저장 중 오류가 발생했습니다.');
    }
  };

  const saveTodoWithRecommendation = (workouts: TodoWorkout[]) => {
    const todo: DailyTodo = {
      id: generateId(),
      date: formatDate(),
      source: 'ai_recommendation',
      aiRecommendation: {
        analysisResult: currentAnalysis,
        initialRecommendation: recommendationChatMessages[0]?.content || '',
        conversationHistory: recommendationChatMessages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.timestamp,
          })),
        finalRecommendation: currentRecommendation,
        userFeedback: recommendationChatMessages
          .filter((m) => m.role === 'user')
          .map((m) => m.content)
          .join('; '),
        finalizedAt: Date.now(),
      },
      workouts,
      createdAt: Date.now(),
    };

    try {
      saveTodo(todo);
      alert('오늘의 Todo로 저장되었습니다!');

      // 상태 초기화
      setRecommendationChatMessages([]);
      setCurrentAnalysis('');
      setCurrentRecommendation('');
      setViewMode('ready');

      navigate('/todo');
    } catch (err) {
      setError('Todo 저장에 실패했습니다.');
    }
  };

  const analyzeWorkouts = (logs: WorkoutLog[]): string => {
    // 1. 기본 통계
    const totalWorkouts = logs.reduce((sum, log) => sum + log.workouts.length, 0);
    const totalDays = logs.length;

    // 2. 운동별 통계
    const workoutStats = new Map<string, {
      count: number;
      totalSets: number;
      totalReps: number;
      weights: number[];
      durations: number[];
      lastDate: string;
    }>();

    logs.forEach((log) => {
      log.workouts.forEach((workout) => {
        const existing = workoutStats.get(workout.name) || {
          count: 0,
          totalSets: 0,
          totalReps: 0,
          weights: [],
          durations: [],
          lastDate: log.date,
        };

        existing.count++;
        if (workout.sets) existing.totalSets += workout.sets;
        if (workout.reps) existing.totalReps += workout.reps;
        if (workout.weight_kg) existing.weights.push(workout.weight_kg);
        if (workout.duration_min) existing.durations.push(workout.duration_min);
        existing.lastDate = log.date;

        workoutStats.set(workout.name, existing);
      });
    });

    // 3. 운동 타입별 분석
    const typeCount = new Map<string, number>();
    logs.forEach((log) => {
      log.workouts.forEach((workout) => {
        typeCount.set(workout.type, (typeCount.get(workout.type) || 0) + 1);
      });
    });

    // 4. 구조화된 요약 생성
    let summary = `=== 운동 기록 분석 (최근 ${totalDays}일) ===\n\n`;

    summary += `📊 전체 통계:\n`;
    summary += `- 총 운동 세션: ${totalDays}일\n`;
    summary += `- 총 운동 개수: ${totalWorkouts}개\n`;
    summary += `- 일평균 운동: ${(totalWorkouts / totalDays).toFixed(1)}개\n\n`;

    summary += `💪 주요 운동 (빈도순):\n`;
    const sortedWorkouts = Array.from(workoutStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    sortedWorkouts.forEach(([name, stats]) => {
      summary += `- ${name}: ${stats.count}회`;

      if (stats.weights.length > 0) {
        const avgWeight = stats.weights.reduce((a, b) => a + b, 0) / stats.weights.length;
        const maxWeight = Math.max(...stats.weights);
        const minWeight = Math.min(...stats.weights);
        summary += ` | 무게 ${minWeight}~${maxWeight}kg (평균 ${avgWeight.toFixed(1)}kg)`;

        // 발전도 분석
        if (stats.weights.length >= 3) {
          const recent = stats.weights.slice(-2).reduce((a, b) => a + b, 0) / 2;
          const old = stats.weights.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
          const trend = recent - old;
          if (trend > 0) summary += ` 📈 ${trend.toFixed(1)}kg 증가`;
          else if (trend < -1) summary += ` 📉 ${Math.abs(trend).toFixed(1)}kg 감소`;
        }
      }

      if (stats.totalSets > 0) {
        summary += ` | 평균 ${(stats.totalSets / stats.count).toFixed(1)}세트`;
      }

      if (stats.durations.length > 0) {
        const avgDuration = stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length;
        summary += ` | 평균 ${avgDuration.toFixed(1)}분`;
      }

      summary += ` (마지막: ${stats.lastDate})\n`;
    });

    summary += `\n🎯 운동 타입 분포:\n`;
    const sortedTypes = Array.from(typeCount.entries())
      .sort((a, b) => b[1] - a[1]);
    sortedTypes.forEach(([type, count]) => {
      const percentage = ((count / totalWorkouts) * 100).toFixed(0);
      summary += `- ${type}: ${count}회 (${percentage}%)\n`;
    });

    // 5. 최근 3일 상세 기록
    summary += `\n📅 최근 3일 상세:\n`;
    logs.slice(0, 3).forEach((log, index) => {
      summary += `${index + 1}. ${log.date}\n`;
      log.workouts.forEach((workout) => {
        summary += `   • ${workout.name}`;
        if (workout.weight_kg) summary += ` ${workout.weight_kg}kg`;
        if (workout.sets && workout.reps) summary += ` ${workout.sets}세트×${workout.reps}회`;
        if (workout.duration_min) summary += ` ${workout.duration_min}분`;
        summary += `\n`;
      });
    });

    return summary;
  };

  // Profile Chat View (대화형 프로필 설정)
  if (viewMode === 'profile-chat') {
    return (
      <div className="container">
        <div className="recommend-header">
          <h1>프로필 설정</h1>
          <p className="subtitle">AI와 대화하며 맞춤 프로필을 만들어보세요</p>
        </div>

        <div className="chat-container">
          <div className="chat-messages">
            {profileChatMessages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {isProfileChatProcessing && (
              <div className="chat-message assistant">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isGeneratingProfile ? (
            <div className="chat-generating">
              <div className="spinner"></div>
              <p>프로필 생성 중...</p>
            </div>
          ) : (
            <div className="chat-input-container">
              <textarea
                className="chat-input"
                value={profileChatInput}
                onChange={(e) => setProfileChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleProfileChatSubmit();
                  }
                }}
                placeholder="답변을 입력하세요..."
                rows={2}
                disabled={isProfileChatProcessing}
              />
              <button
                className="chat-send-button"
                onClick={handleProfileChatSubmit}
                disabled={isProfileChatProcessing || !profileChatInput.trim()}
              >
                전송
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="error-box">
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Ready View (프로필 있음, 추천 받을 준비)
  if (viewMode === 'ready') {
    return (
      <div className="container">
        <div className="recommend-header">
          <h1>AI 운동 추천</h1>
          <p className="subtitle">최근 운동 기록을 분석하여 오늘의 운동을 추천해드립니다</p>
          {aiInfo && <p className="ai-info" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>{aiInfo}</p>}
        </div>

        {profile && (
          <div className="profile-display">
            <div className="profile-header">
              <h3>내 운동 프로필</h3>
              <div className="profile-actions">
                <button className="edit-button" onClick={handleEditProfile}>
                  수정
                </button>
                <button className="delete-icon-button" onClick={handleDeleteProfile}>
                  삭제
                </button>
              </div>
            </div>
            <div className="profile-content">{profile.goals}</div>
          </div>
        )}

        <div className="today-feeling-section">
          <h3>오늘의 기분은 어떠세요?</h3>
          <textarea
            className="feeling-input"
            value={todayFeeling}
            onChange={(e) => setTodayFeeling(e.target.value)}
            placeholder="예: 어제 운동 후 다리가 뻐근해요. 컨디션은 좋은데 피곤해요. 오늘은 가볍게 하고 싶어요."
            rows={4}
          />
          <p className="feeling-hint">
            오늘의 컨디션, 피로도, 통증, 기분 등을 자유롭게 적어주세요. AI가 고려해서 추천해드립니다.
          </p>
        </div>

        <div className="recommend-cta">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <p>AI가 당신의 운동 기록, 목표, 컨디션을 분석하여</p>
          <p>맞춤 운동을 추천해드립니다</p>
          <button className="primary-button large-button" onClick={generateRecommendation}>
            추천 받기
          </button>
        </div>

        {error && (
          <div className="error-box">
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Loading View
  if (viewMode === 'loading') {
    return (
      <div className="container">
        <div className="recommend-loading">
          <div className="spinner"></div>
          <p>AI가 운동 기록을 분석하는 중...</p>
        </div>
      </div>
    );
  }

  // Recommendation Chat View (대화형 추천)
  if (viewMode === 'recommendation-chat') {
    return (
      <div className="container">
        <div className="recommend-header">
          <h1>운동 추천</h1>
          <p className="subtitle">AI와 대화하며 추천을 조정해보세요</p>
        </div>

        <div className="chat-container">
          <div className="chat-messages">
            {recommendationChatMessages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="message-content">
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
            {isRecommendationChatProcessing && (
              <div className="chat-message assistant">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="chat-input-container">
            <textarea
              className="chat-input"
              value={recommendationChatInput}
              onChange={(e) => setRecommendationChatInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleRecommendationChatSubmit();
                }
              }}
              placeholder="피드백을 입력하세요 (예: 스쿼트 무게 너무 높아요, 시간 부족해요)"
              rows={2}
              disabled={isRecommendationChatProcessing}
            />
            <div className="chat-buttons">
              <button
                className="chat-finalize-button"
                onClick={handleFinalizeRecommendation}
                disabled={isRecommendationChatProcessing}
              >
                ✓ 확정하고 Todo 저장
              </button>
              <button
                className="chat-send-button"
                onClick={handleRecommendationChatSubmit}
                disabled={isRecommendationChatProcessing || !recommendationChatInput.trim()}
              >
                전송
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-box">
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  // 기본 View (혹시 다른 상태일 경우)
  return (
    <div className="container">
      <div className="recommend-loading">
        <div className="spinner"></div>
        <p>로딩 중...</p>
      </div>
    </div>
  );
};
