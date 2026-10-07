import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const eodReports = db.prepare('SELECT * FROM eod_reports ORDER BY date DESC').all();
    return NextResponse.json(eodReports);
  } catch (err) {
    console.error('Error fetching EOD reports:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, store, date, sales, expenses, cash, upi, card, orders, submittedBy, submittedAt } = body;

    const eodId = id || `eod-${store || 'ADIT CAMPUS'}-${date || new Date().toISOString().split('T')[0]}`;

    db.prepare(`
      INSERT OR REPLACE INTO eod_reports (
        id, store, date, sales, expenses, cash, upi, card, orders, submittedBy, submittedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eodId,
      store || 'ADIT CAMPUS',
      date || new Date().toISOString().split('T')[0],
      sales || 0,
      expenses || 0,
      cash || 0,
      upi || 0,
      card || 0,
      orders || 0,
      submittedBy || 'Branch Manager',
      submittedAt || new Date().toLocaleString()
    );

    return NextResponse.json({ success: true, eodId, message: 'EOD report persisted directly into database.db.' });
  } catch (err) {
    console.error('Error submitting EOD report:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
