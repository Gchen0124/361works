import { useCallback, useEffect, useState } from 'react';
import { journalAPI } from '@/lib/journalAPI';
import type { JournalEntries } from '@/hooks/useJournalData';

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
}

export function useTimeMachine(year: number) {
  const [state, setState] = useState<TimeMachineState>({
    timeline: [],
    selectedIndex: -1,
    snapshot: null,
    loading: false,
    error: null,
  });

  const loadTimeline = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const tl = await journalAPI.getTimeline(year);
      setState((s) => ({ ...s, timeline: tl, selectedIndex: tl.length > 0 ? tl.length - 1 : -1, loading: false }));
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message ?? 'Failed to load timeline' }));
    }
  }, [year]);

  const loadSnapshotAt = useCallback(async (index: number) => {
    setState((s) => ({ ...s, loading: true, error: null, selectedIndex: index }));
    try {
      const tl = state.timeline;
      if (index < 0 || index >= tl.length) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const ts = tl[index].timestamp;
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
  }, [state.timeline.length]);

  return {
    ...state,
    reloadTimeline: loadTimeline,
    setIndex: loadSnapshotAt,
  };
}
