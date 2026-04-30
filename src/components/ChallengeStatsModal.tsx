import { useState, useEffect, useRef } from 'react';
import { X, Download, FileDown, Search } from 'lucide-react';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import clubService from '../services/clubService';
import type { ClubDetailedStats } from '../services/clubService';
import challengeService from '../services/challengeService';
import type { Challenge, GoalValidationRow } from '../services/challengeService';

interface Props {
  challenge: Challenge;
  clubId: string;
  clubName: string;
  isManager: boolean;
  onClose: () => void;
}

type Tab = 'stats' | 'validation';

const VERDICT_COLOR: Record<string, string> = {
  '😴 낮음': '#94a3b8',
  '✅ 적정': '#22c55e',
  '🔥 도전적': '#f59e0b',
  '⚠️ 과도': '#ef4444',
  '📊 데이터 없음': '#94a3b8',
};

export const ChallengeStatsModal = ({ challenge, clubId, clubName, isManager, onClose }: Props) => {
  const [tab, setTab] = useState<Tab>('stats');

  // 마일리지 통계 탭
  const [stats, setStats] = useState<ClubDetailedStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [workoutKeys, setWorkoutKeys] = useState<string[]>([]);
  const tableRef = useRef<HTMLDivElement>(null);

  // 목표 검증 탭
  const [validation, setValidation] = useState<GoalValidationRow[]>([]);
  const [validationLoading, setValidationLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { loadStats(); }, [challenge.id]);
  useEffect(() => {
    if (tab === 'validation' && validation.length === 0) loadValidation();
  }, [tab]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const [data, configRows] = await Promise.all([
        clubService.getClubStatsByDateRange(clubId, challenge.start_date, challenge.end_date, challenge.allowed_categories),
        clubService.getClubMileageConfigs(clubId),
      ]);
      setStats(data);
      let enabledKeys = configRows.filter((r) => r.enabled).map((r) => (r.sub_type ? `${r.category}-${r.sub_type}` : r.category));
      if (challenge.allowed_categories && challenge.allowed_categories.length > 0) {
        enabledKeys = enabledKeys.filter((k) => challenge.allowed_categories!.includes(k));
      }
      setWorkoutKeys([...enabledKeys].sort());
    } catch (e) {
      console.error('챌린지 통계 불러오기 실패:', e);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadValidation = async () => {
    setValidationLoading(true);
    try {
      const data = await challengeService.getGoalValidation(challenge, clubId);
      setValidation(data);
    } catch (e) {
      console.error('목표 검증 불러오기 실패:', e);
    } finally {
      setValidationLoading(false);
    }
  };

  const filteredValidation = validation.filter((r) =>
    r.displayName.includes(search) || r.category.includes(search)
  );

  const downloadExcel = async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const queryDatetime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(challenge.title.slice(0, 30));
    const columns: Partial<ExcelJS.Column>[] = [
      { header: '순위', key: 'rank', width: 6 },
      { header: '이름', key: 'name', width: 14 },
      { header: '운동일수', key: 'days', width: 10 },
      ...workoutKeys.map((k) => ({ header: k, key: k, width: 16 })),
      { header: '총 마일리지', key: 'total', width: 12 },
    ];
    sheet.columns = columns;
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 20;
    stats.forEach((member) => {
      const rowData: Record<string, any> = { rank: member.rank, name: member.display_name, days: member.workout_days, total: parseFloat(member.total_mileage.toFixed(1)) };
      workoutKeys.forEach((key) => {
        const mileage = member.by_workout[key] || 0;
        const value = member.by_workout_values[key] || 0;
        const unit = member.by_workout_units[key] || '';
        rowData[key] = mileage === 0 ? '-' : `${value.toFixed(value >= 100 ? 0 : 1)}${unit} (${mileage.toFixed(1)})`;
      });
      const row = sheet.addRow(rowData);
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
    });
    sheet.addRow([]);
    const infoRow = sheet.addRow([`조회일시: ${queryDatetime} | 기간: ${challenge.start_date} ~ ${challenge.end_date}`]);
    sheet.mergeCells(infoRow.number, 1, infoRow.number, columns.length);
    infoRow.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
    infoRow.getCell(1).alignment = { horizontal: 'right' };
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${clubName}_${challenge.title}_통계_${queryDatetime.replace(/[: ]/g, '-')}.xlsx`;
    link.click();
  };

  const downloadValidationExcel = async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const queryDatetime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const duration = challengeService.getChallengeDuration(challenge.start_date, challenge.end_date);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('목표검증');

    const columns: Partial<ExcelJS.Column>[] = [
      { header: '이름',       key: 'name',      width: 14 },
      { header: '종목',       key: 'category',  width: 16 },
      { header: '선언 목표',  key: 'target',    width: 12 },
      { header: `일평균(30일)`, key: 'avg',     width: 14 },
      { header: `예상치(${duration}일)`, key: 'projected', width: 14 },
      { header: '비율',       key: 'ratio',     width: 10 },
      { header: '판정',       key: 'verdict',   width: 16 },
    ];
    sheet.columns = columns;

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 20;

    const VERDICT_ARGB: Record<string, string> = {
      '😴 낮음':       'FFCFD8DC',
      '✅ 적정':       'FFC8E6C9',
      '🔥 도전적':    'FFFFF9C4',
      '⚠️ 과도':      'FFFFCDD2',
      '📊 데이터 없음': 'FFF5F5F5',
    };

    validation.forEach((row) => {
      const r = sheet.addRow({
        name:      row.displayName,
        category:  row.category + (row.sub_type ? ` · ${row.sub_type}` : ''),
        target:    `${row.target_value}${row.unit}`,
        avg:       row.daily_avg > 0 ? `${row.daily_avg}${row.unit}` : '-',
        projected: row.projected > 0 ? `${row.projected}${row.unit}` : '-',
        ratio:     row.ratio !== null ? `${row.ratio}%` : '-',
        verdict:   row.verdict,
      });
      const argb = VERDICT_ARGB[row.verdict] ?? 'FFFFFFFF';
      r.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
      r.getCell('name').alignment = { horizontal: 'left' };
      r.getCell('category').alignment = { horizontal: 'left' };
    });

    sheet.addRow([]);
    const ref = validation[0]?.ref_period ?? '';
    const infoRow = sheet.addRow([`기준기간: ${ref} (30일) | 챌린지 기간: ${challenge.start_date} ~ ${challenge.end_date} (${duration}일) | 조회: ${queryDatetime}`]);
    sheet.mergeCells(infoRow.number, 1, infoRow.number, columns.length);
    infoRow.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
    infoRow.getCell(1).alignment = { horizontal: 'right' };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${clubName}_${challenge.title}_목표검증_${queryDatetime.replace(/[: ]/g, '-')}.xlsx`;
    link.click();
  };

  const downloadImage = async () => {
    if (!tableRef.current) return;
    const container = tableRef.current;
    const prev = { overflow: container.style.overflow, height: container.style.height, maxHeight: container.style.maxHeight, width: container.style.width, maxWidth: container.style.maxWidth };
    container.style.overflow = 'visible'; container.style.height = 'auto'; container.style.maxHeight = 'none'; container.style.width = 'auto'; container.style.maxWidth = 'none';
    await new Promise((r) => setTimeout(r, 100));
    try {
      const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, scrollY: -window.scrollY, scrollX: -window.scrollX, width: container.scrollWidth, height: container.scrollHeight, windowWidth: container.scrollWidth, windowHeight: container.scrollHeight, useCORS: true, allowTaint: true });
      const link = document.createElement('a');
      link.download = `${clubName}_${challenge.title}_통계.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('이미지 다운로드 실패:', e);
    } finally {
      Object.assign(container.style, prev);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {challenge.title}
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', marginLeft: '8px', fontWeight: 400 }}>
              {challenge.start_date} ~ {challenge.end_date}
            </span>
          </h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>

        {/* 탭 — 매니저만 목표 검증 탭 노출 */}
        {isManager && (
          <div className="challenge-stats-tabs">
            <button className={`challenge-stats-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>마일리지 통계</button>
            <button className={`challenge-stats-tab ${tab === 'validation' ? 'active' : ''}`} onClick={() => setTab('validation')}>목표 검증</button>
          </div>
        )}

        <div className="modal-body">

          {/* ── 마일리지 통계 탭 ── */}
          {tab === 'stats' && (
            statsLoading ? (
              <div className="loading-screen"><div className="spinner" /><p>불러오는 중...</p></div>
            ) : stats.length === 0 ? (
              <div className="empty-state"><p>기간 내 마일리지 데이터가 없습니다.</p></div>
            ) : (
              <>
                <div className="stats-actions">
                  <button className="download-button" onClick={downloadExcel}><FileDown size={16} />엑셀 다운로드</button>
                  <button className="download-button" onClick={downloadImage}><Download size={16} />이미지 다운로드</button>
                </div>
                <div className="stats-table-container" ref={tableRef}>
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>순위</th><th>이름</th><th>운동<br />일수</th>
                        {workoutKeys.map((key) => {
                          const parts = key.split('-');
                          return <th key={key}>{parts[0]}{parts[1] && <><br /><span style={{ fontWeight: 400, opacity: 0.85 }}>{parts[1]}</span></>}</th>;
                        })}
                        <th>총<br />마일리지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((member) => (
                        <tr key={member.user_id}>
                          <td className="rank-cell">{member.rank === 1 ? '🥇' : member.rank === 2 ? '🥈' : member.rank === 3 ? '🥉' : member.rank}</td>
                          <td className="name-cell">{member.display_name}</td>
                          <td>{member.workout_days}일</td>
                          {workoutKeys.map((key) => {
                            const mileage = member.by_workout[key] || 0;
                            const value = member.by_workout_values[key] || 0;
                            const unit = member.by_workout_units[key] || '';
                            if (mileage === 0) return <td key={key}>-</td>;
                            return <td key={key}><div>{value.toFixed(value >= 100 ? 0 : 1)}{unit}</div><div style={{ fontSize: '11px', opacity: 0.7 }}>({mileage.toFixed(1)})</div></td>;
                          })}
                          <td className="total-cell">{member.total_mileage.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}

          {/* ── 목표 검증 탭 (매니저 전용) ── */}
          {tab === 'validation' && (
            validationLoading ? (
              <div className="loading-screen"><div className="spinner" /><p>불러오는 중...</p></div>
            ) : validation.length === 0 ? (
              <div className="empty-state"><p>참여 선언 데이터가 없습니다.</p></div>
            ) : (
              <>
                <div className="stats-actions">
                  <button className="download-button" onClick={downloadValidationExcel}><FileDown size={16} />엑셀 다운로드</button>
                </div>

                <div className="validation-meta">
                  기준기간: {validation[0]?.ref_period} (30일) → 챌린지 기간 {challengeService.getChallengeDuration(challenge.start_date, challenge.end_date)}일 환산
                </div>

                {/* 검색 */}
                <div className="validation-search-wrap">
                  <Search size={14} />
                  <input
                    className="challenge-search-input"
                    placeholder="이름 또는 종목 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && <button onClick={() => setSearch('')}><X size={12} /></button>}
                </div>

                <div className="stats-table-container">
                  <table className="stats-table validation-table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>종목</th>
                        <th>선언 목표</th>
                        <th>일평균<br /><span style={{fontWeight:400,opacity:0.8}}>(30일)</span></th>
                        <th>예상치<br /><span style={{fontWeight:400,opacity:0.8}}>(기간)</span></th>
                        <th>비율</th>
                        <th>판정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredValidation.map((row, idx) => (
                        <tr key={idx}>
                          <td className="name-cell">{row.displayName}</td>
                          <td>{row.category}{row.sub_type && ` · ${row.sub_type}`}</td>
                          <td>{row.target_value}{row.unit}</td>
                          <td>{row.daily_avg > 0 ? `${row.daily_avg}${row.unit}` : '-'}</td>
                          <td>{row.projected > 0 ? `${row.projected}${row.unit}` : '-'}</td>
                          <td>{row.ratio !== null ? `${row.ratio}%` : '-'}</td>
                          <td>
                            <span className="verdict-badge" style={{ color: VERDICT_COLOR[row.verdict] }}>
                              {row.verdict}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="validation-legend">
                  <span style={{ color: VERDICT_COLOR['😴 낮음'] }}>😴 낮음 &lt;70%</span>
                  <span style={{ color: VERDICT_COLOR['✅ 적정'] }}>✅ 적정 70~130%</span>
                  <span style={{ color: VERDICT_COLOR['🔥 도전적'] }}>🔥 도전적 130~200%</span>
                  <span style={{ color: VERDICT_COLOR['⚠️ 과도'] }}>⚠️ 과도 &gt;200%</span>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};
