const { db } = require('./db.cjs');

console.log('--- TEST: INVENTORY CONSUMPTION VIA RECIPES ---');

try {
  // 1. Pick a store and create an inventory item & recipe
  const store = 'GAURAV PATH';
  
  // Clean up any old test data
  db.prepare("DELETE FROM pos_products WHERE id = 'pos-test-1'").run();
  db.prepare("DELETE FROM recipes WHERE id = 'recipe-test-1'").run();
  db.prepare("DELETE FROM inventory WHERE id = 'inv-test-1'").run();

  // Create raw material
  db.prepare(`
    INSERT INTO inventory (id, label, category, unit, unitCost, stock, store)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('inv-test-1', 'Test Paneer', 'Raw Materials', 'gm', 0.5, 1000, store);

  // Create recipe
  const ingredients = JSON.stringify([{ name: 'Test Paneer', qty: 150, unit: 'gm', cost: 75 }]);
  db.prepare(`
    INSERT INTO recipes (id, name, portion, status, version, ingredients)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('recipe-test-1', 'Test Paneer Tikka', '1 Plate', 'Active', 1, ingredients);

  // Create POS product linked to recipe
  db.prepare(`
    INSERT INTO pos_products (id, name, category, price, isVeg, recipeId, stock)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('pos-test-1', 'Test Paneer Tikka', 'Starters', 250, 1, 'recipe-test-1', 100);

  // Create a mock POS order
  const orderId = 'order-test-1';
  db.prepare("DELETE FROM pos_orders WHERE id = ?").run(orderId);
  db.prepare("DELETE FROM pos_order_items WHERE orderId = ?").run(orderId);
  db.prepare("DELETE FROM inventory_consumption WHERE orderId = ?").run(orderId);
  db.prepare("DELETE FROM inventory_ledger WHERE reason LIKE ?").run(`%${orderId}%`);

  db.prepare(`
    INSERT INTO pos_orders (id, orderType, store, grandTotal, status, date, time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(orderId, 'Dine In', store, 250, 'Completed', '2026-08-15', '13:00');

  db.prepare(`
    INSERT INTO pos_order_items (id, orderId, productId, quantity, price)
    VALUES (?, ?, ?, ?, ?)
  `).run('itm-test-1', orderId, 'pos-test-1', 2, 250); // Ordering 2 quantity

  // 2. We will call the consumption logic directly
  function processPosOrderInventoryConsumption(orderId, storeId) {
    try {
      const order = db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(orderId);
      if (!order) return;
      
      const existingSync = db.prepare('SELECT count(*) as cnt FROM inventory_consumption WHERE orderId = ?').get(orderId);
      if (existingSync && existingSync.cnt > 0) {
        db.prepare("UPDATE pos_orders SET inventorySyncStatus = 'Synced' WHERE id = ?").run(orderId);
        return;
      }
  
      const orderItems = db.prepare('SELECT * FROM pos_order_items WHERE orderId = ?').all(orderId);
      let allDeducted = true;
      let missingRecipes = 0;
  
      db.exec('BEGIN EXCLUSIVE TRANSACTION');
      try {
        for (const item of orderItems) {
          const product = db.prepare('SELECT * FROM pos_products WHERE id = ?').get(item.productId);
          if (!product || !product.recipeId) {
            missingRecipes++;
            continue; 
          }
  
          const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(product.recipeId);
          if (!recipe) {
            missingRecipes++;
            continue;
          }
  
          const ingredients = recipe.ingredients ? JSON.parse(recipe.ingredients) : [];
          const quantitySold = item.quantity;
          
          for (const ing of ingredients) {
            const reqQty = (ing.qty || 0) * quantitySold;
            
            const invItem = db.prepare('SELECT * FROM inventory WHERE label = ? AND store = ?').get(ing.name, storeId);
            if (invItem) {
              const newStock = invItem.stock - reqQty;
              db.prepare('UPDATE inventory SET stock = ? WHERE id = ?').run(newStock, invItem.id);
              
              const consumptionId = `cons-${Date.now()}-${Math.random().toString(36).substr(2,4)}`;
              db.prepare(`
                INSERT INTO inventory_consumption (
                  id, orderId, storeId, menuItemId, recipeId, recipeVersion, soldQuantity,
                  ingredientId, recipeQuantity, actualConsumptionQuantity, unit, timestamp, source, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                consumptionId, orderId, storeId, product.id, recipe.id, recipe.version || 1, quantitySold,
                invItem.id, reqQty, reqQty, invItem.unit, new Date().toISOString(), 'POS', 'Completed'
              );
  
              db.prepare(`
                INSERT INTO inventory_ledger (id, itemId, storeId, transactionType, qty, unit, reason, timestamp, referenceId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                `ledg-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
                invItem.id, storeId, 'POS Consumption', -reqQty, invItem.unit, `POS Order ${orderId}`, new Date().toISOString(), consumptionId
              );
            } else {
               allDeducted = false;
            }
          }
        }
  
        const syncStatus = missingRecipes > 0 ? 'Partial/Missing Recipe' : (allDeducted ? 'Synced' : 'Failed');
        db.prepare('UPDATE pos_orders SET inventorySyncStatus = ? WHERE id = ?').run(syncStatus, orderId);
        db.exec('COMMIT');
      } catch (txErr) {
        db.exec('ROLLBACK');
        throw txErr;
      }
    } catch(e) {
      console.error(e);
    }
  }

  // Trigger it
  processPosOrderInventoryConsumption(orderId, store);

  // 3. Verify Ledger and Stock
  const finalStock = db.prepare('SELECT stock FROM inventory WHERE id = ?').get('inv-test-1').stock;
  console.log(`Expected stock: 700 (1000 - 2 * 150). Actual stock: ${finalStock}`);
  
  const ledgerEntries = db.prepare('SELECT * FROM inventory_ledger WHERE reason LIKE ?').all(`%${orderId}%`);
  console.log('Ledger Entries created:', ledgerEntries.length);
  console.dir(ledgerEntries);

  const orderStatus = db.prepare('SELECT inventorySyncStatus FROM pos_orders WHERE id = ?').get(orderId).inventorySyncStatus;
  console.log('Order Sync Status:', orderStatus);

} catch (e) {
  console.error(e);
}
