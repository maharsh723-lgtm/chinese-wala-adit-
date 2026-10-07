import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    db.prepare('DELETE FROM pos_order_items').run();
    db.prepare('DELETE FROM pos_orders').run();
    return NextResponse.json({ success: true, message: 'All POS orders cleared from database.db.' });
  } catch (err) {
    console.error('Error clearing POS orders:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
