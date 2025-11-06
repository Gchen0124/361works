import { useCallback, useEffect, useRef, useState } from 'react';
import { journalAPI } from '@/lib/journalAPI';
import type { JournalEntries } from '@/hooks/useJournalData';
import { loadLocalTimeline, type LocalTimelineSnapshot } from '@/lib/localTimeline';
import { getUserStorageKey } from '@/lib/userStorage';

export interface TimeMachineState {
  timeline: { timestamp: string; entry_type: string }[];
  selectedIndex: number;
  snapshot: {
    timestamp: string;
    year: number;
    plan_contents: JournalEntries;
    reality_contents: JournalEntries;
  } | null;
  loading: boolean;
  error: string | null;
  timelineSource: 'remote' | 'local' | null;
}

interface UseTimeMachineOptions {
  userId?: string;
}

const createInitialTimeMachineState = (): TimeMachineState => ({
  timeline: [],
  selectedIndex: -1,
  snapshot: null,
  loading: false,
  error: null,
  timelineSource: null,
});

export function useTimeMachine(year: number, options: UseTimeMachineOptions = {}) {
  const storageUserKey = getUserStorageKey(options.userId);
  const [state, setState] = useState<TimeMachineState>(() => createInitialTimeMachineState());
  const localTimelineCache = useRef<Record<string, LocalTimelineSnapshot>>({});

  useEffect(() => {
    setState(createInitialTimeMachineState());
    localTimelineCache.current = {};
  }, [storageUserKey, year]);

  const loadTimeline = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const tl = await journalAPI.getTimeline(year);
      localTimelineCache.current = {};
      setState((s) => ({
        ...s,
        timeline: tl,
        selectedIndex: tl.length > 0 ? tl.length - 1 : -1,
        loading: false,
        timelineSource: 'remote',
      }));
    } catch (e: any) {
      const localTimeline = loadLocalTimeline(storageUserKey, year);
      if (localTimeline.length > 0) {
        localTimelineCache.current = localTimeline.reduce<Record<string, LocalTimelineSnapshot>>((acc, snapshot) => {
          acc[snapshot.timestamp] = snapshot;
          return acc;
        }, {});

        const timeline = localTimeline.map((snapshot) => ({
          timestamp: snapshot.timestamp,
          entry_type: 'local',
        }));

        setState((s) => ({
          ...s,
          timeline,
          selectedIndex: timeline.length - 1,
          loading: false,
          error: null,
          timelineSource: 'local',
        }));
      } else {
        localTimelineCache.current = {};
        setState((s) => ({
          ...s,
          loading: false,
          error: e?.message ?? 'Failed to load timeline',
          timelineSource: null,
          timeline: [],
          selectedIndex: -1,
          snapshot: null,
        }));
      }
    }
  }, [year, storageUserKey]);

  const loadSnapshotAt = useCallback(async (index: number) => {
    setState((s) => ({ ...s, loading: true, error: null, selectedIndex: index }));
    const tl = state.timeline;
    if (index < 0 || index >= tl.length) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    const ts = tl[index].timestamp;
    const localSnapshot = localTimelineCache.current[ts];

    if (localSnapshot) {
      setState((s) => ({ ...s, snapshot: localSnapshot, loading: false }));
      return;
    }

    try {
      const snap = await journalAPI.getTimeMachineSnapshot(year, ts);
      setState((s) => ({ ...s, snapshot: snap, loading: false }));
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message ?? 'Failed to load snapshot' }));
    }
  }, [state.timeline, year]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    if (state.timeline.length > 0 && state.selectedIndex >= 0) {
      loadSnapshotAt(state.selectedIndex);
    }
  }, [state.timeline.length, state.selectedIndex, loadSnapshotAt]);

  return {
    ...state,
    reloadTimeline: loadTimeline,
    setIndex: loadSnapshotAt,
  };
}
