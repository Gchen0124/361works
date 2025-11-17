// Conditional schema loader - uses PostgreSQL schema for Neon, SQLite otherwise
const DATABASE_URL = process.env.DATABASE_URL;
const USE_NEON = !!DATABASE_URL && DATABASE_URL.includes('neon.tech');

// Re-export everything from the appropriate schema
if (USE_NEON) {
  console.log("📦 Loading PostgreSQL schema for Neon database");
  export * from "./schema.postgres";
} else {
  console.log("📦 Loading SQLite schema for local database");
  export * from "./schema.sqlite";
}
