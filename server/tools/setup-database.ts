/**
 * Database Setup Script
 *
 * This script initializes the database and creates the default user.
 * Run this after setting up your Neon DATABASE_URL in .env
 *
 * Usage: npm run setup-db
 */

import { db, initializeDatabase } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function setupDatabase() {
  console.log('🚀 Starting database setup...\n');

  try {
    // Initialize database connection and run migrations
    await initializeDatabase();
    console.log('✅ Database initialized\n');

    // Check if default user exists
    const existingUsers = await db.select().from(users).where(eq(users.id, 'default-user'));

    if (existingUsers.length > 0) {
      console.log('✅ Default user already exists');
      console.log('   User ID: default-user');
      console.log('   Username:', existingUsers[0].username);
    } else {
      // Create default user
      console.log('📝 Creating default user...');
      await db.insert(users).values({
        id: 'default-user',
        username: 'demo',
        password: 'demo', // In production, this should be hashed
      });
      console.log('✅ Default user created');
      console.log('   User ID: default-user');
      console.log('   Username: demo');
      console.log('   Password: demo');
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Open your browser and start journaling!');

  } catch (error) {
    console.error('\n❌ Database setup failed:', error);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure DATABASE_URL is set in .env');
    console.error('   2. Check that your Neon database is accessible');
    console.error('   3. Verify your database credentials are correct');
    process.exit(1);
  }
}

setupDatabase();
