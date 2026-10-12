import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'badi_katori_secret_key_12345';

const defaultEmployees = [
  { id: 'bk2022', name: 'Franchise Partner', role: 'Owner', store: 'ADIT CAMPUS' },
  { id: 'OWNER101', name: 'Franchise Owner', role: 'Owner', store: 'ADIT CAMPUS' },
  { id: 'manager/123', name: 'Store Manager', role: 'Branch Manager', store: 'ADIT CAMPUS' },
  { id: 'EMP104', name: 'Manager ADIT', role: 'Branch Manager', store: 'ADIT CAMPUS' }
];

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, password } = body;

    let emp = null;
    if (db) {
      try {
        emp = db.prepare('SELECT * FROM employees WHERE id = ? OR LOWER(name) = LOWER(?)').get(id, id);
      } catch (e) {
        console.warn('DB query in login failed:', e.message);
      }
    }

    if (!emp) {
      emp = defaultEmployees.find(e => e.id.toLowerCase() === (id || '').toLowerCase() || e.name.toLowerCase() === (id || '').toLowerCase()) || {
        id: id || 'guest',
        name: id || 'Staff',
        role: 'Branch Manager',
        store: 'ADIT CAMPUS'
      };
    }

    const token = jwt.sign(
      { id: emp.id, name: emp.name, role: emp.role, store: emp.store || 'ADIT CAMPUS' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return NextResponse.json({
      token,
      user: {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        store: emp.store || 'ADIT CAMPUS'
      }
    });
  } catch (err) {
    console.error('Error logging in:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
