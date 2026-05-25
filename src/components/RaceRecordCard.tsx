import { ExternalLink, Trophy } from 'lucide-react';
import type { RaceRecord } from '../services/raceService';

interface Props {
  record: RaceRecord;
  isPB: boolean;
  onDelete: (id: string) => void;
  onEdit: (record: RaceRecord) => void;
  onView: (record: RaceRecord) => void;
}

export const RaceRecordCard = ({ record, isPB, onView }: Props) => {
  const d = new Date(record.race_date);
  const dateStr = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;

  return (
    <div className={`race-card ${isPB ? 'pb' : ''}`} onClick={() => onView(record)}>
      {isPB && (
        <div className="race-pb-badge">
          <Trophy size={10} strokeWidth={2.5} /> PB
        </div>
      )}

      <div className="race-card-header">
        <div className="race-card-info">
          <span className="race-card-name">{record.race_name}</span>
          <span className="race-card-date">{dateStr}</span>
        </div>
        <div className="race-card-actions">
          <span className="race-cat-badge">{record.category}</span>
          {record.link_url && (
            <a
              href={record.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="race-link-btn"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      <div className="race-time">{record.finish_time}</div>

      {record.notes && <p className="race-notes">{record.notes}</p>}
    </div>
  );
};
