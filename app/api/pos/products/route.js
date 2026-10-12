import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { defaultPosProducts } from '@/lib/defaultMenu';

export async function GET() {
  try {
    if (db) {
      const productRows = db.prepare('SELECT * FROM pos_products').all();
      if (productRows && productRows.length > 0) {
        const posProducts = productRows.map(row => ({
          ...row,
          isVeg: Boolean(row.isVeg),
          isPopular: Boolean(row.isPopular),
          isFavorite: Boolean(row.isFavorite),
          ingredients: row.ingredients ? JSON.parse(row.ingredients) : []
        }));
        return NextResponse.json(posProducts);
      }
    }
    // Serverless fallback: return the 88 seeded Chinese Wala products
    return NextResponse.json(defaultPosProducts);
  } catch (err) {
    console.warn('Error fetching POS products from DB, using fallback menu:', err.message);
    return NextResponse.json(defaultPosProducts);
  }
}
