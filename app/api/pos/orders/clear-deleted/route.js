import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const deletedOrders = db.prepare("SELECT id FROM pos_orders WHERE status IN ('Deleted', 'Cancelled', 'Refunded')").all();
    for (const o of deletedOrders) {
      db.prepare('DELETE FROM pos_order_items WHERE orderId = ?').run(o.id);
      db.prepare('DELETE FROM pos_orders WHERE id = ?').run(o.id);
    }
    try {
      db.prepare("DELETE FROM pos_audit_logs WHERE action = 'ORDER_DELETED'").run();
    } catch(e) {}

    return NextResponse.json({
      success: true,
      count: deletedOrders.length,
      message: 'All deleted bills emptied from database.db.'
    });
  } catch (err) {
    console.error('Error clearing deleted bills:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
