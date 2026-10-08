import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req) {
  try {
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC').all();
    return NextResponse.json(expenses);
  } catch (err) {
    console.error('Error fetching expenses:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, title, category, amount, date, store, notes } = body;

    const expenseId = id || `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const expDate = date || new Date().toISOString().split('T')[0];
    const expStore = store || 'ADIT CAMPUS';

    db.prepare(`
      INSERT INTO expenses (id, title, category, amount, date, store, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(expenseId, title || 'General Expense', category || 'Miscellaneous', Number(amount) || 0, expDate, expStore, notes || '');

    return NextResponse.json({ success: true, id: expenseId, message: 'Expense saved successfully.' });
  } catch (err) {
    console.error('Error saving expense:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
