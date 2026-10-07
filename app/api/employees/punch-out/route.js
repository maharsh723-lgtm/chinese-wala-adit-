import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const { empId, time } = body;

    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(empId);
    if (!emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const nowStr = time || new Date().toISOString();
    const history = emp.history ? JSON.parse(emp.history) : [];
    const activePunch = emp.activePunch ? JSON.parse(emp.activePunch) : null;

    if (activePunch) {
      history.push({
        store: activePunch.store,
        startTime: activePunch.startTime,
        endTime: nowStr
      });
    }

    db.prepare(`
      UPDATE employees SET activePunch = NULL, status = 'Off-Shift', history = ? WHERE id = ?
    `).run(JSON.stringify(history), empId);

    return NextResponse.json({ success: true, message: 'Punch-out persisted directly into database.db.' });
  } catch (err) {
    console.error('Error clocking out:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
