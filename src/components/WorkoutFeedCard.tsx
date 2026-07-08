import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Heart, MessageCircle, MoreVertical, Share, Copy, CircleOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import feedService from '../services/feedService';
import { CommentSection } from './CommentSection';
import { WorkoutSourceIcon, getSourceLabel, getSourceColor } from './WorkoutSourceIcon';
import type { WorkoutFeedItem } from '../services/feedService';

const REPORT_REASONS = ['스팸', '욕설/혐오발언', '부적절한 내용', '기타'];

// Kakao SDK 타입 선언
declare global {
  interface Window {
    Kakao: any;
  }
}

interface Props {
  item: WorkoutFeedItem;
  clubId: string;
  clubName: string;
  onOptimisticLike: (workoutId: string, isLiked: boolean) => void;
  onOptimisticCommentAdd: (workoutId: string) => void;
  onOptimisticCommentDelete: (workoutId: string) => void;
  onBlock: (userId: string) => void;
  onMemberClick: (userId: string, userName: string) => void;
}

export const WorkoutFeedCard = ({
  item,
  clubId,
  clubName,
  onOptimisticLike,
  onOptimisticCommentAdd,
  onOptimisticCommentDelete,
  onBlock,
  onMemberClick,
}: Props) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 메뉴 외부 클릭 감지
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // 운동상세 시트 열릴 때 BottomNav 숨김
  useEffect(() => {
    if (showDetail) {
      document.body.classList.add('workout-detail-open');
    } else {
      document.body.classList.remove('workout-detail-open');
    }
    return () => document.body.classList.remove('workout-detail-open');
  }, [showDetail]);

  const isMyPost = user?.id === item.workout.user_id;

  const handleReport = async () => {
    if (!user || !selectedReason) return;
    setSubmitting(true);
    try {
      await feedService.reportContent(user.id, item.workout.user_id, item.workout.id, clubId, selectedReason);
      setShowReportModal(false);
      setSelectedReason('');
      alert('신고가 접수되었습니다.');
    } catch {
      alert('신고 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlock = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      await feedService.blockUser(user.id, item.workout.user_id, clubId);
      setShowBlockConfirm(false);
      onBlock(item.workout.user_id);
    } catch (err: any) {
      alert('차단 처리에 실패했습니다.\n' + (err?.message || JSON.stringify(err)));
    } finally {
      setSubmitting(false);
    }
  };

  // 카카오톡으로 공유하기
  const handleKakaoShare = () => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      alert('카카오톡 공유 기능을 사용할 수 없습니다.');
      return;
    }

    const workoutLabel = getWorkoutLabel();
    const appUrl = `${window.location.origin}/workout/${workout.id}?clubId=${clubId}`;

    // 날짜 포맷팅
    const workoutDate = new Date(workout.workout_time);
    const dateStr = `${workoutDate.getFullYear()}.${String(workoutDate.getMonth() + 1).padStart(2, '0')}.${String(workoutDate.getDate()).padStart(2, '0')}`;

    const shareTitle = `[${clubName}] ${item.club_nickname ?? '회원'}님 (${dateStr})`;

    // 피드 로드 시 계산된 운동 번호 사용 (비동기 호출 없음)
    const numberText = item.workout_number ? `\n오늘 클럽 ${item.workout_number}번째` : '';
    const shareDescription = `${workoutLabel}: ${workout.value}${workout.unit}${numberText}`;

    try {
      const shareData: any = {
        objectType: 'feed',
        content: {
          title: shareTitle,
          description: shareDescription,
          link: {
            mobileWebUrl: appUrl,
            webUrl: appUrl,
          },
        },
        buttons: [
          {
            title: '나도 기록하기',
            link: {
              mobileWebUrl: appUrl,
              webUrl: appUrl,
            },
          },
        ],
      };

      // imageUrl은 존재할 때만 추가 (undefined 방지)
      if (workout.proof_image) {
        shareData.content.imageUrl = workout.proof_image;
      }

      console.log('카카오 공유 데이터:', shareData);
      window.Kakao.Share.sendDefault(shareData);
      setShowMenu(false);
    } catch (error) {
      console.error('카카오톡 공유 실패:', error);
      alert('카카오톡 공유에 실패했습니다.');
    }
  };

  // 텍스트 복사하기
  const handleCopyText = async () => {
    const workoutLabel = getWorkoutLabel();
    const shareUrl = `${window.location.origin}/workout/${workout.id}?clubId=${clubId}`;

    // 날짜 포맷팅
    const workoutDate = new Date(workout.workout_time);
    const dateStr = `${workoutDate.getFullYear()}.${String(workoutDate.getMonth() + 1).padStart(2, '0')}.${String(workoutDate.getDate()).padStart(2, '0')}`;

    // 피드 로드 시 계산된 운동 번호 사용
    let shareText = `[${clubName}] ${item.club_nickname ?? '회원'}님 (${dateStr})\n`;
    shareText += `${workoutLabel}: ${workout.value}${workout.unit}\n`;
    if (item.workout_number) {
      shareText += `오늘 클럽 ${item.workout_number}번째\n`;
    }

    if (workout.proof_image) {
      shareText += `\n📸 인증샷: ${workout.proof_image}\n`;
    }

    shareText += `\n🔗 자세히 보기: ${shareUrl}`;

    try {
      // 최신 Clipboard API 시도
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        // Fallback: 구형 방식
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      alert('클립보드에 복사되었습니다!\n카카오톡에 붙여넣기 하세요.');
      setShowMenu(false);
    } catch (error) {
      console.error('복사 실패:', error);
      alert('복사에 실패했습니다.');
    }
  };

  const { workout } = item;

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

  const renderAvatar = (profileImage: string | undefined, displayName: string, className: string) => {
    if (profileImage?.startsWith('default:')) {
      // default:color 형식 - 색상 아바타
      const color = profileImage.replace('default:', '');
      return (
        <div
          className={className}
          style={{ background: color, color: 'white' }}
        >
          {displayName[0].toUpperCase()}
        </div>
      );
    } else if (profileImage) {
      // URL 형식 - 이미지
      return <img src={profileImage} alt={displayName} className={className} />;
    } else {
      // 프로필 이미지 없음 - 기본 그라데이션
      return (
        <div
          className={className}
          style={{ background: 'linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%)' }}
        >
          {displayName[0]}
        </div>
      );
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getIntensityLabel = (intensity: number) => {
    if (intensity <= 2) return '편안';
    if (intensity <= 4) return '경쾌';
    if (intensity <= 6) return '자극';
    if (intensity <= 8) return '고강도';
    return '한계돌파';
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity <= 2) return '#4ade80'; // green
    if (intensity <= 4) return '#22c55e'; // green
    if (intensity <= 6) return '#eab308'; // yellow
    if (intensity <= 8) return '#f97316'; // orange
    if (intensity === 9) return '#ef4444'; // red
    return '#dc2626'; // dark red
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}시간 ${m}분 ${String(s).padStart(2, '0')}초`;
    return `${m}분 ${String(s).padStart(2, '0')}초`;
  };

  const getStravaSpeedLabel = () => {
    // '걷기'는 Health Connect 연동으로만 들어와 WorkoutCategory 유니온에 없음
    const cat = workout.category as string;
    if (cat === '달리기') return '페이스';
    if (cat === '걷기') return '페이스';
    if (cat === '수영') return '페이스';
    return '속도';
  };

  // moving_seconds 없는 소스(apple/google health)는 elapsed_seconds로 계산
  const formatStravaSpeed = () => {
    const mv = workout.moving_seconds ?? workout.elapsed_seconds;
    const val = workout.value;
    const cat = workout.category as string;
    if ((cat === '달리기' || cat === '걷기') && mv && val > 0) {
      const secPerKm = mv / val;
      const m = Math.floor(secPerKm / 60);
      const s = Math.round(secPerKm % 60);
      return `${m}'${String(s).padStart(2, '0')}"/km`;
    }
    if (workout.category === '수영' && mv && val > 0) {
      const secPer100m = mv / (val / 100);
      const m = Math.floor(secPer100m / 60);
      const s = Math.round(secPer100m % 60);
      return `${m}'${String(s).padStart(2, '0')}"/100m`;
    }
    if (workout.category === '사이클' || workout.category === '로잉') {
      if (workout.average_speed) return `${(workout.average_speed * 3.6).toFixed(1)} km/h`;
      if (mv && val > 0 && workout.unit === 'km') return `${(val / (mv / 3600)).toFixed(1)} km/h`;
    }
    return null;
  };

  const handleLikeToggle = async () => {
    if (!user || liking) return;

    setLiking(true);

    // Optimistic Update: UI 즉시 업데이트
    onOptimisticLike(workout.id, item.is_liked_by_me);

    try {
      // 백그라운드로 DB 업데이트
      await feedService.toggleLike(workout.id, clubId, user.id, item.is_liked_by_me);
    } catch (error) {
      console.error('좋아요 토글 실패:', error);
      // 실패 시 롤백
      onOptimisticLike(workout.id, !item.is_liked_by_me);
      alert('좋아요 처리에 실패했습니다.');
    } finally {
      setLiking(false);
    }
  };

  return (
    <div className={`feed-card ${item.is_disabled ? 'feed-card-disabled' : ''} ${isMyPost ? 'feed-card-my-post' : ''}`}>
      {/* 비활성화 배지 */}
      {item.is_disabled && (
        <div className="feed-disabled-badge">
          <CircleOff size={11} />
          미적립
        </div>
      )}

      {/* 더보기/공유 버튼 */}
      <div className="feed-more-wrapper" ref={menuRef}>
        <button
          className="feed-more-btn"
          onClick={() => setShowMenu(v => !v)}
          title={isMyPost ? '공유하기' : '더보기'}
        >
          {isMyPost ? <Share size={16} /> : <MoreVertical size={16} />}
        </button>
        {showMenu && (
          <div className="feed-more-menu">
            {/* 공유 옵션 (내 글만) */}
            {isMyPost && (
              <>
                <button onClick={handleKakaoShare}>
                  <Share size={14} style={{ marginRight: 8 }} />
                  카톡으로 공유
                </button>
                <button onClick={handleCopyText}>
                  <Copy size={14} style={{ marginRight: 8 }} />
                  텍스트 복사
                </button>
              </>
            )}

            {/* 신고/차단 (남의 글만) */}
            {!isMyPost && (
              <>
                <button onClick={() => { setShowMenu(false); setShowReportModal(true); }}>
                  신고하기
                </button>
                <button onClick={() => { setShowMenu(false); setShowBlockConfirm(true); }}>
                  차단하기
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 전체 래퍼: 프사(왼쪽 2줄) + 내용(오른쪽 2줄) */}
      <div className="feed-card-wrapper">
        {/* 왼쪽: 프로필 사진 (2줄 고정) */}
        <div className="feed-avatar-wrapper">
          {renderAvatar(item.user_profile_image, item.user_display_name, item.user_profile_image ? 'feed-user-avatar-v2' : 'feed-user-avatar-placeholder-v2')}
        </div>

        {/* 오른쪽: 내용 */}
        <div className="feed-content-wrapper">
          {/* 첫째 줄: 이름 + 시간 + 운동종목 */}
          <div className="feed-header-line" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>
            <span
              className="feed-user-name-v2"
              onClick={(e) => {
                e.stopPropagation();
                onMemberClick(item.workout.user_id, item.user_display_name);
              }}
            >
              {item.user_display_name}
            </span>
            <span className="feed-time-v2">{formatTime(workout.workout_time)}</span>
            <span className="feed-workout-type-v2">
              {getWorkoutLabel()}
            </span>
          </div>

          {/* 둘째 줄: 데이터 + 좋아요/댓글 */}
          <div className="feed-data-line">
            <div className="feed-workout-value-v2" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>
              {workout.value} {workout.unit}
            </div>
            <div className="feed-actions-v2">
              <button
                className={`feed-action-btn-v2 ${item.is_liked_by_me ? 'liked' : ''}`}
                onClick={handleLikeToggle}
                disabled={liking}
              >
                <Heart size={14} fill={item.is_liked_by_me ? 'currentColor' : 'none'} />
                <span>{item.like_count}</span>
              </button>

              <button className="feed-action-btn-v2" onClick={() => setShowComments(!showComments)}>
                <MessageCircle size={14} />
                <span>{item.comment_count}</span>
              </button>
            </div>
          </div>

          {/* 메모 */}
          {workout.memo && (
            <div className="feed-memo" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>{workout.memo}</div>
          )}
        </div>
      </div>

      {/* 댓글 섹션 */}
      {showComments && (
        <CommentSection
          workoutId={workout.id}
          clubId={clubId}
          onCommentAdded={() => onOptimisticCommentAdd(workout.id)}
          onCommentDeleted={() => onOptimisticCommentDelete(workout.id)}
        />
      )}

      {/* 신고 모달 */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content" style={{ maxWidth: 320 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>신고하기</h2>
              <button className="modal-close" onClick={() => setShowReportModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                신고 사유를 선택해주세요.
              </p>
              <div className="report-reasons">
                {REPORT_REASONS.map(reason => (
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
          <div className="modal-content" style={{ maxWidth: 320 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>차단하기</h2>
              <button className="modal-close" onClick={() => setShowBlockConfirm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 20, lineHeight: 1.6 }}>
                <strong>{item.user_display_name}</strong>님을 차단하시겠어요?<br />
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

      {/* 상세보기 바텀시트 */}
      {showDetail && createPortal(
        <div className="workout-sheet-overlay" onClick={() => setShowDetail(false)}>
          <div className="workout-sheet" onClick={(e) => e.stopPropagation()}>
            {/* 고정 헤더 */}
            <div className="workout-sheet-header">
              <h2>운동 상세</h2>
              <button className="modal-close" onClick={() => setShowDetail(false)}>
                ✕
              </button>
            </div>
            {/* 스크롤 바디 */}
            <div className="workout-sheet-body">
              <div className="workout-detail-section">
                <h3>운동 정보</h3>
                <div className="workout-detail-info">
                  <div className="workout-detail-row">
                    <span className="label">종류</span>
                    <span className="value">
                      {getWorkoutLabel()}
                      {getRatioDisplay() && (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {getRatioDisplay()}
                        </div>
                      )}
                    </span>
                  </div>
                  <div className="workout-detail-row">
                    <span className="label">거리/시간</span>
                    <span className="value">
                      {workout.value} {workout.unit}
                    </span>
                  </div>
                  <div className="workout-detail-row">
                    <span className="label">체감 난이도</span>
                    <span
                      className="value intensity-value"
                      style={{ color: getIntensityColor(workout.intensity) }}
                    >
                      {getIntensityLabel(workout.intensity)}
                    </span>
                  </div>
                  {/* 마일리지는 클럽별로 다르므로 표시하지 않음 */}
                  <div className="workout-detail-row">
                    <span className="label">시간</span>
                    <span className="value">
                      {new Date(workout.workout_time).toLocaleString('ko-KR')}
                    </span>
                  </div>
                </div>
              </div>

              {workout.source && workout.source !== 'manual' && (
                workout.elapsed_seconds || workout.moving_seconds || workout.average_heartrate || workout.max_heartrate ||
                workout.device_name || workout.calories || workout.steps || workout.elevation_gain
              ) && (
                <div className="workout-detail-section">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, color: getSourceColor(workout.source) }}>
                    <WorkoutSourceIcon source={workout.source} size={14} />
                    {getSourceLabel(workout.source)} 데이터
                  </h3>
                  <div className="workout-detail-info">
                    {workout.moving_seconds ? (
                      <div className="workout-detail-row">
                        <span className="label">이동 시간</span>
                        <span className="value">{formatDuration(workout.moving_seconds)}</span>
                      </div>
                    ) : workout.elapsed_seconds ? (
                      <div className="workout-detail-row">
                        <span className="label">운동 시간</span>
                        <span className="value">{formatDuration(workout.elapsed_seconds)}</span>
                      </div>
                    ) : null}
                    {formatStravaSpeed() && (
                      <div className="workout-detail-row">
                        <span className="label">{getStravaSpeedLabel()}</span>
                        <span className="value">{formatStravaSpeed()}</span>
                      </div>
                    )}
                    {workout.average_heartrate ? (
                      <div className="workout-detail-row">
                        <span className="label">평균 심박수</span>
                        <span className="value">{Math.round(workout.average_heartrate)} bpm</span>
                      </div>
                    ) : null}
                    {workout.max_heartrate ? (
                      <div className="workout-detail-row">
                        <span className="label">최고 심박수</span>
                        <span className="value">{Math.round(workout.max_heartrate)} bpm</span>
                      </div>
                    ) : null}
                    {workout.calories ? (
                      <div className="workout-detail-row">
                        <span className="label">칼로리</span>
                        <span className="value">{workout.calories} kcal</span>
                      </div>
                    ) : null}
                    {workout.steps ? (
                      <div className="workout-detail-row">
                        <span className="label">걸음수</span>
                        <span className="value">{workout.steps.toLocaleString()} 보</span>
                      </div>
                    ) : null}
                    {workout.elevation_gain ? (
                      <div className="workout-detail-row">
                        <span className="label">누적 고도</span>
                        <span className="value">{workout.elevation_gain} m</span>
                      </div>
                    ) : null}
                    {workout.device_name ? (
                      <div className="workout-detail-row">
                        <span className="label">기록 기기</span>
                        <span className="value">{workout.device_name}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {workout.memo && (
                <div className="workout-detail-section">
                  <h3>메모</h3>
                  <p className="workout-detail-memo">{workout.memo}</p>
                </div>
              )}

              {workout.proof_image && (
                <div className="workout-detail-section">
                  <h3>인증 사진</h3>
                  <div className="workout-detail-image">
                    <img src={workout.proof_image} alt="운동 인증" />
                  </div>
                </div>
              )}

              <div className="workout-detail-section">
                <h3>기록자</h3>
                <div className="workout-detail-user">
                  {renderAvatar(item.user_profile_image, item.user_display_name, 'user-avatar-placeholder')}
                  <span>{item.user_display_name}</span>
                </div>
              </div>

              {/* 신고/차단 버튼 (내 글 제외) */}
              {!isMyPost && (
                <div className="workout-detail-actions">
                  <button
                    className="detail-action-btn detail-action-report"
                    onClick={() => { setShowDetail(false); setShowReportModal(true); }}
                  >
                    신고하기
                  </button>
                  <button
                    className="detail-action-btn detail-action-block"
                    onClick={() => { setShowDetail(false); setShowBlockConfirm(true); }}
                  >
                    차단하기
                  </button>
                </div>
              )}
            </div>
            {/* 고정 액션바 */}
            <div className="workout-sheet-footer">
              <button
                className={`sheet-action-btn ${item.is_liked_by_me ? 'liked' : ''}`}
                onClick={handleLikeToggle}
                disabled={liking}
              >
                <Heart size={18} fill={item.is_liked_by_me ? 'currentColor' : 'none'} />
                <span>{item.like_count}</span>
              </button>
              <button
                className="sheet-action-btn"
                onClick={() => { setShowDetail(false); setShowComments(true); }}
              >
                <MessageCircle size={18} />
                <span>{item.comment_count}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
