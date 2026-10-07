import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'badi_katori_secret_key_12345';

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, password } = body;

    const emp = db.prepare('SELECT * FROM employees WHERE id = ? OR LOWER(name) = LOWER(?)').get(id, id);
    if (!emp) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const token = jwt.sign(
      { id: emp.id, name: emp.name, role: emp.role, store: emp.store || 'VESU' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return NextResponse.json({
      token,
      user: {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        store: emp.store || 'VESU'
      }
    });
  } catch (err) {
    console.error('Error logging in:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
