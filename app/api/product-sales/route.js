import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store') || 'ADIT CAMPUS';

    const sales = db.prepare('SELECT * FROM product_sales WHERE store = ? OR ? = \'All\' ORDER BY date DESC').all(store, store);
    return NextResponse.json(sales);
  } catch (err) {
    console.error('Error fetching product sales:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
