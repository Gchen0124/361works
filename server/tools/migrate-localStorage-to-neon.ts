/**
 * Migrate localStorage Data to Neon Database
 *
 * This script takes your exported localStorage JSON file and migrates it to Neon.
 *
 * Usage:
 * 1. Export your data using export-localStorage.html
 * 2. Save the JSON file as 'localStorage-backup.json' in the project root
 * 3. Run: npm run migrate-local-data
 */

import { db, initializeDatabase } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';
import * as storage from '../storage';

interface LocalStorageExport {
  timestamp: string;
  source: string;
  data: Record<string, string>;
}

interface JournalEntries {
  [key: string]: string; // day_001, day_002, etc. or old format YYYY-MM-DD
}

// Migration function to convert old date format to new day format
function migrateOldFormatToNewFormat(entries: JournalEntries, year: number): JournalEntries {
  const migratedEntries: JournalEntries = {};

  Object.entries(entries).forEach(([key, content]) => {
    if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Old date format (YYYY-MM-DD)
      const date = new Date(key);
      if (!isNaN(date.getTime()) && date.getFullYear() === year) {
        const dayOfYear = Math.floor(
          (date.getTime() - new Date(year, 0, 0).getTime()) / (1000 * 60 * 60 * 24)
        );
        const dayKey = `day_${String(dayOfYear).padStart(3, '0')}`;
        migratedEntries[dayKey] = content;
      }
    } else if (key.startsWith('day_')) {
      // Already new format
      migratedEntries[key] = content;
    }
  });

  return migratedEntries;
}

async function migrateData() {
  console.log('🚀 Starting localStorage to Neon migration...\n');

  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database connected\n');

    // Check if default user exists
    const existingUsers = await db.select().from(users).where(eq(users.id, 'default-user'));
    if (existingUsers.length === 0) {
      console.log('❌ Default user not found. Run: npm run db:setup first');
      process.exit(1);
    }
    console.log('✅ Default user found\n');

    // Read exported localStorage file
    let backupData: LocalStorageExport;
    try {
      const fileContent = readFileSync('./localStorage-backup.json', 'utf-8');
      backupData = JSON.parse(fileContent);
      console.log(`📂 Loaded backup from: ${backupData.timestamp}\n`);
    } catch (error) {
      console.error('❌ Could not read localStorage-backup.json');
      console.error('💡 Make sure you:');
      console.error('   1. Opened export-localStorage.html in your browser');
      console.error('   2. Downloaded the JSON file');
      console.error('   3. Saved it as "localStorage-backup.json" in project root');
      process.exit(1);
    }

    // Parse journal data
    const yearsToMigrate: { year: number; planData: JournalEntries; realityData: JournalEntries }[] = [];

    for (const [key, value] of Object.entries(backupData.data)) {
      if (key.startsWith('journal-plan-')) {
        const year = parseInt(key.replace('journal-plan-', ''));
        const entries = JSON.parse(value);
        const migratedEntries = migrateOldFormatToNewFormat(entries, year);

        let existing = yearsToMigrate.find(y => y.year === year);
        if (!existing) {
          existing = { year, planData: {}, realityData: {} };
          yearsToMigrate.push(existing);
        }
        existing.planData = migratedEntries;

        console.log(`📅 Found plan data for ${year}: ${Object.keys(migratedEntries).length} days`);
      } else if (key.startsWith('journal-reality-')) {
        const year = parseInt(key.replace('journal-reality-', ''));
        const entries = JSON.parse(value);
        const migratedEntries = migrateOldFormatToNewFormat(entries, year);

        let existing = yearsToMigrate.find(y => y.year === year);
        if (!existing) {
          existing = { year, planData: {}, realityData: {} };
          yearsToMigrate.push(existing);
        }
        existing.realityData = migratedEntries;

        console.log(`📅 Found reality data for ${year}: ${Object.keys(migratedEntries).length} days`);
      }
    }

    if (yearsToMigrate.length === 0) {
      console.log('⚠️  No journal data found in backup file');
      process.exit(0);
    }

    console.log(`\n🔄 Migrating ${yearsToMigrate.length} year(s) to Neon...\n`);

    // Import each year's data
    for (const { year, planData, realityData } of yearsToMigrate) {
      console.log(`\n📤 Uploading ${year} data to Neon...`);
      console.log(`   Plan days: ${Object.keys(planData).length}`);
      console.log(`   Reality days: ${Object.keys(realityData).length}`);

      try {
        // Create plan snapshot
        if (Object.keys(planData).length > 0) {
          await storage.createPlanSnapshot({
            user_id: 'default-user',
            snapshot_timestamp: new Date(),
            year: year,
            day_contents: planData,
            metadata: {
              source: 'localStorage_migration',
              migrated_at: new Date().toISOString(),
              original_backup: backupData.timestamp
            }
          });
          console.log(`   ✅ Plan data uploaded`);
        }

        // Create reality snapshot
        if (Object.keys(realityData).length > 0) {
          await storage.createRealitySnapshot({
            user_id: 'default-user',
            snapshot_timestamp: new Date(),
            year: year,
            day_contents: realityData,
            metadata: {
              source: 'localStorage_migration',
              migrated_at: new Date().toISOString(),
              original_backup: backupData.timestamp
            }
          });
          console.log(`   ✅ Reality data uploaded`);
        }

        console.log(`   ✅ Year ${year} migration complete!`);
      } catch (error) {
        console.error(`   ❌ Failed to migrate ${year}:`, error);
      }
    }

    console.log('\n🎉 Migration completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Visit your app and verify the data appears');
    console.log('   2. Check browser console for "Loaded from database" message');
    console.log('   3. Verify data in Neon console: https://console.neon.tech');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateData();
