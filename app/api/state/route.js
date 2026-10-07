import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

function safeQuery(sql, fallback = []) {
  try {
    return db.prepare(sql).all();
  } catch (e) {
    return fallback;
  }
}

function safeJsonParse(val, fallback = []) {
  if (!val) return fallback;
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return val;
  }
}

export async function GET() {
  try {
    const empRows = safeQuery('SELECT * FROM employees');
    const employees = {};
    for (const row of empRows) {
      employees[row.id] = {
        id: row.id,
        name: row.name,
        role: row.role,
        mobile: row.mobile,
        shiftStart: row.shiftStart,
        roleKey: row.roleKey,
        password: row.password,
        status: row.status,
        store: row.store,
        activePunch: safeJsonParse(row.activePunch, null),
        history: safeJsonParse(row.history, [])
      };
    }

    const leaveRequests = safeQuery('SELECT * FROM leave_requests');
    const leaveBalances = safeQuery('SELECT * FROM leave_balances');
    const payrolls = safeQuery('SELECT * FROM payrolls');

    const sopRows = safeQuery('SELECT * FROM sops');
    const sops = sopRows.map(row => ({
      ...row,
      instructions: safeJsonParse(row.instructions, [])
    }));

    const inventory = safeQuery('SELECT * FROM inventory');
    const wastage = safeQuery('SELECT * FROM wastage');
    const checklists = safeQuery('SELECT * FROM checklists');
    const eodReports = safeQuery('SELECT * FROM eod_reports');

    const recipeRows = safeQuery('SELECT * FROM recipes');
    const recipes = recipeRows.map(row => ({
      ...row,
      ingredients: safeJsonParse(row.ingredients, [])
    }));

    const productSales = safeQuery('SELECT * FROM product_sales');

    const productRows = safeQuery('SELECT * FROM pos_products');
    const posProducts = productRows.map(row => ({
      ...row,
      isVeg: Boolean(row.isVeg),
      isPopular: Boolean(row.isPopular),
      isFavorite: Boolean(row.isFavorite),
      ingredients: safeJsonParse(row.ingredients, [])
    }));

    const posModifiers = safeQuery('SELECT * FROM pos_modifiers');
    const posCustomers = safeQuery('SELECT * FROM pos_customers');

    const orderRows = safeQuery('SELECT * FROM pos_orders');
    const itemRows = safeQuery('SELECT * FROM pos_order_items');

    const posOrders = orderRows.map(order => {
      const items = itemRows
        .filter(item => item.orderId === order.id)
        .map(item => ({
          ...item,
          modifiers: safeJsonParse(item.modifiers, [])
        }));
      return {
        ...order,
        items
      };
    });

    const suppliers = safeQuery('SELECT * FROM suppliers');
    const itemSuppliers = safeQuery('SELECT * FROM inventory_item_suppliers');

    const state = {
      employees,
      leaveRequests,
      leaveBalances,
      payrolls,
      sops,
      inventory,
      wastage,
      checklists,
      eodReports,
      recipes,
      productSales,
      posProducts,
      posModifiers,
      posCustomers,
      posOrders,
      suppliers,
      itemSuppliers
    };

    return NextResponse.json(state, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, private'
      }
    });
  } catch (err) {
    console.error('Error fetching Next.js state:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
