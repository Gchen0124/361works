import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { journalAPI } from '@/lib/journalAPI';

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

// Migration function to convert old date format to new day format
function migrateOldFormatToNewFormat(entries: Record<string, string>, year: number): Record<string, string> {
  const migratedEntries: Record<string, string> = {};

  Object.entries(entries).forEach(([key, content]) => {
    if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Old date format (YYYY-MM-DD)
      const date = new Date(key);
      if (!isNaN(date.getTime()) && date.getFullYear() === year) {
        const dayKey = dateToDay(date, year);
        migratedEntries[dayKey] = content;
      }
    } else if (key.startsWith('day_')) {
      // Already new format
      migratedEntries[key] = content;
    }
  });

  return migratedEntries;
}

// Helper function to load and migrate data from localStorage
function loadFromLocalStorage(key: string, year: number): JournalEntries {
  const savedData = localStorage.getItem(key);
  if (!savedData) return {};
  try {
    return migrateOldFormatToNewFormat(JSON.parse(savedData), year);
  } catch (error) {
    console.error(`Failed to parse localStorage data for ${key}:`, error);
    return {};
  }
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

  // Load data from localStorage and database (prioritizing database)
  useEffect(() => {
    const loadJournalData = async () => {
      try {
        // Load current mode preference from localStorage first
        const savedMode = localStorage.getItem('journal-current-mode') as JournalMode;
        const currentMode = savedMode || 'plan';

        // Load last sync timestamp
        const lastSyncStr = localStorage.getItem(`journal-last-sync-${year}`);
        const lastSyncTimestamp = lastSyncStr ? new Date(lastSyncStr) : null;

        // Check connectivity first
        const isOnline = await checkConnectivity();

        let planEntries: JournalEntries = {};
        let realityEntries: JournalEntries = {};

        if (isOnline) {
          // PRIORITY 1: Try to load from database if online
          try {
            console.log('🌐 Online - loading from database...');
            const dailySnapshot = await journalAPI.getDailySnapshot(year);
            if (dailySnapshot) {
              planEntries = dailySnapshot.latest_plan_contents || {};
              realityEntries = dailySnapshot.latest_reality_contents || {};
              console.log(`✅ Loaded from database: ${Object.keys(planEntries).length} plan, ${Object.keys(realityEntries).length} reality entries`);

              // Update localStorage with fresh database data
              if (Object.keys(planEntries).length > 0) {
                localStorage.setItem(`journal-plan-${year}`, JSON.stringify(planEntries));
              }
              if (Object.keys(realityEntries).length > 0) {
                localStorage.setItem(`journal-reality-${year}`, JSON.stringify(realityEntries));
              }
              localStorage.setItem(`journal-last-sync-${year}`, new Date().toISOString());
            } else {
              console.log('⚠️  No data in database, falling back to localStorage...');
              // Fallback to localStorage if no database data
              planEntries = loadFromLocalStorage(`journal-plan-${year}`, year);
              realityEntries = loadFromLocalStorage(`journal-reality-${year}`, year);
            }
          } catch (error) {
            console.warn('⚠️  Failed to load from database, using localStorage:', error);
            // Fallback to localStorage on error
            planEntries = loadFromLocalStorage(`journal-plan-${year}`, year);
            realityEntries = loadFromLocalStorage(`journal-reality-${year}`, year);
          }
        } else {
          // PRIORITY 2: Load from localStorage if offline
          console.log('📴 Offline - loading from localStorage...');
          planEntries = loadFromLocalStorage(`journal-plan-${year}`, year);
          realityEntries = loadFromLocalStorage(`journal-reality-${year}`, year);
        }

        setJournalData({
          planEntries,
          realityEntries,
          currentMode,
          isOnline,
          lastSyncTimestamp: isOnline ? new Date() : lastSyncTimestamp
        });

        console.log(`🔄 Loaded journal data for ${year}:`, {
          planCount: Object.keys(planEntries).length,
          realityCount: Object.keys(realityEntries).length,
          currentMode,
          source: isOnline ? 'database' : 'localStorage',
          lastSync: lastSyncTimestamp?.toISOString()
        });

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
    const dayKey = dateToDay(date, year);
    console.log(`✏️ Editing ${dayKey}: "${content.substring(0, 50)}..."`);

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
      } else {
        updatedData.realityEntries = {
          ...prev.realityEntries,
          [dayKey]: content
        };
        // Remove empty entries
        if (!content.trim()) {
          delete updatedData.realityEntries[dayKey];
        }
      }

      return updatedData;
    });

    // Trigger auto-save AFTER state update with a small delay to ensure state is updated
    setTimeout(() => {
      const mode = journalData.currentMode;
      const entries = mode === 'plan' ? journalData.planEntries : journalData.realityEntries;

      // Create updated entries with the new content
      const updatedEntries = {
        ...entries,
        [dayKey]: content
      };

      // Remove if empty
      if (!content.trim()) {
        delete updatedEntries[dayKey];
      }

      console.log(`📤 Triggering auto-save for ${dayKey} in ${mode} mode`);
      console.log(`📊 Total entries to save: ${Object.keys(updatedEntries).length}`);
      console.log(`🔍 ${dayKey} value in save data: "${updatedEntries[dayKey]?.substring(0, 50)}..."`);

      autoSaveToDatabase(mode, updatedEntries);
    }, 100); // Small delay to let state update
  }, [year, journalData.currentMode, journalData.planEntries, journalData.realityEntries, autoSaveToDatabase]);

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