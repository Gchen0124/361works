import type { JournalEntries } from '@/hooks/useJournalData';
import { getNamespacedKey } from '@/lib/userStorage';

export interface LocalTimelineSnapshot {
  timestamp: string;
  year: number;
  plan_contents: JournalEntries;
  reality_contents: JournalEntries;
}

const MAX_LOCAL_SNAPSHOTS = 40;

const getTimelineKey = (userKey: string, year: number) =>
  getNamespacedKey(userKey, `local-timeline-${year}`);

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }
  return window.localStorage;
};

export function loadLocalTimeline(userKey: string, year: number): LocalTimelineSnapshot[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(getTimelineKey(userKey, year));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as LocalTimelineSnapshot[];
    }
    return [];
  } catch (error) {
    console.warn('Failed to load local timeline:', error);
    return [];
  }
}

function persistLocalTimeline(userKey: string, year: number, snapshots: LocalTimelineSnapshot[]): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(getTimelineKey(userKey, year), JSON.stringify(snapshots));
  } catch (error) {
    console.warn('Failed to persist local timeline:', error);
  }
}

function entriesSignature(plan: JournalEntries, reality: JournalEntries): string {
  return JSON.stringify({ plan_contents: plan, reality_contents: reality });
}

export function appendLocalSnapshot(
  userKey: string,
  year: number,
  snapshot: Omit<LocalTimelineSnapshot, 'timestamp' | 'year'> & { timestamp?: string; year?: number },
): LocalTimelineSnapshot[] {
  const existing = loadLocalTimeline(userKey, year);
  const timestamp = snapshot.timestamp ?? new Date().toISOString();

  const planClone = JSON.parse(JSON.stringify(snapshot.plan_contents ?? {}));
  const realityClone = JSON.parse(JSON.stringify(snapshot.reality_contents ?? {}));

  const newSnapshot: LocalTimelineSnapshot = {
    timestamp,
    year,
    plan_contents: planClone,
    reality_contents: realityClone,
  };

  const last = existing[existing.length - 1];
  if (last) {
    const prevSig = entriesSignature(last.plan_contents, last.reality_contents);
    const nextSig = entriesSignature(newSnapshot.plan_contents, newSnapshot.reality_contents);
    if (prevSig === nextSig) {
      return existing;
    }
  }

  const updated = [...existing, newSnapshot];
  if (updated.length > MAX_LOCAL_SNAPSHOTS) {
    updated.splice(0, updated.length - MAX_LOCAL_SNAPSHOTS);
  }

  persistLocalTimeline(userKey, year, updated);
  return updated;
}

export function clearLocalTimeline(userKey: string, year: number): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(getTimelineKey(userKey, year));
}
