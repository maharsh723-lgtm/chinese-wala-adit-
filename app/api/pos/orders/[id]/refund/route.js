import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req, { params }) {
  try {
    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    const order = db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    db.prepare("UPDATE pos_orders SET status = 'Refunded' WHERE id = ?").run(orderId);

    // Record audit log
    try {
      db.prepare(`
        INSERT INTO pos_audit_logs (id, orderId, action, details, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        `audit-${Date.now()}`,
        orderId,
        'ORDER_REFUNDED',
        reason || 'Order refunded by manager',
        new Date().toISOString()
      );
    } catch (e) {}

    return NextResponse.json({ success: true, message: `Order ${orderId} refunded successfully.` });
  } catch (err) {
    console.error('Error refunding order:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
