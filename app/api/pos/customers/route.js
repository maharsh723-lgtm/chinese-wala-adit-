import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const customers = db.prepare('SELECT * FROM pos_customers').all();
    return NextResponse.json(customers);
  } catch (err) {
    console.error('Error fetching customers:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, name, phone, loyaltyPoints, email, dob, anniversary, preferences, specialRequirements, notes } = body;

    const customerId = id || `cust-${Date.now()}`;

    db.prepare(`
      INSERT OR REPLACE INTO pos_customers (
        id, name, phone, loyaltyPoints, email, dob, anniversary, preferences, specialRequirements, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customerId,
      name,
      phone || '',
      loyaltyPoints || 0,
      email || '',
      dob || '',
      anniversary || '',
      preferences || '',
      specialRequirements || '',
      notes || ''
    );

    return NextResponse.json({ success: true, customerId, message: 'Customer intelligence persisted directly into database.db.' });
  } catch (err) {
    console.error('Error adding customer:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
