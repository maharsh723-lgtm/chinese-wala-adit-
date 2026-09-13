const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
console.log('Testing DB at:', dbPath);

try {
  const db = new DatabaseSync(dbPath);
  
  const start = performance.now();
  
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const posOrders = db.prepare('SELECT * FROM pos_orders WHERE date >= ?').all(sixtyDaysAgo);
  
  const t1 = performance.now();
  console.log(`Fetched ${posOrders.length} orders in ${(t1 - start).toFixed(2)} ms`);
  
  const recentOrderIds = posOrders.map(o => o.id);
  let posOrderItemsOld = [];
  const t2_start = performance.now();
  if (recentOrderIds.length > 0) {
    const placeholders = recentOrderIds.map(() => '?').join(',');
    posOrderItemsOld = db.prepare(`SELECT * FROM pos_order_items WHERE orderId IN (${placeholders})`).all(...recentOrderIds);
  }
  const t2 = performance.now();
  console.log(`Old posOrderItems query (${posOrderItemsOld.length} items) took ${(t2 - t2_start).toFixed(2)} ms`);
  
  const t3_start = performance.now();
  const posOrderItemsNew = db.prepare(`
    SELECT oi.* FROM pos_order_items oi
    JOIN pos_orders o ON oi.orderId = o.id
    WHERE o.date >= ?
  `).all(sixtyDaysAgo);
  const t3 = performance.now();
  console.log(`New posOrderItems JOIN query (${posOrderItemsNew.length} items) took ${(t3 - t3_start).toFixed(2)} ms`);

  const t4_start = performance.now();
  const kitchenOld = db.prepare('SELECT * FROM pos_kitchen_orders').all();
  const t4 = performance.now();
  console.log(`Old posKitchenOrders (${kitchenOld.length} rows) took ${(t4 - t4_start).toFixed(2)} ms`);

  const t5_start = performance.now();
  const kitchenNew = db.prepare(`
    SELECT ko.* FROM pos_kitchen_orders ko
    WHERE ko.status IN ('Pending', 'In Progress', 'Ready')
       OR ko.orderId IN (SELECT id FROM pos_orders WHERE date >= ?)
  `).all(sixtyDaysAgo);
  const t5 = performance.now();
  console.log(`New posKitchenOrders (${kitchenNew.length} rows) took ${(t5 - t5_start).toFixed(2)} ms`);

} catch (e) {
  console.error("Error running test:", e);
}
