const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new DatabaseSync(dbPath);

const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const todayStr = new Date().toISOString().split('T')[0];

const start = performance.now();
const stores = ["VESU", "LP SAVANI", "GAURAV PATH", "SUDAMA CHOWK"];
const topSellingByStore = {};

stores.forEach(st => {
  let items = db.prepare(`
    SELECT productName, SUM(quantity) as qty
    FROM pos_order_items oi
    JOIN pos_orders o ON oi.orderId = o.id
    WHERE o.store = ? AND o.date = ? AND o.status NOT IN ('Refunded', 'Cancelled', 'Deleted')
    GROUP BY productName
    ORDER BY qty DESC
    LIMIT 5
  `).all(st, todayStr);

  if (items.length === 0) {
    items = db.prepare(`
      SELECT productName, SUM(quantity) as qty
      FROM pos_order_items oi
      JOIN pos_orders o ON oi.orderId = o.id
      WHERE o.store = ? AND o.date >= ? AND o.status NOT IN ('Refunded', 'Cancelled', 'Deleted')
      GROUP BY productName
      ORDER BY qty DESC
      LIMIT 5
    `).all(st, sixtyDaysAgo);
  }
  topSellingByStore[st] = items;
});

console.log(`topSellingByStore execution time: ${(performance.now() - start).toFixed(2)} ms`);
console.log(topSellingByStore);
