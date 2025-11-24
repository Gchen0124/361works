/**
 * localStorage Migration Script
 *
 * Recovers data stored under old key formats and migrates to new namespaced format.
 * This fixes data loss when rolling back commits that changed localStorage key structure.
 */

import { getUserStorageKey, getNamespacedKey } from './userStorage';

interface MigrationResult {
  success: boolean;
  migratedKeys: string[];
  errors: string[];
  summary: {
    planEntries: number;
    realityEntries: number;
    timelines: number;
    other: number;
  };
}

/**
 * Detects old localStorage keys that need migration
 */
function detectOldKeys(): string[] {
  const oldKeys: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // Old format patterns (before user namespacing):
    // - journal-plan-YYYY
    // - journal-reality-YYYY
    // - journal-current-mode
    // - journal-last-sync-YYYY
    // - journal-local-timeline-YYYY

    if (key.match(/^journal-(plan|reality|current-mode|last-sync|local-timeline)-/)) {
      // Check if it's NOT already namespaced (doesn't have user key in middle)
      if (!key.match(/^journal-.+--.+/)) {
        oldKeys.push(key);
      }
    }
  }

  return oldKeys;
}

/**
 * Parses old key format and extracts metadata
 */
function parseOldKey(oldKey: string): { type: string; year?: number; suffix: string } | null {
  // journal-plan-2025 -> { type: 'plan', year: 2025, suffix: 'plan-2025' }
  // journal-reality-2025 -> { type: 'reality', year: 2025, suffix: 'reality-2025' }
  // journal-current-mode -> { type: 'mode', suffix: 'current-mode' }
  // journal-last-sync-2025 -> { type: 'sync', year: 2025, suffix: 'last-sync-2025' }
  // journal-local-timeline-2025 -> { type: 'timeline', year: 2025, suffix: 'local-timeline-2025' }

  const match = oldKey.match(/^journal-(.+)$/);
  if (!match) return null;

  const suffix = match[1];
  const yearMatch = suffix.match(/-(\d{4})$/);
  const year = yearMatch ? parseInt(yearMatch[1]) : undefined;

  let type = 'other';
  if (suffix.startsWith('plan-')) type = 'plan';
  else if (suffix.startsWith('reality-')) type = 'reality';
  else if (suffix.startsWith('last-sync-')) type = 'sync';
  else if (suffix.startsWith('local-timeline-')) type = 'timeline';
  else if (suffix === 'current-mode') type = 'mode';

  return { type, year, suffix };
}

/**
 * Migrates a single key to new namespaced format
 */
function migrateKey(oldKey: string, targetUserId: string): { success: boolean; newKey?: string; error?: string } {
  try {
    const metadata = parseOldKey(oldKey);
    if (!metadata) {
      return { success: false, error: 'Could not parse old key format' };
    }

    const userKey = getUserStorageKey(targetUserId);
    const newKey = getNamespacedKey(userKey, metadata.suffix);

    // Check if new key already exists
    const existingNewValue = localStorage.getItem(newKey);
    const oldValue = localStorage.getItem(oldKey);

    if (!oldValue) {
      return { success: false, error: 'Old key has no value' };
    }

    if (existingNewValue) {
      // New key exists - need to decide merge strategy
      console.warn(`⚠️ Key collision: ${newKey} already exists. Old data preserved separately.`);

      // For safety, we'll create a backup key and not overwrite
      const backupKey = `${oldKey}-backup-${Date.now()}`;
      localStorage.setItem(backupKey, oldValue);

      return {
        success: true,
        newKey: backupKey,
        error: 'Collision: saved as backup instead'
      };
    }

    // Safe to migrate
    localStorage.setItem(newKey, oldValue);
    localStorage.removeItem(oldKey);

    return { success: true, newKey };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main migration function
 */
export function migrateLocalStorageToNamespaced(targetUserId?: string | null): MigrationResult {
  const userId = targetUserId || 'default-user';
  const oldKeys = detectOldKeys();

  const result: MigrationResult = {
    success: true,
    migratedKeys: [],
    errors: [],
    summary: {
      planEntries: 0,
      realityEntries: 0,
      timelines: 0,
      other: 0
    }
  };

  console.log(`🔄 Starting localStorage migration for user: ${userId}`);
  console.log(`📦 Found ${oldKeys.length} old keys to migrate`);

  for (const oldKey of oldKeys) {
    const migrationResult = migrateKey(oldKey, userId);

    if (migrationResult.success) {
      result.migratedKeys.push(oldKey);

      // Update summary
      const metadata = parseOldKey(oldKey);
      if (metadata) {
        if (metadata.type === 'plan') result.summary.planEntries++;
        else if (metadata.type === 'reality') result.summary.realityEntries++;
        else if (metadata.type === 'timeline') result.summary.timelines++;
        else result.summary.other++;
      }

      console.log(`✅ Migrated: ${oldKey} → ${migrationResult.newKey}`);

      if (migrationResult.error) {
        console.warn(`⚠️ ${migrationResult.error}`);
      }
    } else {
      result.success = false;
      result.errors.push(`${oldKey}: ${migrationResult.error}`);
      console.error(`❌ Failed: ${oldKey} - ${migrationResult.error}`);
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`  Plan entries: ${result.summary.planEntries}`);
  console.log(`  Reality entries: ${result.summary.realityEntries}`);
  console.log(`  Timelines: ${result.summary.timelines}`);
  console.log(`  Other: ${result.summary.other}`);
  console.log(`  Total migrated: ${result.migratedKeys.length}`);
  console.log(`  Errors: ${result.errors.length}`);

  return result;
}

/**
 * Lists all current localStorage keys for debugging
 */
export function debugListLocalStorageKeys(): void {
  console.log('📋 Current localStorage keys:');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('journal-')) {
      const value = localStorage.getItem(key);
      const size = value ? (value.length / 1024).toFixed(2) : '0';
      console.log(`  ${key} (${size} KB)`);
    }
  }
}

/**
 * Auto-migration hook that runs on app startup
 */
export function autoMigrateIfNeeded(currentUserId?: string | null): void {
  const MIGRATION_FLAG_KEY = 'journal-migration-completed';

  // Check if migration already completed
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
    console.log('✓ localStorage migration already completed');
    return;
  }

  const oldKeys = detectOldKeys();
  if (oldKeys.length === 0) {
    console.log('✓ No old keys found, migration not needed');
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return;
  }

  console.log(`🔧 Auto-migration triggered: ${oldKeys.length} keys need migration`);
  const result = migrateLocalStorageToNamespaced(currentUserId);

  if (result.success && result.errors.length === 0) {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    console.log('✅ Auto-migration completed successfully');
  } else {
    console.warn('⚠️ Auto-migration completed with errors', result.errors);
  }
}
