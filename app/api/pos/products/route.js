import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const productRows = db.prepare('SELECT * FROM pos_products').all();
    const posProducts = productRows.map(row => ({
      ...row,
      isVeg: Boolean(row.isVeg),
      isPopular: Boolean(row.isPopular),
      isFavorite: Boolean(row.isFavorite),
      ingredients: row.ingredients ? JSON.parse(row.ingredients) : []
    }));
    return NextResponse.json(posProducts);
  } catch (err) {
    console.error('Error fetching POS products:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
