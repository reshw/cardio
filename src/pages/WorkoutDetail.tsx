import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Edit2, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import workoutService from '../services/workoutService';
import feedService from '../services/feedService';
import clubService from '../services/clubService';
import type { Workout } from '../services/workoutService';
import { uploadToR2 } from '../utils/r2Storage';
import { IntegratedCommentSection } from '../components/IntegratedCommentSection';
import { LikeStatsModal } from '../components/LikeStatsModal';
import { useAuth } from '../contexts/AuthContext';

export const WorkoutDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const highlightCommentId = searchParams.get('commentId');
  const clubIdParam = searchParams.get('clubId');
  const { user, loading: authLoading } = useAuth();

  const [workout, setWorkout] = useState<Workout | null>(location.state?.workout || null);
  const [loading, setLoading] = useState(!workout);

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(workout?.value.toString() || '');
  const toKSTInputValue = (utcString: string) => {
    const kstDate = new Date(new Date(utcString).getTime() + 9 * 60 * 60 * 1000);
    return kstDate.toISOString().slice(0, 16);
  };

  const [workoutTime, setWorkoutTime] = useState(
    workout ? toKSTInputValue(workout.workout_time) : ''
  );
  const [intensity, setIntensity] = useState(workout?.intensity || 4);
  const [memo, setMemo] = useState(workout?.memo ?? '');
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [ownerName, setOwnerName] = useState<string | null>(null);

  // 좋아요 관련 state
  const [totalLikes, setTotalLikes] = useState(0);
  const [showLikeStats, setShowLikeStats] = useState(false);

  // 댓글 관련 state
  const [totalComments, setTotalComments] = useState(0);

  // 초기 로드: clubIdParam이 있으면 멤버십 체크 후 워크아웃 로드, 없으면 바로 로드
  useEffect(() => {
    if (!id) return;

    if (clubIdParam) {
      // auth 로딩 완료 대기 (로딩 중이거나 user 없으면 건너뜀)
      if (authLoading || !user) return;

      const init = async () => {
        try {
          const isMember = await clubService.isClubMember(clubIdParam, user.id);
          if (!isMember) {
            const club = await clubService.getClubById(clubIdParam);
            const returnUrl = `/workout/${id}?clubId=${clubIdParam}`;
            sessionStorage.setItem('join_return_url', returnUrl);
            navigate(`/join/${club.invite_code}`, { replace: true });
            return;
          }
          // 멤버 확인 후 워크아웃 로드
          if (!workout) {
            loadWorkout();
          }
        } catch (error) {
          console.error('클럽 소속 확인 실패:', error);
        }
      };

      init();
    } else {
      if (!workout) {
        loadWorkout();
      }
    }
  }, [id, clubIdParam, user, authLoading]);

  // 타인 기록 진입 시 소유자 닉네임 로드 (클럽 닉네임 우선, fallback: username)
  useEffect(() => {
    if (!workout || !user || user.id === workout.user_id) return;
    const fetchOwner = async () => {
      if (clubIdParam) {
        const { data: member } = await supabase
          .from('club_members')
          .select('club_nickname')
          .eq('club_id', clubIdParam)
          .eq('user_id', workout.user_id)
          .single();
        if (member?.club_nickname) { setOwnerName(member.club_nickname); return; }
      }
      const { data: u } = await supabase
        .from('users')
        .select('username')
        .eq('id', workout.user_id)
        .single();
      if (u?.username) setOwnerName(u.username);
    };
    fetchOwner();
  }, [workout?.user_id, user?.id, clubIdParam]);

  // 좋아요 개수 로드
  useEffect(() => {
    if (workout) {
      loadTotalLikes();
    }
  }, [workout]);

  const loadWorkout = async () => {
    if (!id) {
      navigate('/');
      return;
    }

    setLoading(true);
    try {
      const data = await workoutService.getWorkoutById(id);
      if (!data) {
        navigate('/');
        return;
      }
      setWorkout(data);
      setValue(data.value.toString());
      setWorkoutTime(toKSTInputValue(data.workout_time));
      setIntensity(data.intensity);
    } catch (error) {
      console.error('운동 조회 실패:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadTotalLikes = async () => {
    if (!workout) return;
    try {
      const count = await feedService.getTotalLikeCount(workout.id);
      setTotalLikes(count);
    } catch (error) {
      console.error('좋아요 조회 실패:', error);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>운동 정보 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!workout) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date
      .getHours()
      .toString()
      .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getWorkoutLabel = () => {
    // 요가/복싱은 항상 "혼합"으로 표시
    if (workout.category === '요가' || workout.category === '복싱') {
      return `${workout.category}-혼합`;
    }
    if (workout.sub_type) {
      return `${workout.category}-${workout.sub_type}`;
    }
    return workout.category;
  };

  const getRatioDisplay = () => {
    if (workout.category !== '요가' && workout.category !== '복싱') {
      return null;
    }

    if (!workout.sub_type_ratios) {
      return null;
    }

    const ratios = workout.sub_type_ratios as Record<string, number>;
    const entries = Object.entries(ratios);

    if (entries.length === 0) {
      return null;
    }

    // 단일 타입 100%인 경우 비율 표시 안함
    if (entries.length === 1 && entries[0][1] === 1.0) {
      return null;
    }

    // 비율 표시
    return entries
      .map(([type, ratio]) => `${type} ${Math.round(ratio * 100)}%`)
      .join(' | ');
  };

  const getIntensityLabel = (intensity: number) => {
    // 1단계 (1-2): 편안
    if (intensity <= 2) return '1단계 - 편안';
    // 2단계 (3-4): 경쾌
    if (intensity <= 4) return '2단계 - 경쾌';
    // 3단계 (5-6): 자극
    if (intensity <= 6) return '3단계 - 자극';
    // 4단계 (7-8): 고강도
    if (intensity <= 8) return '4단계 - 고강도';
    // 5단계 (9-10): 한계돌파
    return '5단계 - 한계돌파';
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity <= 2) return '#4ade80';
    if (intensity <= 4) return '#22c55e';
    if (intensity <= 6) return '#eab308';
    if (intensity <= 8) return '#f97316';
    if (intensity === 9) return '#ef4444';
    return '#dc2626';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async () => {
    if (!value || parseFloat(value) <= 0) {
      alert('올바른 값을 입력해주세요.');
      return;
    }

    setUpdating(true);

    try {
      let imageUrl = workout.proof_image;

      if (proofImage) {
        imageUrl = await uploadToR2(proofImage);
      }

      await workoutService.updateWorkout(workout.id, {
        value: parseFloat(value),
        workout_time: new Date(workoutTime + ':00+09:00').toISOString(),
        intensity,
        proof_image: imageUrl,
        memo: memo.trim() || undefined,
      });

      alert('운동 기록이 수정되었습니다.');
      navigate(-1);
    } catch (error) {
      console.error('운동 기록 수정 실패:', error);
      alert('운동 기록 수정에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말로 이 운동 기록을 삭제하시겠습니까?')) {
      return;
    }

    setDeleting(true);

    try {
      await workoutService.deleteWorkout(workout.id);
      alert('운동 기록이 삭제되었습니다.');
      navigate(-1);
    } catch (error) {
      console.error('운동 기록 삭제 실패:', error);
      alert('운동 기록 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container workout-detail-page">
      <div className="detail-header">
        <button className="back-button" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/club')}>
          <ChevronLeft size={24} />
        </button>
        <h1>운동 상세</h1>
      </div>
      {ownerName && (
        <div className="workout-owner-banner">
          {ownerName}님의 기록
        </div>
      )}

      <div className="detail-content">
        {!isEditing ? (
          <>
            <div className="detail-section">
              <div className="detail-label">운동 종류</div>
              <div className="detail-value">
                {getWorkoutLabel()}
                {getRatioDisplay() && (
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {getRatioDisplay()}
                  </div>
                )}
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-label">기록</div>
              <div className="detail-value">
                {workout.value}
                {workout.unit}
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-label">날짜</div>
              <div className="detail-value">{formatDate(workout.workout_time)}</div>
            </div>

            <div className="detail-section">
              <div className="detail-label">체감 난이도</div>
              <div
                className="detail-value"
                style={{ color: getIntensityColor(workout.intensity), fontWeight: 600 }}
              >
                {getIntensityLabel(workout.intensity)}
              </div>
            </div>

            {/* 좋아요 섹션 */}
            <div className="detail-section">
              <div className="detail-label">좋아요</div>
              <div className="detail-value like-stats-row">
                <span>❤ {totalLikes}개</span>
                {totalLikes > 0 && (
                  <button
                    className="view-details-btn"
                    onClick={() => setShowLikeStats(true)}
                  >
                    상세 보기 →
                  </button>
                )}
              </div>
            </div>

            {/* 댓글 섹션 */}
            <div className="detail-section full-width">
              <div className="detail-label">
                댓글 {totalComments > 0 && `(총 ${totalComments}개)`}
              </div>
              <IntegratedCommentSection
                workoutId={workout.id}
                highlightCommentId={highlightCommentId || undefined}
                onCommentCountChange={setTotalComments}
              />
            </div>

            {workout.memo && (
              <div className="detail-section">
                <div className="detail-label">메모</div>
                <div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{workout.memo}</div>
              </div>
            )}

            {/* 증빙 이미지 */}
            {workout.proof_image && (
              <div className="detail-section">
                <div className="detail-label">증빙 이미지</div>
                <div
                  className="detail-proof-image"
                  onClick={() => setSelectedImage(workout.proof_image!)}
                >
                  <img src={workout.proof_image} alt="증빙" />
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="edit-value">기록 ({workout.unit})</label>
              <input
                id="edit-value"
                type="number"
                step="0.01"
                min="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="value-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-date">날짜 및 시간</label>
              <input
                id="edit-date"
                type="datetime-local"
                value={workoutTime}
                onChange={(e) => setWorkoutTime(e.target.value)}
                className="value-input"
              />
            </div>

            <div className="form-group">
              <label>체감 난이도</label>

              {/* 스펙트럼 바 */}
              <div className="difficulty-spectrum-bar">
                <div className="spectrum-gradient"></div>
                <div
                  className="spectrum-indicator"
                  style={{ left: `${(intensity * 10) - 5}%` }}
                ></div>
              </div>

              {/* 5단계 버튼 */}
              <div className="difficulty-levels">
                <button
                  type="button"
                  className={`difficulty-level-btn ${intensity <= 2 ? 'active' : ''}`}
                  onClick={() => setIntensity(2)}
                >
                  <div className="difficulty-number">1</div>
                  <div className="difficulty-label">편안</div>
                </button>
                <button
                  type="button"
                  className={`difficulty-level-btn ${intensity >= 3 && intensity <= 4 ? 'active' : ''}`}
                  onClick={() => setIntensity(4)}
                >
                  <div className="difficulty-number">2</div>
                  <div className="difficulty-label">경쾌</div>
                </button>
                <button
                  type="button"
                  className={`difficulty-level-btn ${intensity >= 5 && intensity <= 6 ? 'active' : ''}`}
                  onClick={() => setIntensity(6)}
                >
                  <div className="difficulty-number">3</div>
                  <div className="difficulty-label">자극</div>
                </button>
                <button
                  type="button"
                  className={`difficulty-level-btn ${intensity >= 7 && intensity <= 8 ? 'active' : ''}`}
                  onClick={() => setIntensity(8)}
                >
                  <div className="difficulty-number">4</div>
                  <div className="difficulty-label">고강도</div>
                </button>
                <button
                  type="button"
                  className={`difficulty-level-btn ${intensity >= 9 ? 'active' : ''}`}
                  onClick={() => setIntensity(10)}
                >
                  <div className="difficulty-number">5</div>
                  <div className="difficulty-label">한계돌파</div>
                </button>
              </div>

              {/* 세부 조정 */}
              {intensity > 0 && (
                <div className="difficulty-fine-tune">
                  <button
                    type="button"
                    className="fine-tune-adjust-btn"
                    onClick={() => {
                      const min = intensity <= 2 ? 1 : intensity <= 4 ? 3 : intensity <= 6 ? 5 : intensity <= 8 ? 7 : 9;
                      if (intensity > min) setIntensity(intensity - 1);
                    }}
                    disabled={
                      intensity === 1 || intensity === 3 || intensity === 5 || intensity === 7 || intensity === 9
                    }
                  >
                    ◀ 조금 더 낮게
                  </button>
                  <button
                    type="button"
                    className="fine-tune-adjust-btn"
                    onClick={() => {
                      const max = intensity <= 2 ? 2 : intensity <= 4 ? 4 : intensity <= 6 ? 6 : intensity <= 8 ? 8 : 10;
                      if (intensity < max) setIntensity(intensity + 1);
                    }}
                    disabled={
                      intensity === 2 || intensity === 4 || intensity === 6 || intensity === 8 || intensity === 10
                    }
                  >
                    조금 더 높게 ▶
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="edit-memo">메모 (선택)</label>
              <textarea
                id="edit-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="날씨, 컨디션, 느낀점 등..."
                className="race-textarea"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-proof">증빙 이미지 변경</label>
              <input
                id="edit-proof"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="file-input"
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="새 증빙" />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 고정 액션 버튼 */}
      <div className="detail-actions-fixed">
        {!isEditing ? (
          <>
            {user?.id === workout.user_id && (
              <>
                <button className="action-button-full" onClick={() => setIsEditing(true)}>
                  <Edit2 size={18} />
                  수정
                </button>
                <button className="action-button-full danger" onClick={handleDelete} disabled={deleting}>
                  <Trash2 size={18} />
                  {deleting ? '삭제 중...' : '삭제'}
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <button
              className="action-button-full secondary"
              onClick={() => {
                setIsEditing(false);
                setValue(workout.value.toString());
                setWorkoutTime(toKSTInputValue(workout.workout_time));
                setIntensity(workout.intensity);
                setProofImage(null);
                setImagePreview(null);
              }}
            >
              취소
            </button>
            <button className="action-button-full" onClick={handleUpdate} disabled={updating}>
              {updating ? '저장 중...' : '저장'}
            </button>
          </>
        )}
      </div>

      {/* 이미지 뷰어 */}
      {selectedImage && (
        <div className="image-viewer-overlay" onClick={() => setSelectedImage(null)}>
          <button className="image-viewer-close" onClick={() => setSelectedImage(null)}>
            <X size={32} />
          </button>
          <img
            src={selectedImage}
            alt="증빙 전체 이미지"
            className="image-viewer-content"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 좋아요 상세 모달 */}
      <LikeStatsModal
        isOpen={showLikeStats}
        onClose={() => setShowLikeStats(false)}
        workoutId={workout.id}
      />
    </div>
  );
};
