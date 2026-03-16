import { useState, useEffect, useRef } from 'react';
import { X, Download, FileDown } from 'lucide-react';
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
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStats();
  }, [clubId, month]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await clubService.getClubDetailedStats(clubId, month);
      setStats(data);
    } catch (error) {
      console.error('상세 통계 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    const headers = [
      '순위',
      '이름',
      '달리기-트레드밀',
      '달리기-러닝',
      '사이클-실외',
      '사이클-실내',
      '수영',
      '계단',
      '총 마일리지',
    ];

    const filteredStats = stats.filter(m => m.total_mileage > 0);
    const rows = filteredStats.map((member) => [
      member.rank,
      member.display_name,
      member.by_workout['달리기-트레드밀'].toFixed(1),
      member.by_workout['달리기-러닝'].toFixed(1),
      member.by_workout['사이클-실외'].toFixed(1),
      member.by_workout['사이클-실내'].toFixed(1),
      member.by_workout['수영'].toFixed(1),
      member.by_workout['계단'].toFixed(1),
      member.total_mileage.toFixed(1),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${clubName}_${month.year}-${month.month}_상세통계.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadImage = async () => {
    if (!tableRef.current) return;

    try {
      const canvas = await html2canvas(tableRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

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
                <button className="download-button" onClick={downloadCSV}>
                  <FileDown size={16} />
                  CSV 다운로드
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
                      <th>트레드밀</th>
                      <th>러닝</th>
                      <th>실외 사이클</th>
                      <th>실내 사이클</th>
                      <th>수영</th>
                      <th>계단</th>
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
                        <td>{member.by_workout['달리기-트레드밀'].toFixed(1)}</td>
                        <td>{member.by_workout['달리기-러닝'].toFixed(1)}</td>
                        <td>{member.by_workout['사이클-실외'].toFixed(1)}</td>
                        <td>{member.by_workout['사이클-실내'].toFixed(1)}</td>
                        <td>{member.by_workout['수영'].toFixed(1)}</td>
                        <td>{member.by_workout['계단'].toFixed(1)}</td>
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
