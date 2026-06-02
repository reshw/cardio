import { useState, useEffect } from 'react';
import clubService from '../services/clubService';

export function useClubName(clubId: string | undefined): string {
  const [name, setName] = useState('');
  useEffect(() => {
    if (!clubId) return;
    clubService.getClubById(clubId).then(c => setName(c.name)).catch(() => {});
  }, [clubId]);
  return name;
}
