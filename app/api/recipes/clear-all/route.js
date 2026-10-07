import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    db.prepare('DELETE FROM recipes').run();
    db.prepare('UPDATE pos_products SET recipeId = NULL').run();
    return NextResponse.json({ success: true, message: 'All recipes removed successfully.' });
  } catch (err) {
    console.error('Error clearing recipes:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
