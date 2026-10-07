import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const { store, items } = body;
    const targetStore = store || 'ADIT CAMPUS';

    const checkStmt = db.prepare('SELECT id FROM inventory WHERE store = ? AND label = ?');
    const updateStmt = db.prepare(`
      UPDATE inventory SET stock = ?, unitCost = ?, category = ?, unit = ?, reorder = ?, status = ?
      WHERE id = ?
    `);
    const insertStmt = db.prepare(`
      INSERT INTO inventory (id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status, openingStock, closingStock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let updatedCount = 0;
    if (Array.isArray(items)) {
      for (const item of items) {
        const stock = Number(item.stock) || 0;
        const unitCost = Number(item.unitCost) || 0;
        const reorder = Number(item.reorder) || 1000;
        const status = stock <= reorder ? 'LOW STOCK' : 'IN STOCK';

        const existing = checkStmt.get(targetStore, item.label);
        if (existing) {
          updateStmt.run(stock, unitCost, item.category || 'General', item.unit || 'gm', reorder, status, existing.id);
        } else {
          const itemId = `inv-${targetStore.toLowerCase()}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
          insertStmt.run(itemId, item.label, item.category || 'General', stock, item.unit || 'gm', reorder, unitCost, '2026-12-31', targetStore, status, stock, stock);
        }
        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, count: updatedCount, message: 'Batch inventory persisted directly into database.db.' });
  } catch (err) {
    console.error('Error in batch inventory update:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
