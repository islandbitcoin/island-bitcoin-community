import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { fileURLToPath } from 'url';
import type BetterSqlite3 from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../island-bitcoin.db');
const migrationsPath = process.env.MIGRATIONS_PATH || path.join(__dirname, '../../../../drizzle');

const sqlite: BetterSqlite3.Database = new Database(dbPath);
const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: migrationsPath });

export { db, sqlite };
