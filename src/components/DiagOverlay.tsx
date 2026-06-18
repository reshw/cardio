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

export const DiagOverlay = () => {
  const [tick, setTick] = useState(0);
  // 임시 진단용: ?diag=1 또는 cardio-android WebView 에서 자동 활성
  // 디버깅 완료 후 별도 커밋으로 제거 필요
  const enabled =
    new URLSearchParams(window.location.search).has('diag') ||
    navigator.userAgent.includes('cardio-android');

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

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
        top: 0,
        left: 0,
        right: 0,
        maxHeight: '60vh',
        overflowY: 'auto',
        background: 'rgba(255, 255, 0, 0.95)',
        color: '#000',
        font: '10px/1.3 monospace',
        padding: '4px 6px',
        zIndex: 2147483647,
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
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
