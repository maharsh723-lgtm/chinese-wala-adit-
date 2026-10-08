import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    storeName: 'ADIT CAMPUS',
    supplierPhone: '+91 99786 73137',
    supplierEmail: 'supplies@badikatori.com',
    supplierName: 'GM Supplies'
  });
}
