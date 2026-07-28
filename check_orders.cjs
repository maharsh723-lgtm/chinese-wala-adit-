const Database = require('better-sqlite3');
const db = new Database('database.db');
const ordersCount = db.prepare('SELECT COUNT(*) as count FROM pos_orders').get().count;
const customersCount = db.prepare('SELECT COUNT(*) as count FROM pos_customers').get().count;
console.log("POS Orders count:", ordersCount);
console.log("POS Customers count:", customersCount);
