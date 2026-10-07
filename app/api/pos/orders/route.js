import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const orderRows = db.prepare('SELECT * FROM pos_orders ORDER BY date DESC, time DESC').all();
    const itemRows = db.prepare('SELECT * FROM pos_order_items').all();

    const posOrders = orderRows.map(order => {
      const items = itemRows
        .filter(item => item.orderId === order.id)
        .map(item => ({
          ...item,
          name: item.productName || item.name,
          qty: item.quantity || item.qty,
          total: (item.price || 0) * (item.quantity || item.qty || 1),
          modifiers: item.modifiers ? (typeof item.modifiers === 'string' ? JSON.parse(item.modifiers) : item.modifiers) : []
        }));
      return {
        ...order,
        items
      };
    });

    return NextResponse.json(posOrders);
  } catch (err) {
    console.error('Error fetching POS orders:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      id,
      date,
      time,
      customerId,
      customerName,
      orderType,
      tableName,
      address,
      subtotal,
      tax,
      discount,
      serviceCharge,
      grandTotal,
      paymentMethod,
      status,
      store,
      items,
      source,
      dToken,
      deliveryStatus,
      externalOrderId,
      estimatedPickupTime
    } = body;

    const orderId = id || `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const storeName = store || 'ADIT CAMPUS';
    const orderDate = date || new Date().toISOString().split('T')[0];
    const orderTime = time || new Date().toLocaleTimeString('en-US', { hour12: false });

    // 1. Insert POS Order into pos_orders table in database.db
    db.prepare(`
      INSERT INTO pos_orders (
        id, date, time, customerId, customerName, orderType, tableName, address,
        subtotal, tax, discount, serviceCharge, grandTotal, paymentMethod, status, store,
        source, dToken, deliveryStatus, externalOrderId, estimatedPickupTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      orderDate,
      orderTime,
      customerId || '',
      customerName || 'Walk-in Guest',
      orderType || 'Dine In',
      tableName || 'Takeaway',
      address || '',
      subtotal || 0,
      tax || 0,
      discount || 0,
      serviceCharge || 0,
      grandTotal || 0,
      paymentMethod || 'Cash',
      status || 'Completed',
      storeName,
      source || 'pos',
      dToken || '',
      deliveryStatus || '',
      externalOrderId || '',
      estimatedPickupTime || ''
    );

    // 2. Insert Items into pos_order_items table in database.db
    const insertItemStmt = db.prepare(`
      INSERT INTO pos_order_items (id, orderId, productId, productName, quantity, price, modifiers, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateProductStockStmt = db.prepare(`
      UPDATE pos_products SET stock = MAX(0, stock - ?) WHERE id = ?
    `);

    const upsertProductSaleStmt = db.prepare(`
      INSERT INTO product_sales (id, store, date, recipeId, itemName, category, qty, revenue, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    if (Array.isArray(items)) {
      for (const item of items) {
        const itemId = item.id || `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const itemName = item.productName || item.name;
        const itemQty = Number(item.quantity || item.qty) || 1;
        const itemPrice = Number(item.price) || 0;
        const itemTotal = Number(item.total) || (itemPrice * itemQty);

        insertItemStmt.run(
          itemId,
          orderId,
          item.productId || item.id,
          itemName,
          itemQty,
          itemPrice,
          JSON.stringify(item.modifiers || []),
          item.instructions || ''
        );

        if (item.productId) {
          updateProductStockStmt.run(itemQty, item.productId);
        }

        // Record in product_sales table in database.db
        const psId = `ps-${storeName}-${orderDate}-${itemName.replace(/\s+/g, '_')}`;
        try {
          upsertProductSaleStmt.run(
            psId,
            storeName,
            orderDate,
            item.productId || '',
            itemName,
            item.category || 'General',
            itemQty,
            itemTotal,
            item.image || '🍽️'
          );
        } catch (e) {
          db.prepare(`
            UPDATE product_sales SET qty = qty + ?, revenue = revenue + ? WHERE id = ?
          `).run(itemQty, itemTotal, psId);
        }

        // 3. Inventory Raw Ingredient Deduction if recipe exists
        try {
          const product = db.prepare('SELECT recipeId FROM pos_products WHERE id = ?').get(item.productId);
          if (product && product.recipeId) {
            const recipe = db.prepare('SELECT ingredients FROM recipes WHERE id = ?').get(product.recipeId);
            if (recipe && recipe.ingredients) {
              const ingredients = JSON.parse(recipe.ingredients);
              for (const ing of ingredients) {
                const reqQty = (ing.qty || 0) * itemQty;
                const invItem = db.prepare('SELECT id, stock, unit FROM inventory WHERE LOWER(label) = LOWER(?) AND store = ?').get(ing.name, storeName);
                if (invItem) {
                  const newStock = Math.max(0, invItem.stock - reqQty);
                  db.prepare('UPDATE inventory SET stock = ? WHERE id = ?').run(newStock, invItem.id);
                  db.prepare('INSERT INTO inventory_ledger (id, itemId, storeId, transactionType, qty, unit, reason, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
                    `ledger-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                    invItem.id,
                    storeName,
                    'POS Consumption',
                    -reqQty,
                    invItem.unit || 'gm',
                    `POS Order ${orderId}`,
                    orderDate
                  );
                }
              }
            }
          }
        } catch (invErr) {
          console.error('Inventory deduction error for order:', invErr);
        }
      }
    }

    return NextResponse.json({ success: true, orderId, message: 'Order persisted directly into database.db successfully.' });
  } catch (err) {
    console.error('Error persisting POS order to database:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
