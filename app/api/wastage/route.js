import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const wastage = db.prepare('SELECT * FROM wastage ORDER BY date DESC').all();
    return NextResponse.json(wastage);
  } catch (err) {
    console.error('Error fetching wastage:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, store, name, qty, unit, reason, date, cost, image, loggedBy } = body;

    const wastageId = id || `w-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const wastageStore = store || 'ADIT CAMPUS';
    const wastageDate = date || new Date().toISOString().split('T')[0];

    // 1. Insert wastage record into wastage table in database.db
    db.prepare(`
      INSERT INTO wastage (id, store, name, qty, unit, reason, date, cost, image, loggedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      wastageId,
      wastageStore,
      name,
      qty || 1,
      unit || 'gm',
      reason || 'Spillage',
      wastageDate,
      cost || 0,
      image || '🗑️',
      loggedBy || 'Branch Manager'
    );

    // 2. Decrement inventory stock in database.db
    try {
      const invItem = db.prepare('SELECT id, stock FROM inventory WHERE store = ? AND LOWER(label) = LOWER(?)').get(wastageStore, name);
      if (invItem) {
        const newStock = Math.max(0, invItem.stock - (qty || 1));
        db.prepare('UPDATE inventory SET stock = ? WHERE id = ?').run(newStock, invItem.id);
      }
    } catch (e) {
      console.error('Error updating inventory stock for wastage:', e);
    }

    return NextResponse.json({ success: true, wastageId, message: 'Wastage persisted directly into database.db.' });
  } catch (err) {
    console.error('Error logging wastage:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
