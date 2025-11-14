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

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Check API connectivity
  const checkConnectivity = useCallback(async () => {
    try {
      const isHealthy = await journalAPI.healthCheck();
      if (isMountedRef.current) {
        setJournalData(prev => ({ ...prev, isOnline: isHealthy }));
      }
      return isHealthy;
    } catch (error) {
      if (isMountedRef.current) {
        setJournalData(prev => ({ ...prev, isOnline: false }));
      }
      return false;
    }
  }, []);

  // Load data from localStorage and optionally from database
  useEffect(() => {
    const loadJournalData = async () => {
      try {
        // Load plan entries
        const savedPlanEntries = localStorage.getItem(`journal-plan-${year}`);
        const planEntries = savedPlanEntries ? migrateOldFormatToNewFormat(JSON.parse(savedPlanEntries), year) : {};

        // Load reality entries
        const savedRealityEntries = localStorage.getItem(`journal-reality-${year}`);
        const realityEntries = savedRealityEntries ? migrateOldFormatToNewFormat(JSON.parse(savedRealityEntries), year) : {};

        // Load current mode preference
        const savedMode = localStorage.getItem('journal-current-mode') as JournalMode;
        const currentMode = savedMode || 'plan';

        // Load last sync timestamp
        const lastSyncStr = localStorage.getItem(`journal-last-sync-${year}`);
        const lastSyncTimestamp = lastSyncStr ? new Date(lastSyncStr) : null;

        if (isMountedRef.current) {
          setJournalData({
            planEntries,
            realityEntries,
            currentMode,
            isOnline: false, // Will be updated by connectivity check
            lastSyncTimestamp
          });
        }

        console.log(`🔄 Loaded journal data for ${year}:`, {
          planCount: Object.keys(planEntries).length,
          realityCount: Object.keys(realityEntries).length,
          currentMode,
          lastSync: lastSyncTimestamp?.toISOString()
        });

        // Check connectivity and try to sync with database
        const isOnline = await checkConnectivity();
        if (isOnline && isMountedRef.current) {
          try {
            await loadFromDatabaseInternal(planEntries, realityEntries, lastSyncTimestamp);
          } catch (error) {
            console.warn('Failed to load from database, using localStorage data:', error);
          }
        }

      } catch (error) {
        console.error('Failed to load journal data:', error);
        if (isMountedRef.current) {
          setJournalData({
            planEntries: {},
            realityEntries: {},
            currentMode: 'plan',
            isOnline: false,
            lastSyncTimestamp: null
          });
        }
      }
    };

    loadJournalData();
  }, [year]); // Remove checkConnectivity from dependencies

  // Save data to localStorage whenever it changes
  // IMPORTANT: Always save, even if empty (to handle deletion case)
  useEffect(() => {
    try {
      localStorage.setItem(`journal-plan-${year}`, JSON.stringify(journalData.planEntries));
      console.log(`💾 Saved ${Object.keys(journalData.planEntries).length} plan entries to localStorage for ${year}`);
    } catch (error) {
      console.error('Failed to save plan entries to localStorage:', error);
    }
  }, [journalData.planEntries, year]);

  useEffect(() => {
    try {
      localStorage.setItem(`journal-reality-${year}`, JSON.stringify(journalData.realityEntries));
      console.log(`💾 Saved ${Object.keys(journalData.realityEntries).length} reality entries to localStorage for ${year}`);
    } catch (error) {
      console.error('Failed to save reality entries to localStorage:', error);
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

  // Internal database loading function with conflict resolution
  const loadFromDatabaseInternal = useCallback(async (
    localPlanEntries?: JournalEntries,
    localRealityEntries?: JournalEntries,
    localLastSync?: Date | null
  ) => {
    try {
      const dailySnapshot = await journalAPI.getDailySnapshot(year);
      if (!dailySnapshot) {
        console.log('📥 No database snapshot found, will create on first save');
        return;
      }

      // Conflict resolution: merge local and database data
      // If local data is newer (modified after last sync), keep it; otherwise use database
      const dbPlanEntries = dailySnapshot.latest_plan_contents || {};
      const dbRealityEntries = dailySnapshot.latest_reality_contents || {};

      // Check if we have local changes that are newer
      const hasLocalChanges = localPlanEntries || localRealityEntries;
      const dbLastUpdated = dailySnapshot.updated_at ? new Date(dailySnapshot.updated_at) : null;

      let finalPlanEntries = dbPlanEntries;
      let finalRealityEntries = dbRealityEntries;

      if (hasLocalChanges && localLastSync && dbLastUpdated) {
        // If local sync is newer than db, prefer local (user made changes offline)
        if (localLastSync > dbLastUpdated) {
          console.log('⚠️ Local data is newer than database, keeping local changes');
          finalPlanEntries = localPlanEntries || {};
          finalRealityEntries = localRealityEntries || {};
          // Trigger save to sync local changes to database
          setTimeout(() => {
            if (localPlanEntries && Object.keys(localPlanEntries).length > 0) {
              journalAPI.saveSnapshot('plan', localPlanEntries, year).catch(console.error);
            }
            if (localRealityEntries && Object.keys(localRealityEntries).length > 0) {
              journalAPI.saveSnapshot('reality', localRealityEntries, year).catch(console.error);
            }
          }, 100);
        } else {
          console.log('📥 Database data is newer, using database');
        }
      } else {
        console.log('📥 No local changes or timestamps, using database');
      }

      if (isMountedRef.current) {
        setJournalData(prev => ({
          ...prev,
          planEntries: finalPlanEntries,
          realityEntries: finalRealityEntries,
          lastSyncTimestamp: new Date()
        }));
      }

      console.log('📥 Loaded data from database:', {
        planCount: Object.keys(finalPlanEntries).length,
        realityCount: Object.keys(finalRealityEntries).length
      });
    } catch (error) {
      console.error('Failed to load from database:', error);
      throw error;
    }
  }, [year]);

  // Auto-save to database (debounced) - uses ref to avoid stale closure
  const autoSaveToDatabase = useCallback((mode: JournalMode, entries: JournalEntries, isOnline: boolean) => {
    if (!isOnline) {
      console.log(`⏸️ Skipping auto-save for ${mode} (offline)`);
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        console.log(`🔄 Auto-saving ${mode} to database...`);
        await journalAPI.saveSnapshot(mode, entries, year);

        if (isMountedRef.current) {
          setJournalData(prev => ({
            ...prev,
            lastSyncTimestamp: new Date()
          }));
        }

        console.log(`✅ Auto-saved ${mode} to database successfully`);
      } catch (error) {
        console.error(`❌ Failed to auto-save ${mode} to database:`, error);
        // Retry once after 5 seconds
        setTimeout(async () => {
          try {
            console.log(`🔄 Retrying auto-save for ${mode}...`);
            await journalAPI.saveSnapshot(mode, entries, year);
            if (isMountedRef.current) {
              setJournalData(prev => ({
                ...prev,
                lastSyncTimestamp: new Date()
              }));
            }
            console.log(`✅ Retry successful for ${mode}`);
          } catch (retryError) {
            console.error(`❌ Retry failed for ${mode}:`, retryError);
          }
        }, 5000);
      }
    }, 2000); // 2-second debounce
  }, [year]);

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

        // Auto-save to database with current state
        autoSaveToDatabase('plan', updatedData.planEntries, prev.isOnline);
      } else {
        updatedData.realityEntries = {
          ...prev.realityEntries,
          [dayKey]: content
        };
        // Remove empty entries
        if (!content.trim()) {
          delete updatedData.realityEntries[dayKey];
        }

        // Auto-save to database with current state
        autoSaveToDatabase('reality', updatedData.realityEntries, prev.isOnline);
      }

      return updatedData;
    });
  }, [year, autoSaveToDatabase]);

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

  // Cleanup timers and set mounted flag
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
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