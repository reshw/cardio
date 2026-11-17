import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, Bike, Crown, Footprints, Mountain, Waves, type LucideIcon } from 'lucide-react';
import { GRADE_ICON_LABELS, type GradeIcon, type MemberGrade } from '../services/clubGradeService';

/**
 * 회원 등급 배지 — docs/design-guide_member-grade.md 5절
 * compact: 글자 없는 표식 (랭킹·피드). 누르면 버블.
 * full:    아이콘 + 등급 이름 알약 (회원관리·멤버 상세).
 */

const SPORT_ICONS: Record<GradeIcon, LucideIcon> = {
  run: Footprints,
  bike: Bike,
  swim: Waves,
  hike: Mountain,
};

function GradeIconView({ grade, size }: { grade: MemberGrade; size: number }) {
  if (grade.kind === 'manager' || grade.kind === 'vice') {
    return <Crown size={size} fill="currentColor" strokeWidth={2} aria-hidden="true" />;
  }
  if (grade.kind === 'title' && grade.icon) {
    const Icon = SPORT_ICONS[grade.icon];
    return <Icon size={size} strokeWidth={2.2} aria-hidden="true" />;
  }
  if (grade.kind === 'tier_strong' || grade.kind === 'tier_soft') {
    return <BadgeCheck size={size} strokeWidth={2.4} aria-hidden="true" />;
  }
  return null;
}

/** 버블·aria 에 쓰는 설명 */
function describe(grade: MemberGrade): string {
  if (grade.kind === 'tier_strong') return `${grade.label}, ${grade.step ?? 5}만원 이상 후원`;
  return grade.label;
}

// 한 번에 버블 하나 — 새로 열리면 나머지는 닫힌다
const OPEN_EVENT = 'grade-bubble-open';

interface Props {
  grade: MemberGrade | null | undefined;
  size?: 'compact' | 'full';
}

export function GradeBadge({ grade, size = 'compact' }: Props) {
  if (!grade) return null;
  if (size === 'full') return <GradeBadgeFull grade={grade} />;
  return <GradeBadgeCompact grade={grade} />;
}

function GradeBadgeFull({ grade }: { grade: MemberGrade }) {
  const isStaff = grade.kind === 'manager' || grade.kind === 'vice';
  return (
    <span className={`grade-badge grade-badge--full grade-badge--${grade.kind}`} aria-label={describe(grade)}>
      {isStaff ? (
        <span className={`grade-badge grade-badge--mark grade-badge--${grade.kind}`} aria-hidden="true">
          <GradeIconView grade={grade} size={13} />
        </span>
      ) : (
        <GradeIconView grade={grade} size={13} />
      )}
      <span className="grade-badge__label">{grade.label}</span>
      {grade.kind === 'tier_strong' && <span className="grade-badge__step">{grade.step ?? 5}+</span>}
    </span>
  );
}

function GradeBadgeCompact({ grade }: { grade: MemberGrade }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const idRef = useRef(Math.random().toString(36).slice(2));
  const [open, setOpen] = useState(false);

  // 종목 아이콘 없는 직책(다른 클럽의 "총무" 등)은 표식으로 뜻이 전달되지 않아 글자 알약
  const textOnly = grade.kind === 'title' && !grade.icon;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== idRef.current) close();
    };
    const onPointer = (e: PointerEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) close();
    };
    const timer = window.setTimeout(close, 2500);
    window.addEventListener(OPEN_EVENT, onOther);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(OPEN_EVENT, onOther);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    // 랭킹 행·피드 카드는 통째로 눌리는 영역 — 막지 않으면 멤버 상세가 열린다
    e.stopPropagation();
    e.preventDefault();
    setOpen((v) => {
      if (!v) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: idRef.current }));
      return !v;
    });
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`grade-badge grade-badge--${textOnly ? 'text' : 'mark'} grade-badge--${grade.kind}`}
        aria-label={describe(grade)}
        title={describe(grade)}
        onClick={toggle}
      >
        {textOnly ? (
          <span className="grade-badge__label">{grade.label}</span>
        ) : (
          <>
            <GradeIconView grade={grade} size={grade.kind === 'tier_strong' || grade.kind === 'tier_soft' ? 11 : 13} />
            {grade.kind === 'tier_strong' && <span className="grade-badge__plus">+</span>}
          </>
        )}
      </button>
      {open && btnRef.current && <GradeBubble anchor={btnRef.current} grade={grade} />}
    </>
  );
}

function GradeBubble({ anchor, grade }: { anchor: HTMLElement; grade: MemberGrade }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden', top: 0, left: 0 });
  const [below, setBelow] = useState(false);
  const [tailLeft, setTailLeft] = useState(0);

  // 위치는 실측해서 인라인으로 — 화면 끝에서 잘리지 않게 가두고, 위가 좁으면 아래로 뒤집는다
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 8;
    const center = a.left + a.width / 2;
    const left = Math.min(Math.max(8, center - w / 2), window.innerWidth - w - 8);
    const flip = a.top - h - gap < 8;
    setBelow(flip);
    setTailLeft(center - left);
    setStyle({ top: flip ? a.bottom + gap : a.top - h - gap, left });
  }, [anchor]);

  return createPortal(
    <div
      ref={ref}
      className={`grade-bubble${below ? ' grade-bubble--below' : ''}`}
      style={style}
      role="tooltip"
    >
      {grade.kind === 'tier_strong' ? (
        <>
          <strong className="grade-bubble__big">{grade.step ?? 5}+</strong>
          <span className="grade-bubble__small">만원 이상 후원 · {grade.label}</span>
        </>
      ) : (
        <span className="grade-bubble__small">{grade.label}</span>
      )}
      <span className="grade-bubble__tail" style={{ left: tailLeft }} />
    </div>,
    document.body
  );
}

/** 멤버 상세 헤더용 한 줄 소개 (5-3) */
export function GradeTagline({ grade }: { grade: MemberGrade | null | undefined }) {
  if (!grade) return null;
  let text: string;
  switch (grade.kind) {
    case 'manager':
    case 'vice':
      text = '클럽을 위해 봉사하는 운영진';
      break;
    case 'title':
      text = grade.icon ? `${GRADE_ICON_LABELS[grade.icon]} 파트를 이끄는 리더` : `클럽을 위해 봉사하는 ${grade.label}`;
      break;
    case 'tier_strong':
      text = `${grade.year ?? ''}년 클럽을 든든하게 받치는 대회원`;
      break;
    case 'tier_soft':
      text = `${grade.year ?? ''}년 클럽과 함께하는 정회원`;
      break;
  }
  return <div className="grade-tagline">{text}</div>;
}
