import { useState, useEffect, useRef } from 'react';
import { X, Download, FileDown } from 'lucide-react';
import ExcelJS from 'exceljs';
import clubService from '../services/clubService';
import type { ClubDetailedStats } from '../services/clubService';
import html2canvas from 'html2canvas';

interface Props {
  clubId: string;
  clubName: string;
  month: { year: number; month: number };
  onClose: () => void;
}

export const ClubDetailedStatsModal = ({ clubId, clubName, month, onClose }: Props) => {
  const [stats, setStats] = useState<ClubDetailedStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [workoutKeys, setWorkoutKeys] = useState<string[]>([]);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStats();
  }, [clubId, month]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // 클럽 정보 조회 (enabled_categories 확인)
      const club = await clubService.getClubById(clubId);
      const enabledCategories = club.enabled_categories || [];

      const data = await clubService.getClubDetailedStats(clubId, month);
      setStats(data);

      // 클럽에서 활성화한 모든 운동 종목을 칼럼으로 표시 (마일리지 0이어도 표시)
      setWorkoutKeys([...enabledCategories].sort());
    } catch (error) {
      console.error('상세 통계 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`${month.year}-${month.month}`);

    const filteredStats = stats.filter(m => m.total_mileage > 0);

    // 이번 달 신규 여부 판단
    const isNewThisMonth = (member: ClubDetailedStats) => {
      if (!member.joined_at) return false;
      const joined = new Date(member.joined_at);
      return joined.getFullYear() === month.year && joined.getMonth() + 1 === month.month;
    };

    // 컬럼 정의
    const columns: Partial<ExcelJS.Column>[] = [
      { header: '순위',       key: 'rank',    width: 6 },
      { header: '이름',       key: 'name',    width: 14 },
      { header: '운동일수',   key: 'days',    width: 10 },
      ...workoutKeys.map(k => ({ header: k, key: k, width: 16 })),
      { header: '총 마일리지', key: 'total',  width: 12 },
      { header: '비고',        key: 'note',   width: 10 },
    ];
    sheet.columns = columns;

    // 헤더 스타일 — 회색 배경 + bold
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

    // 데이터 행 추가
    filteredStats.forEach((member) => {
      const rowData: Record<string, any> = {
        rank: member.rank,
        name: member.display_name,
        days: member.workout_days,
        total: parseFloat(member.total_mileage.toFixed(1)),
        note: isNewThisMonth(member) ? '신규' : '',
      };
      workoutKeys.forEach(key => {
        const mileage = member.by_workout[key] || 0;
        const value = member.by_workout_values[key] || 0;
        const unit = member.by_workout_units[key] || '';
        rowData[key] = mileage === 0 ? '-' : `${value.toFixed(value >= 100 ? 0 : 1)}${unit} (${mileage.toFixed(1)})`;
      });

      const row = sheet.addRow(rowData);

      // 명예의 전당 — 노란색 강조
      if (member.is_hall_of_fame) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
        });
      }

      // 신규 비고 셀 강조 (연한 초록)
      if (isNewThisMonth(member)) {
        const noteCell = row.getCell('note');
        noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
        noteCell.font = { bold: true, color: { argb: 'FF375623' } };
      }

      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    });

    // 다운로드
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${clubName}_${month.year}-${month.month}_상세통계.xlsx`;
    link.click();
  };

  const downloadImage = async () => {
    if (!tableRef.current) return;

    try {
      // 스크롤 컨테이너 찾기
      const container = tableRef.current;
      const originalOverflow = container.style.overflow;
      const originalHeight = container.style.height;
      const originalMaxHeight = container.style.maxHeight;
      const originalWidth = container.style.width;
      const originalMaxWidth = container.style.maxWidth;

      // 스크롤 제거하고 전체 크기로 확장
      container.style.overflow = 'visible';
      container.style.height = 'auto';
      container.style.maxHeight = 'none';
      container.style.width = 'auto';
      container.style.maxWidth = 'none';

      // DOM 업데이트 대기
      await new Promise(resolve => setTimeout(resolve, 100));

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

      // 스타일 복원
      container.style.overflow = originalOverflow;
      container.style.height = originalHeight;
      container.style.maxHeight = originalMaxHeight;
      container.style.width = originalWidth;
      container.style.maxWidth = originalMaxWidth;

      const link = document.createElement('a');
      link.download = `${clubName}_${month.year}-${month.month}_상세통계.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('이미지 다운로드 실패:', error);
      alert('이미지 다운로드에 실패했습니다.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            운동별 상세 통계
            <span style={{ fontSize: '16px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
              {month.year}년 {month.month}월
            </span>
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-screen">
              <div className="spinner"></div>
              <p>불러오는 중...</p>
            </div>
          ) : stats.filter(m => m.total_mileage > 0).length === 0 ? (
            <div className="empty-state">
              <p>통계 데이터가 없습니다.</p>
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
                      <th>운동일수</th>
                      {workoutKeys.map((key) => (
                        <th key={key}>{key}</th>
                      ))}
                      <th>총 마일리지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.filter(m => m.total_mileage > 0).map((member) => (
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

                          if (mileage === 0) {
                            return <td key={key}>-</td>;
                          }

                          return (
                            <td key={key}>
                              {value.toFixed(value >= 100 ? 0 : 1)}{unit} ({mileage.toFixed(1)})
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
