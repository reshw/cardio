import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useClubName } from '../hooks/useClubName';
import { useAuth } from '../contexts/AuthContext';
import { useModalHistory } from '../hooks/useModalHistory';
import clubService, { type ClubMember } from '../services/clubService';
import clubDuesService, {
  type DuesPayment,
  MAJOR_MEMBER_THRESHOLD,
  currentSeasonYear,
  donationStep,
} from '../services/clubDuesService';
import type { MemberGrade } from '../services/clubGradeService';
import { GradeBadge } from '../components/GradeBadge';
import { MemberPickerSheet } from '../components/MemberPickerSheet';

/**
 * 회비 관리 (운영진 전용) — docs/design-guide_member-grade.md 10-4
 * 같은 장부를 날짜별 / 회원별로 본다. 대회원·정회원은 그 해 합계로 자동 계산.
 */

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const yy = (year: number) => String(year % 100).padStart(2, '0');
const errMsg = (err: any) => err?.message || err?.error_description || err?.hint || JSON.stringify(err);

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 그 해 합계 + 누적 합계로 배지 미리보기 (실제 배지는 서버 RPC 가 같은 규칙으로 계산) */
function previewGrade(year: number, yearTotal: number, allTotal: number): MemberGrade | null {
  if (yearTotal <= 0) return null;
  return yearTotal >= MAJOR_MEMBER_THRESHOLD
    ? { kind: 'tier_strong', label: `${yy(year)} 대회원`, step: donationStep(allTotal), year }
    : { kind: 'tier_soft', label: `${yy(year)} 정회원`, year };
}

type Tab = 'date' | 'member';

export const ClubDues = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [year, setYear] = useState(currentSeasonYear());
  const [tab, setTab] = useState<Tab>('member');
  const [payments, setPayments] = useState<DuesPayment[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ payment?: DuesPayment; userId?: string } | null>(null);
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);

  const load = async () => {
    if (!clubId) return;
    try {
      // 누적 단계 계산에 전체 연도가 필요해서 장부 전체를 한 번에 읽는다 (클럽 단위라 작다)
      const [list, memberList] = await Promise.all([
        clubDuesService.listPayments(clubId),
        clubService.getClubMembers(clubId),
      ]);
      setPayments(list);
      setMembers(memberList);
      setErrorMsg(null);
    } catch (err: any) {
      console.error('[회비] 화면 로드 실패:', JSON.stringify(err), err);
      setErrorMsg(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const nameOf = useMemo(() => {
    const map = new Map(members.map((m) => [m.user_id, m.club_nickname || m.user?.display_name || '회원']));
    return (userId: string) => map.get(userId) ?? '(탈퇴 회원)';
  }, [members]);

  const totals = useMemo(() => {
    const yearTotal = new Map<string, number>();
    const allTotal = new Map<string, number>();
    for (const p of payments) {
      allTotal.set(p.user_id, (allTotal.get(p.user_id) ?? 0) + p.amount);
      if (p.season_year === year) yearTotal.set(p.user_id, (yearTotal.get(p.user_id) ?? 0) + p.amount);
    }
    return { yearTotal, allTotal };
  }, [payments, year]);

  const yearPayments = payments.filter((p) => p.season_year === year);
  const memberIds = new Set(members.map((m) => m.user_id));
  const paidRows = [...totals.yearTotal.entries()]
    .filter(([uid]) => memberIds.has(uid))
    .sort((a, b) => b[1] - a[1]);
  const majorCount = paidRows.filter(([, t]) => t >= MAJOR_MEMBER_THRESHOLD).length;
  const unpaid = members.filter((m) => !totals.yearTotal.has(m.user_id));
  const yearSum = yearPayments.reduce((s, p) => s + p.amount, 0);

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading-screen"><div className="spinner"></div></div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>회비 관리</h1>
        </div>
      </div>

      <div className="settings-content dues-page">
        {errorMsg && (
          <div className="empty-state"><p>불러오는 중 오류: {errorMsg}</p></div>
        )}

        <div className="dues-year-nav">
          <button type="button" onClick={() => setYear(year - 1)} aria-label="이전 해"><ChevronLeft size={18} /></button>
          <strong>{year}년 회비</strong>
          <button type="button" onClick={() => setYear(year + 1)} aria-label="다음 해"><ChevronRight size={18} /></button>
        </div>

        <div className="dues-summary">
          <div><span>대회원</span><strong>{majorCount}</strong></div>
          <div><span>정회원</span><strong>{paidRows.length - majorCount}</strong></div>
          <div><span>합계</span><strong>{won(yearSum)}</strong></div>
        </div>

        <div className="dues-tabs" role="tablist">
          <button type="button" className={tab === 'member' ? 'is-active' : ''} onClick={() => setTab('member')}>회원별</button>
          <button type="button" className={tab === 'date' ? 'is-active' : ''} onClick={() => setTab('date')}>날짜별</button>
        </div>

        {tab === 'member' ? (
          <div className="dues-list">
            {paidRows.map(([uid, total]) => (
              <button key={uid} type="button" className="dues-row" onClick={() => setHistoryUserId(uid)}>
                <span className="dues-row-name">{nameOf(uid)}</span>
                <GradeBadge grade={previewGrade(year, total, totals.allTotal.get(uid) ?? total)} size="full" />
                <span className="dues-row-amount">{won(total)}</span>
              </button>
            ))}
            {unpaid.length > 0 && <div className="dues-divider">{year}년 미납 {unpaid.length}명</div>}
            {unpaid.map((m) => (
              <button key={m.user_id} type="button" className="dues-row is-unpaid" onClick={() => setHistoryUserId(m.user_id)}>
                <span className="dues-row-name">{nameOf(m.user_id)}</span>
                <span className="dues-row-amount">—</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="dues-list">
            {yearPayments.length === 0 && <div className="empty-message">{year}년 납부 기록이 없습니다.</div>}
            {yearPayments.map((p) => (
              <button key={p.id} type="button" className="dues-row" onClick={() => setEditing({ payment: p })}>
                <span className="dues-row-date">{p.paid_on.slice(5).replace('-', '.')}</span>
                <span className="dues-row-name">
                  {nameOf(p.user_id)}
                  {p.memo && <span className="dues-row-memo">{p.memo}</span>}
                </span>
                <span className="dues-row-amount">{won(p.amount)}</span>
              </button>
            ))}
          </div>
        )}

        <button type="button" className="dues-add-fab" onClick={() => setEditing({})}>
          <Plus size={18} /> 납부 기록
        </button>
      </div>

      {historyUserId && (
        <DuesHistorySheet
          name={nameOf(historyUserId)}
          payments={payments.filter((p) => p.user_id === historyUserId)}
          onAdd={() => {
            setEditing({ userId: historyUserId });
            setHistoryUserId(null);
          }}
          onEdit={(p) => {
            setEditing({ payment: p });
            setHistoryUserId(null);
          }}
          onClose={() => setHistoryUserId(null)}
        />
      )}

      {editing && clubId && user && (
        <DuesPaymentSheet
          clubId={clubId}
          createdBy={user.id}
          members={members}
          payments={payments}
          payment={editing.payment}
          initialUserId={editing.userId}
          defaultYear={year}
          nameOf={nameOf}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

function DuesHistorySheet({
  name,
  payments,
  onAdd,
  onEdit,
  onClose,
}: {
  name: string;
  payments: DuesPayment[];
  onAdd: () => void;
  onEdit: (p: DuesPayment) => void;
  onClose: () => void;
}) {
  useModalHistory(true, onClose);
  const byYear = new Map<number, DuesPayment[]>();
  for (const p of payments) byYear.set(p.season_year, [...(byYear.get(p.season_year) ?? []), p]);
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const all = payments.reduce((s, p) => s + p.amount, 0);

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="feedback-sheet dues-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 32 }} />
          <span className="date-picker-title">{name}</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="dues-history-total">누적 {won(all)}</div>

        {years.length === 0 && <div className="empty-message">납부 기록이 없습니다.</div>}
        {years.map((y) => {
          const list = byYear.get(y)!;
          const sum = list.reduce((s, p) => s + p.amount, 0);
          return (
            <div key={y} className="dues-history-year">
              <div className="dues-history-year-head">
                <strong>{y}년</strong>
                <span>{won(sum)} · {sum >= MAJOR_MEMBER_THRESHOLD ? '대회원' : '정회원'}</span>
              </div>
              {list.map((p) => (
                <button key={p.id} type="button" className="dues-row" onClick={() => onEdit(p)}>
                  <span className="dues-row-date">{p.paid_on.replace(/-/g, '.')}</span>
                  <span className="dues-row-name">{p.memo ?? ''}</span>
                  <span className="dues-row-amount">{won(p.amount)}</span>
                </button>
              ))}
            </div>
          );
        })}

        <button type="button" className="race-save-btn" onClick={onAdd}>납부 기록 추가</button>
      </div>
    </div>,
    document.body
  );
}

function DuesPaymentSheet({
  clubId,
  createdBy,
  members,
  payments,
  payment,
  initialUserId,
  defaultYear,
  nameOf,
  onSaved,
  onClose,
}: {
  clubId: string;
  createdBy: string;
  members: ClubMember[];
  payments: DuesPayment[];
  payment?: DuesPayment;
  initialUserId?: string;
  defaultYear: number;
  nameOf: (userId: string) => string;
  onSaved: () => void;
  onClose: () => void;
}) {
  useModalHistory(true, onClose);
  const isEdit = !!payment;
  const [userId, setUserId] = useState(payment?.user_id ?? initialUserId ?? '');
  const [paidOn, setPaidOn] = useState(payment?.paid_on ?? todayLocal());
  const [seasonYear, setSeasonYear] = useState(payment?.season_year ?? defaultYear);
  const [yearTouched, setYearTouched] = useState(isEdit);
  const [amountText, setAmountText] = useState(payment ? String(payment.amount) : '');
  const [memo, setMemo] = useState(payment?.memo ?? '');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountText.replace(/[^\d]/g, '')) || 0;
  const paidYear = Number(paidOn.slice(0, 4));
  const isDecember = paidOn.slice(5, 7) === '12';

  // 받은 날을 바꾸면 회비 연도도 따라간다 — 운영진이 직접 고른 뒤에는 건드리지 않는다
  const onDateChange = (v: string) => {
    setPaidOn(v);
    if (!yearTouched && /^\d{4}/.test(v)) setSeasonYear(Number(v.slice(0, 4)));
  };

  // 저장 후 배지 미리보기 — 이 기록을 반영한 그 해 합계 / 누적 합계
  const others = payments.filter((p) => p.user_id === userId && p.id !== payment?.id);
  const yearTotal = others.filter((p) => p.season_year === seasonYear).reduce((s, p) => s + p.amount, 0) + amount;
  const allTotal = others.reduce((s, p) => s + p.amount, 0) + amount;
  const preview = userId && amount > 0 ? previewGrade(seasonYear, yearTotal, allTotal) : null;

  const save = async () => {
    if (!userId) return setError('회원을 선택해 주세요.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return setError('받은 날을 입력해 주세요.');
    if (amount <= 0) return setError('금액을 입력해 주세요.');
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await clubDuesService.updatePayment(clubId, payment!.id, { seasonYear, paidOn, amount, memo });
      } else {
        await clubDuesService.addPayment({ clubId, userId, createdBy, seasonYear, paidOn, amount, memo });
      }
      onSaved();
    } catch (err: any) {
      console.error('[회비] 저장 실패:', JSON.stringify(err), err);
      setError(`저장 실패: ${errMsg(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!payment || !confirm(`${nameOf(payment.user_id)} · ${won(payment.amount)} 기록을 삭제할까요?`)) return;
    setSaving(true);
    try {
      await clubDuesService.deletePayment(clubId, payment.id);
      onSaved();
    } catch (err: any) {
      console.error('[회비] 삭제 실패:', JSON.stringify(err), err);
      setError(`삭제 실패: ${errMsg(err)}`);
      setSaving(false);
    }
  };

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="feedback-sheet dues-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <h3>{isEdit ? '납부 기록 수정' : '납부 기록'}</h3>
          <button className="race-modal-close" type="button" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="race-form">
          <div className="race-form-group">
            <label>회원</label>
            <button
              type="button"
              className="race-input dues-member-select"
              onClick={() => !isEdit && setShowPicker(true)}
              disabled={isEdit}
            >
              {userId ? nameOf(userId) : '회원 선택'}
            </button>
          </div>

          <div className="race-form-row">
            <div className="race-form-group">
              <label>받은 날</label>
              <input type="date" className="race-input" value={paidOn} onChange={(e) => onDateChange(e.target.value)} />
            </div>
            <div className="race-form-group">
              <label>회비 연도</label>
              <select
                className="race-input"
                value={seasonYear}
                onChange={(e) => {
                  setSeasonYear(Number(e.target.value));
                  setYearTouched(true);
                }}
              >
                {[paidYear - 1, paidYear, paidYear + 1].filter((y) => y > 2000).map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>
          </div>
          {isDecember && seasonYear === paidYear && (
            <div className="dues-hint">12월 납부예요. 내년 회비라면 회비 연도를 {paidYear + 1}년으로 바꿔 주세요.</div>
          )}

          <div className="race-form-group">
            <label>금액 (원)</label>
            <input
              className="race-input"
              inputMode="numeric"
              placeholder="50000"
              value={amount ? amount.toLocaleString('ko-KR') : amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
            <div className="dues-quick-amounts">
              {[10000, 30000, 50000, 100000].map((v) => (
                <button key={v} type="button" onClick={() => setAmountText(String(v))}>{v / 10000}만</button>
              ))}
            </div>
          </div>

          <div className="race-form-group">
            <label>메모 <span className="race-label-hint">선택</span></label>
            <input className="race-input" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={50} placeholder="계좌이체" />
          </div>

          {preview && (
            <div className="dues-preview">
              <span>저장하면</span>
              <GradeBadge grade={preview} size="full" />
              <span>({seasonYear}년 합계 {won(yearTotal)})</span>
            </div>
          )}

          {error && <div className="dues-error">{error}</div>}
        </div>

        <button type="button" className="race-save-btn" onClick={save} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </button>
        {isEdit && (
          <button type="button" className="dues-delete-btn" onClick={remove} disabled={saving}>기록 삭제</button>
        )}

        {showPicker && (
          <MemberPickerSheet
            title="납부한 회원"
            members={members}
            onSelect={(id) => {
              setUserId(id);
              setShowPicker(false);
            }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
