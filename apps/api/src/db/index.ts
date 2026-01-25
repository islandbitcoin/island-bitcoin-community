import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

const dbPath = path.join(__dirname, '../../island-bitcoin.db');
const migrationsPath = path.join(__dirname, '../../../../drizzle');

const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: migrationsPath });

export { db };
