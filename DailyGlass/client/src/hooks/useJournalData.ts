import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { journalAPI } from '@/lib/journalAPI';

export type JournalMode = 'plan' | 'reality';
export type JournalEntries = Record<string, string>;

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
  getCurrentEntries: () => JournalEntries;
  getEntryForMode: (date: Date, mode: JournalMode) => string;
  syncToDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
}

export function useJournalData(year: number): UseJournalDataReturn {
  const [journalData, setJournalData] = useState<JournalData>({
    planEntries: {},
    realityEntries: {},
    currentMode: 'plan', // Start with plan mode (dark mode equivalent)
    isOnline: false,
    lastSyncTimestamp: null
  });

  // Debounce timer for auto-save
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();

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
        const savedPlanEntries = localStorage.getItem(`journal-plan-${year}`);
        const planEntries = savedPlanEntries ? JSON.parse(savedPlanEntries) : {};

        // Load reality entries
        const savedRealityEntries = localStorage.getItem(`journal-reality-${year}`);
        const realityEntries = savedRealityEntries ? JSON.parse(savedRealityEntries) : {};

        // Load current mode preference
        const savedMode = localStorage.getItem('journal-current-mode') as JournalMode;
        const currentMode = savedMode || 'plan';

        // Load last sync timestamp
        const lastSyncStr = localStorage.getItem(`journal-last-sync-${year}`);
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
  }, [year, checkConnectivity]);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(journalData.planEntries).length > 0) {
      localStorage.setItem(`journal-plan-${year}`, JSON.stringify(journalData.planEntries));
      console.log(`💾 Saved ${Object.keys(journalData.planEntries).length} plan entries for ${year}`);
    }
  }, [journalData.planEntries, year]);

  useEffect(() => {
    if (Object.keys(journalData.realityEntries).length > 0) {
      localStorage.setItem(`journal-reality-${year}`, JSON.stringify(journalData.realityEntries));
      console.log(`💾 Saved ${Object.keys(journalData.realityEntries).length} reality entries for ${year}`);
    }
  }, [journalData.realityEntries, year]);

  useEffect(() => {
    localStorage.setItem('journal-current-mode', journalData.currentMode);
  }, [journalData.currentMode]);

  useEffect(() => {
    if (journalData.lastSyncTimestamp) {
      localStorage.setItem(`journal-last-sync-${year}`, journalData.lastSyncTimestamp.toISOString());
    }
  }, [journalData.lastSyncTimestamp, year]);

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
    const dateKey = format(date, 'yyyy-MM-dd');

    setJournalData(prev => {
      const updatedData = { ...prev };

      if (prev.currentMode === 'plan') {
        updatedData.planEntries = {
          ...prev.planEntries,
          [dateKey]: content
        };
        // Remove empty entries
        if (!content.trim()) {
          delete updatedData.planEntries[dateKey];
        }

        // Auto-save to database
        autoSaveToDatabase('plan', updatedData.planEntries);
      } else {
        updatedData.realityEntries = {
          ...prev.realityEntries,
          [dateKey]: content
        };
        // Remove empty entries
        if (!content.trim()) {
          delete updatedData.realityEntries[dateKey];
        }

        // Auto-save to database
        autoSaveToDatabase('reality', updatedData.realityEntries);
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
    const dateKey = format(date, 'yyyy-MM-dd');
    const entries = mode === 'plan' ? journalData.planEntries : journalData.realityEntries;
    return entries[dateKey] || '';
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
    getCurrentEntries,
    getEntryForMode,
    syncToDatabase,
    loadFromDatabase
  };
}