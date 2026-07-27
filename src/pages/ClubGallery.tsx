import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, X, Search } from 'lucide-react';
import { useClubName } from '../hooks/useClubName';
import photoGalleryService from '../services/photoGalleryService';
import type { GalleryPhoto } from '../services/photoGalleryService';

type SortOrder = 'new' | 'old' | 'nick';

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const ClubGallery = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const monthAgo = useMemo(() => new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), [today]);

  const [startDate, setStartDate] = useState(toDateInputValue(monthAgo));
  const [endDate, setEndDate] = useState(toDateInputValue(today));
  const [unbounded, setUnbounded] = useState(false);

  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOrder>('new');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (clubId) loadPhotos();
  }, [clubId, startDate, endDate, unbounded]);

  const loadPhotos = async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const from = unbounded ? undefined : `${startDate}T00:00:00`;
      const to = unbounded ? undefined : `${endDate}T23:59:59`;
      const data = await photoGalleryService.getClubPhotos(clubId, from, to);
      setPhotos(data);
    } catch (error: any) {
      console.error('[클럽 갤러리] 사진 조회 실패:', JSON.stringify(error), error);
      alert(`사진을 불러오지 못했습니다: ${error?.message || error?.error_description || JSON.stringify(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const visiblePhotos = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q ? photos.filter((p) => p.nickname.toLowerCase().includes(q)) : photos;
    list = [...list];
    if (sort === 'new') list.sort((a, b) => new Date(b.workoutTime).getTime() - new Date(a.workoutTime).getTime());
    if (sort === 'old') list.sort((a, b) => new Date(a.workoutTime).getTime() - new Date(b.workoutTime).getTime());
    if (sort === 'nick') list.sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));
    return list;
  }, [photos, search, sort]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>사진 갤러리</h1>
        </div>
      </div>

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
      ) : (
        <div className="gallery-grid">
          {visiblePhotos.map((p) => (
            <div className="gallery-card" key={p.id} onClick={() => setLightboxUrl(p.url)}>
              <img src={p.url} alt="증빙" loading="lazy" />
              <div className="gallery-card-meta">
                <div className="gallery-card-nick">{p.nickname}</div>
                <div className="gallery-card-sub">
                  {p.category}{p.subType ? ` · ${p.subType}` : ''}
                </div>
                <div className="gallery-card-time">{formatTime(p.workoutTime)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightboxUrl && (
        <div className="image-viewer-overlay" onClick={() => setLightboxUrl(null)}>
          <button className="image-viewer-close" onClick={() => setLightboxUrl(null)}>
            <X size={32} />
          </button>
          <img
            src={lightboxUrl}
            alt="증빙 전체 이미지"
            className="image-viewer-content"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
