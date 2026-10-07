import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(req, { params }) {
  try {
    const resolvedParams = await params;
    const orderId = resolvedParams?.id;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // 1. Check if order exists in pos_orders table
    const order = db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Retrieve order items to revert stock
    const items = db.prepare('SELECT * FROM pos_order_items WHERE orderId = ?').all(orderId);

    for (const item of items) {
      const itemQty = Number(item.quantity || item.qty) || 1;
      const productId = item.productId;

      // Revert pos_products stock
      if (productId) {
        db.prepare('UPDATE pos_products SET stock = stock + ? WHERE id = ?').run(itemQty, productId);

        // Revert raw ingredients if recipe exists
        try {
          const product = db.prepare('SELECT recipeId FROM pos_products WHERE id = ?').get(productId);
          if (product && product.recipeId) {
            const recipe = db.prepare('SELECT ingredients FROM recipes WHERE id = ?').get(product.recipeId);
            if (recipe && recipe.ingredients) {
              const ingredients = JSON.parse(recipe.ingredients);
              for (const ing of ingredients) {
                const reqQty = (ing.qty || 0) * itemQty;
                db.prepare(`
                  UPDATE inventory SET stock = stock + ? WHERE LOWER(label) = LOWER(?) AND store = ?
                `).run(reqQty, ing.name, order.store || 'ADIT CAMPUS');
              }
            }
          }
        } catch (e) {
          console.error('Error reverting inventory stock on order deletion:', e);
        }
      }
    }

    // 3. Mark order status as 'Deleted' in database.db
    db.prepare("UPDATE pos_orders SET status = 'Deleted' WHERE id = ?").run(orderId);

    return NextResponse.json({
      success: true,
      message: 'Bill deleted successfully and stock restored in database.db.'
    });
  } catch (err) {
    console.error('Error deleting POS order:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
