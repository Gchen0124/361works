import { apiRequest } from '@/lib/queryClient';
import type { JournalMode, JournalEntries } from '@/hooks/useJournalData';

// Types for API communication - now aligned with database structure
export interface JournalSnapshot {
  id?: number;
  user_id: string;
  snapshot_timestamp: Date;
  year: number;
  day_contents: JournalEntries; // Now directly uses day_XXX format
  metadata?: Record<string, any>;
}

export interface DailySnapshot {
  id?: number;
  user_id: string;
  snapshot_date: Date;
  year: number;
  latest_plan_contents: JournalEntries; // Now directly uses day_XXX format
  latest_reality_contents: JournalEntries; // Now directly uses day_XXX format
  plan_last_updated?: Date | null;
  reality_last_updated?: Date | null;
  completion_rate?: number;
}

export class JournalAPI {
  private static instance: JournalAPI;
  private userId: string = 'default-user'; // In a real app, this would come from auth

  // Backend server URL; automatically detects production vs development
  private baseURL: string = this.getBaseURL();

  private getBaseURL(): string {
    // 1. Check for explicit environment variable (highest priority)
    if ((import.meta as any)?.env?.VITE_API_BASE_URL) {
      return (import.meta as any).env.VITE_API_BASE_URL;
    }

    // 2. Browser environment
    if (typeof window !== 'undefined') {
      // Production: Use same origin (no port needed - Render handles routing)
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return `${window.location.protocol}//${window.location.host}`;  // ✅ Uses same host
      }

      // Local development: Use port 5001
      return `${window.location.protocol}//${window.location.hostname}:5001`;
    }

    // 3. Server-side fallback (shouldn't reach here in practice)
    return 'http://localhost:5001';
  }

  static getInstance(): JournalAPI {
    if (!JournalAPI.instance) {
      JournalAPI.instance = new JournalAPI();
    }
    return JournalAPI.instance;
  }

  async saveSnapshot(mode: JournalMode, entries: JournalEntries, year: number): Promise<JournalSnapshot> {
    const endpoint = mode === 'plan' ? '/api/matrix/plan' : '/api/matrix/reality';

    const snapshot: Partial<JournalSnapshot> = {
      user_id: this.userId,
      snapshot_timestamp: new Date(),
      year,
      day_contents: entries, // Direct pass-through - no conversion needed!
      metadata: {
        mode,
        entry_count: Object.keys(entries).length,
        saved_at: new Date().toISOString()
      }
    };

    try {
      const response = await apiRequest('POST', `${this.baseURL}${endpoint}`, snapshot);
      const result = await response.json();
      console.log(`✅ Saved ${mode} snapshot with ${Object.keys(entries).length} entries`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to save ${mode} snapshot:`, error);
      throw error;
    }
  }

  async getDailySnapshot(year: number): Promise<DailySnapshot | null> {
    try {
      const response = await apiRequest('GET', `${this.baseURL}/api/matrix/${this.userId}/${year}/daily`);
      const result = await response.json();

      if (result) {
        // Direct pass-through - no conversion needed!
        return result;
      }
      return null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null; // No snapshot exists yet
      }
      console.error('❌ Failed to get daily snapshot:', error);
      throw error;
    }
  }

  async getAllSnapshots(mode: JournalMode, year: number): Promise<JournalSnapshot[]> {
    const endpoint = mode === 'plan' ? `/api/matrix/${this.userId}/${year}/plans` : `/api/matrix/${this.userId}/${year}/realities`;

    try {
      const response = await apiRequest('GET', `${this.baseURL}${endpoint}`);
      const results = await response.json();

      // Direct pass-through - no conversion needed!
      return results;
    } catch (error) {
      console.error(`❌ Failed to get ${mode} snapshots:`, error);
      throw error;
    }
  }

  async getTimeline(year: number): Promise<any[]> {
    try {
      const response = await apiRequest('GET', `${this.baseURL}/api/timemachine/${this.userId}/${year}/timeline`);
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get timeline:', error);
      throw error;
    }
  }

  async getTimeMachineSnapshot(year: number, timestamp: string): Promise<{
    timestamp: string;
    year: number;
    plan_contents: JournalEntries;
    reality_contents: JournalEntries;
    metadata?: Record<string, any>;
  }> {
    try {
      const response = await apiRequest('GET', `${this.baseURL}/api/timemachine/${this.userId}/${year}/snapshot/${encodeURIComponent(timestamp)}`);
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get time machine snapshot:', error);
      throw error;
    }
  }

  async exportData(year: number, format: 'json' | 'csv' = 'json'): Promise<any> {
    try {
      const endpoint = format === 'csv'
        ? `/api/export/${this.userId}/${year}/matrix-csv`
        : `/api/export/${this.userId}/${year}`;

      const response = await apiRequest('GET', `${this.baseURL}${endpoint}`);

      if (format === 'csv') {
        return await response.text();
      } else {
        return await response.json();
      }
    } catch (error) {
      console.error(`❌ Failed to export ${format} data:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await apiRequest('GET', `${this.baseURL}/api/health`);
      const result = await response.json();
      return result.status === 'ok';
    } catch (error) {
      console.error('❌ API health check failed:', error);
      return false;
    }
  }
}

export const journalAPI = JournalAPI.getInstance();
