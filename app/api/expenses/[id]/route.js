import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    return NextResponse.json({ success: true, message: 'Expense deleted successfully.' });
  } catch (err) {
    console.error('Error deleting expense:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
