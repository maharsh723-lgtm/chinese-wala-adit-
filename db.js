const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new DatabaseSync(dbPath);

console.log(`Database initialized at: ${dbPath}`);

// Recreate tables with new schema
db.exec('DROP TABLE IF EXISTS employees');
db.exec('DROP TABLE IF EXISTS leave_requests');
db.exec('DROP TABLE IF EXISTS purchase_requests');
db.exec('DROP TABLE IF EXISTS sops');
db.exec('DROP TABLE IF EXISTS inventory');
db.exec('DROP TABLE IF EXISTS wastage');
db.exec('DROP TABLE IF EXISTS checklists');
db.exec('DROP TABLE IF EXISTS eod_reports');
db.exec('DROP TABLE IF EXISTS recipes');


// Create Tables
db.exec(`
  CREATE TABLE employees (
    id TEXT PRIMARY KEY,
    name TEXT,
    role TEXT,
    mobile TEXT,
    shiftStart TEXT,
    roleKey TEXT,
    password TEXT,
    status TEXT,
    store TEXT,
    activePunch TEXT, -- JSON string
    history TEXT -- JSON string
  )
`);

db.exec(`
  CREATE TABLE leave_requests (
    id TEXT PRIMARY KEY,
    empId TEXT,
    name TEXT,
    store TEXT,
    date TEXT,
    reason TEXT,
    status TEXT
  )
`);

db.exec(`
  CREATE TABLE purchase_requests (
    id TEXT PRIMARY KEY,
    name TEXT,
    qty INTEGER,
    supplier TEXT,
    store TEXT,
    reqDate TEXT,
    status TEXT,
    currentStep INTEGER,
    history TEXT -- JSON string
  )
`);

db.exec(`
  CREATE TABLE sops (
    id TEXT PRIMARY KEY,
    title TEXT,
    dept TEXT,
    priority TEXT,
    freq TEXT,
    instructions TEXT,
    assignedTo TEXT,
    store TEXT,
    status TEXT,
    completionPct INTEGER,
    dueDate TEXT
  )
`);

db.exec(`
  CREATE TABLE inventory (
    id TEXT PRIMARY KEY,
    label TEXT,
    category TEXT,
    stock INTEGER,
    unit TEXT,
    reorder INTEGER,
    unitCost REAL,
    expiryDate TEXT,
    store TEXT,
    status TEXT
  )
`);

db.exec(`
  CREATE TABLE wastage (
    id TEXT PRIMARY KEY,
    store TEXT,
    name TEXT,
    qty INTEGER,
    unit TEXT,
    reason TEXT,
    date TEXT
  )
`);

db.exec(`
  CREATE TABLE checklists (
    id TEXT PRIMARY KEY, -- "opening-STORE-YYYY-MM-DD" or "closing-STORE-YYYY-MM-DD"
    type TEXT, -- "opening" or "closing"
    store TEXT,
    date TEXT,
    progress INTEGER,
    completed INTEGER,
    items TEXT -- JSON string (array of indices checked)
  )
`);

db.exec(`
  CREATE TABLE eod_reports (
    id TEXT PRIMARY KEY, -- "eod-STORE-YYYY-MM-DD"
    store TEXT,
    date TEXT,
    sales REAL,
    expenses REAL,
    cash REAL,
    upi REAL,
    card REAL,
    orders INTEGER,
    submittedBy TEXT,
    submittedAt TEXT
  )
`);

db.exec(`
  CREATE TABLE recipes (
    id TEXT PRIMARY KEY,
    name TEXT,
    portion TEXT,
    status TEXT,
    ingredients TEXT, -- JSON string
    rawCost REAL,
    retailPrice REAL
  )
`);


// Seed Employees
console.log('Seeding employees...');
const insertEmp = db.prepare(`
  INSERT INTO employees (id, name, role, mobile, shiftStart, roleKey, password, status, store, activePunch, history)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seededEmployees = [
  // Mumbai Bandra
  {
    id: "1",
    name: "John Doe",
    role: "Crew Member",
    mobile: "9876543210",
    shiftStart: "06:00",
    roleKey: "staff",
    password: "",
    status: "Active",
    store: "Mumbai Bandra",
    activePunch: null,
    history: [
      { date: "2026-06-10", punchIn: "05:58 AM", punchOut: "02:00 PM", hours: "8.0", status: "Normal", device: "Android Terminal #1", location: "Mumbai Bandra Store" }
    ]
  },
  {
    id: "EMP102",
    name: "Alice Smith",
    role: "Kitchen Staff",
    mobile: "9876543211",
    shiftStart: "06:00",
    roleKey: "kitchen",
    password: "password123",
    status: "Active",
    store: "Mumbai Bandra",
    activePunch: null,
    history: []
  },
  {
    id: "EMP104",
    name: "Rahul Sharma",
    role: "Branch Manager",
    mobile: "9876543213",
    shiftStart: "09:00",
    roleKey: "sm",
    password: "password123",
    status: "Active",
    store: "Mumbai Bandra",
    activePunch: null,
    history: []
  },
  // Delhi Connaught Place
  {
    id: "EMP107",
    name: "Raj Patel",
    role: "Crew Member",
    mobile: "9876543220",
    shiftStart: "06:00",
    roleKey: "staff",
    password: "",
    status: "Active",
    store: "Delhi Connaught Place",
    activePunch: null,
    history: []
  },
  {
    id: "EMP108",
    name: "Sunita Sharma",
    role: "Kitchen Staff",
    mobile: "9876543221",
    shiftStart: "06:00",
    roleKey: "kitchen",
    password: "password123",
    status: "Active",
    store: "Delhi Connaught Place",
    activePunch: null,
    history: []
  },
  {
    id: "EMP105",
    name: "Priya Patel",
    role: "Branch Manager",
    mobile: "9876543214",
    shiftStart: "09:00",
    roleKey: "sm",
    password: "password123",
    status: "Active",
    store: "Delhi Connaught Place",
    activePunch: null,
    history: []
  },
  // Bangalore Indiranagar
  {
    id: "EMP109",
    name: "Ramesh Kumar",
    role: "Crew Member",
    mobile: "9876543230",
    shiftStart: "06:00",
    roleKey: "staff",
    password: "",
    status: "Active",
    store: "Bangalore Indiranagar",
    activePunch: null,
    history: []
  },
  {
    id: "EMP110",
    name: "Kavitha Raju",
    role: "Kitchen Staff",
    mobile: "9876543231",
    shiftStart: "06:00",
    roleKey: "kitchen",
    password: "password123",
    status: "Active",
    store: "Bangalore Indiranagar",
    activePunch: null,
    history: []
  },
  {
    id: "EMP103",
    name: "Bob Miller",
    role: "Branch Manager",
    mobile: "9876543212",
    shiftStart: "14:00",
    roleKey: "sm",
    password: "password123",
    status: "Active",
    store: "Bangalore Indiranagar",
    activePunch: null,
    history: []
  },
  // Owner (Global representation)
  {
    id: "OWNER101",
    name: "Franchise Partner",
    role: "Owner",
    mobile: "9999999999",
    shiftStart: "09:00",
    roleKey: "owner",
    password: "ownerpassword",
    status: "Active",
    store: "All",
    activePunch: null,
    history: []
  }
];

for (const emp of seededEmployees) {
  insertEmp.run(
    emp.id,
    emp.name,
    emp.role,
    emp.mobile,
    emp.shiftStart,
    emp.roleKey,
    emp.password,
    emp.status,
    emp.store,
    emp.activePunch ? JSON.stringify(emp.activePunch) : null,
    JSON.stringify(emp.history)
  );
}

// Seed Leave Requests
console.log('Seeding leave requests...');
db.prepare(`
  INSERT INTO leave_requests (id, empId, name, store, date, reason, status)
  VALUES ('lv-1', '1', 'John Doe', 'Mumbai Bandra', '2026-06-14', 'Medical Checkup', 'PENDING')
`).run();

// Seed Purchase Requests
console.log('Seeding purchase requests...');
db.prepare(`
  INSERT INTO purchase_requests (id, name, qty, supplier, store, reqDate, status, currentStep, history)
  VALUES ('pr-demo-1', 'Whopper Sesame Buns', 80, 'BK Soho', 'Mumbai Bandra', '15 June', 'ho_pending', 3, ?)
`).run(JSON.stringify([{ role: 'sm', action: 'approve', time: '15 June, 10:00 AM' }]));

// Seed SOPs
console.log('Seeding SOPs...');
const insertSOP = db.prepare(`
  INSERT INTO sops (id, title, dept, priority, freq, instructions, assignedTo, store, status, completionPct, dueDate)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insertSOP.run('sop-1', 'Whopper Broiler Calibration', 'Kitchen', 'High', 'daily', 'Calibrate broiler temp to 350C.', 'Kitchen Staff', 'Mumbai Bandra', 'OVERDUE', 40, '11:00 AM');
insertSOP.run('sop-2', 'Deep Fryer Salting Standard', 'Kitchen', 'Medium', 'daily', 'Salt french fries immediately after fry cycle.', 'Kitchen Staff', 'Delhi Connaught Place', 'PENDING', 75, '2:00 PM');
insertSOP.run('sop-3', 'Cold storage audit log', 'Management', 'High', 'weekly', 'Audit chiller and freezer temp history sheets.', 'Branch Manager', 'Bangalore Indiranagar', 'COMPLETED', 100, 'Yesterday');

// Seed Inventory for each of the 3 branches
console.log('Seeding inventory for all 3 branches...');
const insertInv = db.prepare(`
  INSERT INTO inventory (id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const branches = ['Mumbai Bandra', 'Delhi Connaught Place', 'Bangalore Indiranagar'];
const invItems = [
  { label: 'Whopper Sesame Buns', category: 'Bakery Breads', stock: 120, unit: 'Piece', reorder: 100, unitCost: 15.50, expiryDate: '2026-06-25', status: 'OK' },
  { label: 'Raw Chicken Patties (Whopper)', category: 'Frozen Foods', stock: 45, unit: 'Box', reorder: 80, unitCost: 450.00, expiryDate: '2026-08-15', status: 'LOW STOCK' },
  { label: 'Cheddar Cheese Slices', category: 'Dairy Packets', stock: 320, unit: 'Piece', reorder: 150, unitCost: 8.50, expiryDate: '2026-06-18', status: 'OK' }
];

let invCounter = 1;
for (const branch of branches) {
  for (const item of invItems) {
    insertInv.run(
      `inv-${invCounter++}`,
      item.label,
      item.category,
      item.stock,
      item.unit,
      item.reorder,
      item.unitCost,
      item.expiryDate,
      branch,
      item.status
    );
  }
}

// Seed Wastage
console.log('Seeding wastage...');
db.prepare(`
  INSERT INTO wastage (id, store, name, qty, unit, reason, date)
  VALUES ('w-1', 'Mumbai Bandra', 'Chicken patties', 20, 'Piece', 'Expired', '2026-06-15')
`).run();
db.prepare(`
  INSERT INTO wastage (id, store, name, qty, unit, reason, date)
  VALUES ('w-2', 'Delhi Connaught Place', 'Whopper Sesame Buns', 12, 'Piece', 'Spillage', '2026-06-15')
`).run();

// Seed Checklists for today for all 3 branches
console.log('Seeding checklists for all 3 branches...');
const insertChecklist = db.prepare(`
  INSERT INTO checklists (id, type, store, date, progress, completed, items)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const todayStr = '2026-06-15';
for (const branch of branches) {
  // Mumbai starts with 20% checked, Delhi and Bangalore start empty
  const progress = branch === 'Mumbai Bandra' ? 20 : 0;
  const items = branch === 'Mumbai Bandra' ? [0] : [];
  insertChecklist.run(`opening-${branch}-${todayStr}`, 'opening', branch, todayStr, progress, 0, JSON.stringify(items));
  insertChecklist.run(`closing-${branch}-${todayStr}`, 'closing', branch, todayStr, 0, 0, JSON.stringify([]));
}

// Seed historical EOD report for testing
console.log('Seeding EOD Reports...');
const insertEod = db.prepare(`
  INSERT INTO eod_reports (id, store, date, sales, expenses, cash, upi, card, orders, submittedBy, submittedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
// Seed Delhi and Bangalore historical EOD for yesterday
insertEod.run(`eod-Delhi Connaught Place-2026-06-14`, 'Delhi Connaught Place', '2026-06-14', 185000, 24000, 45000, 110000, 30000, 850, 'Priya Patel', '2026-06-14 10:15 PM');
insertEod.run(`eod-Bangalore Indiranagar-2026-06-14`, 'Bangalore Indiranagar', '2026-06-14', 165000, 18000, 35000, 95000, 35000, 780, 'Bob Miller', '2026-06-14 09:45 PM');
// Seed Mumbai for yesterday
insertEod.run(`eod-Mumbai Bandra-2026-06-14`, 'Mumbai Bandra', '2026-06-14', 210000, 31000, 50000, 120000, 40000, 1020, 'Rahul Sharma', '2026-06-14 10:30 PM');

// Seed Recipes
console.log('Seeding recipes...');
const insertRecipe = db.prepare(`
  INSERT INTO recipes (id, name, portion, status, ingredients, rawCost, retailPrice)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const seededRecipes = [
  {
    id: "rec-1",
    name: "Whopper Veg Burger",
    portion: "Standard size portion",
    status: "Active",
    ingredients: [
      { name: "Sesame Bun", qty: 1, unit: "Piece" },
      { name: "Veg Whopper Patty", qty: 1, unit: "Piece" },
      { name: "Mayonnaise Sauce", qty: 20, unit: "gm" },
      { name: "Iceberg Lettuce", qty: 15, unit: "gm" }
    ],
    rawCost: 38.50,
    retailPrice: 149.00
  },
  {
    id: "rec-2",
    name: "Paneer King Royale",
    portion: "Standard size portion",
    status: "Active",
    ingredients: [
      { name: "Long Glazed Bun", qty: 1, unit: "Piece" },
      { name: "Royale Paneer Patty", qty: 1, unit: "Piece" },
      { name: "Shredded Iceberg Lettuce", qty: 15, unit: "gm" },
      { name: "Royale Mint Sauce", qty: 14, unit: "gm" }
    ],
    rawCost: 42.20,
    retailPrice: 169.00
  },
  {
    id: "rec-3",
    name: "Tandoori Double Cheeseburger",
    portion: "Value size portion",
    status: "Active",
    ingredients: [
      { name: "Plain Bun", qty: 1, unit: "Piece" },
      { name: "Cheeseburger Patty (2oz)", qty: 2, unit: "Piece" },
      { name: "Cheddar Cheese Slices", qty: 2, unit: "Piece" },
      { name: "Tandoori Mayo Sauce", qty: 10, unit: "gm" }
    ],
    rawCost: 35.40,
    retailPrice: 119.00
  }
];

for (const recipe of seededRecipes) {
  insertRecipe.run(
    recipe.id,
    recipe.name,
    recipe.portion,
    recipe.status,
    JSON.stringify(recipe.ingredients),
    recipe.rawCost,
    recipe.retailPrice
  );
}

module.exports = db;
