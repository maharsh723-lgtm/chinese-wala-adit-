import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const recipeRows = db.prepare('SELECT * FROM recipes').all();
    const recipes = recipeRows.map(row => ({
      ...row,
      ingredients: row.ingredients ? JSON.parse(row.ingredients) : []
    }));
    return NextResponse.json(recipes);
  } catch (err) {
    console.error('Error fetching recipes:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, name, portion, status, ingredients, rawCost, retailPrice } = body;
    db.prepare(`
      INSERT OR REPLACE INTO recipes (id, name, portion, status, ingredients, rawCost, retailPrice)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, portion, status, JSON.stringify(ingredients), rawCost, retailPrice);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error creating recipe:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
