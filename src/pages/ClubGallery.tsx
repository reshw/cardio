import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useClubName } from '../hooks/useClubName';
import { usePageHeader } from '../contexts/PageHeaderContext';
import photoGalleryService from '../services/photoGalleryService';
import type { GalleryPhoto } from '../services/photoGalleryService';
import { WorkoutDetail } from './WorkoutDetail';

type SortOrder = 'new' | 'old' | 'nick';

/**
 * 날짜 처리는 전부 KST(UTC+9) 기준.
 * workout_time은 timestamptz(UTC)로 저장되므로 UTC 기준으로 자르면
 * 한국 시간 00:00~09:00 기록이 전날로 밀려버린다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** UTC 인스턴트 → KST 달력 날짜 키 (YYYY-MM-DD) */
function kstDateKey(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC 인스턴트 → KST 시:분 */
function kstTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → '7월 25일 (토)' */
function kstDateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const wday = WDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${wday})`;
}

export const ClubGallery = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);

  // 글로벌 헤더에 이 페이지의 제목/뒤로가기를 주입 (헤더 두 겹 방지)
  usePageHeader({
    title: '사진 갤러리',
    subtitle: clubName ? `클럽 · ${clubName}` : '클럽',
    showBack: true,
  });

  const todayKey = useMemo(() => kstDateKey(new Date().toISOString()), []);
  const monthAgoKey = useMemo(
    () => kstDateKey(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    []
  );

  const [startDate, setStartDate] = useState(monthAgoKey);
  const [endDate, setEndDate] = useState(todayKey);
  const [unbounded, setUnbounded] = useState(false);

  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOrder>('new');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    if (clubId) loadPhotos();
  }, [clubId, startDate, endDate, unbounded]);

  const loadPhotos = async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      // 경계값에 +09:00을 명시하지 않으면 Postgres가 UTC로 해석해 KST 기준 하루가 어긋난다
      const from = unbounded ? undefined : `${startDate}T00:00:00+09:00`;
      const to = unbounded ? undefined : `${endDate}T23:59:59.999+09:00`;
      const result = await photoGalleryService.getClubPhotos(clubId, from, to);
      setPhotos(result.photos);
      setTruncated(result.truncated);
    } catch (error: any) {
      console.error('[클럽 갤러리] 사진 조회 실패:', JSON.stringify(error), error);
      alert(`사진을 불러오지 못했습니다: ${error?.message || error?.error_description || JSON.stringify(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const visiblePhotos = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? photos.filter((p) => p.nickname.toLowerCase().includes(q)) : [...photos];
    if (sort === 'new') list.sort((a, b) => new Date(b.workoutTime).getTime() - new Date(a.workoutTime).getTime());
    if (sort === 'old') list.sort((a, b) => new Date(a.workoutTime).getTime() - new Date(b.workoutTime).getTime());
    if (sort === 'nick') list.sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));
    return list;
  }, [photos, search, sort]);

  // 닉네임순일 땐 날짜 묶음이 의미가 없으므로 평면 그리드로 렌더
  const dateGroups = useMemo(() => {
    if (sort === 'nick') return null;
    const map = new Map<string, GalleryPhoto[]>();
    for (const p of visiblePhotos) {
      const key = kstDateKey(p.workoutTime);
      const bucket = map.get(key);
      if (bucket) bucket.push(p);
      else map.set(key, [p]);
    }
    return Array.from(map.entries());
  }, [visiblePhotos, sort]);

  const renderCard = (p: GalleryPhoto) => (
    <div className="gallery-card" key={p.id} onClick={() => setSelectedWorkoutId(p.id)}>
      <img src={p.url} alt="증빙" loading="lazy" />
      <div className="gallery-card-meta">
        <div className="gallery-card-nick">{p.nickname}</div>
        <div className="gallery-card-sub">
          {p.category}{p.subType ? ` · ${p.subType}` : ''}
        </div>
        <div className="gallery-card-time">{kstTime(p.workoutTime)}</div>
      </div>
    </div>
  );

  return (
    <div className="settings-page">
      <div className="gallery-controls">
        <div className="gallery-date-range">
          <input
            type="date"
            className="gallery-date-input"
            value={startDate}
            max={endDate}
            disabled={unbounded}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="gallery-date-sep">~</span>
          <input
            type="date"
            className="gallery-date-input"
            value={endDate}
            min={startDate}
            disabled={unbounded}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <button
            className={`gallery-range-toggle${unbounded ? ' active' : ''}`}
            onClick={() => setUnbounded((v) => !v)}
          >
            전체기간
          </button>
        </div>
        <div className="gallery-filter-row">
          <div className="gallery-search">
            <Search size={15} />
            <input placeholder="닉네임 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="gallery-sort" value={sort} onChange={(e) => setSort(e.target.value as SortOrder)}>
            <option value="new">최신순</option>
            <option value="old">오래된순</option>
            <option value="nick">닉네임순</option>
          </select>
        </div>
        <div className="gallery-count">
          {loading ? '불러오는 중...' : `${visiblePhotos.length}장 · ${new Set(visiblePhotos.map((p) => p.userId)).size}명`}
        </div>
        {!loading && truncated && (
          <div className="gallery-truncated-note">
            사진이 너무 많아 최근 것부터 일부만 표시했습니다. 기간을 좁혀주세요.
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>불러오는 중...</p>
        </div>
      ) : visiblePhotos.length === 0 ? (
        <div className="empty-state">
          <p>해당 기간에 등록된 증빙사진이 없습니다.</p>
        </div>
      ) : dateGroups ? (
        dateGroups.map(([dateKey, items]) => (
          <section className="gallery-date-section" key={dateKey}>
            <h2 className="gallery-date-heading">
              {kstDateLabel(dateKey)}
              <span className="gallery-date-heading-count">{items.length}장</span>
            </h2>
            <div className="gallery-grid">{items.map(renderCard)}</div>
          </section>
        ))
      ) : (
        <div className="gallery-grid">{visiblePhotos.map(renderCard)}</div>
      )}

      {selectedWorkoutId && clubId && (
        <WorkoutDetail
          workoutId={selectedWorkoutId}
          clubId={clubId}
          onClose={() => setSelectedWorkoutId(null)}
        />
      )}
    </div>
  );
};
