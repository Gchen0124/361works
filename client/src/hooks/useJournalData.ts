import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format, getWeek } from 'date-fns';
import { journalAPI } from '@/lib/journalAPI';
import { appendLocalSnapshot } from '@/lib/localTimeline';
import { getNamespacedKey, getUserStorageKey } from '@/lib/userStorage';

export type JournalMode = 'plan' | 'reality';
// Updated to use day_XXX format aligned with database structure
export type JournalEntries = Record<string, string>; // day_001, day_002, etc.

// Helper functions for date/day conversion
export function dateToDay(date: Date, year: number): string {
  const dayOfYear = Math.floor((date.getTime() - new Date(year, 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  return `day_${String(dayOfYear).padStart(3, '0')}`;
}

export function dayToDate(dayKey: string, year: number): Date {
  const dayNumber = parseInt(dayKey.replace('day_', ''));
  return new Date(year, 0, dayNumber);
}

export function dateToWeekKey(date: Date, year: number): string {
  const weekNumber = getWeek(date, { weekStartsOn: 0, firstWeekContainsDate: 1 });
  return `week_${year}_${String(weekNumber).padStart(2, '0')}`;
}

// Migration function to convert old date format to new day format
function migrateOldFormatToNewFormat(entries: Record<string, string>, year: number): Record<string, string> {
  const migratedEntries: Record<string, string> = {};

  Object.entries(entries).forEach(([key, content]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      // Old date format (YYYY-MM-DD)
      const date = new Date(key);
      if (!isNaN(date.getTime()) && date.getFullYear() === year) {
        const dayKey = dateToDay(date, year);
        migratedEntries[dayKey] = content;
      }
      return;
    }

    if (key.startsWith('day_') || key.startsWith('week_')) {
      migratedEntries[key] = content;
      return;
    }

    // Preserve any other keyed entries so we do not drop future formats during migration
    migratedEntries[key] = content;
  });

  return migratedEntries;
}

interface JournalData {
  planEntries: JournalEntries;
  realityEntries: JournalEntries;
  currentMode: JournalMode;
  isOnline: boolean;
  lastSyncTimestamp: Date | null;
}

interface UseJournalDataReturn {
  planEntries: JournalEntries;
  realityEntries: JournalEntries;
  currentMode: JournalMode;
  isOnline: boolean;
  lastSyncTimestamp: Date | null;
  setCurrentMode: (mode: JournalMode) => void;
  updateEntry: (date: Date, content: string) => void;
  updateWeeklyEntry: (weekKey: string, content: string, mode?: JournalMode) => void;
  getCurrentEntries: () => JournalEntries;
  getEntryForMode: (date: Date, mode: JournalMode) => string;
  getWeeklyEntry: (weekKey: string, mode: JournalMode) => string;
  syncToDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
}

interface UseJournalDataOptions {
  userId?: string;
}

const buildInitialJournalState = (mode: JournalMode = 'plan'): JournalData => ({
  planEntries: {},
  realityEntries: {},
  currentMode: mode,
  isOnline: false,
  lastSyncTimestamp: null
});

export function useJournalData(year: number, options: UseJournalDataOptions = {}): UseJournalDataReturn {
  const storageUserKey = getUserStorageKey(options.userId);

  const storageKeys = useMemo(() => ({
    plan: getNamespacedKey(storageUserKey, `plan-${year}`),
    reality: getNamespacedKey(storageUserKey, `reality-${year}`),
    mode: getNamespacedKey(storageUserKey, 'current-mode'),
    lastSync: getNamespacedKey(storageUserKey, `last-sync-${year}`)
  }), [storageUserKey, year]);

  const [journalData, setJournalData] = useState<JournalData>(() => buildInitialJournalState());

  // Debounce timer for auto-save
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    journalAPI.setUser(options.userId ?? 'default-user');
  }, [options.userId]);

  useEffect(() => {
    setJournalData(buildInitialJournalState());
  }, [storageUserKey, year]);

  // Check API connectivity
  const checkConnectivity = useCallback(async () => {
    try {
      const isHealthy = await journalAPI.healthCheck();
      setJournalData(prev => ({ ...prev, isOnline: isHealthy }));
      return isHealthy;
    } catch (error) {
      setJournalData(prev => ({ ...prev, isOnline: false }));
      return false;
    }
  }, []);

  // Load data from localStorage and optionally from database
  useEffect(() => {
    const loadJournalData = async () => {
      try {
        // Load plan entries
        const savedPlanEntries = localStorage.getItem(storageKeys.plan);
        const planEntries = savedPlanEntries ? migrateOldFormatToNewFormat(JSON.parse(savedPlanEntries), year) : {};

        // Load reality entries
        const savedRealityEntries = localStorage.getItem(storageKeys.reality);
        const realityEntries = savedRealityEntries ? migrateOldFormatToNewFormat(JSON.parse(savedRealityEntries), year) : {};

        // Load current mode preference
        const savedMode = localStorage.getItem(storageKeys.mode) as JournalMode;
        const currentMode = savedMode || 'plan';

        // Load last sync timestamp
        const lastSyncStr = localStorage.getItem(storageKeys.lastSync);
        const lastSyncTimestamp = lastSyncStr ? new Date(lastSyncStr) : null;

        setJournalData({
          planEntries,
          realityEntries,
          currentMode,
          isOnline: false, // Will be updated by connectivity check
          lastSyncTimestamp
        });

        console.log(`🔄 Loaded journal data for ${year}:`, {
          planCount: Object.keys(planEntries).length,
          realityCount: Object.keys(realityEntries).length,
          currentMode,
          lastSync: lastSyncTimestamp?.toISOString()
        });

        // Check connectivity and try to sync with database
        const isOnline = await checkConnectivity();
        if (isOnline) {
          try {
            await loadFromDatabaseInternal();
          } catch (error) {
            console.warn('Failed to load from database, using localStorage data:', error);
          }
        }

      } catch (error) {
        console.error('Failed to load journal data:', error);
        setJournalData({
          planEntries: {},
          realityEntries: {},
          currentMode: 'plan',
          isOnline: false,
          lastSyncTimestamp: null
        });
      }
    };

    loadJournalData();
  }, [year, storageKeys, checkConnectivity]);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(journalData.planEntries).length > 0) {
      localStorage.setItem(storageKeys.plan, JSON.stringify(journalData.planEntries));
      console.log(`💾 Saved ${Object.keys(journalData.planEntries).length} plan entries for ${year}`);
    }
  }, [journalData.planEntries, storageKeys.plan]);

  useEffect(() => {
    if (Object.keys(journalData.realityEntries).length > 0) {
      localStorage.setItem(storageKeys.reality, JSON.stringify(journalData.realityEntries));
      console.log(`💾 Saved ${Object.keys(journalData.realityEntries).length} reality entries for ${year}`);
    }
  }, [journalData.realityEntries, storageKeys.reality]);

  // Persist lightweight timeline snapshots locally for offline Time Machine
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasEntries =
      Object.keys(journalData.planEntries).length > 0 ||
      Object.keys(journalData.realityEntries).length > 0;

    if (!hasEntries) return;

    const timer = setTimeout(() => {
      appendLocalSnapshot(storageUserKey, year, {
        plan_contents: journalData.planEntries,
        reality_contents: journalData.realityEntries,
      });
    }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, [journalData.planEntries, journalData.realityEntries, storageUserKey, year]);

  useEffect(() => {
    localStorage.setItem(storageKeys.mode, journalData.currentMode);
  }, [journalData.currentMode, storageKeys.mode]);

  useEffect(() => {
    if (journalData.lastSyncTimestamp) {
      localStorage.setItem(storageKeys.lastSync, journalData.lastSyncTimestamp.toISOString());
    }
  }, [journalData.lastSyncTimestamp, storageKeys.lastSync]);

  // Internal database loading function
  const loadFromDatabaseInternal = useCallback(async () => {
    try {
      const dailySnapshot = await journalAPI.getDailySnapshot(year);
      if (dailySnapshot) {
        setJournalData(prev => ({
          ...prev,
          planEntries: dailySnapshot.latest_plan_contents,
          realityEntries: dailySnapshot.latest_reality_contents,
          lastSyncTimestamp: new Date()
        }));
        console.log('📥 Loaded latest data from database');
      }
    } catch (error) {
      console.error('Failed to load from database:', error);
      throw error;
    }
  }, [year]);

  // Auto-save to database (debounced)
  const autoSaveToDatabase = useCallback(async (mode: JournalMode, entries: JournalEntries) => {
    if (!journalData.isOnline) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await journalAPI.saveSnapshot(mode, entries, year);
        setJournalData(prev => ({
          ...prev,
          lastSyncTimestamp: new Date()
        }));
        console.log(`🔄 Auto-saved ${mode} to database`);
      } catch (error) {
        console.error(`Failed to auto-save ${mode} to database:`, error);
      }
    }, 2000); // 2-second debounce
  }, [journalData.isOnline, year]);

  const setCurrentMode = useCallback((mode: JournalMode) => {
    setJournalData(prev => ({ ...prev, currentMode: mode }));
    console.log(`📝 Switched to ${mode} mode`);
  }, []);

  const updateEntry = useCallback((date: Date, content: string) => {
    const dayKey = dateToDay(date, year);

    setJournalData(prev => {
      const updatedData = { ...prev };

      if (prev.currentMode === 'plan') {
        updatedData.planEntries = {
          ...prev.planEntries,
          [dayKey]: content
        };
        // Remove empty entries
        if (!content.trim()) {
          delete updatedData.planEntries[dayKey];
        }

        // Auto-save to database
        autoSaveToDatabase('plan', updatedData.planEntries);
      } else {
        updatedData.realityEntries = {
          ...prev.realityEntries,
          [dayKey]: content
        };
        // Remove empty entries
        if (!content.trim()) {
          delete updatedData.realityEntries[dayKey];
        }

        // Auto-save to database
        autoSaveToDatabase('reality', updatedData.realityEntries);
      }

      return updatedData;
    });
  }, [autoSaveToDatabase]);

  const updateWeeklyEntry = useCallback((weekKey: string, content: string, mode?: JournalMode) => {
    setJournalData(prev => {
      const targetMode = mode ?? prev.currentMode;
      const updatedData = { ...prev };

      if (targetMode === 'plan') {
        const updatedPlan = {
          ...prev.planEntries,
          [weekKey]: content
        };

        if (!content.trim()) {
          delete updatedPlan[weekKey];
        }

        updatedData.planEntries = updatedPlan;
        autoSaveToDatabase('plan', updatedPlan);
      } else {
        const updatedReality = {
          ...prev.realityEntries,
          [weekKey]: content
        };

        if (!content.trim()) {
          delete updatedReality[weekKey];
        }

        updatedData.realityEntries = updatedReality;
        autoSaveToDatabase('reality', updatedReality);
      }

      return updatedData;
    });
  }, [autoSaveToDatabase]);

  const getCurrentEntries = useCallback((): JournalEntries => {
    return journalData.currentMode === 'plan'
      ? journalData.planEntries
      : journalData.realityEntries;
  }, [journalData.currentMode, journalData.planEntries, journalData.realityEntries]);

  const getEntryForMode = useCallback((date: Date, mode: JournalMode): string => {
    const dayKey = dateToDay(date, year);
    const entries = mode === 'plan' ? journalData.planEntries : journalData.realityEntries;
    return entries[dayKey] || '';
  }, [journalData.planEntries, journalData.realityEntries, year]);

  const getWeeklyEntry = useCallback((weekKey: string, mode: JournalMode): string => {
    const entries = mode === 'plan' ? journalData.planEntries : journalData.realityEntries;
    return entries[weekKey] || '';
  }, [journalData.planEntries, journalData.realityEntries]);

  const syncToDatabase = useCallback(async () => {
    if (!journalData.isOnline) {
      throw new Error('Cannot sync: API is offline');
    }

    try {
      // Save both plan and reality to database
      await Promise.all([
        journalAPI.saveSnapshot('plan', journalData.planEntries, year),
        journalAPI.saveSnapshot('reality', journalData.realityEntries, year)
      ]);

      setJournalData(prev => ({
        ...prev,
        lastSyncTimestamp: new Date()
      }));

      console.log('✅ Manual sync completed');
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      throw error;
    }
  }, [journalData.isOnline, journalData.planEntries, journalData.realityEntries, year]);

  const loadFromDatabase = useCallback(async () => {
    if (!journalData.isOnline) {
      throw new Error('Cannot load: API is offline');
    }

    await loadFromDatabaseInternal();
  }, [journalData.isOnline, loadFromDatabaseInternal]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  return {
    planEntries: journalData.planEntries,
    realityEntries: journalData.realityEntries,
    currentMode: journalData.currentMode,
    isOnline: journalData.isOnline,
    lastSyncTimestamp: journalData.lastSyncTimestamp,
    setCurrentMode,
    updateEntry,
    updateWeeklyEntry,
    getCurrentEntries,
    getEntryForMode,
    getWeeklyEntry,
    syncToDatabase,
    loadFromDatabase
  };
}
