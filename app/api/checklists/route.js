import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const checklists = db.prepare('SELECT * FROM checklists').all();
    return NextResponse.json(checklists);
  } catch (err) {
    console.error('Error fetching checklists:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, type, store, date, progress, completed, items, photo } = body;

    const checklistId = id || `${type || 'opening'}-${store || 'ADIT CAMPUS'}-${date || new Date().toISOString().split('T')[0]}`;

    db.prepare(`
      INSERT OR REPLACE INTO checklists (id, type, store, date, progress, completed, items, photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      checklistId,
      type || 'opening',
      store || 'ADIT CAMPUS',
      date || new Date().toISOString().split('T')[0],
      progress || 0,
      completed ? 1 : 0,
      JSON.stringify(items || []),
      photo || null
    );

    return NextResponse.json({ success: true, checklistId, message: 'Checklist progress persisted directly into database.db.' });
  } catch (err) {
    console.error('Error saving checklist:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
