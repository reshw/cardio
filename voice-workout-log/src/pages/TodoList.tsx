import { useState, useEffect } from 'react';
import { getTodayTodo, saveTodo, generateId, formatDate } from '../storage/logStorage';
import type { DailyTodo, TodoWorkout, RecordingState } from '../types';
import { useSpeechRecognition } from '../features/speech/useSpeechRecognition';
import { useWhisperRecording } from '../features/speech/useWhisperRecording';
import { parseWorkoutText } from '../features/parse/parseWorkoutText';
import { parseWithGPT } from '../features/parse/parseWithGPT';
import { normalizeText } from '../features/normalize/normalizeText';

type AddMode = 'web-speech' | 'ai';

export const TodoList = () => {
  const [todo, setTodo] = useState<DailyTodo | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('web-speech');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [isRecommendationExpanded, setIsRecommendationExpanded] = useState(false);

  const webSpeech = useSpeechRecognition();
  const whisper = useWhisperRecording();

  useEffect(() => {
    loadTodo();
  }, []);

  const loadTodo = () => {
    const todayTodo = getTodayTodo();
    setTodo(todayTodo);
  };

  const toggleWorkoutComplete = (index: number) => {
    if (!todo) return;

    const updatedWorkouts = [...todo.workouts];
    updatedWorkouts[index] = {
      ...updatedWorkouts[index],
      completed: !updatedWorkouts[index].completed,
    };

    const updatedTodo: DailyTodo = {
      ...todo,
      workouts: updatedWorkouts,
    };

    saveTodo(updatedTodo);
    setTodo(updatedTodo);
  };

  const handleMicClick = async () => {
    console.log('[TodoList] handleMicClick - State:', recordingState, 'Mode:', addMode);

    if (recordingState === 'idle') {
      webSpeech.resetTranscript();
      setRecordingState('listening');

      if (addMode === 'web-speech') {
        webSpeech.startListening();
      } else {
        webSpeech.startListening();
        await whisper.startRecording();
      }
    } else if (recordingState === 'listening') {
      setRecordingState('transcribing');

      if (addMode === 'web-speech') {
        webSpeech.stopListening();
        setTimeout(() => {
          const finalText = webSpeech.transcript.trim();
          console.log('[TodoList] Web Speech final text:', finalText);
          handleParse(finalText, false);
        }, 500);
      } else {
        webSpeech.stopListening();
        const whisperResult = await whisper.stopRecording();
        console.log('[TodoList] Whisper final text:', whisperResult);
        handleParse(whisperResult, true);
      }
    }
  };

  const handleParse = async (text: string, useAI: boolean) => {
    console.log('[TodoList] handleParse - useAI:', useAI, 'text:', text);
    setRecordingState('parsing');

    try {
      let newWorkouts: TodoWorkout[] = [];

      if (useAI) {
        console.log('[TodoList] Using AI mode (GPT parsing)');
        const parsed = await parseWithGPT(text);
        newWorkouts = parsed.map((w) => ({
          name: w.name,
          sets: w.sets || undefined,
          reps: w.reps || undefined,
          weight_kg: w.weight_kg || undefined,
          duration_min: w.duration_min || undefined,
          distance_km: w.distance_km || undefined,
          pace: w.pace || undefined,
          note: w.note || undefined,
          completed: false,
        }));
      } else {
        console.log('[TodoList] Using rule-based parsing');
        setTimeout(() => {
          const normalized = normalizeText(text);
          console.log('[TodoList] Normalized text:', normalized);
          const parsed = parseWorkoutText(normalized);
          console.log('[TodoList] Rule-based parsing result:', parsed);

          newWorkouts = parsed.map((w) => ({
            name: w.name,
            sets: w.sets || undefined,
            reps: w.reps || undefined,
            weight_kg: w.weight_kg || undefined,
            duration_min: w.duration_min || undefined,
            distance_km: w.distance_km || undefined,
            pace: w.pace || undefined,
            note: w.note || undefined,
            completed: false,
          }));

          addWorkoutsToTodo(newWorkouts);
        }, 300);
        return;
      }

      addWorkoutsToTodo(newWorkouts);
    } catch (err) {
      console.error('[TodoList] Parsing error:', err);
      alert(`파싱에 실패했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      setRecordingState('idle');
    }
  };

  const addWorkoutsToTodo = (newWorkouts: TodoWorkout[]) => {
    const existingTodo = getTodayTodo();

    if (existingTodo) {
      // 기존 Todo에 추가
      const updatedTodo: DailyTodo = {
        ...existingTodo,
        workouts: [...existingTodo.workouts, ...newWorkouts],
      };
      saveTodo(updatedTodo);
      setTodo(updatedTodo);
    } else {
      // 새 Todo 생성
      const newTodo: DailyTodo = {
        id: generateId(),
        date: formatDate(),
        source: 'manual',
        workouts: newWorkouts,
        createdAt: Date.now(),
      };
      saveTodo(newTodo);
      setTodo(newTodo);
    }

    setRecordingState('idle');
    setIsAdding(false);
    alert(`${newWorkouts.length}개의 운동이 추가되었습니다!`);
  };

  const handleCancelAdding = () => {
    if (recordingState === 'listening') {
      webSpeech.stopListening();
      if (addMode === 'ai') {
        whisper.stopRecording();
      }
    }
    setIsAdding(false);
    setRecordingState('idle');
    webSpeech.resetTranscript();
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
  };

  const completedCount = todo?.workouts.filter((w) => w.completed).length || 0;
  const totalCount = todo?.workouts.length || 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Adding Mode
  if (isAdding) {
    return (
      <div className="container">
        <div className="header">
          <h1>Todo 추가</h1>
          <button className="cancel-button" onClick={handleCancelAdding}>
            취소
          </button>
        </div>

        {recordingState === 'idle' && (
          <>
            <div className="mode-selector">
              <button
                className={`mode-button ${addMode === 'web-speech' ? 'active' : ''}`}
                onClick={() => setAddMode('web-speech')}
              >
                기본 (무료)
              </button>
              <button
                className={`mode-button ${addMode === 'ai' ? 'active' : ''}`}
                onClick={() => setAddMode('ai')}
              >
                AI (유료)
              </button>
            </div>
            <div className="mode-description">
              {addMode === 'web-speech' ? (
                <p>브라우저 내장 음성 인식 + 룰 기반 파싱</p>
              ) : (
                <p>Whisper 음성 인식 + GPT 스마트 파싱</p>
              )}
            </div>
          </>
        )}

        {recordingState === 'idle' && (
          <div className="recording-section">
            <div className="status-text">추가할 운동을 말씀해주세요</div>
            <button className="mic-button" onClick={handleMicClick}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
            <div className="hint-text">탭하여 녹음 시작</div>
          </div>
        )}

        {recordingState === 'listening' && (
          <div className="recording-section">
            <div className="status-text listening">
              {addMode === 'ai' ? '🎤 AI 녹음 중...' : '듣는 중...'}
            </div>
            <button className="mic-button active" onClick={handleMicClick}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            </button>
            <div className="hint-text">탭하여 녹음 종료</div>

            {(webSpeech.transcript || webSpeech.interimTranscript) && (
              <div className="transcript-box">
                {addMode === 'ai' && (
                  <div className="ai-preview-label">
                    실시간 미리보기 (AI가 다시 처리합니다)
                  </div>
                )}
                <div className="transcript-final">{webSpeech.transcript}</div>
                {webSpeech.interimTranscript && (
                  <div className="transcript-interim">{webSpeech.interimTranscript}</div>
                )}
              </div>
            )}
          </div>
        )}

        {(recordingState === 'transcribing' || recordingState === 'parsing') && (
          <div className="recording-section">
            <div className="status-text">
              {recordingState === 'transcribing' ? '텍스트 처리 중...' : '운동 기록 분석 중...'}
            </div>
            <div className="spinner"></div>
          </div>
        )}
      </div>
    );
  }

  // Empty State
  if (!todo) {
    return (
      <div className="container">
        <div className="header">
          <h1>오늘의 Todo</h1>
        </div>

        <div className="empty-state">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
            <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V19z" />
          </svg>
          <p>오늘의 Todo가 없습니다</p>
          <p className="hint-text">음성으로 Todo를 추가하거나 AI 추천을 받으세요</p>
          <button className="primary-button" onClick={() => setIsAdding(true)}>
            음성으로 Todo 추가
          </button>
        </div>
      </div>
    );
  }

  // Todo List View
  return (
    <div className="container">
      <div className="header">
        <h1>오늘의 Todo</h1>
        <button className="add-todo-button" onClick={() => setIsAdding(true)}>
          + 추가
        </button>
      </div>

      <div className="todo-header-card">
        <div className="todo-date">{formatDateDisplay(todo.date)}</div>
        <div className="todo-progress-section">
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="progress-text">
            {completedCount} / {totalCount} 완료
          </div>
        </div>
        {todo.source === 'ai_recommendation' && (
          <div className="todo-source-badge">AI 추천</div>
        )}
      </div>

      {todo.aiRecommendation && (
        <div className="ai-recommendation-preview">
          <div className="recommendation-header" onClick={() => setIsRecommendationExpanded(!isRecommendationExpanded)}>
            <h3>AI 추천 메시지</h3>
            <button className="expand-button">
              {isRecommendationExpanded ? '접기 ▲' : '펼치기 ▼'}
            </button>
          </div>
          <div className={`ai-recommendation-text ${isRecommendationExpanded ? 'expanded' : 'collapsed'}`}>
            {(() => {
              const aiRec = todo.aiRecommendation as any; // Runtime check for backward compatibility

              // 새 형식 (객체)
              if (aiRec && typeof aiRec === 'object' && 'finalRecommendation' in aiRec) {
                const recommendation = aiRec.finalRecommendation;
                if (isRecommendationExpanded) {
                  return (
                    <>
                      {recommendation}
                      {aiRec.userFeedback && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '14px', color: 'var(--text-secondary)' }}>
                          <strong>사용자 피드백:</strong> {aiRec.userFeedback}
                        </div>
                      )}
                    </>
                  );
                } else {
                  return recommendation.split('\n').slice(0, 3).join('\n') + (recommendation.split('\n').length > 3 ? '...' : '');
                }
              }
              // 구 형식 (문자열) - 하위 호환성
              else if (typeof aiRec === 'string') {
                return isRecommendationExpanded
                  ? aiRec
                  : aiRec.split('\n').slice(0, 3).join('\n') +
                    (aiRec.split('\n').length > 3 ? '...' : '');
              }
              return '';
            })()}
          </div>
        </div>
      )}

      <div className="todo-workout-list">
        <h3>운동 목록</h3>
        {todo.workouts.map((workout, index) => (
          <div
            key={index}
            className={`todo-workout-item ${workout.completed ? 'completed' : ''}`}
            onClick={() => toggleWorkoutComplete(index)}
          >
            <div className="todo-checkbox">
              {workout.completed && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </div>
            <div className="todo-workout-info">
              <div className="todo-workout-name">{workout.name}</div>
              <div className="todo-workout-specs">
                {workout.distance_km && <span className="spec-distance">{workout.distance_km}km</span>}
                {workout.pace && <span className="spec-pace">{workout.pace}/km</span>}
                {workout.weight_kg && <span className="spec-weight">{workout.weight_kg}kg</span>}
                {workout.sets && workout.reps && (
                  <span>
                    {workout.sets}세트 × {workout.reps}회
                  </span>
                )}
                {!workout.sets && workout.reps && <span>{workout.reps}회</span>}
                {workout.duration_min && <span>{workout.duration_min}분</span>}
              </div>
              {workout.note && <div className="todo-workout-note">{workout.note}</div>}
            </div>
          </div>
        ))}
      </div>

      {completedCount === totalCount && totalCount > 0 && (
        <div className="todo-completion-message">
          <div className="completion-icon">🎉</div>
          <div className="completion-text">
            <h3>오늘의 운동 완료!</h3>
            <p>훌륭합니다! 모든 운동을 완료했습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
};
