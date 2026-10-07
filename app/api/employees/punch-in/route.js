import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const { empId, store, time } = body;

    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(empId);
    if (!emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const nowStr = time || new Date().toISOString();
    const activePunch = { store: store || emp.store || 'ADIT CAMPUS', startTime: nowStr };

    db.prepare(`
      UPDATE employees SET activePunch = ?, status = 'Active' WHERE id = ?
    `).run(JSON.stringify(activePunch), empId);

    return NextResponse.json({ success: true, activePunch, message: 'Punch-in persisted directly into database.db.' });
  } catch (err) {
    console.error('Error clocking in:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
