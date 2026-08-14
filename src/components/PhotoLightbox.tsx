import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { useModalHistory } from '../hooks/useModalHistory';

interface LightboxPhoto {
  url: string;
  caption?: string;
  id?: string;
  canDelete?: boolean;
}

interface Props {
  photos: LightboxPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** 지정하면 canDelete=true 인 사진에 휴지통 버튼이 뜬다. */
  onDelete?: (photo: LightboxPhoto) => void;
}

const SWIPE_THRESHOLD = 40;

/** 사진 그리드에서 탭한 사진을 전체화면으로 보여준다 — 좌우 스와이프/화살표로 다음·이전. */
export const PhotoLightbox = ({ photos, index, onIndexChange, onClose, onDelete }: Props) => {
  useModalHistory(true, onClose);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const goPrev = () => onIndexChange((index - 1 + photos.length) % photos.length);
  const goNext = () => onIndexChange((index + 1) % photos.length);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (delta > SWIPE_THRESHOLD) goPrev();
    else if (delta < -SWIPE_THRESHOLD) goNext();
    setTouchStartX(null);
  };

  const photo = photos[index];
  if (!photo) return null;

  return createPortal(
    <div className="photo-lightbox-overlay" onClick={onClose}>
      <button type="button" className="photo-lightbox-close" onClick={onClose}>
        <X size={22} />
      </button>

      {onDelete && photo.canDelete && (
        <button
          type="button"
          className="photo-lightbox-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(photo); }}
        >
          <Trash2 size={20} />
        </button>
      )}

      {photos.length > 1 && (
        <span className="photo-lightbox-counter">{index + 1} / {photos.length}</span>
      )}

      {photos.length > 1 && (
        <button
          type="button"
          className="photo-lightbox-nav photo-lightbox-nav--prev"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      <img
        src={photo.url}
        alt={photo.caption ?? ''}
        className="photo-lightbox-image"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {photos.length > 1 && (
        <button
          type="button"
          className="photo-lightbox-nav photo-lightbox-nav--next"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          <ChevronRight size={28} />
        </button>
      )}

      {photo.caption && (
        <span className="photo-lightbox-caption">{photo.caption}</span>
      )}
    </div>,
    document.body
  );
};
