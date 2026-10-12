import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  defaultPosProducts,
  defaultPosModifiers,
  defaultPosCustomers,
  defaultPosTables
} from '@/lib/defaultMenu';

let cachedStateResponse = null;
let cachedStateTime = 0;
const CACHE_TTL_MS = 5000; // 5 seconds high-performance in-memory cache

function safeQuery(sql, fallback = []) {
  if (!db) return fallback;
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

export async function GET(req) {
  try {
    const now = Date.now();

    // Fast path: Return cached state if fresh (within 5 seconds)
    if (cachedStateResponse && (now - cachedStateTime < CACHE_TTL_MS)) {
      return NextResponse.json(cachedStateResponse, {
        headers: {
          'Cache-Control': 'private, max-age=5, stale-while-revalidate=10',
          'X-State-Cache': 'HIT'
        }
      });
    }

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
    let posProducts = productRows.map(row => ({
      ...row,
      isVeg: Boolean(row.isVeg),
      isPopular: Boolean(row.isPopular),
      isFavorite: Boolean(row.isFavorite),
      ingredients: safeJsonParse(row.ingredients, [])
    }));
    if (!posProducts || posProducts.length === 0) {
      posProducts = defaultPosProducts;
    }

    let posModifiers = safeQuery('SELECT * FROM pos_modifiers');
    if (!posModifiers || posModifiers.length === 0) {
      posModifiers = defaultPosModifiers;
    }

    let posCustomers = safeQuery('SELECT * FROM pos_customers');
    if (!posCustomers || posCustomers.length === 0) {
      posCustomers = defaultPosCustomers;
    }

    let posTables = safeQuery('SELECT * FROM pos_tables');
    if (!posTables || posTables.length === 0) {
      posTables = defaultPosTables;
    }

    const orderRows = safeQuery('SELECT * FROM pos_orders');
    const itemRows = safeQuery('SELECT * FROM pos_order_items');

    const itemsByOrderId = {};
    for (let i = 0; i < itemRows.length; i++) {
      const item = itemRows[i];
      const oid = item.orderId;
      if (!itemsByOrderId[oid]) itemsByOrderId[oid] = [];
      itemsByOrderId[oid].push({
        ...item,
        name: item.productName || item.name,
        qty: item.quantity || item.qty,
        total: (item.price || 0) * (item.quantity || item.qty || 1),
        modifiers: safeJsonParse(item.modifiers, [])
      });
    }

    const posOrders = orderRows.map(order => ({
      ...order,
      items: itemsByOrderId[order.id] || []
    }));

    const suppliers = safeQuery('SELECT * FROM suppliers');
    const itemSuppliers = safeQuery('SELECT * FROM inventory_item_suppliers');

    const state = {
      version: cachedStateTime || now,
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
      posTables,
      posOrders,
      suppliers,
      itemSuppliers
    };

    // Update in-memory cache
    cachedStateResponse = state;
    cachedStateTime = now;

    return NextResponse.json(state, {
      headers: {
        'Cache-Control': 'private, max-age=2, stale-while-revalidate=5',
        'X-State-Cache': 'MISS'
      }
    });
  } catch (err) {
    console.error('Error fetching Next.js state:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
