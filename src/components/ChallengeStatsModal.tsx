import { useState, useEffect, useRef } from 'react';
import { X, Download, FileDown } from 'lucide-react';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import clubService from '../services/clubService';
import type { ClubDetailedStats } from '../services/clubService';
import type { Challenge } from '../services/challengeService';

interface Props {
  challenge: Challenge;
  clubId: string;
  clubName: string;
  onClose: () => void;
}

export const ChallengeStatsModal = ({ challenge, clubId, clubName, onClose }: Props) => {
  const [stats, setStats] = useState<ClubDetailedStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [workoutKeys, setWorkoutKeys] = useState<string[]>([]);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStats();
  }, [challenge.id]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [data, configRows] = await Promise.all([
        clubService.getClubStatsByDateRange(
          clubId,
          challenge.start_date,
          challenge.end_date,
          challenge.allowed_categories
        ),
        clubService.getClubMileageConfigs(clubId),
      ]);
      setStats(data);

      // 활성화된 종목 중 챌린지 허용 종목과 교집합으로 컬럼 결정
      let enabledKeys = configRows
        .filter((r) => r.enabled)
        .map((r) => (r.sub_type ? `${r.category}-${r.sub_type}` : r.category));
      if (challenge.allowed_categories && challenge.allowed_categories.length > 0) {
        enabledKeys = enabledKeys.filter((k) => challenge.allowed_categories!.includes(k));
      }
      setWorkoutKeys([...enabledKeys].sort());
    } catch (error) {
      console.error('챌린지 통계 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const queryDatetime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(challenge.title.slice(0, 30));

    const columns: Partial<ExcelJS.Column>[] = [
      { header: '순위',       key: 'rank',  width: 6 },
      { header: '이름',       key: 'name',  width: 14 },
      { header: '운동일수',   key: 'days',  width: 10 },
      ...workoutKeys.map((k) => ({ header: k, key: k, width: 16 })),
      { header: '총 마일리지', key: 'total', width: 12 },
    ];
    sheet.columns = columns;

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });
    headerRow.height = 20;

    stats.forEach((member) => {
      const rowData: Record<string, any> = {
        rank: member.rank,
        name: member.display_name,
        days: member.workout_days,
        total: parseFloat(member.total_mileage.toFixed(1)),
      };
      workoutKeys.forEach((key) => {
        const mileage = member.by_workout[key] || 0;
        const value = member.by_workout_values[key] || 0;
        const unit = member.by_workout_units[key] || '';
        rowData[key] = mileage === 0 ? '-' : `${value.toFixed(value >= 100 ? 0 : 1)}${unit} (${mileage.toFixed(1)})`;
      });

      const row = sheet.addRow(rowData);
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    });

    sheet.addRow([]);
    const totalCols = columns.length;
    const infoRow = sheet.addRow([`조회일시: ${queryDatetime} | 기간: ${challenge.start_date} ~ ${challenge.end_date}`]);
    sheet.mergeCells(infoRow.number, 1, infoRow.number, totalCols);
    infoRow.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
    infoRow.getCell(1).alignment = { horizontal: 'right' };

    const queryDatetimeFile = queryDatetime.replace(/[: ]/g, '-');
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${clubName}_${challenge.title}_통계_${queryDatetimeFile}.xlsx`;
    link.click();
  };

  const downloadImage = async () => {
    if (!tableRef.current) return;
    const container = tableRef.current;
    const prev = {
      overflow: container.style.overflow,
      height: container.style.height,
      maxHeight: container.style.maxHeight,
      width: container.style.width,
      maxWidth: container.style.maxWidth,
    };
    container.style.overflow = 'visible';
    container.style.height = 'auto';
    container.style.maxHeight = 'none';
    container.style.width = 'auto';
    container.style.maxWidth = 'none';
    await new Promise((r) => setTimeout(r, 100));
    try {
      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        scrollY: -window.scrollY,
        scrollX: -window.scrollX,
        width: container.scrollWidth,
        height: container.scrollHeight,
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight,
        useCORS: true,
        allowTaint: true,
      });
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
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-screen">
              <div className="spinner" />
              <p>불러오는 중...</p>
            </div>
          ) : stats.length === 0 ? (
            <div className="empty-state">
              <p>기간 내 마일리지 데이터가 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="stats-actions">
                <button className="download-button" onClick={downloadExcel}>
                  <FileDown size={16} />
                  엑셀 다운로드
                </button>
                <button className="download-button" onClick={downloadImage}>
                  <Download size={16} />
                  이미지 다운로드
                </button>
              </div>

              <div className="stats-table-container" ref={tableRef}>
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>이름</th>
                      <th>운동<br />일수</th>
                      {workoutKeys.map((key) => {
                        const parts = key.split('-');
                        return (
                          <th key={key}>
                            {parts[0]}
                            {parts[1] && <><br /><span style={{ fontWeight: 400, opacity: 0.85 }}>{parts[1]}</span></>}
                          </th>
                        );
                      })}
                      <th>총<br />마일리지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((member) => (
                      <tr key={member.user_id}>
                        <td className="rank-cell">
                          {member.rank === 1 ? '🥇' : member.rank === 2 ? '🥈' : member.rank === 3 ? '🥉' : member.rank}
                        </td>
                        <td className="name-cell">{member.display_name}</td>
                        <td>{member.workout_days}일</td>
                        {workoutKeys.map((key) => {
                          const mileage = member.by_workout[key] || 0;
                          const value = member.by_workout_values[key] || 0;
                          const unit = member.by_workout_units[key] || '';
                          if (mileage === 0) return <td key={key}>-</td>;
                          return (
                            <td key={key}>
                              <div>{value.toFixed(value >= 100 ? 0 : 1)}{unit}</div>
                              <div style={{ fontSize: '11px', opacity: 0.7 }}>({mileage.toFixed(1)})</div>
                            </td>
                          );
                        })}
                        <td className="total-cell">{member.total_mileage.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
