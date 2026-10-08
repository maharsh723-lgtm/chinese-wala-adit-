import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const empRows = db.prepare('SELECT * FROM employees').all();
    const employees = {};
    for (const row of empRows) {
      employees[row.id] = {
        ...row,
        activePunch: row.activePunch ? (typeof row.activePunch === 'string' ? JSON.parse(row.activePunch) : row.activePunch) : null,
        history: row.history ? (typeof row.history === 'string' ? JSON.parse(row.history) : row.history) : []
      };
    }
    return NextResponse.json(employees);
  } catch (err) {
    console.error('Error fetching employees:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
