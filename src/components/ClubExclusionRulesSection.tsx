import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import clubService from '../services/clubService';
import type { ExclusionRule, ExclusionRuleInput, RecalcScope } from '../services/clubService';

interface CategoryOption {
  key: string;   // "달리기-러닝" 또는 "수영"
  label: string; // "달리기 - 러닝"
  emoji: string;
}

interface Props {
  clubId: string;
  categories: CategoryOption[];
}

// 배지 색상 프리셋 (배경/글자 쌍)
const COLOR_PRESETS: { bg: string; fg: string }[] = [
  { bg: '#ffe0e0', fg: '#c00000' }, // 빨강
  { bg: '#ffedd5', fg: '#c2410c' }, // 주황
  { bg: '#fef9c3', fg: '#a16207' }, // 노랑
  { bg: '#dcfce7', fg: '#15803d' }, // 초록
  { bg: '#dbeafe', fg: '#1d4ed8' }, // 파랑
  { bg: '#ede9fe', fg: '#6d28d9' }, // 보라
  { bg: '#e5e7eb', fg: '#374151' }, // 회색
  { bg: '#111827', fg: '#f9fafb' }, // 검정
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const splitKey = (key: string): { category: string; sub_type: string | null } => {
  const i = key.indexOf('-');
  return i > -1
    ? { category: key.substring(0, i), sub_type: key.substring(i + 1) }
    : { category: key, sub_type: null };
};

const keyOf = (category: string, sub_type: string | null) =>
  sub_type ? `${category}-${sub_type}` : category;

const emptyInput = (year: number): ExclusionRuleInput => ({
  name: '',
  label_bg_color: COLOR_PRESETS[0].bg,
  label_fg_color: COLOR_PRESETS[0].fg,
  category: '',
  sub_type: null,
  date_from: `${year}-07-01`,
  date_to: `${year}-08-31`,
  hour_from: 9,
  hour_to: 17,
  enabled: true,
});

export const ClubExclusionRulesSection = ({ clubId, categories }: Props) => {
  const year = new Date().getFullYear();
  const [rules, setRules] = useState<ExclusionRule[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<{ id: string | null; input: ExclusionRuleInput } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // 소급 재계산 모달: 저장/삭제/토글 성공 후 어느 범위로 재계산할지
  const [showRetro, setShowRetro] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      setRules(await clubService.getExclusionRules(clubId));
    } catch (err: any) {
      console.error('제외 규칙 로드 실패 상세:', JSON.stringify(err), err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setError('');
    setEditing({ id: null, input: emptyInput(year) });
  };

  const openEdit = (r: ExclusionRule) => {
    setError('');
    setEditing({
      id: r.id,
      input: {
        name: r.name,
        label_bg_color: r.label_bg_color,
        label_fg_color: r.label_fg_color,
        category: r.category,
        sub_type: r.sub_type,
        date_from: r.date_from,
        date_to: r.date_to,
        hour_from: r.hour_from,
        hour_to: r.hour_to,
        enabled: r.enabled,
      },
    });
  };

  const applyPreset = () => {
    // 폭염 프리셋: 달리기-러닝 (없으면 첫 카테고리), 올해 07-01~08-31, 09~17시, 빨강
    const running = categories.find((c) => c.key === '달리기-러닝') || categories[0];
    const parsed = running ? splitKey(running.key) : { category: '', sub_type: null };
    setEditing({
      id: editing?.id ?? null,
      input: {
        name: '폭염제외',
        label_bg_color: COLOR_PRESETS[0].bg,
        label_fg_color: COLOR_PRESETS[0].fg,
        category: parsed.category,
        sub_type: parsed.sub_type,
        date_from: `${year}-07-01`,
        date_to: `${year}-08-31`,
        hour_from: 9,
        hour_to: 17,
        enabled: true,
      },
    });
  };

  const validate = (i: ExclusionRuleInput): string | null => {
    if (!i.name.trim()) return '규칙 이름을 입력해주세요.';
    if (!i.category) return '대상 종목을 선택해주세요.';
    if (!i.date_from || !i.date_to) return '적용 기간을 입력해주세요.';
    if (i.date_to < i.date_from) return '종료일이 시작일보다 빠를 수 없습니다.';
    if (i.hour_from < 0 || i.hour_from > 23) return '시작 시각은 0~23 사이여야 합니다.';
    if (i.hour_to < 1 || i.hour_to > 24) return '종료 시각은 1~24 사이여야 합니다.';
    if (i.hour_to <= i.hour_from) return '종료 시각이 시작 시각보다 커야 합니다.';
    if (!HEX_RE.test(i.label_bg_color)) return '배경색 HEX 형식이 올바르지 않습니다. (예: #ffe0e0)';
    if (!HEX_RE.test(i.label_fg_color)) return '글자색 HEX 형식이 올바르지 않습니다.';
    return null;
  };

  const handleSave = async () => {
    if (!editing) return;
    const msg = validate(editing.input);
    if (msg) { setError(msg); return; }

    setSaving(true);
    setError('');
    try {
      if (editing.id) {
        await clubService.updateExclusionRule(editing.id, editing.input);
      } else {
        await clubService.createExclusionRule(clubId, editing.input);
      }
      setEditing(null);
      await loadRules();
      // 저장 성공 → 소급 재계산 범위 선택 모달
      setShowRetro(true);
    } catch (err: any) {
      console.error('제외 규칙 저장 실패 상세:', JSON.stringify(err), err);
      const m = err?.message || err?.error_description || err?.hint || JSON.stringify(err);
      setError(`저장 실패: ${m}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r: ExclusionRule) => {
    try {
      await clubService.updateExclusionRule(r.id, { enabled: !r.enabled });
      await loadRules();
      setShowRetro(true);
    } catch (err: any) {
      console.error('제외 규칙 토글 실패 상세:', JSON.stringify(err), err);
      alert(`활성 토글 실패: ${err?.message || JSON.stringify(err)}`);
    }
  };

  const handleDelete = async (r: ExclusionRule) => {
    if (!confirm(`"${r.name}" 규칙을 삭제할까요?\n삭제만으로는 과거 미적립이 자동 복원되지 않습니다. 이후 소급 재계산에서 복원됩니다.`)) return;
    try {
      await clubService.deleteExclusionRule(r.id);
      await loadRules();
      setShowRetro(true);
    } catch (err: any) {
      console.error('제외 규칙 삭제 실패 상세:', JSON.stringify(err), err);
      alert(`삭제 실패: ${err?.message || JSON.stringify(err)}`);
    }
  };

  const runRecalc = async (scope: RecalcScope) => {
    if (scope === 'none') { setShowRetro(false); return; }
    setRecalculating(true);
    try {
      await clubService.recalculateAfterRuleChange(clubId, scope);
      setShowRetro(false);
      alert('소급 재계산이 완료되었습니다.');
    } catch (err: any) {
      console.error('소급 재계산 실패 상세:', JSON.stringify(err), err);
      alert(`소급 재계산 실패: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setRecalculating(false);
    }
  };

  const setInput = (patch: Partial<ExclusionRuleInput>) => {
    if (!editing) return;
    setEditing({ ...editing, input: { ...editing.input, ...patch } });
  };

  return (
    <div className="settings-section" style={{ marginTop: '32px' }}>
      <h3>마일리지 제외 규칙</h3>
      <p className="form-hint" style={{ marginBottom: '16px' }}>
        특정 종목을 특정 기간·시간대에 올리면 <strong>미적립</strong>(마일리지 0) 처리합니다.
        예: 폭염기 낮시간 실외 러닝. 운동일수 산입 여부는 위 "운동일수 산입" 설정을 따릅니다.
      </p>

      {loading ? (
        <p className="form-hint">불러오는 중...</p>
      ) : rules.length === 0 ? (
        <p className="form-hint">등록된 규칙이 없습니다.</p>
      ) : (
        <div className="exclusion-rule-list">
          {rules.map((r) => (
            <div key={r.id} className={`exclusion-rule-item${r.enabled ? '' : ' disabled'}`}>
              <div className="exclusion-rule-main">
                <span
                  className="exclusion-rule-badge"
                  style={{ background: r.label_bg_color, color: r.label_fg_color }}
                >
                  {r.name}
                </span>
                <div className="exclusion-rule-meta">
                  {r.category}{r.sub_type ? `·${r.sub_type}` : ''} / {r.date_from} ~ {r.date_to} / {r.hour_from}~{r.hour_to}시
                  {!r.enabled && <span className="exclusion-rule-off"> (비활성)</span>}
                </div>
              </div>
              <div className="exclusion-rule-actions">
                <button type="button" onClick={() => handleToggle(r)} title={r.enabled ? '비활성화' : '활성화'}>
                  <span className={`challenge-toggle-track ${r.enabled ? 'on' : ''}`} style={{ pointerEvents: 'none' }} />
                </button>
                <button type="button" onClick={() => openEdit(r)} title="편집"><Pencil size={16} /></button>
                <button type="button" onClick={() => handleDelete(r)} title="삭제"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="exclusion-rule-add" onClick={openCreate}>
        <Plus size={16} /> 규칙 추가
      </button>

      {/* 편집 모달 */}
      {editing && createPortal(
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing.id ? '규칙 편집' : '규칙 추가'}</h2>
              <button className="modal-close" onClick={() => setEditing(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <button type="button" className="exclusion-preset-btn" onClick={applyPreset}>
                ☀️ 폭염 프리셋 채우기 (07-01~08-31 / 09~17시 / 달리기)
              </button>

              <label className="exclusion-field-label">이름</label>
              <input
                className="race-input"
                placeholder="예: 폭염제외"
                value={editing.input.name}
                maxLength={20}
                onChange={(e) => setInput({ name: e.target.value })}
              />

              <label className="exclusion-field-label">대상 종목</label>
              <select
                className="race-input"
                value={keyOf(editing.input.category, editing.input.sub_type)}
                onChange={(e) => setInput(splitKey(e.target.value))}
              >
                <option value="">종목 선택…</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                ))}
              </select>

              <div className="exclusion-field-row">
                <div style={{ flex: 1 }}>
                  <label className="exclusion-field-label">시작일</label>
                  <input
                    type="date"
                    className="race-input"
                    value={editing.input.date_from}
                    onChange={(e) => setInput({ date_from: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="exclusion-field-label">종료일</label>
                  <input
                    type="date"
                    className="race-input"
                    value={editing.input.date_to}
                    min={editing.input.date_from}
                    onChange={(e) => setInput({ date_to: e.target.value })}
                  />
                </div>
              </div>

              <div className="exclusion-field-row">
                <div style={{ flex: 1 }}>
                  <label className="exclusion-field-label">시작 시각 (0~23)</label>
                  <input
                    type="number" min={0} max={23}
                    className="race-input"
                    value={editing.input.hour_from}
                    onChange={(e) => setInput({ hour_from: parseInt(e.target.value || '0', 10) })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="exclusion-field-label">종료 시각 (1~24)</label>
                  <input
                    type="number" min={1} max={24}
                    className="race-input"
                    value={editing.input.hour_to}
                    onChange={(e) => setInput({ hour_to: parseInt(e.target.value || '0', 10) })}
                  />
                </div>
              </div>
              <p className="form-hint" style={{ marginTop: '4px' }}>
                운동 <strong>시작시각(KST)</strong> 기준. 종료 24 = 자정까지 포함.
              </p>

              <label className="exclusion-field-label">배지 색상</label>
              <div className="exclusion-palette">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.bg + p.fg}
                    type="button"
                    className="exclusion-swatch"
                    style={{ background: p.bg, color: p.fg }}
                    onClick={() => setInput({ label_bg_color: p.bg, label_fg_color: p.fg })}
                  >
                    가
                  </button>
                ))}
              </div>
              <div className="exclusion-field-row">
                <div style={{ flex: 1 }}>
                  <label className="exclusion-field-label">배경 HEX</label>
                  <input
                    className="race-input"
                    value={editing.input.label_bg_color}
                    onChange={(e) => setInput({ label_bg_color: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="exclusion-field-label">글자 HEX</label>
                  <input
                    className="race-input"
                    value={editing.input.label_fg_color}
                    onChange={(e) => setInput({ label_fg_color: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <span className="exclusion-field-label">미리보기</span>
                <span
                  className="exclusion-rule-badge"
                  style={{ background: editing.input.label_bg_color, color: editing.input.label_fg_color, marginLeft: '8px' }}
                >
                  {editing.input.name || '규칙 이름'}
                </span>
              </div>

              {error && <p className="challenge-create-error" style={{ marginTop: '12px' }}>{error}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="cancel-button" onClick={() => setEditing(null)}>취소</button>
              <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 소급 재계산 범위 모달 */}
      {showRetro && createPortal(
        <div className="modal-overlay" onClick={() => !recalculating && setShowRetro(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>이전 기록에도 적용할까요?</h2>
            </div>
            <div className="modal-body">
              <p style={{ lineHeight: 1.6, marginBottom: '12px' }}>
                규칙을 이전 기록에 소급 적용하려면 재계산 범위를 선택하세요.
                신규/수정 기록은 규칙에 따라 자동 반영됩니다.
              </p>
              <p className="form-hint" style={{ lineHeight: 1.6 }}>
                ※ 챌린지·팀 대항전 결과가 이미 발표된 기간에 소급 적용하면 결과가 바뀔 수 있습니다.
              </p>
            </div>
            <div className="exclusion-retro-actions">
              <button type="button" disabled={recalculating} onClick={() => runRecalc('current_month')}>이번 월만</button>
              <button type="button" disabled={recalculating} onClick={() => runRecalc('last_3_months')}>지난 3개월</button>
              <button type="button" disabled={recalculating} onClick={() => runRecalc('all')}>전체 기간</button>
              <button type="button" className="exclusion-retro-none" disabled={recalculating} onClick={() => runRecalc('none')}>
                소급 안 함
              </button>
            </div>
            {recalculating && <p className="form-hint" style={{ textAlign: 'center', marginTop: '8px' }}>재계산 중...</p>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
