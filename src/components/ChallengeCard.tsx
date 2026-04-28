import type { Challenge } from '../services/challengeService';
import challengeService, { METRIC_LABELS, METRIC_UNITS } from '../services/challengeService';

interface Props {
  challenge: Challenge;
  progress: number;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
}

export const ChallengeCard = ({ challenge, progress, isAdmin, onDelete }: Props) => {
  const pct = challenge.goal_value != null ? Math.min(100, Math.round((progress / challenge.goal_value) * 100)) : 0;
  const daysLeft = challengeService.getDaysLeft(challenge.end_date);
  const unit = challenge.goal_metric ? METRIC_UNITS[challenge.goal_metric] : '';
  const label = challenge.goal_metric ? METRIC_LABELS[challenge.goal_metric] : '';
  const color = challenge.theme_color || '#8b5cf6';
  const done = pct >= 100;

  const handleDelete = () => {
    if (!confirm(`"${challenge.title}" 챌린지를 삭제하시겠습니까?`)) return;
    onDelete?.(challenge.id);
  };

  return (
    <div className="challenge-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="challenge-card-header">
        <div className="challenge-title-row">
          <span className="challenge-title">{challenge.title}</span>
          {challenge.scope === 'global' && (
            <span className="challenge-badge global">전체</span>
          )}
          {done && <span className="challenge-badge done">달성!</span>}
        </div>
        {isAdmin && challenge.scope === 'club' && (
          <button className="challenge-delete-btn" onClick={handleDelete}>✕</button>
        )}
      </div>

      {challenge.description && (
        <p className="challenge-desc">{challenge.description}</p>
      )}

      <div className="challenge-meta">
        <span>{label}</span>
        <span className="challenge-period">
          {challenge.start_date} ~ {challenge.end_date}
          {daysLeft > 0 && !done && (
            <span className="days-left"> ({daysLeft}일 남음)</span>
          )}
        </span>
      </div>

      <div className="challenge-progress-bar-wrap">
        <div
          className="challenge-progress-bar-fill"
          style={{ width: `${pct}%`, background: done ? '#22c55e' : color }}
        />
      </div>

      <div className="challenge-progress-nums">
        <span style={{ color: done ? '#22c55e' : color, fontWeight: 700 }}>
          {progress}{unit}
        </span>
        <span className="challenge-goal"> / {challenge.goal_value}{unit} ({pct}%)</span>
      </div>
    </div>
  );
};
