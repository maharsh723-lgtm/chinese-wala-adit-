const { db } = require('./db.cjs');

console.log('--- CLEANUP AND STOCK UPDATE ---');

try {
  // 1. Remove the Paneer Tikka test data
  const orderId = 'order-test-1';
  db.prepare("DELETE FROM pos_orders WHERE id = ?").run(orderId);
  db.prepare("DELETE FROM pos_order_items WHERE orderId = ?").run(orderId);
  db.prepare("DELETE FROM inventory_consumption WHERE orderId = ?").run(orderId);
  db.prepare("DELETE FROM inventory_ledger WHERE reason LIKE ?").run(`%${orderId}%`);
  
  db.prepare("DELETE FROM pos_products WHERE id = 'pos-test-1'").run();
  db.prepare("DELETE FROM recipes WHERE id = 'recipe-test-1'").run();
  db.prepare("DELETE FROM inventory WHERE id = 'inv-test-1'").run();

  console.log('Successfully removed Test Paneer Tikka data.');

  // 2. Add 10 stock to every item in the inventory
  db.prepare(`
    UPDATE inventory 
    SET stock = stock + 10
  `).run();

  console.log('Successfully added 10 stock to every item in the inventory.');

} catch (e) {
  console.error('Error during cleanup and update:', e);
}
