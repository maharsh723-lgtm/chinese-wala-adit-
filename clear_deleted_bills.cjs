const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new DatabaseSync(dbPath);

console.log('Clearing all Deleted, Cancelled, and Refunded bills from database.db...');

// 1. Get IDs of deleted orders
const deletedOrders = db.prepare("SELECT id FROM pos_orders WHERE status IN ('Deleted', 'Cancelled', 'Refunded')").all();
const deletedIds = deletedOrders.map(o => o.id);

console.log(`Found ${deletedIds.length} deleted/cancelled/refunded orders.`);

if (deletedIds.length > 0) {
  for (const id of deletedIds) {
    db.prepare('DELETE FROM pos_order_items WHERE orderId = ?').run(id);
    db.prepare('DELETE FROM pos_orders WHERE id = ?').run(id);
  }
}

// 2. Clear ORDER_DELETED audit logs
try {
  db.prepare("DELETE FROM pos_audit_logs WHERE action = 'ORDER_DELETED'").run();
  console.log('Cleared ORDER_DELETED audit logs.');
} catch (e) {
  console.error('Error clearing audit logs:', e);
}

console.log('Successfully emptied all Deleted Bills from database.db!');
