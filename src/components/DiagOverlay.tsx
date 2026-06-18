import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// ?diag=1 일 때만 화면 상단에 모달 진단 정보 표시
// 사용자가 폰 스크린샷 떠서 공유하기 위한 도구. 디버그 끝나면 마운트 해제

interface ElInfo {
  inDom: boolean;
  rect?: { x: number; y: number; w: number; h: number };
  parent?: string;
  parentRect?: { x: number; y: number; w: number; h: number };
  style?: {
    display: string;
    position: string;
    transform: string;
    opacity: string;
    visibility: string;
    zIndex: string;
    width: string;
    height: string;
    background: string;
  };
}

const collect = (selector: string): ElInfo => {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return { inDom: false };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const p = el.parentElement;
  const pr = p?.getBoundingClientRect();
  return {
    inDom: true,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    parent: p ? `${p.tagName}.${(p.className || '').slice(0, 30)}` : 'none',
    parentRect: pr ? { x: Math.round(pr.x), y: Math.round(pr.y), w: Math.round(pr.width), h: Math.round(pr.height) } : undefined,
    style: {
      display: cs.display,
      position: cs.position,
      transform: cs.transform,
      opacity: cs.opacity,
      visibility: cs.visibility,
      zIndex: cs.zIndex,
      width: cs.width,
      height: cs.height,
      background: cs.backgroundColor,
    },
  };
};

const collectAncestorStacking = (selector: string): string[] => {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return [];
  const ancestors: string[] = [];
  let cur: HTMLElement | null = el.parentElement;
  let depth = 0;
  while (cur && depth < 10) {
    const cs = getComputedStyle(cur);
    const flags: string[] = [];
    if (cs.transform !== 'none') flags.push('transform');
    if (cs.filter !== 'none') flags.push('filter');
    if (cs.willChange !== 'auto') flags.push(`will-change:${cs.willChange}`);
    if (cs.contain !== 'none' && cs.contain !== '') flags.push(`contain:${cs.contain}`);
    if (cs.isolation === 'isolate') flags.push('isolation');
    if (cs.overflow !== 'visible') flags.push(`overflow:${cs.overflow}`);
    if (cs.position !== 'static' && cs.zIndex !== 'auto') flags.push(`z:${cs.zIndex}`);
    if (flags.length > 0) {
      const id = cur.id ? `#${cur.id}` : '';
      const cls = (cur.className || '').toString().slice(0, 24);
      ancestors.push(`${cur.tagName}${id}.${cls} [${flags.join(',')}]`);
    }
    cur = cur.parentElement;
    depth++;
  }
  return ancestors;
};

const STORAGE_KEY = 'diag-enabled';
const TAP_COUNT_KEY = 'diag-tap-count';
const TAP_TIME_KEY = 'diag-tap-time';
const TAP_WINDOW_MS = 1500;
const TAP_THRESHOLD = 7;

export const DiagOverlay = () => {
  const [tick, setTick] = useState(0);
  const [enabled, setEnabled] = useState(
    () =>
      new URLSearchParams(window.location.search).has('diag') ||
      localStorage.getItem(STORAGE_KEY) === '1'
  );

  // "기록" 탭 1.5초 내 7번 연속 탭 시 활성화 (안드로이드 빌드넘버 패턴)
  useEffect(() => {
    const handler = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const item = t?.closest('a, button');
      if (!item) return;
      if (!(item.textContent || '').includes('기록')) return;
      const now = Date.now();
      const last = Number(localStorage.getItem(TAP_TIME_KEY) || 0);
      const prev = Number(localStorage.getItem(TAP_COUNT_KEY) || 0);
      const count = now - last > TAP_WINDOW_MS ? 1 : prev + 1;
      localStorage.setItem(TAP_TIME_KEY, String(now));
      localStorage.setItem(TAP_COUNT_KEY, String(count));
      if (count >= TAP_THRESHOLD) {
        localStorage.setItem(STORAGE_KEY, '1');
        localStorage.removeItem(TAP_COUNT_KEY);
        setEnabled(true);
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  const dismiss = () => {
    localStorage.removeItem(STORAGE_KEY);
    setEnabled(false);
  };

  const overlay = collect('.modal-overlay');
  const content = collect('.modal-content');
  const sheetOverlay = collect('.workout-sheet-overlay');
  const sheet = collect('.workout-sheet');
  const target = content.inDom ? '.modal-content' : sheet.inDom ? '.workout-sheet' : null;
  const ancestors = target ? collectAncestorStacking(target) : [];

  const bodyOf = document.body;
  const htmlOf = document.documentElement;
  const bodyCs = getComputedStyle(bodyOf);
  const htmlCs = getComputedStyle(htmlOf);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 'env(safe-area-inset-bottom, 0px)',
        left: 0,
        right: 0,
        minHeight: `${Math.floor(window.innerHeight * 0.35)}px`,
        maxHeight: `${Math.floor(window.innerHeight * 0.4)}px`,
        overflowY: 'auto',
        background: 'rgba(255, 255, 0, 0.96)',
        color: '#000',
        fontFamily: 'monospace',
        fontSize: '13px',
        lineHeight: 1.35,
        padding: '10px 12px',
        paddingRight: '52px',
        zIndex: 2147483647,
        pointerEvents: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        borderTop: '3px solid #000',
      }}
    >
      <button
        onClick={dismiss}
        aria-label="close diag overlay"
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 38,
          height: 38,
          background: '#000',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          fontSize: '18px',
          fontWeight: 700,
          cursor: 'pointer',
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>
      {`tick ${tick} viewport ${innerWidth}x${innerHeight}\n`}
      {`html overflow=${htmlCs.overflow} overflowX=${htmlCs.overflowX} transform=${htmlCs.transform}\n`}
      {`body overflow=${bodyCs.overflow} overflowX=${bodyCs.overflowX} transform=${bodyCs.transform}\n`}
      {`\n.modal-overlay inDom=${overlay.inDom}`}
      {overlay.inDom && `\n  rect=${JSON.stringify(overlay.rect)}\n  style=${JSON.stringify(overlay.style)}`}
      {`\n.modal-content inDom=${content.inDom}`}
      {content.inDom && `\n  rect=${JSON.stringify(content.rect)}\n  parent=${content.parent}\n  parentRect=${JSON.stringify(content.parentRect)}\n  style=${JSON.stringify(content.style)}`}
      {`\n.workout-sheet-overlay inDom=${sheetOverlay.inDom}`}
      {sheetOverlay.inDom && `\n  rect=${JSON.stringify(sheetOverlay.rect)}`}
      {`\n.workout-sheet inDom=${sheet.inDom}`}
      {sheet.inDom && `\n  rect=${JSON.stringify(sheet.rect)}\n  parent=${sheet.parent}\n  style=${JSON.stringify(sheet.style)}`}
      {ancestors.length > 0 && `\n\nAncestors of ${target} that create stacking context / containing block:`}
      {ancestors.map((a, i) => `\n  ${i}. ${a}`)}
    </div>,
    document.body
  );
};
