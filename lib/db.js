import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.db');

let db;
if (global._nextSqliteDb) {
  db = global._nextSqliteDb;
} else {
  db = new DatabaseSync(dbPath);
  global._nextSqliteDb = db;

  // High-performance SQLite tuning & indexing
  try {
    db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = -64000;
      PRAGMA temp_store = MEMORY;
      PRAGMA mmap_size = 268435456;

      CREATE INDEX IF NOT EXISTS idx_orders_date_store ON pos_orders (date, store);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON pos_orders (status);
      CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON pos_order_items (orderId);
      CREATE INDEX IF NOT EXISTS idx_inventory_store_label ON inventory (store, label);
      CREATE INDEX IF NOT EXISTS idx_pos_products_category ON pos_products (category);
      CREATE INDEX IF NOT EXISTS idx_product_sales_date_store ON product_sales (date, store);
      CREATE INDEX IF NOT EXISTS idx_checklists_date_store ON checklists (date, store);
      CREATE INDEX IF NOT EXISTS idx_eod_reports_date_store ON eod_reports (date, store);
    `);
  } catch (err) {
    // Ignore harmless concurrent index init lock during worker startup
  }
}

export { db };
