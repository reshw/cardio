import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Edit2, Trash2, X, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import workoutService from '../services/workoutService';
import feedService from '../services/feedService';
import clubService from '../services/clubService';
import type { Workout } from '../services/workoutService';
import { IntegratedCommentSection } from '../components/IntegratedCommentSection';
import { LikeStatsModal } from '../components/LikeStatsModal';
import { useAuth } from '../contexts/AuthContext';
import { WorkoutSourceIcon, getSourceLabel, getSourceColor } from '../components/WorkoutSourceIcon';

const REPORT_REASONS = ['스팸', '욕설/혐오발언', '부적절한 내용', '기타'];

interface WorkoutDetailProps {
  workoutData?: Workout;
  /** workoutData 없이 id만 아는 경우(예: 갤러리 썸네일) — 열릴 때 자체적으로 조회 */
  workoutId?: string;
  onClose?: (changed?: boolean) => void;
  /**
   * 클럽 컨텍스트(피드/갤러리/멤버 상세 등)에서 열 때 전달.
   * - 좋아요 토글이 이 클럽 기준으로 귀속됨 (workout_likes.club_id)
   * - 신고/차단은 클럽 컨텍스트가 있을 때만 노출 (club_id 필수 컬럼)
   * 페이지 모드(/workout/:id?clubId=...)에서는 URL 쿼리로 대체됨.
   */
  clubId?: string;
  /** 클럽 피드에서 차단 처리 후 목록에서 바로 빼고 싶을 때 */
  onBlock?: (userId: string) => void;
}

export const WorkoutDetail = ({ workoutData: propWorkout, workoutId: propWorkoutId, onClose, clubId, onBlock }: WorkoutDetailProps = {}) => {
  const isModal = !!onClose;
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const highlightCommentId = isModal ? null : searchParams.get('commentId');
  const clubIdParam = isModal ? null : searchParams.get('clubId');
  const effectiveClubId = clubId ?? clubIdParam ?? undefined;
  const { user, loading: authLoading } = useAuth();

  const [workout, setWorkout] = useState<Workout | null>(propWorkout || location.state?.workout || null);
  const [loading, setLoading] = useState(!workout);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 기록 소유자 표시용 — 클럽 컨텍스트면 클럽 전용 닉네임/프로필을 우선 사용
  const [owner, setOwner] = useState<{ name: string; image: string | null } | null>(null);

  // 좋아요 (전체 클럽 합산 — 보기 전용)
  const [totalLikes, setTotalLikes] = useState(0);
  const [showLikeStats, setShowLikeStats] = useState(false);

  // 좋아요 (이 클럽 기준 — 토글 가능, clubId 있을 때만)
  const [clubLike, setClubLike] = useState<{ count: number; isLiked: boolean } | null>(null);
  const [liking, setLiking] = useState(false);

  // 댓글
  const [totalComments, setTotalComments] = useState(0);

  // 신고/차단 (클럽 컨텍스트 + 남의 글일 때만)
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const goBack = (changed = false) => {
    if (onClose) { onClose(changed); return; }
    window.history.length > 1 ? navigate(-1) : navigate('/');
  };

  // 바텀시트로 열려있는 동안 하단 네비게이션 숨김
  useEffect(() => {
    if (!isModal) return;
    document.body.classList.add('workout-detail-open');
    return () => document.body.classList.remove('workout-detail-open');
  }, [isModal]);

  // 초기 로드: clubIdParam이 있으면 멤버십 체크 후 워크아웃 로드, 없으면 바로 로드
  useEffect(() => {
    if (isModal || !id) return;

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

  // 모달 모드에서 workoutData 없이 workoutId만 받은 경우 (예: 갤러리 썸네일) 자체 조회
  useEffect(() => {
    if (!isModal || workout || !propWorkoutId) return;
    loadWorkout(propWorkoutId);
  }, [isModal, workout, propWorkoutId]);

  // 기록 소유자 정보 로드. 클럽 컨텍스트에서는 그 클럽 전용 닉네임/프로필 사진을 우선 쓰고,
  // 설정이 없으면 전역 users 값으로 폴백한다. (본인 기록도 헤더에 표시하므로 항상 조회)
  useEffect(() => {
    if (!workout) return;
    let cancelled = false;

    const fetchOwner = async () => {
      try {
        let name: string | null = null;
        let image: string | null = null;

        if (effectiveClubId) {
          const { data: member } = await supabase
            .from('club_members')
            .select('club_nickname, club_profile_image')
            .eq('club_id', effectiveClubId)
            .eq('user_id', workout.user_id)
            .maybeSingle();
          name = member?.club_nickname ?? null;
          image = member?.club_profile_image ?? null;
        }

        if (!name || !image) {
          const { data: u } = await supabase
            .from('users')
            .select('display_name, profile_image')
            .eq('id', workout.user_id)
            .maybeSingle();
          name = name ?? u?.display_name ?? null;
          image = image ?? u?.profile_image ?? null;
        }

        if (!cancelled && name) setOwner({ name, image });
      } catch (err) {
        console.error('[운동상세] 기록자 정보 조회 실패:', JSON.stringify(err), err);
      }
    };

    fetchOwner();
    return () => { cancelled = true; };
  }, [workout?.user_id, effectiveClubId]);

  // 좋아요 개수 로드 (전체 클럽 합산)
  useEffect(() => {
    if (workout) {
      loadTotalLikes();
    }
  }, [workout]);

  // 이 클럽 기준 좋아요 상태 로드
  useEffect(() => {
    loadClubLikeState();
  }, [workout?.id, effectiveClubId, user?.id]);

  const loadWorkout = async (targetId?: string) => {
    const wid = targetId || id;
    if (!wid) {
      if (!isModal) navigate('/');
      return;
    }

    setLoading(true);
    try {
      const data = await workoutService.getWorkoutById(wid);
      if (!data) {
        if (!isModal) navigate('/');
        return;
      }
      setWorkout(data);
    } catch (error) {
      console.error('[운동상세] 조회 실패:', JSON.stringify(error), error);
      if (!isModal) navigate('/');
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

  const loadClubLikeState = async () => {
    if (!workout || !effectiveClubId) {
      setClubLike(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('workout_likes')
        .select('user_id')
        .eq('workout_id', workout.id)
        .eq('club_id', effectiveClubId);
      if (error) throw error;
      const rows = data || [];
      setClubLike({ count: rows.length, isLiked: !!user && rows.some((r) => r.user_id === user.id) });
    } catch (error) {
      console.error('[운동상세] 클럽 좋아요 조회 실패:', JSON.stringify(error), error);
    }
  };

  const handleClubLikeToggle = async () => {
    if (!workout || !effectiveClubId || !user || liking) return;
    const wasLiked = clubLike?.isLiked ?? false;
    setLiking(true);
    setClubLike((prev) => (prev ? { count: prev.count + (wasLiked ? -1 : 1), isLiked: !wasLiked } : prev));
    setTotalLikes((prev) => prev + (wasLiked ? -1 : 1));
    try {
      await feedService.toggleLike(workout.id, effectiveClubId, user.id, wasLiked);
    } catch (error: any) {
      console.error('[운동상세] 좋아요 토글 실패:', JSON.stringify(error), error);
      setClubLike((prev) => (prev ? { count: prev.count + (wasLiked ? 1 : -1), isLiked: wasLiked } : prev));
      setTotalLikes((prev) => prev + (wasLiked ? 1 : -1));
      alert(`좋아요 처리 실패: ${error?.message || JSON.stringify(error)}`);
    } finally {
      setLiking(false);
    }
  };

  const handleReport = async () => {
    if (!user || !workout || !effectiveClubId || !selectedReason) return;
    setSubmitting(true);
    try {
      await feedService.reportContent(user.id, workout.user_id, workout.id, effectiveClubId, selectedReason);
      setShowReportModal(false);
      setSelectedReason('');
      alert('신고가 접수되었습니다.');
    } catch (error: any) {
      console.error('[운동상세] 신고 실패:', JSON.stringify(error), error);
      alert(`신고 처리에 실패했습니다: ${error?.message || JSON.stringify(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlock = async () => {
    if (!user || !workout || !effectiveClubId) return;
    setSubmitting(true);
    try {
      await feedService.blockUser(user.id, workout.user_id, effectiveClubId);
      setShowBlockConfirm(false);
      onBlock?.(workout.user_id);
      goBack(true);
    } catch (error: any) {
      console.error('[운동상세] 차단 실패:', JSON.stringify(error), error);
      alert(`차단 처리에 실패했습니다: ${error?.message || JSON.stringify(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !workout) {
    const loadingBody = loading ? (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>운동 정보 불러오는 중...</p>
      </div>
    ) : null;

    if (!isModal) {
      return loadingBody ? <div className="container">{loadingBody}</div> : null;
    }
    if (!loadingBody) return null;
    return createPortal(
      <div className="workout-sheet-overlay" onClick={() => goBack()}>
        <div className="workout-sheet" onClick={(e) => e.stopPropagation()} style={{ minHeight: 200 }}>
          <div className="workout-sheet-handle" />
          {loadingBody}
        </div>
      </div>,
      document.body
    );
  }

  const isMyPost = user?.id === workout.user_id;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date
      .getHours()
      .toString()
      .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatMovingTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  };

  // 연동 기록 페이스/속도 — average_speed 없으면 (moving ?? elapsed) + 거리로 계산
  const formatConnectedPace = () => {
    const secs = workout.moving_seconds ?? workout.elapsed_seconds;
    const val = workout.value;
    // '걷기'는 Health Connect 연동으로만 들어와 WorkoutCategory 유니온에 없음
    const cat = workout.category as string;
    if (secs && val > 0) {
      if ((cat === '달리기' || cat === '걷기') && workout.unit === 'km') {
        const secPerKm = secs / val;
        const m = Math.floor(secPerKm / 60);
        const s = Math.round(secPerKm % 60);
        return `페이스 ${m}'${String(s).padStart(2, '0')}"/km`;
      }
      if (workout.category === '수영' && workout.unit === 'm') {
        const secPer100m = secs / (val / 100);
        const m = Math.floor(secPer100m / 60);
        const s = Math.round(secPer100m % 60);
        return `페이스 ${m}'${String(s).padStart(2, '0')}"/100m`;
      }
      if ((workout.category === '사이클' || workout.category === '로잉') && workout.unit === 'km') {
        const kmh = workout.average_speed ? workout.average_speed * 3.6 : val / (secs / 3600);
        return `평균 ${kmh.toFixed(1)} km/h`;
      }
    }
    if (workout.average_speed != null) {
      return `평균 ${(workout.average_speed * 3.6).toFixed(1)} km/h`;
    }
    return null;
  };

  const getWorkoutLabel = () => {
    if (workout.category === '복싱') {
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

  // 프로필 이미지는 'default:#색상' 형식이면 색 배경 + 이니셜로 렌더한다
  const renderOwnerAvatar = () => {
    if (!owner) return null;
    const initial = owner.name[0]?.toUpperCase() ?? '?';
    if (owner.image?.startsWith('default:')) {
      return (
        <div className="detail-owner-avatar" style={{ background: owner.image.replace('default:', '') }}>
          {initial}
        </div>
      );
    }
    if (owner.image) {
      return <img src={owner.image} alt={owner.name} className="detail-owner-avatar" />;
    }
    return (
      <div className="detail-owner-avatar" style={{ background: 'var(--gradient-primary)' }}>
        {initial}
      </div>
    );
  };

  const handleDelete = async () => {
    if (!confirm('정말로 이 운동 기록을 삭제하시겠습니까?')) {
      return;
    }

    setDeleting(true);

    try {
      await workoutService.deleteWorkout(workout.id);
      alert('운동 기록이 삭제되었습니다.');
      goBack(true);
    } catch (error) {
      console.error('운동 기록 삭제 실패:', error);
      alert('운동 기록 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const detailContent = (
    <div className={isModal ? 'workout-detail-modal-content' : 'container workout-detail-page'}>
      {isModal ? (
        <div className="detail-header-modal">
          {owner ? (
            <div className="detail-header-owner">
              {renderOwnerAvatar()}
              <h1>{owner.name}님의 기록</h1>
            </div>
          ) : (
            <h1>운동 상세</h1>
          )}
          <button className="detail-modal-close" onClick={() => goBack()}>
            <X size={22} />
          </button>
        </div>
      ) : (
        <div className="detail-header">
          <button className="back-button" onClick={() => goBack()}>
            <ChevronLeft size={24} />
          </button>
          <h1>{owner ? `${owner.name}님의 기록` : '운동 상세'}</h1>
        </div>
      )}

      <div className="detail-content">
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

        {workout.source && workout.source !== 'manual' && (
          workout.elapsed_seconds != null || workout.moving_seconds != null || workout.average_speed != null ||
          workout.average_heartrate != null || workout.max_heartrate != null ||
          workout.calories != null || workout.steps != null || workout.elevation_gain != null ||
          workout.device_name != null
        ) && (
          <div className="strava-source-card" style={{ background: workout.source === 'strava' ? '#fff5f2' : workout.source === 'apple_health' ? '#fff0f3' : '#f0f6ff', borderColor: workout.source === 'strava' ? '#ffd5c8' : workout.source === 'apple_health' ? '#ffcdd6' : '#c5d8ff' }}>
            <div className="strava-source-title" style={{ color: getSourceColor(workout.source) }}>
              <WorkoutSourceIcon source={workout.source} size={14} />
              {getSourceLabel(workout.source)} 연동 기록
            </div>
            <div className="strava-source-metrics">
              {workout.moving_seconds != null ? (
                <span>이동 {formatMovingTime(workout.moving_seconds)}</span>
              ) : workout.elapsed_seconds != null ? (
                <span>운동 시간 {formatMovingTime(workout.elapsed_seconds)}</span>
              ) : null}
              {formatConnectedPace() && (
                <span>{formatConnectedPace()}</span>
              )}
              {workout.average_heartrate != null && (
                <span>심박 {Math.round(workout.average_heartrate)} bpm</span>
              )}
              {workout.max_heartrate != null && (
                <span>최고 심박 {Math.round(workout.max_heartrate)} bpm</span>
              )}
              {workout.calories != null && (
                <span>{workout.calories} kcal</span>
              )}
              {workout.steps != null && (
                <span>{workout.steps.toLocaleString()} 보</span>
              )}
              {workout.elevation_gain != null && (
                <span>고도 +{workout.elevation_gain} m</span>
              )}
              {workout.device_name != null && (
                <span>{workout.device_name}</span>
              )}
            </div>
          </div>
        )}

        <div className="detail-section">
          <div className="detail-label">체감 난이도</div>
          <div
            className="detail-value"
            style={{ color: getIntensityColor(workout.intensity), fontWeight: 600 }}
          >
            {getIntensityLabel(workout.intensity)}
          </div>
        </div>

        {/* 좋아요 섹션 — 클럽 컨텍스트면 이 클럽 기준 토글, 아니면 전체 클럽 합산 보기 전용 */}
        <div className="detail-section">
          <div className="detail-label">좋아요</div>
          <div className="detail-value like-stats-row">
            {effectiveClubId ? (
              <button
                className={`sheet-action-btn ${clubLike?.isLiked ? 'liked' : ''}`}
                onClick={handleClubLikeToggle}
                disabled={liking}
              >
                <Heart size={15} fill={clubLike?.isLiked ? 'currentColor' : 'none'} />
                {clubLike?.count ?? 0}
              </button>
            ) : (
              <span>❤ {totalLikes}개</span>
            )}
            {totalLikes > 0 && (
              <button
                className="view-details-btn"
                onClick={() => setShowLikeStats(true)}
              >
                {effectiveClubId ? `전체 클럽 합산 ${totalLikes}개 →` : '상세 보기 →'}
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

        {/* 신고/차단 — 클럽 컨텍스트에서 남의 글일 때만 */}
        {!isMyPost && effectiveClubId && (
          <div className="workout-detail-actions">
            <button
              className="detail-action-btn detail-action-report"
              onClick={() => setShowReportModal(true)}
            >
              신고하기
            </button>
            <button
              className="detail-action-btn detail-action-block"
              onClick={() => setShowBlockConfirm(true)}
            >
              차단하기
            </button>
          </div>
        )}
      </div>

      {/* 고정 액션 버튼 (본인 글만) */}
      {isMyPost && (
        <div className="detail-actions-fixed">
          <button className="action-button-full" onClick={() => navigate('/add-workout', { state: { editWorkout: workout } })}>
            <Edit2 size={18} />
            수정
          </button>
          <button className="action-button-full danger" onClick={handleDelete} disabled={deleting}>
            <Trash2 size={18} />
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      )}

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

      {/* 신고 모달 */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content" style={{ maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>신고하기</h2>
              <button className="modal-close" onClick={() => setShowReportModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                신고 사유를 선택해주세요.
              </p>
              <div className="report-reasons">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    className={`report-reason-btn ${selectedReason === reason ? 'selected' : ''}`}
                    onClick={() => setSelectedReason(reason)}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <button
                className="btn-primary"
                style={{ width: '100%', marginTop: 20 }}
                onClick={handleReport}
                disabled={!selectedReason || submitting}
              >
                {submitting ? '처리 중...' : '신고 제출'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 차단 확인 모달 */}
      {showBlockConfirm && (
        <div className="modal-overlay" onClick={() => setShowBlockConfirm(false)}>
          <div className="modal-content" style={{ maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>차단하기</h2>
              <button className="modal-close" onClick={() => setShowBlockConfirm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 20, lineHeight: 1.6 }}>
                <strong>{owner?.name || '이 사용자'}</strong>님을 차단하시겠어요?<br />
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  차단하면 이 클럽 피드에서 해당 유저의 게시물이 나에게만 보이지 않습니다.
                </span>
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowBlockConfirm(false)}
                >
                  취소
                </button>
                <button
                  className="btn-danger"
                  style={{ flex: 1 }}
                  onClick={handleBlock}
                  disabled={submitting}
                >
                  {submitting ? '처리 중...' : '차단하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return createPortal(
      <div className="workout-sheet-overlay" onClick={() => goBack()}>
        <div className="workout-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="workout-sheet-handle" />
          {detailContent}
        </div>
      </div>,
      document.body
    );
  }
  return detailContent;
};
