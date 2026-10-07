import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store');

    let items;
    if (store && store !== 'All') {
      items = db.prepare('SELECT * FROM inventory WHERE store = ? ORDER BY category, label').all(store);
    } else {
      items = db.prepare('SELECT * FROM inventory ORDER BY store, category, label').all();
    }

    return NextResponse.json(items);
  } catch (err) {
    console.error('Error fetching inventory:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status } = body;

    const itemId = id || `inv-${(store || 'ADIT CAMPUS').toLowerCase()}-${Date.now()}`;
    const itemStock = Number(stock) || 0;
    const itemCost = Number(unitCost) || 0;
    const itemStore = store || 'ADIT CAMPUS';
    const itemStatus = status || (itemStock <= (reorder || 1000) ? 'LOW STOCK' : 'IN STOCK');

    db.prepare(`
      INSERT INTO inventory (id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status, openingStock, closingStock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemId,
      label,
      category || 'General',
      itemStock,
      unit || 'gm',
      reorder || 1000,
      itemCost,
      expiryDate || '2026-12-31',
      itemStore,
      itemStatus,
      itemStock,
      itemStock
    );

    return NextResponse.json({ success: true, itemId, message: 'Inventory item added directly to database.db.' });
  } catch (err) {
    console.error('Error adding inventory item:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { id, label, category, stock, unit, reorder, unitCost, status, store } = body;

    const itemStock = Number(stock);
    const itemStatus = status || (itemStock <= (reorder || 1000) ? 'LOW STOCK' : 'IN STOCK');

    db.prepare(`
      UPDATE inventory
      SET label = ?, category = ?, stock = ?, unit = ?, reorder = ?, unitCost = ?, status = ?
      WHERE id = ?
    `).run(label, category, itemStock, unit, reorder, unitCost, itemStatus, id);

    return NextResponse.json({ success: true, message: 'Inventory updated directly in database.db.' });
  } catch (err) {
    console.error('Error updating inventory:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
