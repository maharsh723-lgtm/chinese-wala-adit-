import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.db');

let db;
if (global._nextSqliteDb) {
  db = global._nextSqliteDb;
} else {
  db = new DatabaseSync(dbPath);
  global._nextSqliteDb = db;
}

export { db };
