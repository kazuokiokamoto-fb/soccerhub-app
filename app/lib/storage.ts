export function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function safeSave<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// “初回だけ”デモ投入（本番と同じ localStorage を使う）
export function loadOrSeedArray<T>(key: string, demo: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      safeSave(key, demo);
      return demo;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as T[];
    safeSave(key, demo);
    return demo;
  } catch {
    safeSave(key, demo);
    return demo;
  }
}