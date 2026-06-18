const KEY = 'cardio_diag';
const MAX = 50;

export const diagLog = {
  add(category: string, message: string) {
    try {
      const raw = sessionStorage.getItem(KEY);
      const logs: string[] = raw ? JSON.parse(raw) : [];
      const entry = `[${new Date().toISOString()}] ${category}: ${message}`;
      logs.push(entry);
      if (logs.length > MAX) logs.splice(0, logs.length - MAX);
      sessionStorage.setItem(KEY, JSON.stringify(logs));
    } catch {}
  },

  getAll(): string[] {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  clear() {
    try { sessionStorage.removeItem(KEY); } catch {}
  },
};
