interface Props {
  source: string;
  size?: number;
}

export const WorkoutSourceIcon = ({ source, size = 14 }: Props) => {
  const s = { width: size, height: size, flexShrink: 0 as const };
  if (source === 'strava') {
    return <img src="https://cdn.simpleicons.org/strava/FC4C02" alt="Strava" style={s} />;
  }
  if (source === 'apple_health') {
    return <img src="/icons/apple_health.svg" alt="Apple Health" style={s} />;
  }
  if (source === 'google_health') {
    return <img src="/icons/google_health.png" alt="Google Health" style={{ ...s, borderRadius: Math.round(size * 0.22) }} />;
  }
  return null;
};

export const getSourceLabel = (source: string): string => {
  switch (source) {
    case 'strava': return 'Strava';
    case 'apple_health': return 'Apple Health';
    case 'google_health': return 'Google Health';
    default: return source;
  }
};

export const getSourceColor = (source: string): string => {
  switch (source) {
    case 'strava': return '#FC4C02';
    case 'apple_health': return '#FF2616';
    case 'google_health': return '#4285F4';
    default: return 'var(--text-secondary)';
  }
};
