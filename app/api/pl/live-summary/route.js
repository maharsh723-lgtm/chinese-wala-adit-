import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const store = searchParams.get('branch') || 'ADIT CAMPUS';

    const orders = db.prepare(`
      SELECT grandTotal, paymentMethod FROM pos_orders 
      WHERE status NOT IN ('Deleted', 'Cancelled', 'Refunded') 
      AND (store = ? OR ? = 'All')
    `).all(store, store);

    let totalSales = 0;
    let cashInHand = 0;
    let bankBalance = 0;

    for (const o of orders) {
      const amt = Number(o.grandTotal) || 0;
      totalSales += amt;
      if ((o.paymentMethod || '').toLowerCase() === 'cash') {
        cashInHand += amt;
      } else {
        bankBalance += amt;
      }
    }

    const expenseRows = db.prepare(`
      SELECT amount FROM expenses WHERE (store = ? OR ? = 'All')
    `).all(store, store);
    const totalExpenses = expenseRows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const invRows = db.prepare(`
      SELECT stock, unitCost FROM inventory WHERE (store = ? OR ? = 'All')
    `).all(store, store);
    const inventoryValue = invRows.reduce((sum, i) => sum + ((Number(i.stock) || 0) * (Number(i.unitCost) || 0)), 0);

    const cogs = Math.round(totalSales * 0.32);
    const grossProfit = totalSales - cogs;
    const netProfit = grossProfit - totalExpenses;

    return NextResponse.json({
      cogs,
      cashInHand,
      bankBalance,
      inventoryValue,
      outstandingCustomer: 0,
      outstandingSupplier: 0,
      summary: {
        totalSales,
        cashInHand,
        bankBalance,
        grossProfit,
        totalExpenses,
        netProfit
      }
    });
  } catch (err) {
    console.error('Error fetching P&L summary:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
