const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '..', 'database.db'));

const rawProducts = db.prepare('SELECT * FROM pos_products').all();
const products = rawProducts.map(p => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: Number(p.price),
  image: p.image,
  isVeg: Boolean(p.isVeg),
  isPopular: Boolean(p.isPopular),
  isFavorite: Boolean(p.isFavorite),
  stock: Number(p.stock) || 100,
  ingredients: p.ingredients ? JSON.parse(p.ingredients) : []
}));

const rawModifiers = db.prepare('SELECT * FROM pos_modifiers').all();
const modifiers = rawModifiers.map(m => ({
  id: m.id,
  name: m.name,
  price: Number(m.price)
}));

const rawCustomers = db.prepare('SELECT * FROM pos_customers').all();
const customers = rawCustomers.map(c => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  loyaltyPoints: Number(c.loyaltyPoints) || 0
}));

const rawCoupons = db.prepare('SELECT * FROM pos_coupons').all();
const coupons = rawCoupons.map(cp => ({
  id: cp.id,
  code: cp.code,
  discountType: cp.discountType,
  discountValue: Number(cp.discountValue),
  minOrder: Number(cp.minOrder)
}));

const rawTables = db.prepare('SELECT * FROM pos_tables').all();
const tables = rawTables.map(t => ({
  id: t.id,
  name: t.name,
  status: t.status,
  store: t.store
}));

const code = `// Auto-generated fallback catalog for Vercel Serverless environment
export const defaultPosProducts = ${JSON.stringify(products, null, 2)};

export const defaultPosModifiers = ${JSON.stringify(modifiers, null, 2)};

export const defaultPosCustomers = ${JSON.stringify(customers, null, 2)};

export const defaultPosCoupons = ${JSON.stringify(coupons, null, 2)};

export const defaultPosTables = ${JSON.stringify(tables, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '..', 'lib', 'defaultMenu.js'), code, 'utf8');
console.log('Successfully generated lib/defaultMenu.js with', products.length, 'products,', modifiers.length, 'modifiers,', tables.length, 'tables.');
