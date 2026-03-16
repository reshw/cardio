import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { WorkoutLog, RecordingState, Workout } from '../types';
import { getAllLogs, deleteLog, saveLog, formatDate } from '../storage/supabaseStorage';
import { useSpeechRecognition } from '../features/speech/useSpeechRecognition';
import { useWhisperRecording } from '../features/speech/useWhisperRecording';
import { normalizeText } from '../features/normalize/normalizeText';
import { parseWorkoutText } from '../features/parse/parseWorkoutText';
import { parseWithGPT } from '../features/parse/parseWithGPT';
import challengeService from '../services/challengeService';
import {
  getCategoryIcon,
  getTypeColor,
  getTypeLabel,
  getTypeLightColor,
} from '../utils/workoutDisplay';

type AddMode = 'web-speech' | 'ai';
type InputMode = 'voice' | 'text';

// 🔥 [추가] 질적 지표(Quality Metrics) 추출 헬퍼 함수
const getQualityMetrics = (workout: Workout) => {
  const metrics = [];
  
  // 1. 저항/댐퍼/레벨
  if (workout.resistance_level) {
    metrics.push(`저항 ${workout.resistance_level}`);
  }
  
  // 2. 케이던스/RPM
  if (workout.cadence) {
    metrics.push(`${workout.cadence} RPM`);
  }
  
  // 3. 파워/와트
  if (workout.watts) {
    metrics.push(`${workout.watts} W`);
  }

  // 4. 경사도 (러닝 머신 등)
  if (workout.incline_percent) {
    metrics.push(`경사 ${workout.incline_percent}%`);
  }
  
  return metrics;
};

export const History = () => {
  const location = useLocation();
  const contributeChallengeId = (location.state as any)?.contributeChallengeId;

  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
  const [selectedDateForDetail, setSelectedDateForDetail] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [addMode, setAddMode] = useState<AddMode>('web-speech');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [textInput, setTextInput] = useState('');
  const [editableText, setEditableText] = useState('');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateMode, setDateMode] = useState<'today' | 'custom'>('today');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAddingMore, setIsAddingMore] = useState(false);

  const webSpeech = useSpeechRecognition();
  const whisper = useWhisperRecording();

  useEffect(() => {
    loadLogs();
    if (contributeChallengeId) {
      setIsAdding(true);
    }
  }, [contributeChallengeId]);

  const loadLogs = async () => {
    const allLogs = await getAllLogs();
    setLogs(allLogs);
  };

  const handleDelete = async (id: string) => {
    if (confirm('이 기록을 삭제하시겠습니까?')) {
      try {
        await deleteLog(id);
        await loadLogs();
        if (selectedLog?.id === id) {
          setSelectedLog(null);
        }
        alert('삭제되었습니다.');
      } catch (err) {
        alert('삭제에 실패했습니다.');
      }
    }
  };

  const handleMicClick = async () => {
    console.log('[History] handleMicClick - State:', recordingState, 'Mode:', addMode, 'IsAddingMore:', isAddingMore);

    if (recordingState === 'idle') {
      if (!isAddingMore) {
        webSpeech.resetTranscript();
      }
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
          console.log('[History] Web Speech final text:', finalText);

          const updatedText = isAddingMore && editableText
            ? `${editableText}, ${finalText}`
            : finalText;

          setEditableText(updatedText);
          setIsAddingMore(false);
          handleParse(updatedText, false);
        }, 500);
      } else {
        webSpeech.stopListening();
        const whisperResult = await whisper.stopRecording();
        console.log('[History] Whisper final text:', whisperResult);

        const updatedText = isAddingMore && editableText
          ? `${editableText}, ${whisperResult}`
          : whisperResult;

        setEditableText(updatedText);
        setIsAddingMore(false);
        handleParse(updatedText, true);
      }
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) {
      alert('운동 내용을 입력해주세요.');
      return;
    }
    setEditableText(textInput);
    handleParse(textInput, addMode === 'ai');
  };

  const handleParse = async (text: string, useAI: boolean) => {
    console.log('[History] handleParse - useAI:', useAI, 'text:', text);
    setRecordingState('parsing');

    try {
      if (useAI) {
        console.log('[History] Using AI mode (GPT parsing)');
        const parsed = await parseWithGPT(text);
        console.log('[History] GPT parsing result:', parsed);
        setWorkouts(parsed);
      } else {
        console.log('[History] Using rule-based parsing');
        setTimeout(() => {
          const normalized = normalizeText(text);
          console.log('[History] Normalized text:', normalized);
          const parsed = parseWorkoutText(normalized);
          console.log('[History] Rule-based parsing result:', parsed);
          setWorkouts(parsed);
          setRecordingState('review');
        }, 300);
        return;
      }
      setRecordingState('review');
    } catch (err) {
      console.error('[History] Parsing error:', err);
      alert(`파싱에 실패했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      setRecordingState('idle');
    }
  };

  const handleReparse = () => {
    handleParse(editableText, addMode === 'ai');
  };

  const handleRestartRecording = () => {
    setRecordingState('idle');
    setEditableText('');
    setWorkouts([]);
    setIsAddingMore(false);
    webSpeech.resetTranscript();
  };

  const handleAddMore = () => {
    setRecordingState('idle');
    setIsAddingMore(true);
    webSpeech.resetTranscript();
  };

  const handleSave = async () => {
    if (!editableText.trim()) {
      alert('저장할 내용이 없습니다.');
      return;
    }

    const actualDate = dateMode === 'today' ? new Date() : selectedDate;
    const dateString = formatDate(actualDate);

    const log = {
      date: dateString,
      rawText: editableText,
      normalizedText: addMode === 'ai' ? editableText : normalizeText(editableText),
      workouts,
      memo: null,
      createdAt: Date.now(),
      isPrivate,
    };

    try {
      const savedLog = await saveLog(log);

      if (contributeChallengeId && savedLog?.id) {
        try {
          await challengeService.contributeToChallenge(contributeChallengeId, savedLog.id);
          alert('저장되었고 챌린지에 기여되었습니다!');
        } catch (error) {
          alert(`저장되었지만 챌린지 기여에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      } else {
        alert('저장되었습니다!');
      }

      setRecordingState('idle');
      setInputMode('voice');
      setTextInput('');
      setEditableText('');
      setWorkouts([]);
      setIsAddingMore(false);
      webSpeech.resetTranscript();

      await loadLogs();
    } catch (err) {
      alert('저장에 실패했습니다.');
    }
  };

  const handleCompleteAdding = () => {
    setIsAdding(false);
    setRecordingState('idle');
    setInputMode('voice');
    setTextInput('');
    setEditableText('');
    setWorkouts([]);
    setSelectedDate(new Date());
    setDateMode('today');
    setIsPrivate(false);
    setIsAddingMore(false);
    webSpeech.resetTranscript();
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
  };

  const groupByDate = (logs: WorkoutLog[]) => {
    const grouped: Record<string, WorkoutLog[]> = {};
    logs.forEach((log) => {
      if (!grouped[log.date]) {
        grouped[log.date] = [];
      }
      grouped[log.date].push(log);
    });
    return grouped;
  };

  const calculateDayStats = (logs: WorkoutLog[]) => {
    const allWorkouts = logs.flatMap(log => log.workouts);
    const totalWorkouts = allWorkouts.length;
    const totalSets = allWorkouts.reduce((sum, w) => sum + (w.sets || 0), 0);
    const totalDuration = allWorkouts.reduce((sum, w) => sum + (w.duration_min || 0), 0);

    const workoutTypes = new Map<string, number>();
    allWorkouts.forEach(w => {
      workoutTypes.set(w.name, (workoutTypes.get(w.name) || 0) + 1);
    });

    const topWorkouts = Array.from(workoutTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    return {
      totalWorkouts,
      totalSets,
      totalDuration,
      topWorkouts,
      uniqueWorkouts: workoutTypes.size,
    };
  };

  const groupedLogs = groupByDate(logs);
  const dates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  // Adding Mode
  if (isAdding) {
    const displayDate = dateMode === 'today' ? new Date() : selectedDate;
    const formattedDisplayDate = `${displayDate.getFullYear()}년 ${displayDate.getMonth() + 1}월 ${displayDate.getDate()}일`;

    return (
      <div className="container">
        <div className="header">
          <h1>운동 추가</h1>
          <button className="complete-button" onClick={handleCompleteAdding}>
            ✓ 완료
          </button>
        </div>

        {recordingState === 'idle' && (
          <>
            <div className="date-selector-section">
              <h3>날짜 선택</h3>
              <div className="date-mode-buttons">
                <button
                  className={`date-mode-button ${dateMode === 'today' ? 'active' : ''}`}
                  onClick={() => {
                    setDateMode('today');
                    setSelectedDate(new Date());
                  }}
                >
                  오늘
                </button>
                <button
                  className={`date-mode-button ${dateMode === 'custom' ? 'active' : ''}`}
                  onClick={() => setDateMode('custom')}
                >
                  다른 날짜
                </button>
              </div>
              {dateMode === 'custom' && (
                <input
                  type="date"
                  className="date-picker"
                  value={formatDate(selectedDate)}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                />
              )}
              <div className="selected-date-display">
                선택된 날짜: <strong>{formattedDisplayDate}</strong>
              </div>
            </div>

            <div className="input-mode-selector">
              <button
                className={`input-mode-button ${inputMode === 'voice' ? 'active' : ''}`}
                onClick={() => setInputMode('voice')}
              >
                🎤 음성 입력
              </button>
              <button
                className={`input-mode-button ${inputMode === 'text' ? 'active' : ''}`}
                onClick={() => setInputMode('text')}
              >
                ✍️ 텍스트 입력
              </button>
            </div>

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

        {inputMode === 'voice' && recordingState === 'idle' && (
          <div className="recording-section">
            <div className="status-text">운동 기록을 말씀해주세요</div>
            <div className="input-guide">
              <div className="guide-item">운동이름</div>
              <div className="guide-separator">/</div>
              <div className="guide-item">강도 (무게/속도/RPM)</div>
              <div className="guide-separator">/</div>
              <div className="guide-item">세트 x 회수 or 분</div>
              <div className="guide-separator">/</div>
              <div className="guide-item">난이도 (1~10)</div>
            </div>
            <div className="guide-note">
              ※ 난이도: 1 (매우 쉬움) ~ 10 (매우 어려움)
            </div>
            <div className="guide-example">
              예: "벤치프레스 60kg 3세트 10회 난이도 7"
            </div>
            <button className="mic-button" onClick={handleMicClick}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
            <div className="hint-text">탭하여 녹음 시작</div>
          </div>
        )}

        {inputMode === 'text' && recordingState === 'idle' && (
          <div className="text-input-section">
            <div className="status-text">운동 내용을 입력해주세요</div>
            <div className="input-guide">
              <div className="guide-item">운동이름</div>
              <div className="guide-separator">/</div>
              <div className="guide-item">강도 (무게/속도/RPM)</div>
              <div className="guide-separator">/</div>
              <div className="guide-item">세트 x 회수 or 분</div>
              <div className="guide-separator">/</div>
              <div className="guide-item">난이도 (1~10)</div>
            </div>
            <div className="guide-note">
              ※ 난이도: 1 (매우 쉬움) ~ 10 (매우 어려움)
            </div>
            <textarea
              className="text-input-area"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="예: 벤치프레스 60kg 3세트 10회 난이도 7, 스쿼트 80kg 4세트 8회 난이도 8"
              rows={6}
            />
            <button className="primary-button" onClick={handleTextSubmit}>
              파싱하기
            </button>
            <div className="hint-text">자유롭게 입력하시면 AI가 정리해드립니다</div>
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

        {recordingState === 'review' && (
          <div className="review-section">
            <h2>기록 확인</h2>
            <div className="selected-date-display">
              저장될 날짜: <strong>{formattedDisplayDate}</strong>
            </div>

            <div className="section">
              <h3>원문 (편집 가능)</h3>
              <textarea
                className="edit-textarea"
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                rows={5}
              />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="secondary-button" onClick={handleReparse}>
                  🔄 재정리
                </button>
                <button className="secondary-button" onClick={handleRestartRecording}>
                  🎤 다시 말하기
                </button>
                {inputMode === 'voice' && (
                  <button className="secondary-button" onClick={handleAddMore}>
                    ➕ 더 추가하기
                  </button>
                )}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                💡 텍스트 수정 후 "재정리" | 처음부터 다시 녹음하려면 "다시 말하기" | 이어서 녹음하려면 "더 추가하기"
              </div>
            </div>

            <div className="section">
              <h3>운동 기록 ({workouts.length}개)</h3>
              {workouts.length === 0 ? (
                <p className="empty-message">운동 기록을 찾을 수 없습니다.</p>
              ) : (
                <div className="workout-cards">
                  {workouts.map((workout, idx) => {
                    const categoryIcon = getCategoryIcon(workout.category);
                    const typeColor = getTypeColor(workout.type);
                    const typeLabel = getTypeLabel(workout.type);
                    const typeLightColor = getTypeLightColor(workout.type);
                    // 🔥 질적 데이터 가져오기
                    const qualityMetrics = getQualityMetrics(workout);

                    return (
                      <div
                        key={idx}
                        style={{
                          border: `2px solid ${typeColor}`,
                          backgroundColor: typeLightColor,
                          borderRadius: '8px',
                          padding: '12px',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ fontSize: '20px' }}>{categoryIcon}</div>
                          <div className="workout-name">{workout.name}</div>
                          <div
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: typeColor,
                              color: 'white',
                              marginLeft: 'auto',
                            }}
                          >
                            {typeLabel}
                          </div>
                        </div>
                        <div className="workout-details">
                          {/* 1. 거리/속도/페이스 */}
                          {workout.distance_km && <span className="distance">{workout.distance_km} km</span>}
                          {workout.pace && <span className="pace">{workout.pace} /km</span>}
                          
                          {/* 2. 🔥 [추가] 질적 데이터 (RPM, 댐퍼, 와트 등) */}
                          {qualityMetrics.map((metric, i) => (
                            <span key={i} style={{ 
                              backgroundColor: 'rgba(0,0,0,0.05)', 
                              border: '1px solid rgba(0,0,0,0.1)',
                              fontWeight: 600,
                              color: 'var(--text-primary)'
                            }}>
                              {metric}
                            </span>
                          ))}

                          {/* 3. 무게/세트/렙스 */}
                          {workout.weight_kg && <span className="weight">{workout.weight_kg} kg</span>}
                          {workout.sets && <span>{workout.sets} 세트</span>}
                          {workout.reps && <span>{workout.reps} 회</span>}
                          
                          {/* 4. 시간 */}
                          {workout.duration_min && <span>{workout.duration_min} 분</span>}

                          {/* 5. 데이터가 없을 때 */}
                          {!workout.sets && !workout.reps && !workout.duration_min && !workout.weight_kg && !workout.distance_km && !workout.pace && qualityMetrics.length === 0 && (
                            <span className="no-details">상세 정보 없음</span>
                          )}
                        </div>
                        {workout.note && <div className="workout-note">{workout.note}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="section">
              <h3>공유 설정</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--card-bg)', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>🔒 나만 보기</span>
                </label>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {isPrivate ? '이 기록은 나에게만 보입니다' : '클럽 멤버들이 이 기록을 볼 수 있습니다'}
                </div>
              </div>
            </div>

            <div className="action-buttons">
              <button className="primary-button" onClick={handleSave}>
                💾 저장하고 계속 추가
              </button>
            </div>
            <div className="hint-text">저장 후 같은 날짜에 운동을 계속 추가할 수 있습니다</div>
          </div>
        )}
      </div>
    );
  }

  // Detail View - 날짜별 상세
  if (selectedDateForDetail) {
    const dayLogs = groupedLogs[selectedDateForDetail];
    const stats = calculateDayStats(dayLogs);
    const allWorkouts = dayLogs.flatMap(log => log.workouts);

    return (
      <div className="container">
        <div className="header">
          <button className="back-button" onClick={() => setSelectedDateForDetail(null)}>
            ← 뒤로
          </button>
          <h2>운동 기록 상세</h2>
        </div>

        <div className="detail-section">
          <div className="detail-date">{formatDateDisplay(selectedDateForDetail)}</div>

          {/* 통계 요약 */}
          <div className="detail-stats-summary">
            <div className="detail-stat">
              <span className="detail-stat-label">총 운동</span>
              <span className="detail-stat-value">{stats.totalWorkouts}개</span>
            </div>
            <div className="detail-stat">
              <span className="detail-stat-label">종목 수</span>
              <span className="detail-stat-value">{stats.uniqueWorkouts}개</span>
            </div>
            {stats.totalSets > 0 && (
              <div className="detail-stat">
                <span className="detail-stat-label">총 세트</span>
                <span className="detail-stat-value">{stats.totalSets}세트</span>
              </div>
            )}
            {stats.totalDuration > 0 && (
              <div className="detail-stat">
                <span className="detail-stat-label">총 시간</span>
                <span className="detail-stat-value">{stats.totalDuration}분</span>
              </div>
            )}
          </div>

          {/* 모든 운동 표시 */}
          <div className="section">
            <h3>운동 기록 ({allWorkouts.length}개)</h3>
            <div className="workout-cards">
              {allWorkouts.map((workout, idx) => {
                const categoryIcon = getCategoryIcon(workout.category);
                const typeColor = getTypeColor(workout.type);
                const typeLabel = getTypeLabel(workout.type);
                const typeLightColor = getTypeLightColor(workout.type);
                // 🔥 질적 데이터 가져오기
                const qualityMetrics = getQualityMetrics(workout);

                return (
                  <div
                    key={idx}
                    style={{
                      border: `2px solid ${typeColor}`,
                      backgroundColor: typeLightColor,
                      borderRadius: '8px',
                      padding: '12px',
                      position: 'relative',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '20px' }}>{categoryIcon}</div>
                      <div className="workout-name">{workout.name}</div>
                      <div
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: typeColor,
                          color: 'white',
                          marginLeft: 'auto',
                        }}
                      >
                        {typeLabel}
                      </div>
                    </div>
                    <div className="workout-details">
                      {/* 1. 거리/속도/페이스 */}
                      {workout.distance_km && <span className="distance">{workout.distance_km} km</span>}
                      {workout.pace && <span className="pace">{workout.pace} /km</span>}
                      
                      {/* 2. 🔥 [추가] 질적 데이터 */}
                      {qualityMetrics.map((metric, i) => (
                        <span key={i} style={{ 
                          backgroundColor: 'rgba(0,0,0,0.05)', 
                          border: '1px solid rgba(0,0,0,0.1)',
                          fontWeight: 600,
                          color: 'var(--text-primary)'
                        }}>
                          {metric}
                        </span>
                      ))}

                      {/* 3. 무게/세트/렙스 */}
                      {workout.weight_kg && <span className="weight">{workout.weight_kg} kg</span>}
                      {workout.sets && <span>{workout.sets} 세트</span>}
                      {workout.reps && <span>{workout.reps} 회</span>}
                      
                      {/* 4. 시간 */}
                      {workout.duration_min && <span>{workout.duration_min} 분</span>}

                      {/* 5. 데이터 없음 */}
                      {!workout.sets && !workout.reps && !workout.duration_min && !workout.weight_kg && !workout.distance_km && !workout.pace && qualityMetrics.length === 0 && (
                        <span className="no-details">상세 정보 없음</span>
                      )}
                    </div>
                    {workout.note && <div className="workout-note">{workout.note}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 세션별 원문 */}
          <div className="section">
            <h3>입력 내용 ({dayLogs.length}개 세션)</h3>
            {dayLogs.map((log) => (
              <div key={log.id} className="session-raw-text">
                <div className="session-header">
                  <span className="session-time">
                    {new Date(log.createdAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <button
                    className="delete-session-button"
                    onClick={() => handleDelete(log.id)}
                  >
                    삭제
                  </button>
                </div>
                <div className="detail-text">{log.rawText}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Detail View - 개별 로그 (기존 방식 유지)
  if (selectedLog) {
    return (
      <div className="container">
        <div className="header">
          <button className="back-button" onClick={() => setSelectedLog(null)}>
            ← 뒤로
          </button>
          <h2>운동 기록 상세</h2>
        </div>

        <div className="detail-section">
          <div className="detail-date">{formatDateDisplay(selectedLog.date)}</div>

          <div className="section">
            <h3>원문</h3>
            <div className="detail-text">{selectedLog.rawText}</div>
          </div>

          {selectedLog.workouts.length > 0 && (
            <div className="section">
              <h3>운동 기록 ({selectedLog.workouts.length}개)</h3>
              <div className="workout-cards">
                {selectedLog.workouts.map((workout, idx) => {
                  const categoryIcon = getCategoryIcon(workout.category);
                  const typeColor = getTypeColor(workout.type);
                  const typeLabel = getTypeLabel(workout.type);
                  const typeLightColor = getTypeLightColor(workout.type);
                  // 🔥 질적 데이터 가져오기
                  const qualityMetrics = getQualityMetrics(workout);

                  return (
                    <div
                      key={idx}
                      style={{
                        border: `2px solid ${typeColor}`,
                        backgroundColor: typeLightColor,
                        borderRadius: '8px',
                        padding: '12px',
                        position: 'relative',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '20px' }}>{categoryIcon}</div>
                        <div className="workout-name">{workout.name}</div>
                        <div
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            backgroundColor: typeColor,
                            color: 'white',
                            marginLeft: 'auto',
                          }}
                        >
                          {typeLabel}
                        </div>
                      </div>
                      <div className="workout-details">
                        {/* 1. 거리/속도/페이스 */}
                        {workout.distance_km && <span className="distance">{workout.distance_km} km</span>}
                        {workout.pace && <span className="pace">{workout.pace} /km</span>}
                        
                        {/* 2. 🔥 [추가] 질적 데이터 */}
                        {qualityMetrics.map((metric, i) => (
                          <span key={i} style={{ 
                            backgroundColor: 'rgba(0,0,0,0.05)', 
                            border: '1px solid rgba(0,0,0,0.1)',
                            fontWeight: 600,
                            color: 'var(--text-primary)'
                          }}>
                            {metric}
                          </span>
                        ))}

                        {/* 3. 무게/세트/렙스 */}
                        {workout.weight_kg && <span className="weight">{workout.weight_kg} kg</span>}
                        {workout.sets && <span>{workout.sets} 세트</span>}
                        {workout.reps && <span>{workout.reps} 회</span>}
                        
                        {/* 4. 시간 */}
                        {workout.duration_min && <span>{workout.duration_min} 분</span>}

                        {/* 5. 데이터 없음 */}
                        {!workout.sets && !workout.reps && !workout.duration_min && !workout.weight_kg && !workout.distance_km && !workout.pace && qualityMetrics.length === 0 && (
                          <span className="no-details">상세 정보 없음</span>
                        )}
                      </div>
                      {workout.note && <div className="workout-note">{workout.note}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button className="delete-button" onClick={() => handleDelete(selectedLog.id)}>
            삭제
          </button>
        </div>
      </div>
    );
  }

  // Main View - 날짜 카드 중심
  return (
    <div className="container">
      <div className="header">
        <h1>히스토리</h1>
        <button className="add-button" onClick={() => setIsAdding(true)}>
          + 추가
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="empty-state">
          <p>아직 운동 기록이 없습니다.</p>
          <button className="primary-button" onClick={() => setIsAdding(true)}>
            운동 기록 추가하기
          </button>
        </div>
      ) : (
        <div className="history-day-cards">
          {dates.map((date) => {
            const dayLogs = groupedLogs[date];
            const stats = calculateDayStats(dayLogs);

            return (
              <div
                key={date}
                className="day-card-compact"
                onClick={() => setSelectedDateForDetail(date)}
              >
                <div className="day-card-top">
                  <div className="day-info">
                    <div className="day-date-short">
                      {new Date(date).getDate()}
                    </div>
                    <div className="day-month-year">
                      {new Date(date).getMonth() + 1}월
                    </div>
                  </div>
                  <div className="day-summary">
                    <div className="day-title">
                      {['일', '월', '화', '수', '목', '금', '토'][new Date(date).getDay()]}요일
                    </div>
                    <div className="day-stats-inline">
                      <span className="stat-chip">{stats.totalWorkouts}개 운동</span>
                      <span className="stat-chip">{stats.uniqueWorkouts}종목</span>
                      {stats.totalSets > 0 && (
                        <span className="stat-chip">{stats.totalSets}세트</span>
                      )}
                    </div>
                  </div>
                  <div className="day-arrow">›</div>
                </div>

                <div className="day-workouts-preview">
                  {stats.topWorkouts.slice(0, 4).map((workout, idx) => (
                    <span key={idx} className="workout-chip">
                      {workout}
                    </span>
                  ))}
                  {stats.uniqueWorkouts > 4 && (
                    <span className="workout-chip-more">
                      +{stats.uniqueWorkouts - 4}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};