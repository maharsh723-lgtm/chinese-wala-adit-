const { DatabaseSync } = require('node:sqlite');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'env', '.env') });
const XLSX = require('xlsx');
const { hashPassword } = require('./src/cryptoHelper.cjs');

const dbFilename = process.env.DB_FILE || 'database.db';
const dbPath = path.isAbsolute(dbFilename) ? dbFilename : path.join(__dirname, dbFilename);
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 10000;");
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");
db.exec("PRAGMA cache_size = -64000;"); // 64MB cache in RAM
db.exec("PRAGMA temp_store = MEMORY;");

console.log(`Database initialized at: ${dbPath}`);

function getOffsetDateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Recreate tables with new schema
// db.exec('DROP TABLE IF EXISTS employees');
// db.exec('DROP TABLE IF EXISTS leave_requests');
// db.exec('DROP TABLE IF EXISTS sops');
// db.exec('DROP TABLE IF EXISTS inventory');
// db.exec('DROP TABLE IF EXISTS wastage');
// db.exec('DROP TABLE IF EXISTS checklists');
// db.exec('DROP TABLE IF EXISTS eod_reports');
// db.exec('DROP TABLE IF EXISTS recipes');
// db.exec('DROP TABLE IF EXISTS product_sales');
// db.exec('DROP TABLE IF EXISTS pos_products');
// db.exec('DROP TABLE IF EXISTS pos_modifiers');
// db.exec('DROP TABLE IF EXISTS pos_customers');
// db.exec('DROP TABLE IF EXISTS pos_orders');
// db.exec('DROP TABLE IF EXISTS pos_order_items');
// db.exec('DROP TABLE IF EXISTS pos_kitchen_orders');
// db.exec('DROP TABLE IF EXISTS pos_tables');
// db.exec('DROP TABLE IF EXISTS pos_coupons');
// db.exec('DROP TABLE IF EXISTS pos_audit_logs');
// db.exec('DROP TABLE IF EXISTS pos_stock_movement');
// db.exec('DROP TABLE IF EXISTS purchases');
// db.exec('DROP TABLE IF EXISTS expenses');


// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
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
    history TEXT, -- JSON string
    salary REAL DEFAULT 0
  )
`);
try { db.exec("ALTER TABLE employees ADD COLUMN salary REAL DEFAULT 0;"); } catch(e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS leave_requests (
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
  CREATE TABLE IF NOT EXISTS sops (
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
  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    label TEXT,
    category TEXT,
    stock INTEGER,
    unit TEXT,
    reorder INTEGER,
    unitCost REAL,
    expiryDate TEXT,
    store TEXT,
    status TEXT,
    openingStock INTEGER DEFAULT 0,
    closingStock INTEGER DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS wastage (
    id TEXT PRIMARY KEY,
    store TEXT,
    name TEXT,
    qty INTEGER,
    unit TEXT,
    reason TEXT,
    date TEXT,
    cost REAL,
    image TEXT,
    loggedBy TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS checklists (
    id TEXT PRIMARY KEY, -- "opening-STORE-YYYY-MM-DD" or "closing-STORE-YYYY-MM-DD"
    type TEXT, -- "opening" or "closing"
    store TEXT,
    date TEXT,
    progress INTEGER,
    completed INTEGER,
    items TEXT, -- JSON string (array of indices checked)
    photo TEXT -- Base64 image string
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS eod_reports (
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
  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name TEXT,
    portion TEXT,
    status TEXT,
    ingredients TEXT, -- JSON string
    rawCost REAL,
    retailPrice REAL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS product_sales (
    id TEXT PRIMARY KEY,
    store TEXT,
    date TEXT,
    recipeId TEXT,
    itemName TEXT,
    category TEXT,
    qty INTEGER,
    revenue REAL,
    image TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pos_products (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    price REAL,
    image TEXT,
    isVeg INTEGER,
    isPopular INTEGER,
    isFavorite INTEGER,
    stock INTEGER,
    ingredients TEXT -- JSON string
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pos_modifiers (
    id TEXT PRIMARY KEY,
    name TEXT,
    price REAL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pos_customers (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    loyaltyPoints INTEGER DEFAULT 0
  )
`);

// Add Guest Intelligence columns dynamically
try { db.exec("ALTER TABLE pos_customers ADD COLUMN email TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE pos_customers ADD COLUMN dob TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE pos_customers ADD COLUMN anniversary TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE pos_customers ADD COLUMN customerSince TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE pos_customers ADD COLUMN preferences TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE pos_customers ADD COLUMN specialRequirements TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE pos_customers ADD COLUMN notes TEXT;"); } catch(e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS pos_orders (
    id TEXT PRIMARY KEY,
    date TEXT,
    time TEXT,
    customerId TEXT,
    customerName TEXT,
    orderType TEXT,
    tableName TEXT,
    address TEXT,
    subtotal REAL,
    tax REAL,
    discount REAL,
    serviceCharge REAL,
    grandTotal REAL,
    paymentMethod TEXT,
    status TEXT,
    store TEXT,
    source TEXT DEFAULT 'pos',
    dToken TEXT,
    deliveryStatus TEXT,
    externalOrderId TEXT,
    estimatedPickupTime TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pos_order_items (
    id TEXT PRIMARY KEY,
    orderId TEXT,
    productId TEXT,
    productName TEXT,
    quantity INTEGER,
    price REAL,
    modifiers TEXT, -- JSON string array
    instructions TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pos_kitchen_orders (
    id TEXT PRIMARY KEY,
    orderId TEXT,
    kotNumber TEXT,
    status TEXT, -- 'Pending', 'In Progress', 'Ready', 'Served'
    store TEXT,
    items TEXT -- JSON string array
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pos_tables (
    id TEXT PRIMARY KEY,
    name TEXT,
    status TEXT, -- 'Available', 'Occupied', 'Reserved'
    store TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pos_coupons (
    id TEXT PRIMARY KEY,
    code TEXT,
    discountType TEXT, -- 'percent', 'fixed'
    discountValue REAL,
    minOrder REAL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pos_audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    action TEXT,
    userId TEXT,
    userName TEXT,
    details TEXT,
    store TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pos_stock_movement (
    id TEXT PRIMARY KEY,
    itemId TEXT,
    itemName TEXT,
    qty INTEGER,
    type TEXT, -- 'IN', 'OUT'
    reason TEXT,
    timestamp TEXT,
    store TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_ledger (
    id TEXT PRIMARY KEY,
    itemId TEXT,
    storeId TEXT,
    transactionType TEXT,
    qty REAL,
    unit TEXT,
    reason TEXT,
    timestamp TEXT,
    referenceId TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_consumption (
    id TEXT PRIMARY KEY,
    orderId TEXT,
    storeId TEXT,
    menuItemId TEXT,
    recipeId TEXT,
    recipeVersion INTEGER,
    soldQuantity REAL,
    ingredientId TEXT,
    recipeQuantity REAL,
    actualConsumptionQuantity REAL,
    unit TEXT,
    timestamp TEXT,
    source TEXT,
    status TEXT,
    referenceTransactionId TEXT
  )
`);

try { db.exec("ALTER TABLE pos_orders ADD COLUMN source TEXT DEFAULT 'pos'"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN dToken TEXT"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN deliveryStatus TEXT"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN externalOrderId TEXT"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN splitCashAmount REAL DEFAULT 0"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN splitUpiAmount REAL DEFAULT 0"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN estimatedPickupTime TEXT"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN customerPhone TEXT"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN utr TEXT"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN screenshot TEXT"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN paymentStatus TEXT DEFAULT 'Verified'"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN adminNotes TEXT"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN bankName TEXT"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN upiId TEXT"); } catch(e){}
try { db.exec("ALTER TABLE pos_orders ADD COLUMN inventorySyncStatus TEXT DEFAULT 'Pending'"); } catch(e){}

try { db.exec("ALTER TABLE recipes ADD COLUMN version INTEGER DEFAULT 1"); } catch(e){}
try { db.exec("ALTER TABLE pos_products ADD COLUMN recipeId TEXT"); } catch(e){}

db.exec(`
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    date TEXT,
    branchName TEXT,
    managerName TEXT,
    subtotal REAL,
    gst REAL,
    grandTotal REAL,
    paymentMethod TEXT,
    paymentStatus TEXT,
    orderStatus TEXT,
    expectedDeliveryDate TEXT,
    notes TEXT,
    transactionId TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY,
    orderId TEXT,
    productId TEXT,
    productName TEXT,
    quantity INTEGER,
    rate REAL,
    amount REAL,
    gst REAL,
    total REAL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS order_tracking (
    id TEXT PRIMARY KEY,
    orderId TEXT,
    status TEXT,
    timestamp TEXT,
    notes TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    title TEXT,
    message TEXT,
    timestamp TEXT,
    role TEXT,
    store TEXT,
    isRead INTEGER DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contactPerson TEXT,
    mobileNumber TEXT,
    whatsappNumber TEXT,
    email TEXT,
    gstNumber TEXT,
    address TEXT,
    paymentTerms TEXT,
    deliveryDays INTEGER,
    notes TEXT,
    status TEXT DEFAULT 'Active',
    isPreferred INTEGER DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_item_suppliers (
    itemId TEXT,
    supplierId TEXT,
    isDefault INTEGER DEFAULT 0,
    unitCost REAL,
    PRIMARY KEY (itemId, supplierId),
    FOREIGN KEY (itemId) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id TEXT PRIMARY KEY,
    poId TEXT,
    type TEXT,
    recipientNumber TEXT,
    messageContent TEXT,
    status TEXT DEFAULT 'Pending Integration',
    timestamp TEXT,
    FOREIGN KEY (poId) REFERENCES purchase_orders(id) ON DELETE SET NULL
  )
`);

// Create performance indexes
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pos_orders_date_store ON pos_orders (date, store);
    CREATE INDEX IF NOT EXISTS idx_pos_orders_status ON pos_orders (status);
    CREATE INDEX IF NOT EXISTS idx_pos_order_items_orderId ON pos_order_items (orderId);
    CREATE INDEX IF NOT EXISTS idx_pos_order_items_product ON pos_order_items (productName);
    CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory (store);
    CREATE INDEX IF NOT EXISTS idx_product_sales_date ON product_sales (date);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
    CREATE INDEX IF NOT EXISTS idx_pos_audit_logs_timestamp ON pos_audit_logs (timestamp);
  `);
// Clean up any test/phantom orders between 130 and 138
try {
  const phantomOrders = db.prepare(`
    SELECT id FROM pos_orders 
    WHERE (CAST(SUBSTR(id, INSTR(id, 'order-') + 6) AS INTEGER) >= 130 AND CAST(SUBSTR(id, INSTR(id, 'order-') + 6) AS INTEGER) <= 138)
       OR (dToken IS NOT NULL AND (dToken LIKE '%130%' OR dToken LIKE '%131%' OR dToken LIKE '%132%' OR dToken LIKE '%133%' OR dToken LIKE '%134%' OR dToken LIKE '%135%' OR dToken LIKE '%136%' OR dToken LIKE '%137%' OR dToken LIKE '%138%'))
  `).all();
  if (phantomOrders.length > 0) {
    const ids = phantomOrders.map(o => o.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM pos_orders WHERE id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM pos_order_items WHERE orderId IN (${placeholders})`).run(...ids);
  }
} catch(e) {
  console.warn("Clean phantom orders note:", e);
}




// Check if database is already seeded by checking employees count
let isSeeded = false;
try {
  const row = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='employees'").get();
  if (row && row.count > 0) {
    const empCount = db.prepare("SELECT COUNT(*) as count FROM employees").get().count;
    if (empCount > 0) {
      isSeeded = true;
    }
  }
} catch (e) {
  // Not seeded yet
}

if (!isSeeded) {
// Seed Employees
console.log('Seeding employees...');
const insertEmp = db.prepare(`
  INSERT INTO employees (id, name, role, mobile, shiftStart, roleKey, password, status, store, activePunch, history, salary)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seededEmployees = [
  // VESU
  {
    id: "EMP104",
    name: "Manager VESU",
    role: "Branch Manager",
    mobile: "9876543213",
    shiftStart: "09:00",
    roleKey: "sm",
    password: "password123",
    status: "Active",
    store: "VESU",
    activePunch: null,
    history: [],
    salary: 35000
  },
  // LP SAVANI
  {
    id: "EMP105",
    name: "Manager LP SAVANI",
    role: "Branch Manager",
    mobile: "9876543214",
    shiftStart: "09:00",
    roleKey: "sm",
    password: "password123",
    status: "Active",
    store: "LP SAVANI",
    activePunch: null,
    history: [],
    salary: 38000
  },
  // GAURAV PATH
  {
    id: "EMP103",
    name: "Manager GAURAV PATH",
    role: "Branch Manager",
    mobile: "9876543212",
    shiftStart: "14:00",
    roleKey: "sm",
    password: "password123",
    status: "Active",
    store: "GAURAV PATH",
    activePunch: null,
    history: [],
    salary: 40000
  },
  // SUDAMA CHOWK
  {
    id: "EMP106",
    name: "Manager SUDAMA CHOWK",
    role: "Branch Manager",
    mobile: "9876543215",
    shiftStart: "09:00",
    roleKey: "sm",
    password: "password123",
    status: "Active",
    store: "SUDAMA CHOWK",
    activePunch: null,
    history: [],
    salary: 36000
  },
  // Owner (Global representation)
  {
    id: "OWNER101",
    name: "Franchise Owner",
    role: "Owner",
    mobile: "9999999999",
    shiftStart: "09:00",
    roleKey: "owner",
    password: "ownerpassword",
    status: "Active",
    store: "All",
    activePunch: null,
    history: [],
    salary: 0
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
    JSON.stringify(emp.history),
    emp.salary || 0
  );
}

// Seed Leave Requests
console.log('Seeding leave requests...');
db.prepare(`
  INSERT INTO leave_requests (id, empId, name, store, date, reason, status)
  VALUES ('lv-1', '1', 'Crew Member 1', 'VESU', ?, 'Medical Checkup', 'PENDING')
`).run(getOffsetDateStr(1));



// Seed SOPs
console.log('Seeding SOPs...');
const insertSOP = db.prepare(`
  INSERT INTO sops (id, title, dept, priority, freq, instructions, assignedTo, store, status, completionPct, dueDate)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insertSOP.run('sop-1', 'Whopper Broiler Calibration', 'Kitchen', 'High', 'daily', 'Calibrate broiler temp to 350C.', 'Kitchen Staff', 'VESU', 'OVERDUE', 40, '11:00 AM');
insertSOP.run('sop-2', 'Deep Fryer Salting Standard', 'Kitchen', 'Medium', 'daily', 'Salt french fries immediately after fry cycle.', 'Kitchen Staff', 'LP SAVANI', 'PENDING', 75, '2:00 PM');
insertSOP.run('sop-3', 'Cold storage audit log', 'Management', 'High', 'weekly', 'Audit chiller and freezer temp history sheets.', 'Branch Manager', 'GAURAV PATH', 'COMPLETED', 100, 'Yesterday');
insertSOP.run('sop-4', 'Hygiene checklist audit', 'Management', 'Medium', 'daily', 'Verify general store hygiene and cleanliness.', 'Branch Manager', 'SUDAMA CHOWK', 'PENDING', 50, '5:00 PM');

// Dynamic Excel loader for Inventory & Recipes from recipe costing.xlsx
const excelFilename = process.env.RECIPE_EXCEL_FILE || 'recipe costing.xlsx';
const excelPath = path.isAbsolute(excelFilename) ? excelFilename : path.join(__dirname, excelFilename);
let recipesList = [];
let uniqueIngredients = {};

try {
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['Sheet1'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let rawRecipes = [];
  let currentRecipe = null;
  let rawRows = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const isHeader = row.some(cell => typeof cell === 'string' && cell.trim() === 'INGREDIENTS');
    if (isHeader) {
      if (currentRecipe) {
        rawRecipes.push({ currentRecipe, rawRows });
      }
      currentRecipe = {};
      rawRows = [];
      continue;
    }

    if (currentRecipe) {
      rawRows.push(row);
    }
  }
  if (currentRecipe) {
    rawRecipes.push({ currentRecipe, rawRows });
  }

  rawRecipes.forEach((item, idx) => {
    const rows = item.rawRows;
    const firstRow = rows[0];
    if (!firstRow) return;

    let name = '';
    rows.forEach(row => {
      const col0 = row[0];
      if (col0 && typeof col0 === 'string' && col0.includes(':')) {
        name = col0.replace(':', '').trim();
      }
    });

    if (!name) {
      for (let i = 1; i < rows.length; i++) {
        const col0 = rows[i][0];
        if (col0 && typeof col0 === 'string' && col0.trim() !== '' && isNaN(col0)) {
          name = col0.trim();
          break;
        }
      }
    }

    if (!name) {
      name = firstRow[1] || `Recipe-${idx+1}`;
    }

    const menuPrice = typeof firstRow[8] === 'number' ? firstRow[8] : 0;
    let totalCostVal = typeof firstRow[7] === 'number' ? firstRow[7] : (typeof firstRow[5] === 'number' ? firstRow[5] : 0);

    let recipeIngredients = [];
    let calculatedRawCost = 0;

    rows.forEach(row => {
      const ingName = row[1];
      const qty = row[2];
      const rate = row[3];
      const amount = row[4];

      if (ingName && typeof ingName === 'string' && ingName.trim() !== '' && ingName !== 'INGREDIENTS') {
        const cleanIngName = ingName.trim();
        const qVal = typeof qty === 'number' ? qty : 0;
        const rVal = typeof rate === 'number' ? rate : 0;
        const aVal = typeof amount === 'number' ? amount : (qVal * rVal);

        recipeIngredients.push({
          name: cleanIngName,
          qty: qVal,
          unit: 'gm',
          cost: aVal
        });

        calculatedRawCost += aVal;

        if (cleanIngName) {
          if (!uniqueIngredients[cleanIngName]) {
            uniqueIngredients[cleanIngName] = {
              rates: [],
              unit: 'gm'
            };
          }
          if (rVal > 0) {
            uniqueIngredients[cleanIngName].rates.push(rVal);
          }
        }
      }
    });

    recipeIngredients.forEach(ing => {
      const lower = ing.name.toLowerCase();
      if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('samosa') || lower.includes('kachori') || lower.includes('puri') || lower.includes('bhalla') || lower.includes('chilla') || lower.includes('kulche') || lower.includes('bhature') || lower.includes('tikki') || lower.includes('wedge')) {
        ing.unit = 'Piece';
      } else if (lower.includes('ml') || lower.includes('oil') || lower.includes('syrup') || lower.includes('water') || lower.includes('kadi') || lower.includes('batter')) {
        ing.unit = 'ml';
      } else {
        ing.unit = 'gm';
      }
    });

    recipesList.push({
      id: `rec-${idx+1}`,
      name: name,
      portion: 'Standard Portion',
      status: 'Active',
      ingredients: recipeIngredients,
      rawCost: totalCostVal || calculatedRawCost,
      retailPrice: menuPrice || (calculatedRawCost * 3)
    });
  });

  // Manually add standard raw materials for billing-inventory integration
  const manualIngredients = {
    'Milk': { rates: [0.06], unit: 'ml' },
    'Coffee Beans': { rates: [1.2], unit: 'gm' },
    'Tea Leaves': { rates: [0.4], unit: 'gm' },
    'Burger Buns': { rates: [10.0], unit: 'Piece' },
    'Veg Patty': { rates: [15.0], unit: 'Piece' },
    'Sandwich Bread': { rates: [4.0], unit: 'Piece' },
    'Maggie Noodles': { rates: [12.0], unit: 'Piece' },
    'Frozen French Fries': { rates: [0.15], unit: 'gm' },
    'Lassi Dahi': { rates: [0.08], unit: 'gm' }
  };
  Object.keys(manualIngredients).forEach(k => {
    uniqueIngredients[k] = manualIngredients[k];
  });

  // Parse inventory.xlsx if it exists
  try {
    const invExcelPath = path.join(__dirname, 'inventory.xlsx');
    console.log('Checking for inventory.xlsx at:', invExcelPath);
    const invWorkbook = XLSX.readFile(invExcelPath);
    const invSheetNames = invWorkbook.SheetNames;
    
    // Read from the sheets to get all unique items
    invSheetNames.forEach(sheetName => {
      const worksheet = invWorkbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      let headerRowIdx = -1;
      let colIndices = { name: -1, category: -1, unit: -1, cost: -1 };
      
      for (let r = 0; r < Math.min(rows.length, 30); r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        const rowStr = row.map(c => String(c).trim().toLowerCase());
        
        const itemDetailsIdx = rowStr.indexOf('item details');
        if (itemDetailsIdx > -1) {
          headerRowIdx = r;
          colIndices.name = itemDetailsIdx;
          colIndices.category = rowStr.indexOf('parent group');
          colIndices.unit = rowStr.indexOf('unit');
          break;
        }
        
        const stockStatusIdx = rowStr.indexOf('stock status');
        if (stockStatusIdx > -1) {
          headerRowIdx = r;
          colIndices.name = stockStatusIdx;
          colIndices.cost = rowStr.indexOf('price/pkd');
          break;
        }
      }
      
      if (headerRowIdx !== -1) {
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;
          
          const nameVal = row[colIndices.name];
          if (!nameVal || String(nameVal).trim() === '' || String(nameVal).toLowerCase().includes('total') || String(nameVal).toLowerCase().includes('status')) {
            continue;
          }
          
          const name = String(nameVal).trim();
          
          let cost = 10.00;
          if (colIndices.cost > -1 && row[colIndices.cost] !== undefined && row[colIndices.cost] !== '') {
            cost = parseFloat(row[colIndices.cost]) || 10.00;
          }
          
          let unit = '';
          if (colIndices.unit > -1 && row[colIndices.unit]) {
            unit = String(row[colIndices.unit]).trim();
          } else {
            const lower = name.toLowerCase();
            if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('plastic')) {
              unit = 'Piece';
            } else if (lower.includes('ml') || lower.includes('oil') || lower.includes('syrup') || lower.includes('water') || lower.includes('kadi') || lower.includes('batter')) {
              unit = 'ml';
            } else {
              unit = 'gm';
            }
          }
          
          if (!uniqueIngredients[name]) {
            uniqueIngredients[name] = {
              rates: [cost],
              unit: unit
            };
          } else {
            uniqueIngredients[name].rates.push(cost);
          }
        }
      }
    });
    console.log(`Merged inventory.xlsx items successfully. Total unique inventory types: ${Object.keys(uniqueIngredients).length}`);
  } catch (err) {
    console.error("Failed to parse inventory.xlsx during initialization:", err);
  }

  Object.keys(uniqueIngredients).forEach(name => {
    const val = name.trim().toLowerCase();
    if (!name || val.startsWith('(') || val.endsWith(')') || val.includes('as on :') || val === 'jain' || val === 'status' || val === 'item details' || val === 'stock status' || val.includes('all item')) {
      delete uniqueIngredients[name];
      return;
    }
    const item = uniqueIngredients[name];
    const avgRate = item.rates.length > 0 ? (item.rates.reduce((a,b)=>a+b, 0) / item.rates.length) : 10.00;
    item.unitCost = avgRate;
    
    const lower = name.toLowerCase();
    if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('plastic')) {
      item.unit = 'Piece';
    } else if (lower.includes('ml') || lower.includes('oil') || lower.includes('syrup') || lower.includes('water') || lower.includes('kadi') || lower.includes('batter')) {
      item.unit = 'ml';
    } else {
      item.unit = 'gm';
    }
  });
} catch (err) {
  console.error("Failed to dynamically load Excel recipe costing data:", err);
}

function getCategory(name) {
  const lower = name.toLowerCase();
  if (lower.includes('bun') || lower.includes('bread') || lower.includes('kulche') || lower.includes('bhature') || lower.includes('puri') || lower.includes('kachori') || lower.includes('samosa')) {
    return 'Bakery Breads';
  }
  if (lower.includes('patty') || lower.includes('patties') || lower.includes('bhalla') || lower.includes('tikki') || lower.includes('munglet')) {
    return 'Frozen Foods';
  }
  if (lower.includes('chutney') || lower.includes('sauce') || lower.includes('chatney') || lower.includes('oil') || lower.includes('syrup') || lower.includes('kadi')) {
    return 'Sauces & Spreads';
  }
  if (lower.includes('dahi') || lower.includes('cheese') || lower.includes('butter') || lower.includes('cream')) {
    return 'Dairy Packets';
  }
  if (lower.includes('lettuce') || lower.includes('beet') || lower.includes('carrot') || lower.includes('onion') || lower.includes('tomato') || lower.includes('chilli') || lower.includes('adrak') || lower.includes('dhania') || lower.includes('lemon') || lower.includes('potato') || lower.includes('alu') || lower.includes('chana') || lower.includes('spices') || lower.includes('masala')) {
    return 'Fresh Produce';
  }
  if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('plastic')) {
    return 'Packaging & Cutlery';
  }
  return 'Chaat Ingredients';
}

// Seed Inventory for each of the 3 branches
console.log('Seeding inventory for all 3 branches...');
const insertInv = db.prepare(`
  INSERT INTO inventory (id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status, openingStock, closingStock)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const branches = ['VESU', 'LP SAVANI', 'GAURAV PATH', 'SUDAMA CHOWK', 'WAREHOUSE'];

let invCounter = 1;
for (const branch of branches) {
  Object.keys(uniqueIngredients).forEach(name => {
    const item = uniqueIngredients[name];
    const category = getCategory(name);
    const stock = branch === 'WAREHOUSE' ? 50000 : 5000;
    const reorder = 1000;
    insertInv.run(
      `inv-${invCounter++}`,
      name,
      category,
      stock,
      item.unit,
      reorder,
      item.unitCost,
      '2026-12-31',
      branch,
      'OK',
      stock,
      stock
    );
  });
}

// Seed Suppliers and map them to items if count is 0
try {
  const supplierCount = db.prepare("SELECT COUNT(*) as count FROM suppliers").get().count;
  if (supplierCount === 0) {
    console.log('Seeding suppliers...');
    db.prepare(`
      INSERT INTO suppliers (id, name, contactPerson, mobileNumber, whatsappNumber, email, gstNumber, address, paymentTerms, deliveryDays, notes, status, isPreferred)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('SUP-001', 'Anand Verma (GM Supplies)', 'Anand Verma', '+91 99786 73137', '+91 99786 73137', 'supplies@badikatori.com', '24AAACB1234F1Z5', 'Vesu, Surat, Gujarat', 'Net 30', 3, 'Default brand partner for all frozen items.', 'Active', 1);

    db.prepare(`
      INSERT INTO suppliers (id, name, contactPerson, mobileNumber, whatsappNumber, email, gstNumber, address, paymentTerms, deliveryDays, notes, status, isPreferred)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('SUP-002', 'Surat Fresh Foods', 'Amit Patel', '+91 98765 43210', '+91 98765 43210', 'orders@suratfresh.com', '24BBBCD5678G1Z0', 'LP Savani, Surat, Gujarat', 'COD', 1, 'Local fresh produce supplier.', 'Active', 0);

    db.prepare(`
      INSERT INTO suppliers (id, name, contactPerson, mobileNumber, whatsappNumber, email, gstNumber, address, paymentTerms, deliveryDays, notes, status, isPreferred)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('SUP-003', 'Quality Groceries Ltd', 'Vikram Shah', '+91 98765 12345', '+91 98765 12345', 'contact@qualitygroceries.in', '24CCCCD9012H1Z1', 'Ring Road, Surat, Gujarat', 'Net 15', 2, 'Dry goods and packaging distributor.', 'Active', 0);

    // Map default suppliers to inventory items
    const items = db.prepare("SELECT id, label FROM inventory").all();
    const insertMapping = db.prepare(`
      INSERT OR IGNORE INTO inventory_item_suppliers (itemId, supplierId, isDefault, unitCost)
      VALUES (?, ?, ?, ?)
    `);
    
    items.forEach(item => {
      const label = item.label.toLowerCase();
      // Fresh vegetables/produce to SUP-002 (Surat Fresh Foods)
      if (label.includes('lettuce') || label.includes('beet') || label.includes('carrot') || label.includes('onion') || label.includes('tomato') || label.includes('chilli') || label.includes('lemon') || label.includes('potato') || label.includes('dhania')) {
        insertMapping.run(item.id, 'SUP-002', 1, 15.00);
        insertMapping.run(item.id, 'SUP-003', 0, 18.00); // alternative
      }
      // Packaging / cutlery to SUP-003
      else if (label.includes('spoon') || label.includes('dish') || label.includes('bowl') || label.includes('tissue') || label.includes('paper') || label.includes('plastic')) {
        insertMapping.run(item.id, 'SUP-003', 1, 2.50);
        insertMapping.run(item.id, 'SUP-001', 0, 3.00); // alternative
      }
      // Everything else (frozen patties, cheese, buns, chaat ingredients) to SUP-001 (Anand Verma)
      else {
        insertMapping.run(item.id, 'SUP-001', 1, 45.00);
        insertMapping.run(item.id, 'SUP-002', 0, 48.00); // alternative
      }
    });
    console.log('Seeded suppliers and item-supplier mappings successfully.');
  }
} catch (err) {
  console.error('Failed to seed suppliers:', err);
}

// Seed Wastage
console.log('Seeding wastage...');
const insertWastage = db.prepare(`
  INSERT INTO wastage (id, store, name, qty, unit, reason, date, cost, image, loggedBy)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertWastage.run('w-1', 'VESU', 'Raw Chicken Patties (Whopper)', 2, 'Box', 'Expired', getOffsetDateStr(0), 900.00, '🍔', 'Manager VESU');
insertWastage.run('w-2', 'LP SAVANI', 'Whopper Sesame Buns', 12, 'Piece', 'Spillage', getOffsetDateStr(0), 186.00, '🍞', 'Manager LP SAVANI');
insertWastage.run('w-3', 'GAURAV PATH', 'Cheddar Cheese Slices', 50, 'Piece', 'Expired', getOffsetDateStr(1), 425.00, '🧀', 'Manager GAURAV PATH');
insertWastage.run('w-4', 'VESU', 'Whopper Sesame Buns', 40, 'Piece', 'Burnt', getOffsetDateStr(2), 620.00, '🍞', 'Manager VESU');
insertWastage.run('w-5', 'LP SAVANI', 'Raw Chicken Patties (Whopper)', 1, 'Box', 'Preparation Error', getOffsetDateStr(3), 450.00, '🍔', 'Manager LP SAVANI');
insertWastage.run('w-6', 'GAURAV PATH', 'Whopper Sesame Buns', 15, 'Piece', 'Spillage', getOffsetDateStr(4), 232.50, '🍞', 'Manager GAURAV PATH');
insertWastage.run('w-7', 'VESU', 'Cheddar Cheese Slices', 30, 'Piece', 'Customer Return', getOffsetDateStr(5), 255.00, '🧀', 'Manager VESU');
insertWastage.run('w-8', 'VESU', 'Paneer cubes', 500, 'gm', 'Spillage', getOffsetDateStr(0), 140.00, '🧀', 'Manager VESU');
insertWastage.run('w-9', 'LP SAVANI', 'Basmati Rice', 1000, 'gm', 'Pest Damage', getOffsetDateStr(0), 70.00, '🌾', 'Manager LP SAVANI');
insertWastage.run('w-10', 'GAURAV PATH', 'Chicken chunks', 1500, 'gm', 'Spoiled', getOffsetDateStr(0), 525.00, '🍗', 'Manager GAURAV PATH');
insertWastage.run('w-11', 'SUDAMA CHOWK', 'Raw Chicken Patties (Whopper)', 3, 'Box', 'Expired', getOffsetDateStr(0), 1350.00, '🍔', 'Manager SUDAMA CHOWK');
insertWastage.run('w-12', 'SUDAMA CHOWK', 'Whopper Sesame Buns', 20, 'Piece', 'Burnt', getOffsetDateStr(0), 310.00, '🍞', 'Manager SUDAMA CHOWK');

// Seed Checklists for today for all 3 branches
console.log('Seeding checklists for all 3 branches...');
const insertChecklist = db.prepare(`
  INSERT INTO checklists (id, type, store, date, progress, completed, items, photo)
  VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
`);
const todayStr = getOffsetDateStr(0);
for (const branch of branches) {
  insertChecklist.run(`opening-${branch}-${todayStr}`, 'opening', branch, todayStr, 0, 0, JSON.stringify([]));
  insertChecklist.run(`closing-${branch}-${todayStr}`, 'closing', branch, todayStr, 0, 0, JSON.stringify([]));
}

// Seed historical EOD report for testing
console.log('Seeding EOD Reports...');
const insertEod = db.prepare(`
  INSERT INTO eod_reports (id, store, date, sales, expenses, cash, upi, card, orders, submittedBy, submittedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
// Seed Delhi and Bangalore historical EOD for yesterday
const yesterdayStr = getOffsetDateStr(1);
insertEod.run(`eod-LP SAVANI-${yesterdayStr}`, 'LP SAVANI', yesterdayStr, 185000, 24000, 45000, 110000, 30000, 850, 'Manager LP SAVANI', `${yesterdayStr} 10:15 PM`);
insertEod.run(`eod-GAURAV PATH-${yesterdayStr}`, 'GAURAV PATH', yesterdayStr, 165000, 18000, 35000, 95000, 35000, 780, 'Manager GAURAV PATH', `${yesterdayStr} 09:45 PM`);
// Seed Mumbai for yesterday
insertEod.run(`eod-VESU-${yesterdayStr}`, 'VESU', yesterdayStr, 210000, 31000, 50000, 120000, 40000, 1020, 'Manager VESU', `${yesterdayStr} 10:30 PM`);
insertEod.run(`eod-SUDAMA CHOWK-${yesterdayStr}`, 'SUDAMA CHOWK', yesterdayStr, 195000, 26000, 48000, 115000, 32000, 910, 'Manager SUDAMA CHOWK', `${yesterdayStr} 10:00 PM`);

// Seed Recipes
console.log('Seeding recipes...');
const insertRecipe = db.prepare(`
  INSERT INTO recipes (id, name, portion, status, ingredients, rawCost, retailPrice)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const recipe of recipesList) {
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

// Seed Product Sales
console.log('Seeding product sales...');
const insertProductSale = db.prepare(`
  INSERT INTO product_sales (id, store, date, recipeId, itemName, category, qty, revenue, image)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seededProductSales = [
  // VESU - 2026-06-15
  { id: "ps-vesu-1", store: "VESU", date: "2026-06-15", recipeId: "rec-4", itemName: "Paneer Tikka", category: "Starters", qty: 150, revenue: 30000, image: "🍢" },
  { id: "ps-vesu-2", store: "VESU", date: "2026-06-15", recipeId: "rec-5", itemName: "Butter Chicken", category: "Main Course", qty: 120, revenue: 30000, image: "🍲" },
  { id: "ps-vesu-3", store: "VESU", date: "2026-06-15", recipeId: "rec-6", itemName: "Chicken Biryani", category: "Biryani", qty: 100, revenue: 25000, image: "🥘" },
  { id: "ps-vesu-4", store: "VESU", date: "2026-06-15", recipeId: "rec-7", itemName: "Masala Dosa", category: "South Indian", qty: 90, revenue: 16200, image: "🥞" },
  { id: "ps-vesu-5", store: "VESU", date: "2026-06-15", recipeId: "rec-8", itemName: "Dal Makhani", category: "Main Course", qty: 80, revenue: 14800, image: "🍲" },
  { id: "ps-vesu-6", store: "VESU", date: "2026-06-15", recipeId: "rec-9", itemName: "Gulab Jamun", category: "Desserts", qty: 70, revenue: 6300, image: "🧆" },
  { id: "ps-vesu-7", store: "VESU", date: "2026-06-15", recipeId: "rec-10", itemName: "Veg Manchurian", category: "Starters", qty: 60, revenue: 11040, image: "🍜" },
  { id: "ps-vesu-8", store: "VESU", date: "2026-06-15", recipeId: "rec-11", itemName: "Rasgulla", category: "Desserts", qty: 50, revenue: 4500, image: "🍨" },

  // LP SAVANI - 2026-06-15
  { id: "ps-lpsavani-1", store: "LP SAVANI", date: "2026-06-15", recipeId: "rec-4", itemName: "Paneer Tikka", category: "Starters", qty: 160, revenue: 32000, image: "🍢" },
  { id: "ps-lpsavani-2", store: "LP SAVANI", date: "2026-06-15", recipeId: "rec-5", itemName: "Butter Chicken", category: "Main Course", qty: 140, revenue: 35000, image: "🍲" },
  { id: "ps-lpsavani-3", store: "LP SAVANI", date: "2026-06-15", recipeId: "rec-6", itemName: "Chicken Biryani", category: "Biryani", qty: 110, revenue: 27500, image: "🥘" },
  { id: "ps-lpsavani-4", store: "LP SAVANI", date: "2026-06-15", recipeId: "rec-7", itemName: "Masala Dosa", category: "South Indian", qty: 100, revenue: 18000, image: "🥞" },
  { id: "ps-lpsavani-5", store: "LP SAVANI", date: "2026-06-15", recipeId: "rec-8", itemName: "Dal Makhani", category: "Main Course", qty: 90, revenue: 16650, image: "🍲" },
  { id: "ps-lpsavani-6", store: "LP SAVANI", date: "2026-06-15", recipeId: "rec-9", itemName: "Gulab Jamun", category: "Desserts", qty: 80, revenue: 7200, image: "🧆" },
  { id: "ps-lpsavani-7", store: "LP SAVANI", date: "2026-06-15", recipeId: "rec-10", itemName: "Veg Manchurian", category: "Starters", qty: 70, revenue: 12880, image: "🍜" },
  { id: "ps-lpsavani-8", store: "LP SAVANI", date: "2026-06-15", recipeId: "rec-11", itemName: "Rasgulla", category: "Desserts", qty: 60, revenue: 5400, image: "🍨" },

  // GAURAV PATH - 2026-06-15
  { id: "ps-gauravpath-1", store: "GAURAV PATH", date: "2026-06-15", recipeId: "rec-4", itemName: "Paneer Tikka", category: "Starters", qty: 142, revenue: 28400, image: "🍢" },
  { id: "ps-gauravpath-2", store: "GAURAV PATH", date: "2026-06-15", recipeId: "rec-5", itemName: "Butter Chicken", category: "Main Course", qty: 129, revenue: 32250, image: "🍲" },
  { id: "ps-gauravpath-3", store: "GAURAV PATH", date: "2026-06-15", recipeId: "rec-6", itemName: "Chicken Biryani", category: "Biryani", qty: 111, revenue: 27750, image: "🥘" },
  { id: "ps-gauravpath-4", store: "GAURAV PATH", date: "2026-06-15", recipeId: "rec-7", itemName: "Masala Dosa", category: "South Indian", qty: 95, revenue: 17100, image: "🥞" },
  { id: "ps-gauravpath-5", store: "GAURAV PATH", date: "2026-06-15", recipeId: "rec-8", itemName: "Dal Makhani", category: "Main Course", qty: 86, revenue: 15910, image: "🍲" },
  { id: "ps-gauravpath-6", store: "GAURAV PATH", date: "2026-06-15", recipeId: "rec-9", itemName: "Gulab Jamun", category: "Desserts", qty: 91, revenue: 8190, image: "🧆" },
  { id: "ps-gauravpath-7", store: "GAURAV PATH", date: "2026-06-15", recipeId: "rec-10", itemName: "Veg Manchurian", category: "Starters", qty: 59, revenue: 10856, image: "🍜" },
  { id: "ps-gauravpath-8", store: "GAURAV PATH", date: "2026-06-15", recipeId: "rec-11", itemName: "Rasgulla", category: "Desserts", qty: 44, revenue: 3960, image: "🍨" },

  // SUDAMA CHOWK - 2026-06-15
  { id: "ps-sudamachowk-1", store: "SUDAMA CHOWK", date: "2026-06-15", recipeId: "rec-4", itemName: "Paneer Tikka", category: "Starters", qty: 155, revenue: 31000, image: "🍢" },
  { id: "ps-sudamachowk-2", store: "SUDAMA CHOWK", date: "2026-06-15", recipeId: "rec-5", itemName: "Butter Chicken", category: "Main Course", qty: 130, revenue: 32500, image: "🍲" },
  { id: "ps-sudamachowk-3", store: "SUDAMA CHOWK", date: "2026-06-15", recipeId: "rec-6", itemName: "Chicken Biryani", category: "Biryani", qty: 105, revenue: 26250, image: "🥘" },
  { id: "ps-sudamachowk-4", store: "SUDAMA CHOWK", date: "2026-06-15", recipeId: "rec-7", itemName: "Masala Dosa", category: "South Indian", qty: 98, revenue: 17640, image: "🥞" },
  { id: "ps-sudamachowk-5", store: "SUDAMA CHOWK", date: "2026-06-15", recipeId: "rec-8", itemName: "Dal Makhani", category: "Main Course", qty: 88, revenue: 16280, image: "🍲" },
  { id: "ps-sudamachowk-6", store: "SUDAMA CHOWK", date: "2026-06-15", recipeId: "rec-9", itemName: "Gulab Jamun", category: "Desserts", qty: 78, revenue: 7020, image: "🧆" },
  { id: "ps-sudamachowk-7", store: "SUDAMA CHOWK", date: "2026-06-15", recipeId: "rec-10", itemName: "Veg Manchurian", category: "Starters", qty: 65, revenue: 11960, image: "🍜" },
  { id: "ps-sudamachowk-8", store: "SUDAMA CHOWK", date: "2026-06-15", recipeId: "rec-11", itemName: "Rasgulla", category: "Desserts", qty: 55, revenue: 4950, image: "🍨" }
];

// for (const sale of seededProductSales) {
//   insertProductSale.run(sale.id, sale.store, getOffsetDateStr(0), sale.recipeId, sale.itemName, sale.category, sale.qty, sale.revenue, sale.image);
// }

// === Seed POS Tables ===
console.log('Seeding POS Products...');
const insertPosProduct = db.prepare(`
  INSERT INTO pos_products (id, name, category, price, image, isVeg, isPopular, isFavorite, stock, ingredients)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seededPosProducts = [
  { id: "pos-p-1", name: "Paani Puri", category: "Paani Puri", price: 50.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-2", name: "Marwadi Mirchi Bada", category: "Chaat", price: 50.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-3", name: "Kurkure Tawa Aloo Chaat", category: "Chaat", price: 75.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-4", name: "Sabudana Khichadi", category: "Chaat", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-5", name: "Pocket Chhole Chaat", category: "Chaat", price: 110.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-6", name: "Moonglet", category: "Chaat", price: 125.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-7", name: "Paneer Chilla", category: "Chaat", price: 150.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-8", name: "Tikki Chaat", category: "Tikki", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-9", name: "Tikki Ragda", category: "Tikki", price: 90.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-10", name: "Tikki Chhole", category: "Tikki", price: 100.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-11", name: "Samosa Chaat", category: "Samosa", price: 60.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-12", name: "Samosa Ragda", category: "Samosa", price: 70.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-13", name: "Samosa Chhole", category: "Samosa", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-14", name: "Samosa Kadhi", category: "Samosa", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-15", name: "Ragda Kachori", category: "Ragda", price: 70.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-16", name: "Ragda Samosa", category: "Ragda", price: 70.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-17", name: "Ragda Tikki", category: "Ragda", price: 90.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-18", name: "Ragda Kulcha", category: "Ragda", price: 160.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-19", name: "Kachori Chaat", category: "Kachori", price: 60.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-20", name: "Kachori Ragda", category: "Kachori", price: 70.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-21", name: "Kachori Chhole", category: "Kachori", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-22", name: "Kachori Kadhi", category: "Kachori", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-23", name: "Chhole Samosa", category: "Chhole", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-24", name: "Chhole Kachori", category: "Chhole", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-25", name: "Chhole Kulcha", category: "Chhole", price: 140.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-26", name: "Chhole Bhatura", category: "Chhole", price: 180.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-27", name: "Batata Wada", category: "Pav", price: 25.00, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-28", name: "Samosa Pav", category: "Pav", price: 30.00, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-29", name: "Dabeli", category: "Pav", price: 70.00, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-30", name: "Kolhapuri Misal", category: "Pav", price: 95.00, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-31", name: "Pav Bhaji", category: "Pav", price: 180.00, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-32", name: "Kulcha Chhole", category: "Kulcha", price: 140.00, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-33", name: "Kulcha Matar", category: "Kulcha", price: 160.00, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-34", name: "Regular Maggie", category: "Maggie", price: 50.00, image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-35", name: "Cheese Maggie", category: "Maggie", price: 70.00, image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-36", name: "Veg Maggie", category: "Maggie", price: 70.00, image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-37", name: "Szechuan Maggie", category: "Maggie", price: 80.00, image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-38", name: "Sev Poori", category: "Cold Chaat", price: 60.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-39", name: "Masala Poori", category: "Cold Chaat", price: 60.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-40", name: "Dahi Poori", category: "Cold Chaat", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-41", name: "Palak Patta Chaat", category: "Cold Chaat", price: 85.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-42", name: "Aloo Papdi", category: "Cold Chaat", price: 90.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-43", name: "Bhalla Papdi", category: "Cold Chaat", price: 110.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-44", name: "Raj Kachori Chaat", category: "Cold Chaat", price: 170.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-45", name: "Kaju katori Chaat", category: "Cold Chaat", price: 220.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-46", name: "Jain Kacha Kela Chaat", category: "Jain", price: 70.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-47", name: "Jain Kacha Kela Ragda", category: "Jain", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-48", name: "Jain Kacha Kela Chhole", category: "Jain", price: 90.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-49", name: "Jain Kachori Chaat", category: "Jain", price: 70.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-50", name: "Jain Kachori Ragda", category: "Jain", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-51", name: "Jain Kachori Chhole", category: "Jain", price: 90.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-52", name: "Jain Bhalla Papdi Chaat", category: "Jain", price: 120.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-53", name: "Jain Dahi Bhalle", category: "Jain", price: 130.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-54", name: "Jain Raj Kachori Chaat", category: "Jain", price: 200.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-55", name: "Street Style Sandwich", category: "B.T.B", price: 120.00, image: "https://images.unsplash.com/photo-1509722747041-616f39b57569?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-56", name: "Chowpatty Toast", category: "B.T.B", price: 130.00, image: "https://images.unsplash.com/photo-1509722747041-616f39b57569?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-57", name: "Paneer Bhurjee", category: "B.T.B", price: 150.00, image: "https://images.unsplash.com/photo-1509722747041-616f39b57569?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-58", name: "Vegetable Club", category: "B.T.B", price: 180.00, image: "https://images.unsplash.com/photo-1509722747041-616f39b57569?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-59", name: "Classic Patty Burger", category: "Burgers", price: 130.00, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-60", name: "Desi Patty Burger", category: "Burgers", price: 150.00, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-61", name: "Spicy Paneer Patty Burger", category: "Burgers", price: 160.00, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-62", name: "Aloo Paratha", category: "Prontha", price: 150.00, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-63", name: "Mix Veg Paratha", category: "Prontha", price: 170.00, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-64", name: "Paneer Paratha", category: "Prontha", price: 190.00, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-65", name: "Cheese Paratha", category: "Prontha", price: 220.00, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-66", name: "Kulfi stick", category: "Desserts", price: 60.00, image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-67", name: "Gulab jamun", category: "Desserts", price: 60.00, image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-68", name: "Rabdi", category: "Desserts", price: 70.00, image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-69", name: "Rabdi Gulab jamun", category: "Desserts", price: 110.00, image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-70", name: "Whole Fruit kulfi", category: "Desserts", price: 180.00, image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-71", name: "Samosa bucket (6 pcs)", category: "Desserts", price: 130.00, image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-72", name: "Kachori bucket (6 pcs)", category: "Desserts", price: 130.00, image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-73", name: "Vadapav", category: "Apu-Shtik", price: 25.00, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-74", name: "Sabudana vada", category: "Apu-Shtik", price: 70.00, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-75", name: "Cholli garlic pops", category: "Apu-Shtik", price: 75.00, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-76", name: "French fries", category: "Apu-Shtik", price: 80.00, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-77", name: "Peri peri french fries", category: "Apu-Shtik", price: 90.00, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-78", name: "Veggie sticks", category: "Apu-Shtik", price: 110.00, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-79", name: "Hara bhara kebab", category: "Apu-Shtik", price: 120.00, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-80", name: "Mix veg gyozas", category: "Apu-Shtik", price: 120.00, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-81", name: "Jalapeno cheese pops", category: "Apu-Shtik", price: 130.00, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-82", name: "Mozzarella sticks", category: "Apu-Shtik", price: 150.00, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-83", name: "Poppers bucket", category: "Apu-Shtik", price: 180.00, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-84", name: "Fingers bucket", category: "Apu-Shtik", price: 180.00, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-85", name: "Chilli guava", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-86", name: "Masala Lemonade", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-87", name: "Mint Mojito", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-88", name: "Hajma Hajam", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-89", name: "Masala Kaccha Aam", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-90", name: "Shikanji", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-91", name: "Kala Khatta", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-92", name: "Kokum Drink", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-93", name: "Watermelon Cooler", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-94", name: "Orange Cooler", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-95", name: "Alphanso Mango Cooler", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-96", name: "Classic Jeeru", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-97", name: "Imli Banta", category: "Indian Coolers", price: 99.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-98", name: "Mocha Cold Coffee", category: "Frappe", price: 110.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-99", name: "Classic Cold Coffee", category: "Frappe", price: 120.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-100", name: "Cappucino Cold Coffee", category: "Frappe", price: 120.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-101", name: "Filter Coffee 100ml", category: "Hot Coffee Mix", price: 99.00, image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-102", name: "Ginger Tea", category: "Hot Tea", price: 50.00, image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-103", name: "Pudina Tea", category: "Hot Tea", price: 50.00, image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-104", name: "Masala Tea", category: "Hot Tea", price: 50.00, image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-105", name: "Rose Milkshake", category: "Milkshakes", price: 110.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-106", name: "Chocolate Milkshake", category: "Milkshakes", price: 120.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-107", name: "Kesar Thandai", category: "Milkshakes", price: 120.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-108", name: "Nutella Milkshake", category: "Milkshakes", price: 150.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-109", name: "Brownie Milkshake", category: "Milkshakes", price: 150.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-110", name: "Tiramisu Milkshake", category: "Milkshakes", price: 150.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-111", name: "Ferrero Rocher Milkshake", category: "Milkshakes", price: 150.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-112", name: "Kit Kat Milkshake", category: "Milkshakes", price: 150.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-113", name: "Kaju Anjeer Milkshake", category: "Milkshakes", price: 165.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-114", name: "Strawberry Cheesecake Shake", category: "Cheese Cake Shakes", price: 160.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-115", name: "Tiramisu Cheesecake Shake", category: "Cheese Cake Shakes", price: 170.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-116", name: "Chocolate Cheesecake Shake", category: "Cheese Cake Shakes", price: 170.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-117", name: "Mango Cheesecake Shake", category: "Cheese Cake Shakes", price: 180.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-118", name: "Berry Blast Cheesecake Shake", category: "Cheese Cake Shakes", price: 190.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-119", name: "Mango Lassi", category: "Lassi", price: 90.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-120", name: "Saffron Lassi", category: "Lassi", price: 100.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-121", name: "Rajbhog Lassi", category: "Lassi", price: 100.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 1, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-122", name: "Rajwadi Lassi", category: "Lassi", price: 100.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-123", name: "Rose Lassi", category: "Lassi", price: 100.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-124", name: "Chowpatty bhel", category: "Chaat", price: 60.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-125", name: "Jhal muri", category: "Chaat", price: 70.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-126", name: "Dahi Chowpati bhel", category: "Chaat", price: 80.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-127", name: "Kulche 1 pcs", category: "Kulcha", price: 25.00, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-128", name: "bhature 1 pcs", category: "Chaat", price: 20.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-129", name: "Pav 1 pcs", category: "Pav", price: 10.00, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-130", name: "Water", category: "Indian Coolers", price: 10.00, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-131", name: "Samosa", category: "Samosa", price: 25.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-132", name: "Kachori", category: "Kachori", price: 25.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) },
  { id: "pos-p-133", name: "Dahi", category: "Chaat", price: 20.00, image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0, stock: 100, ingredients: JSON.stringify([]) }
];

for (const p of seededPosProducts) {
  // Try to find a matching recipe
  let matchedRecipe = recipesList.find(r => r.name.toLowerCase() === p.name.toLowerCase());
  
  // If not found exactly, try some standard fuzzy/custom mappings
  if (!matchedRecipe) {
    const cleanName = p.name.toLowerCase()
      .replace('chhole', 'chole')
      .replace('prontha', 'paratha')
      .replace('ap-shtik', '')
      .trim();
      
    matchedRecipe = recipesList.find(r => {
      const rName = r.name.toLowerCase();
      // E.g. "Tikki Chaat" matches "Alu Tikki Chaat"
      if (cleanName === 'tikki chaat' && rName === 'alu tikki chaat') return true;
      if (cleanName === 'tikki chhole' && rName === 'alu tikki w chole') return true;
      if (cleanName === 'tikki ragda' && rName === 'alu tikki w ragda') return true;
      if (cleanName === 'kurkure tawa aloo chaat' && rName === 'tawa alu chaat') return true;
      if (cleanName === 'chhole samosa' && rName === 'chole samosa') return true;
      if (cleanName === 'chhole kachori' && rName === 'chole kachori') return true;
      if (cleanName === 'chhole bhatura' && rName === 'chole bhatura') return true;
      if (cleanName === 'chhole kulcha' && rName === 'chole kulcha') return true;
      if (cleanName === 'regular maggie' && rName === 'plain maggie') return true;
      
      return rName === cleanName || rName.includes(cleanName) || cleanName.includes(rName);
    });
  }

  let finalIngredients = p.ingredients;
  if (matchedRecipe && matchedRecipe.ingredients && matchedRecipe.ingredients.length > 0) {
    finalIngredients = JSON.stringify(matchedRecipe.ingredients);
  } else {
    // Fallback: if no recipe matches, let's create a default mock recipe ingredient for it!
    const nameLower = p.name.toLowerCase();
    let mockIngredients = [];
    if (nameLower.includes('puri')) {
      mockIngredients = [
        { name: 'Aata Puri ( 6 pc)', qty: 1, unit: 'Piece', cost: 10.00 },
        { name: 'Pani', qty: 100, unit: 'ml', cost: 5.00 }
      ];
    } else if (nameLower.includes('coffee')) {
      mockIngredients = [
        { name: 'Milk', qty: 200, unit: 'ml', cost: 12.00 },
        { name: 'Coffee Beans', qty: 10, unit: 'gm', cost: 12.00 }
      ];
    } else if (nameLower.includes('tea')) {
      mockIngredients = [
        { name: 'Milk', qty: 100, unit: 'ml', cost: 6.00 },
        { name: 'Tea Leaves', qty: 5, unit: 'gm', cost: 2.00 }
      ];
    } else if (nameLower.includes('shake') || nameLower.includes('smoothie')) {
      mockIngredients = [
        { name: 'Milk', qty: 250, unit: 'ml', cost: 15.00 }
      ];
    } else if (nameLower.includes('lassi')) {
      mockIngredients = [
        { name: 'Lassi Dahi', qty: 200, unit: 'gm', cost: 16.00 }
      ];
    } else if (nameLower.includes('burger')) {
      mockIngredients = [
        { name: 'Burger Buns', qty: 1, unit: 'Piece', cost: 10.00 },
        { name: 'Veg Patty', qty: 1, unit: 'Piece', cost: 15.00 }
      ];
    } else if (nameLower.includes('sandwich') || nameLower.includes('toast')) {
      mockIngredients = [
        { name: 'Sandwich Bread', qty: 2, unit: 'Piece', cost: 8.00 },
        { name: 'Amul Butter ( for par roasting)', qty: 10, unit: 'gm', cost: 5.00 }
      ];
    } else if (nameLower.includes('fries')) {
      mockIngredients = [
        { name: 'Frozen French Fries', qty: 150, unit: 'gm', cost: 22.50 }
      ];
    } else if (nameLower.includes('maggie') || nameLower.includes('noodles')) {
      mockIngredients = [
        { name: 'Maggie Noodles', qty: 1, unit: 'Piece', cost: 12.00 }
      ];
    } else {
      mockIngredients = [
        { name: 'Chat Masala', qty: 2, unit: 'gm', cost: 0.36 }
      ];
    }
    finalIngredients = JSON.stringify(mockIngredients);
  }

  insertPosProduct.run(p.id, p.name, p.category, p.price, p.image, p.isVeg, p.isPopular, p.isFavorite, p.stock, finalIngredients);
}

console.log('Seeding POS Modifiers...');
const insertPosModifier = db.prepare(`
  INSERT INTO pos_modifiers (id, name, price)
  VALUES (?, ?, ?)
`);
const seededPosModifiers = [
  { id: "mod-1", name: "Extra Cheese", price: 25.00 },
  { id: "mod-2", name: "Extra Patty", price: 50.00 },
  { id: "mod-3", name: "No Onion", price: 0.00 },
  { id: "mod-4", name: "Spice Level: Medium", price: 0.00 },
  { id: "mod-5", name: "Spice Level: Spicy", price: 0.00 },
  { id: "mod-6", name: "Extra Sauce", price: 15.00 }
];
for (const m of seededPosModifiers) {
  insertPosModifier.run(m.id, m.name, m.price);
}

console.log('Seeding POS Customers...');
const insertPosCustomer = db.prepare(`
  INSERT INTO pos_customers (id, name, phone, loyaltyPoints)
  VALUES (?, ?, ?, ?)
`);
const seededPosCustomers = [
  { id: "cust-1", name: "Guest Customer", phone: "9999999999", loyaltyPoints: 0 }
];
for (const c of seededPosCustomers) {
  insertPosCustomer.run(c.id, c.name, c.phone, c.loyaltyPoints);
}

console.log('Seeding POS Tables...');
const insertPosTable = db.prepare(`
  INSERT INTO pos_tables (id, name, status, store)
  VALUES (?, ?, ?, ?)
`);
for (const branch of ['VESU', 'LP SAVANI', 'GAURAV PATH', 'SUDAMA CHOWK']) {
  for (let i = 1; i <= 8; i++) {
    insertPosTable.run(`tbl-${branch.toLowerCase()}-${i}`, `Table ${i}`, 'Available', branch);
  }
}

console.log('Seeding POS Coupons...');
const insertPosCoupon = db.prepare(`
  INSERT INTO pos_coupons (id, code, discountType, discountValue, minOrder)
  VALUES (?, ?, ?, ?, ?)
`);
const seededPosCoupons = [
  { id: "cp-1", code: "BK10", discountType: "percent", discountValue: 10.0, minOrder: 200.0 },
  { id: "cp-2", code: "FREECHEESE", discountType: "fixed", discountValue: 25.0, minOrder: 150.0 },
  { id: "cp-3", code: "BADI50", discountType: "fixed", discountValue: 50.0, minOrder: 300.0 }
];
for (const cp of seededPosCoupons) {
  insertPosCoupon.run(cp.id, cp.code, cp.discountType, cp.discountValue, cp.minOrder);
}

console.log('Creating and Seeding purchases...');
db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    itemId TEXT,
    itemName TEXT,
    qty INTEGER,
    unit TEXT,
    unitCost REAL,
    totalCost REAL,
    date TEXT,
    store TEXT,
    supplier TEXT
  )
`);
const insertPurchase = db.prepare(`
  INSERT INTO purchases (id, itemId, itemName, qty, unit, unitCost, totalCost, date, store, supplier)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insertPurchase.run('pur-1', 'inv-1', 'Whopper Sesame Buns', 100, 'Piece', 15.00, 1500.00, getOffsetDateStr(0), 'VESU', 'BK SOHO');
insertPurchase.run('pur-2', 'inv-3', 'Cheddar Cheese Slices', 200, 'Piece', 8.00, 1600.00, getOffsetDateStr(0), 'VESU', 'Amul Outlet');
insertPurchase.run('pur-3', 'inv-4', 'Veg Whopper Patty', 150, 'Piece', 22.00, 3300.00, getOffsetDateStr(0), 'VESU', 'BK SOHO');

console.log('Creating and Seeding expenses...');
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT,
    amount REAL,
    date TEXT,
    store TEXT,
    description TEXT
  )
`);
const insertExpense = db.prepare(`
  INSERT INTO expenses (id, category, amount, date, store, description)
  VALUES (?, ?, ?, ?, ?, ?)
`);
insertExpense.run('exp-1', 'Rent', 85000.00, getOffsetDateStr(0), 'VESU', 'Monthly Outlet Rent');
insertExpense.run('exp-2', 'Utilities', 15000.00, getOffsetDateStr(0), 'VESU', 'Electricity & Water Bill');
insertExpense.run('exp-3', 'Marketing', 12000.00, getOffsetDateStr(0), 'VESU', 'Instagram Ad Campaign');
insertExpense.run('exp-4', 'Salaries', 48000.00, getOffsetDateStr(0), 'VESU', 'Staff Salaries');

// Create P&L Transactions table for multi-branch cafe tracking
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'income' | 'expense'
    category TEXT NOT NULL, -- 'Dine In', 'Take Away', 'Swiggy', 'Zomato', 'Salary', 'Rent', etc.
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create Sales Returns table
db.exec(`
  CREATE TABLE IF NOT EXISTS sales_returns (
    id TEXT PRIMARY KEY,
    order_ref TEXT NOT NULL,
    items TEXT NOT NULL,
    reason TEXT NOT NULL,
    refund_amount REAL NOT NULL,
    refunded_by TEXT NOT NULL,
    status TEXT NOT NULL,
    date TEXT NOT NULL,
    store TEXT NOT NULL
  )
`);

// Build database indices to optimize query performance to <2 seconds
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_branch_date ON transactions(branch_id, date);
  CREATE INDEX IF NOT EXISTS idx_pos_orders_store_date ON pos_orders(store, date);
  CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON expenses(store, date);
  CREATE INDEX IF NOT EXISTS idx_sales_returns_store_date ON sales_returns(store, date);
`);

// Real-time synchronization hooks: SQLite database triggers
db.exec(`
  DROP TRIGGER IF EXISTS after_insert_pos_order;
  DROP TRIGGER IF EXISTS after_update_pos_order;
  DROP TRIGGER IF EXISTS after_delete_pos_order;
  
  DROP TRIGGER IF EXISTS after_insert_expense;
  DROP TRIGGER IF EXISTS after_update_expense;
  DROP TRIGGER IF EXISTS after_delete_expense;
  
  DROP TRIGGER IF EXISTS after_insert_purchase;
  DROP TRIGGER IF EXISTS after_update_purchase;
  DROP TRIGGER IF EXISTS after_delete_purchase;

  DROP TRIGGER IF EXISTS after_insert_sales_return;
  DROP TRIGGER IF EXISTS after_update_sales_return;
  DROP TRIGGER IF EXISTS after_delete_sales_return;

  -- 1. POS Orders Triggers
  CREATE TRIGGER after_insert_pos_order
  AFTER INSERT ON pos_orders
  BEGIN
    INSERT OR REPLACE INTO transactions (id, branch_id, type, category, amount, date)
    VALUES ('order-' || NEW.id, NEW.store, 'income', COALESCE(NEW.orderType, 'Dine In'), NEW.grandTotal, NEW.date);
  END;

  CREATE TRIGGER after_update_pos_order
  AFTER UPDATE ON pos_orders
  BEGIN
    DELETE FROM transactions WHERE id = 'order-' || OLD.id;
    INSERT INTO transactions (id, branch_id, type, category, amount, date)
    SELECT 'order-' || NEW.id, NEW.store, 'income', COALESCE(NEW.orderType, 'Dine In'), NEW.grandTotal, NEW.date
    WHERE NEW.status != 'Cancelled';
  END;

  CREATE TRIGGER after_delete_pos_order
  AFTER DELETE ON pos_orders
  BEGIN
    DELETE FROM transactions WHERE id = 'order-' || OLD.id;
  END;

  -- 2. Expenses Triggers
  CREATE TRIGGER after_insert_expense
  AFTER INSERT ON expenses
  BEGIN
    INSERT OR REPLACE INTO transactions (id, branch_id, type, category, amount, date)
    VALUES ('exp-' || NEW.id, NEW.store, 'expense', NEW.category, NEW.amount, NEW.date);
  END;

  CREATE TRIGGER after_update_expense
  AFTER UPDATE ON expenses
  BEGIN
    UPDATE transactions
    SET branch_id = NEW.store, category = NEW.category, amount = NEW.amount, date = NEW.date
    WHERE id = 'exp-' || OLD.id;
  END;

  CREATE TRIGGER after_delete_expense
  AFTER DELETE ON expenses
  BEGIN
    DELETE FROM transactions WHERE id = 'exp-' || OLD.id;
  END;

  -- 3. Purchases Triggers
  CREATE TRIGGER after_insert_purchase
  AFTER INSERT ON purchases
  BEGIN
    INSERT OR REPLACE INTO transactions (id, branch_id, type, category, amount, date)
    VALUES ('pur-' || NEW.id, NEW.store, 'expense', 'Packaging', NEW.totalCost, NEW.date);
  END;

  CREATE TRIGGER after_update_purchase
  AFTER UPDATE ON purchases
  BEGIN
    UPDATE transactions
    SET branch_id = NEW.store, amount = NEW.totalCost, date = NEW.date
    WHERE id = 'pur-' || OLD.id;
  END;

  CREATE TRIGGER after_delete_purchase
  AFTER DELETE ON purchases
  BEGIN
    DELETE FROM transactions WHERE id = 'pur-' || OLD.id;
  END;

  -- 4. Sales Returns Triggers
  CREATE TRIGGER after_insert_sales_return
  AFTER INSERT ON sales_returns
  BEGIN
    INSERT OR REPLACE INTO transactions (id, branch_id, type, category, amount, date)
    VALUES ('ret-' || NEW.id, NEW.store, 'expense', 'Sales Return', NEW.refund_amount, NEW.date);
  END;

  CREATE TRIGGER after_update_sales_return
  AFTER UPDATE ON sales_returns
  BEGIN
    UPDATE transactions
    SET branch_id = NEW.store, amount = NEW.refund_amount, date = NEW.date
    WHERE id = 'ret-' || OLD.id;
  END;

  CREATE TRIGGER after_delete_sales_return
  AFTER DELETE ON sales_returns
  BEGIN
    DELETE FROM transactions WHERE id = 'ret-' || OLD.id;
  END;
`);

const transCount = db.prepare("SELECT COUNT(*) as count FROM transactions").get().count;
if (transCount === 0) {
  console.log("Seeding transactions table from existing database entries...");
  const insertTrans = db.prepare(`
    INSERT OR IGNORE INTO transactions (id, branch_id, type, category, amount, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // 1. Seed from pos_orders
  const orders = db.prepare("SELECT id, store, orderType, grandTotal, date FROM pos_orders WHERE status != 'Cancelled'").all();
  orders.forEach(o => {
    insertTrans.run(`order-${o.id}`, o.store, 'income', o.orderType || 'Dine In', o.grandTotal, o.date);
  });

  // 2. Seed from expenses
  const exps = db.prepare("SELECT id, store, category, amount, date FROM expenses").all();
  exps.forEach(e => {
    let cat = e.category || 'Miscellaneous';
    if (cat === 'Salaries') cat = 'Salary';
    insertTrans.run(`exp-${e.id}`, e.store, 'expense', cat, e.amount, e.date);
  });

  // 3. Seed from purchases
  const purs = db.prepare("SELECT id, store, totalCost, date FROM purchases").all();
  purs.forEach(p => {
    insertTrans.run(`pur-${p.id}`, p.store, 'expense', 'Packaging', p.totalCost, p.date);
  });
}

// Create Training System Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS handbook (
    id TEXT PRIMARY KEY,
    title TEXT,
    file_name TEXT,
    file_url TEXT,
    file_type TEXT,
    total_pages INTEGER,
    upload_date TEXT,
    uploaded_by TEXT,
    version TEXT,
    is_active INTEGER,
    chapters TEXT
  );

  CREATE TABLE IF NOT EXISTS EmployeeHandbookProgress (
    employee_id TEXT PRIMARY KEY,
    handbook_id TEXT,
    current_page INTEGER,
    completion_percentage REAL,
    reading_time INTEGER,
    completed INTEGER,
    last_opened TEXT,
    pages_viewed TEXT
  );

  CREATE TABLE IF NOT EXISTS training_videos (
    id TEXT PRIMARY KEY,
    title TEXT,
    category TEXT,
    description TEXT,
    videoData TEXT,
    uploadedBy TEXT,
    uploadDate TEXT
  );

  CREATE TABLE IF NOT EXISTS training_video_progress (
    id TEXT PRIMARY KEY,
    employeeId TEXT,
    videoId TEXT,
    watchPercent REAL,
    timeWatched INTEGER,
    lastWatched TEXT,
    completed INTEGER,
    completionDate TEXT,
    UNIQUE(employeeId, videoId)
  );

  CREATE TABLE IF NOT EXISTS training_quizzes (
    id TEXT PRIMARY KEY,
    videoId TEXT UNIQUE,
    questions TEXT
  );

  CREATE TABLE IF NOT EXISTS training_quiz_attempts (
    id TEXT PRIMARY KEY,
    employeeId TEXT,
    videoId TEXT,
    quizId TEXT,
    score REAL,
    passed INTEGER,
    timestamp TEXT,
    details TEXT
  );

  CREATE TABLE IF NOT EXISTS training_certificates (
    id TEXT PRIMARY KEY,
    employeeId TEXT,
    employeeName TEXT,
    type TEXT,
    issueDate TEXT,
    certificateCode TEXT
  );
`);


}

function tryParseDocxHandbook(filePath) {
  try {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      console.log(`Word handbook not found at path: ${filePath}`);
      return null;
    }
    console.log(`Found Word handbook document at: ${filePath}. Parsing contents...`);
    const { execSync } = require('child_process');
    const xmlContent = execSync(`unzip -p "${filePath}" word/document.xml`, { maxBuffer: 10 * 1024 * 1024 }).toString();
    const pMatches = xmlContent.match(/<w:p(?:\s+[^>]*)?>([\s\S]*?)<\/w:p>/g) || [];

    let chapters = [];
    let currentChapter = null;
    let currentPage = null;

    pMatches.forEach((pXml) => {
      const styleMatch = pXml.match(/<w:pStyle\s+[^>]*w:val="([^"]+)"/);
      const style = styleMatch ? styleMatch[1] : null;

      const tMatches = pXml.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
      let text = tMatches.map(m => m.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '')).join('').trim();
      text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

      if (!text) return;

      const isHeading = style && (style.includes('Heading') || style === 'Title');

      if (text.toLowerCase().includes('table of contents') || text.match(/^Page \d+ of \d+$/i)) {
        return;
      }

      // Check if this text matches major chapter keywords to start a top-level chapter
      const majorChapterTerms = ["brand vision", "standard operating procedures", "recipe vault", "hygiene & food safety", "administration & compliance"];
      const isMajorChapter = isHeading && majorChapterTerms.some(term => text.toLowerCase().includes(term));

      if (isMajorChapter) {
        currentChapter = {
          title: text.replace(/^\d+\.\s+/, ''),
          pages: []
        };
        chapters.push(currentChapter);
        currentPage = null;
        return;
      }

      if (isHeading) {
        if (!currentChapter) {
          currentChapter = {
            title: "Introduction & Culture",
            pages: []
          };
          chapters.push(currentChapter);
        }
        currentPage = {
          title: text,
          paragraphs: []
        };
        currentChapter.pages.push(currentPage);
      } else {
        if (currentPage) {
          currentPage.paragraphs.push(text);
        } else if (currentChapter) {
          currentPage = {
            title: currentChapter.title,
            paragraphs: [text]
          };
          currentChapter.pages.push(currentPage);
        } else {
          currentChapter = {
            title: "Operations Handbook Overview",
            pages: []
          };
          chapters.push(currentChapter);
          currentPage = {
            title: "Confidentiality & Notice",
            paragraphs: [text]
          };
          currentChapter.pages.push(currentPage);
        }
      }
    });

    const finalChapters = chapters.map(c => ({
      title: c.title,
      pages: c.pages.map(p => `### ${p.title}\n\n${p.paragraphs.join('\n\n')}`)
    })).filter(c => c.pages.length > 0);

    return finalChapters;
  } catch (err) {
    console.error("Failed to parse docx handbook:", err);
    return null;
  }
}

async function tryParsePdfHandbook(filePath) {
  try {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      console.log(`PDF handbook not found at path: ${filePath}`);
      return null;
    }
    console.log(`Found PDF handbook document at: ${filePath}. Parsing contents...`);
    const pdf = require('pdf-parse');
    const dataBuffer = new Uint8Array(fs.readFileSync(filePath));
    const parser = new pdf.PDFParse(dataBuffer);
    const res = await parser.getText();
    
    // Group pages by chapters
    let chaptersMap = {
      "Introduction & Notice": [],
      "1. Brand Vision & Culture": [],
      "2. Standard Operating Procedures (SOPs)": [],
      "3. The Recipe Vault (Proprietary)": [],
      "4. Hygiene & Food Safety Standards": [],
      "5. Administration & Compliance": []
    };

    res.pages.forEach(p => {
      let chapterName = "Introduction & Notice";
      if (p.num >= 4 && p.num <= 7) {
        chapterName = "1. Brand Vision & Culture";
      } else if (p.num >= 8 && p.num <= 22) {
        chapterName = "2. Standard Operating Procedures (SOPs)";
      } else if (p.num >= 23 && p.num <= 39) {
        chapterName = "3. The Recipe Vault (Proprietary)";
      } else if (p.num >= 40 && p.num <= 50) {
        chapterName = "4. Hygiene & Food Safety Standards";
      } else if (p.num >= 51) {
        chapterName = "5. Administration & Compliance";
      }
      
      // Clean page text format: format headings nicely
      let text = p.text.trim();
      chaptersMap[chapterName].push(text);
    });

    // Format output
    let finalChapters = [];
    for (let title in chaptersMap) {
      if (chaptersMap[title].length > 0) {
        finalChapters.push({
          title: title,
          pages: chaptersMap[title]
        });
      }
    }

    return finalChapters;
  } catch (err) {
    console.error("Failed to parse PDF handbook:", err);
    return null;
  }
}

// Run async seeding in the background
const dbReady = (async () => {
  try {
    const handbookCount = db.prepare("SELECT COUNT(*) as count FROM handbook").get().count;
    if (handbookCount === 0) {
      const pdfPath = path.join(__dirname, 'public', 'handbook', 'badi-katori-handbook.pdf');
      const docxPath = "/Users/nirmitkhasiya/Desktop/BK HANDBOOK.docx";
      
      // 1. Try parsing PDF first
      const parsedPdfChapters = await tryParsePdfHandbook(pdfPath);
      if (parsedPdfChapters && parsedPdfChapters.length > 0) {
        const totalPages = parsedPdfChapters.reduce((acc, c) => acc + c.pages.length, 0);
        db.prepare(`
          INSERT INTO handbook (id, title, file_name, file_url, file_type, total_pages, upload_date, uploaded_by, version, is_active, chapters)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'hb-pdf',
          'Badi Katori Operations Manual',
          'badi-katori-handbook.pdf',
          '/handbook/badi-katori-handbook.pdf',
          'pdf',
          totalPages,
          new Date().toISOString(),
          'OWNER101',
          '1.0',
          1,
          JSON.stringify(parsedPdfChapters)
        );
        console.log(`Successfully parsed and seeded PDF handbook with ${totalPages} pages.`);
        return;
      }

      // 2. Try parsing DOCX second
      const parsedDocxChapters = tryParseDocxHandbook(docxPath);
      if (parsedDocxChapters && parsedDocxChapters.length > 0) {
        const totalPages = parsedDocxChapters.reduce((acc, c) => acc + c.pages.length, 0);
        db.prepare(`
          INSERT INTO handbook (id, title, file_name, file_url, file_type, total_pages, upload_date, uploaded_by, version, is_active, chapters)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'hb-' + Date.now(),
          'Badi Katori Operations Manual',
          'BK HANDBOOK.docx',
          '/uploads/BK HANDBOOK.docx',
          'docx',
          totalPages,
          new Date().toISOString(),
          'OWNER101',
          '1.0',
          1,
          JSON.stringify(parsedDocxChapters)
        );
        console.log(`Successfully parsed and seeded word handbook with ${totalPages} pages.`);
        return;
      }

      // 3. Fallback: Leave empty if no files exist
      console.log("No PDF or DOCX handbook found on Desktop or public/handbook/. Leaving handbook table empty for manual uploads.");
    }
  } catch (err) {
    console.error("Error seeding handbook table:", err);
  }
})();

const videoCount = db.prepare("SELECT COUNT(*) as count FROM training_videos").get().count;
if (videoCount === 0) {
  console.log("Seeding default training videos and quizzes...");
  const defaultVideos = [
    {
      id: "vid-1",
      title: "Kitchen Sanitation & Deep Cleaning SOPs",
      category: "Kitchen Training",
      description: "Step-by-step walkthrough of chemical cleaning ratios, safety goggles usage, and surface sanitization checklists.",
      videoData: "",
      uploadedBy: "OWNER101",
      uploadDate: new Date().toISOString()
    },
    {
      id: "vid-2",
      title: "Reconciling POS Cash Registers & QR Payments",
      category: "Billing Training",
      description: "Learn how to record UPI transaction IDs, verify Axis Bank receipt transfers, and print invoice receipts.",
      videoData: "",
      uploadedBy: "OWNER101",
      uploadDate: new Date().toISOString()
    }
  ];

  const insertVideo = db.prepare(`
    INSERT INTO training_videos (id, title, category, description, videoData, uploadedBy, uploadDate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  defaultVideos.forEach(v => {
    insertVideo.run(v.id, v.title, v.category, v.description, v.videoData, v.uploadedBy, v.uploadDate);
  });

  db.prepare(`
    INSERT INTO training_quizzes (id, videoId, questions)
    VALUES (?, ?, ?)
  `).run(
    'qz-1',
    'vid-1',
    JSON.stringify([
      {
        question: "What is the correct storage temperature for chilled inventory items?",
        type: "MCQ",
        options: ["-18°C or below", "Between 1°C and 4°C", "Above 10°C", "Exactly 0°C"],
        answer: "Between 1°C and 4°C"
      },
      {
        question: "Sanitizing hands must occur every 20 minutes.",
        type: "True/False",
        options: ["True", "False"],
        answer: "True"
      }
    ])
  );

  db.prepare(`
    INSERT INTO training_quizzes (id, videoId, questions)
    VALUES (?, ?, ?)
  `).run(
    'qz-2',
    'vid-2',
    JSON.stringify([
      {
        question: "Which bank handles the Badi Katori POS QR transfer payments?",
        type: "MCQ",
        options: ["HDFC Bank", "ICICI Bank", "Axis Bank", "State Bank of India"],
        answer: "Axis Bank"
      },
      {
        question: "Select all fields required in the cashier payment confirmation popup:",
        type: "Multiple Select",
        options: ["Amount", "Transaction ID / UTR", "Customer Mobile", "Payment Screenshot"],
        answer: ["Amount", "Transaction ID / UTR", "Customer Mobile"]
      }
    ])
  );
}

// Migration: Ensure the 10 new products requested by the user exist in the pos_products database table
const newMenuProducts = [
  { id: "pos-p-124", name: "Chowpatty bhel", category: "Chaat", price: 60.00 },
  { id: "pos-p-125", name: "Jhal muri", category: "Chaat", price: 70.00 },
  { id: "pos-p-126", name: "Dahi Chowpati bhel", category: "Chaat", price: 80.00 },
  { id: "pos-p-127", name: "Kulche 1 pcs", category: "Kulcha", price: 25.00 },
  { id: "pos-p-128", name: "bhature 1 pcs", category: "Chaat", price: 20.00 },
  { id: "pos-p-129", name: "Pav 1 pcs", category: "Pav", price: 10.00 },
  { id: "pos-p-130", name: "Water", category: "Indian Coolers", price: 10.00 },
  { id: "pos-p-131", name: "Samosa", category: "Samosa", price: 25.00 },
  { id: "pos-p-132", name: "Kachori", category: "Kachori", price: 25.00 },
  { id: "pos-p-133", name: "Dahi", category: "Chaat", price: 20.00 }
];

try {
  const checkProduct = db.prepare("SELECT COUNT(*) as count FROM pos_products WHERE name = ?");
  const insertProduct = db.prepare(`
    INSERT INTO pos_products (id, name, category, price, image, isVeg, isPopular, isFavorite, stock, ingredients)
    VALUES (?, ?, ?, ?, ?, 1, 0, 0, 100, ?)
  `);

  for (const p of newMenuProducts) {
    const exists = checkProduct.get(p.name).count > 0;
    if (!exists) {
      const mockIngredients = JSON.stringify([{ name: 'Chat Masala', qty: 2, unit: 'gm', cost: 0.36 }]);
      const fallbackImg = p.category === "Pav" 
        ? "https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=300&auto=format&fit=crop"
        : p.category === "Kulcha"
        ? "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=300&auto=format&fit=crop"
        : p.category === "Indian Coolers"
        ? "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=300&auto=format&fit=crop"
        : "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=300&auto=format&fit=crop";
      insertProduct.run(p.id, p.name, p.category, p.price, fallbackImg, mockIngredients);
      console.log(`Migration: Added new menu product: ${p.name} (₹${p.price})`);
    }
  }
} catch (err) {
  console.error("Migration Error adding new menu products:", err);
}

// Migration: Ensure the owner (bk2022) and store manager (manager/123) exist in the employees table
try {
  const checkEmp = db.prepare("SELECT COUNT(*) as count FROM employees WHERE id = ?");
  const insertEmp = db.prepare(`
    INSERT INTO employees (id, name, role, mobile, shiftStart, roleKey, password, status, store, activePunch, history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Owner
  if (checkEmp.get("bk2022").count === 0) {
    insertEmp.run(
      "bk2022",
      "Franchise Partner",
      "Owner",
      "9999999999",
      "09:00",
      "owner",
      hashPassword("bkoperation/89*"),
      "Active",
      "All",
      null,
      JSON.stringify([])
    );
    console.log("Migration: Added owner user (bk2022)");
  } else {
    db.prepare("UPDATE employees SET password = ? WHERE id = 'bk2022'").run(hashPassword("bkoperation/89*"));
  }

  // Manager
  if (checkEmp.get("manager/123").count === 0) {
    insertEmp.run(
      "manager/123",
      "Store Manager",
      "Branch Manager",
      "9876543213",
      "09:00",
      "sm",
      hashPassword("managerbk/09#"),
      "Active",
      "VESU",
      null,
      JSON.stringify([])
    );
    console.log("Migration: Added manager user (manager/123)");
  } else {
    db.prepare("UPDATE employees SET password = ? WHERE id = 'manager/123'").run(hashPassword("managerbk/09#"));
  }

  // Update existing individual branch manager passwords as well to simplify
  db.prepare("UPDATE employees SET password = ? WHERE roleKey = 'sm'").run(hashPassword("managerbk/09#"));
  
} catch (err) {
  console.error("Migration Error adding login employees:", err);
}

// Targeted inventory seeding from Excel files if inventory table is empty
try {
  const tableCheck = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='inventory'").get().count;
  if (tableCheck > 0) {
    const rowCheck = db.prepare("SELECT COUNT(*) as count FROM inventory").get().count;
    if (rowCheck === 0) {
      console.log('Inventory table is empty. Seeding from recipe costing.xlsx and inventory.xlsx...');
      
      let uniqueIngredients = {};
      
      // 1. Read recipe costing.xlsx
      try {
        const excelFilename = process.env.RECIPE_EXCEL_FILE || 'recipe costing.xlsx';
        const excelPath = path.isAbsolute(excelFilename) ? excelFilename : path.join(__dirname, excelFilename);
        const workbook = XLSX.readFile(excelPath);
        const sheet = workbook.Sheets['Sheet1'];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        let rawRecipes = [];
        let currentRecipe = null;
        let rawRows = [];

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const isHeader = row.some(cell => typeof cell === 'string' && cell.trim() === 'INGREDIENTS');
          if (isHeader) {
            if (currentRecipe) {
              rawRecipes.push({ currentRecipe, rawRows });
            }
            currentRecipe = {};
            rawRows = [];
            continue;
          }
          if (currentRecipe) {
            rawRows.push(row);
          }
        }
        if (currentRecipe) {
          rawRecipes.push({ currentRecipe, rawRows });
        }

        rawRecipes.forEach(item => {
          const rows = item.rawRows;
          rows.forEach(row => {
            const ingNameVal = row[0];
            const qtyVal = parseFloat(row[1]) || 0;
            const rateVal = parseFloat(row[2]) || 0;
            
            if (ingNameVal && typeof ingNameVal === 'string' && !ingNameVal.includes(':') && ingNameVal.trim() !== '' && !ingNameVal.toLowerCase().includes('total')) {
              const cleanIngName = ingNameVal.trim();
              if (!uniqueIngredients[cleanIngName]) {
                uniqueIngredients[cleanIngName] = { rates: [], unit: 'gm' };
              }
              if (rateVal > 0) {
                uniqueIngredients[cleanIngName].rates.push(rateVal);
              }
            }
          });
        });
      } catch (err) {
        console.log('No recipe costing file found or failed parsing:', err.message);
      }
      
      // 2. Add manual ingredients
      const manualIngredients = {
        'Milk': { rates: [0.06], unit: 'ml' },
        'Coffee Beans': { rates: [1.2], unit: 'gm' },
        'Tea Leaves': { rates: [0.4], unit: 'gm' },
        'Burger Buns': { rates: [10.0], unit: 'Piece' },
        'Veg Patty': { rates: [15.0], unit: 'Piece' },
        'Sandwich Bread': { rates: [4.0], unit: 'Piece' },
        'Maggie Noodles': { rates: [12.0], unit: 'Piece' },
        'Frozen French Fries': { rates: [0.15], unit: 'gm' },
        'Lassi Dahi': { rates: [0.08], unit: 'gm' }
      };
      Object.keys(manualIngredients).forEach(k => {
        uniqueIngredients[k] = manualIngredients[k];
      });

      // 3. Read inventory.xlsx
      try {
        const invExcelPath = path.join(__dirname, 'inventory.xlsx');
        const invWorkbook = XLSX.readFile(invExcelPath);
        invWorkbook.SheetNames.forEach(sheetName => {
          const worksheet = invWorkbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          let headerRowIdx = -1;
          let colIndices = { name: -1, category: -1, unit: -1, cost: -1 };
          
          for (let r = 0; r < Math.min(rows.length, 30); r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            const rowStr = row.map(c => String(c).trim().toLowerCase());
            
            const itemDetailsIdx = rowStr.indexOf('item details');
            if (itemDetailsIdx > -1) {
              headerRowIdx = r;
              colIndices.name = itemDetailsIdx;
              colIndices.category = rowStr.indexOf('parent group');
              colIndices.unit = rowStr.indexOf('unit');
              break;
            }
            
            const stockStatusIdx = rowStr.indexOf('stock status');
            if (stockStatusIdx > -1) {
              headerRowIdx = r;
              colIndices.name = stockStatusIdx;
              colIndices.cost = rowStr.indexOf('price/pkd');
              break;
            }
          }
          
          if (headerRowIdx !== -1) {
            for (let r = headerRowIdx + 1; r < rows.length; r++) {
              const row = rows[r];
              if (!row || row.length === 0) continue;
              const nameVal = row[colIndices.name];
              if (!nameVal || String(nameVal).trim() === '' || String(nameVal).toLowerCase().includes('total') || String(nameVal).toLowerCase().includes('status')) {
                continue;
              }
              const name = String(nameVal).trim();
              let cost = 10.00;
              if (colIndices.cost > -1 && row[colIndices.cost] !== undefined && row[colIndices.cost] !== '') {
                cost = parseFloat(row[colIndices.cost]) || 10.00;
              }
              
              let unit = '';
              if (colIndices.unit > -1 && row[colIndices.unit]) {
                unit = String(row[colIndices.unit]).trim();
              } else {
                const lower = name.toLowerCase();
                if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('plastic')) {
                  unit = 'Piece';
                } else if (lower.includes('ml') || lower.includes('oil') || lower.includes('syrup') || lower.includes('water') || lower.includes('kadi') || lower.includes('batter')) {
                  unit = 'ml';
                } else {
                  unit = 'gm';
                }
              }
              
              if (!uniqueIngredients[name]) {
                uniqueIngredients[name] = { rates: [cost], unit: unit };
              } else {
                uniqueIngredients[name].rates.push(cost);
              }
            }
          }
        });
      } catch (err) {
        console.log("Failed to parse inventory.xlsx during fallback seeding:", err.message);
      }

      // Compute average rates
      Object.keys(uniqueIngredients).forEach(name => {
        const val = name.trim().toLowerCase();
        if (!name || val.startsWith('(') || val.endsWith(')') || val.includes('as on :') || val === 'jain' || val === 'status' || val === 'item details' || val === 'stock status' || val.includes('all item')) {
          delete uniqueIngredients[name];
          return;
        }
        const item = uniqueIngredients[name];
        const avgRate = item.rates.length > 0 ? (item.rates.reduce((a,b)=>a+b, 0) / item.rates.length) : 10.00;
        item.unitCost = avgRate;
        if (!item.unit) {
          const lower = name.toLowerCase();
          if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('plastic')) {
            item.unit = 'Piece';
          } else if (lower.includes('ml') || lower.includes('oil') || lower.includes('syrup') || lower.includes('water') || lower.includes('kadi') || lower.includes('batter')) {
            item.unit = 'ml';
          } else {
            item.unit = 'gm';
          }
        }
      });

      function getCategoryHelper(name) {
        const lower = name.toLowerCase();
        if (lower.includes('bun') || lower.includes('bread') || lower.includes('kulche') || lower.includes('bhature') || lower.includes('puri') || lower.includes('kachori') || lower.includes('samosa')) return 'Bakery Breads';
        if (lower.includes('patty') || lower.includes('patties') || lower.includes('bhalla') || lower.includes('tikki') || lower.includes('munglet')) return 'Frozen Foods';
        if (lower.includes('chutney') || lower.includes('sauce') || lower.includes('chatney') || lower.includes('oil') || lower.includes('syrup') || lower.includes('kadi')) return 'Sauces & Spreads';
        if (lower.includes('dahi') || lower.includes('cheese') || lower.includes('butter') || lower.includes('cream')) return 'Dairy Packets';
        if (lower.includes('lettuce') || lower.includes('beet') || lower.includes('carrot') || lower.includes('onion') || lower.includes('tomato') || lower.includes('chilli') || lower.includes('adrak') || lower.includes('dhania') || lower.includes('lemon') || lower.includes('potato') || lower.includes('alu') || lower.includes('chana') || lower.includes('spices') || lower.includes('masala')) return 'Fresh Produce';
        if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('plastic')) return 'Packaging & Cutlery';
        return 'Chaat Ingredients';
      }

      // Seed
      const insertInv = db.prepare(`
        INSERT INTO inventory (id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status, openingStock, closingStock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const branches = ['VESU', 'LP SAVANI', 'GAURAV PATH', 'SUDAMA CHOWK', 'WAREHOUSE'];
      let invCounter = 1;
      for (const branch of branches) {
        Object.keys(uniqueIngredients).forEach(name => {
          const item = uniqueIngredients[name];
          const category = getCategoryHelper(name);
          const stock = branch === 'WAREHOUSE' ? 50000 : 5000;
          insertInv.run(
            `inv-${invCounter++}`,
            name,
            category,
            stock,
            item.unit,
            1000,
            item.unitCost,
            '2026-12-31',
            branch,
            'OK',
            stock,
            stock
          );
        });
      }
      console.log(`Successfully seeded ${invCounter - 1} inventory rows into SQLite.`);
    }
  }
} catch (err) {
  console.error("Critical error in fallback inventory seeding:", err);
}

// Migration: Update all POS products images to high-quality badikatori.in website image mappings
try {
  const websiteImageMappings = [
    { name: "Paani Puri", file: "dahi-puri.jpg" },
    { name: "Marwadi Mirchi Bada", file: "marwadi-mirchi-bada.jpg" },
    { name: "Kurkure Tawa Aloo Chaat", file: "aloo-tawa-chaat.jpg" },
    { name: "Sabudana Khichadi", file: "sabudana-khichadi.jpg" },
    { name: "Pocket Chhole Chaat", file: "pocket-chhole-chaat.jpg" },
    { name: "Moonglet", file: "moonglet.jpg" },
    { name: "Paneer Chilla", file: "paneer-chilla.jpg" },
    { name: "Tikki Chaat", file: "aloo-tikki-chaat.jpg" },
    { name: "Tikki Ragda", file: "aloo-tikki-ragda.jpg" },
    { name: "Tikki Chhole", file: "aloo-tikki-chhole.jpg" },
    { name: "Samosa Chaat", file: "samosa-chaat.jpg" },
    { name: "Samosa Ragda", file: "samosa-ragda.jpg" },
    { name: "Samosa Chhole", file: "samosa-chhole.jpg" },
    { name: "Samosa Kadhi", file: "samosa-kadhi.jpg" },
    { name: "Ragda Kachori", file: "kachori-ragda.jpg" },
    { name: "Ragda Samosa", file: "samosa-ragda.jpg" },
    { name: "Ragda Tikki", file: "aloo-tikki-ragda.jpg" },
    { name: "Ragda Kulcha", file: "kulcha-chhole.jpg" },
    { name: "Kachori Chaat", file: "kachori-chaat.jpg" },
    { name: "Kachori Ragda", file: "kachori-ragda.jpg" },
    { name: "Kachori Chhole", file: "kachori-chhole.jpg" },
    { name: "Kachori Kadhi", file: "kachori-kadhi.jpg" },
    { name: "Chhole Samosa", file: "samosa-chhole.jpg" },
    { name: "Chhole Kachori", file: "kachori-chhole.jpg" },
    { name: "Chhole Kulcha", file: "kulcha-chhole.jpg" },
    { name: "Chhole Bhature", file: "bhature.jpg" },
    { name: "Batata Wada", file: "batata-wada.jpg" },
    { name: "Samosa Pav", file: "samosa.jpg" },
    { name: "Dabeli", file: "dabeli.jpg" },
    { name: "Kolhapuri Misal", file: "kolhapuri-misal.jpg" },
    { name: "Pav Bhaji", file: "bhaji.jpg" },
    { name: "Kulcha Chhole", file: "kulcha-chhole.jpg" },
    { name: "Kulcha Matar", file: "kulcha-matar.jpg" },
    { name: "Regular Maggie", file: "apustik-french-fries.jpg" },
    { name: "Cheese Maggie", file: "apustik-french-fries.jpg" },
    { name: "Veg Maggie", file: "apustik-french-fries.jpg" },
    { name: "Szechuan Maggie", file: "apustik-french-fries.jpg" },
    { name: "Sev Poori", file: "sev-puri.jpg" },
    { name: "Masala Poori", file: "masala-poori.jpg" },
    { name: "Dahi Poori", file: "dahi-puri.jpg" },
    { name: "Palak Patta Chaat", file: "palak-patta-chaat.jpg" },
    { name: "Aloo Papdi", file: "aloo-papdi.jpg" },
    { name: "Bhalla Papdi", file: "dahi-bhalla.jpg" },
    { name: "Raj Kachori Chaat", file: "raj-kachori.jpg" },
    { name: "Kaju katori Chaat", file: "raj-kachori.jpg" },
    { name: "Jain Kacha Kela Chaat", file: "aloo-tikki-chaat.jpg" },
    { name: "Jain Kacha Kela Ragda", file: "aloo-tikki-ragda.jpg" },
    { name: "Jain Kacha Kela Chhole", file: "aloo-tikki-chhole.jpg" },
    { name: "Jain Kachori Chaat", file: "kachori-chaat.jpg" },
    { name: "Jain Kachori Ragda", file: "kachori-ragda.jpg" },
    { name: "Jain Kachori Chhole", file: "kachori-chhole.jpg" },
    { name: "Jain Bhalla Papdi Chaat", file: "bhalla-papdi.jpg" },
    { name: "Jain Dahi Bhalle", file: "dahi-bhalla.jpg" },
    { name: "Jain Raj Kachori Chaat", file: "raj-kachori.jpg" },
    { name: "Street Style Sandwich", file: "chowpatty-toast.jpg" },
    { name: "Chowpatty Toast", file: "chowpatty-toast.jpg" },
    { name: "Paneer Bhurjee", file: "paneer-chilla.jpg" },
    { name: "Vegetable Club", file: "chowpatty-toast.jpg" },
    { name: "Classic Patty Burger", file: "burger-classic.jpg" },
    { name: "Desi Patty Burger", file: "burger-desi.jpg" },
    { name: "Spicy Paneer Patty Burger", file: "burger-paneer.jpg" },
    { name: "Aloo Paratha", file: "paratha-aloo.jpg" },
    { name: "Mix Veg Paratha", file: "paratha-mixveg.jpg" },
    { name: "Paneer Paratha", file: "paratha-paneer.jpg" },
    { name: "Cheese Paratha", file: "paratha-cheese.jpg" },
    { name: "Kulfi stick", file: "dessert-kulfi-stick.jpg" },
    { name: "Gulab jamun", file: "dessert-gulab-jamun.jpg" },
    { name: "Rabdi", file: "dessert-rabdi.jpg" },
    { name: "Rabdi Gulab jamun", file: "dessert-rabdi-gulab-jamun.jpg" },
    { name: "Whole Fruit kulfi", file: "dessert-whole-fruit-kulfi.jpg" },
    { name: "Samosa bucket (6 pcs)", file: "bucket-samosa.jpg" },
    { name: "Kachori bucket (6 pcs)", file: "bucket-kachori.jpg" },
    { name: "Vadapav", file: "apustik-vadapav.jpg" },
    { name: "Sabudana vada", file: "apustik-sabudana-vada.jpg" },
    { name: "Cholli garlic pops", file: "apustik-choli-garlic-pops.jpg" },
    { name: "French fries", file: "apustik-french-fries.jpg" },
    { name: "Peri peri french fries", file: "apustik-peri-peri-fries.jpg" },
    { name: "Veggie sticks", file: "apustik-veggie-sticks.jpg" },
    { name: "Hara bhara kebab", file: "apustik-hara-bhara.jpg" },
    { name: "Mix veg gyozas", file: "apustik-gyozas.jpg" },
    { name: "Jalapeno cheese pops", file: "apustik-jalapeno-pops.jpg" },
    { name: "Mozzarella sticks", file: "apustik-mozzarella-sticks.jpg" },
    { name: "Poppers bucket", file: "bucket-poppers.jpg" },
    { name: "Fingers bucket", file: "bucket-fingers.jpg" },
    { name: "Chilli guava", file: "cooler-chilli-guava.jpg" },
    { name: "Masala Lemonade", file: "cooler-masala-lemonade.jpg" },
    { name: "Mint Mojito", file: "cooler-mint-mojito.jpg" },
    { name: "Hajma Hajam", file: "cooler-hajma-hajam.jpg" },
    { name: "Masala Kaccha Aam", file: "cooler-kaccha-aam.jpg" },
    { name: "Shikanji", file: "cooler-shikanji.jpg" },
    { name: "Kala Khatta", file: "cooler-kala-khatta.jpg" },
    { name: "Kokum Drink", file: "cooler-kokum.jpg" },
    { name: "Watermelon Cooler", file: "cooler-watermelon.jpg" },
    { name: "Orange Cooler", file: "cooler-orange.jpg" },
    { name: "Alphanso Mango Cooler", file: "cooler-mango.jpg" },
    { name: "Classic Jeeru", file: "cooler-jeera.jpg" },
    { name: "Imli Banta", file: "cooler-imli-banta.jpg" },
    { name: "Strawberry Cheesecake Shake", file: "shake-strawberry.jpg" },
    { name: "Tiramisu Cheesecake Shake", file: "shake-tiramisu.jpg" },
    { name: "Chocolate Cheesecake Shake", file: "shake-chocolate.jpg" },
    { name: "Mango Cheesecake Shake", file: "shake-mango.jpg" },
    { name: "Berry Blast Cheesecake Shake", file: "shake-berry-blast.jpg" },
    { name: "Mango Lassi", file: "lassi-mango.jpg" },
    { name: "Saffron Lassi", file: "lassi-saffron.jpg" },
    { name: "Rajbhog Lassi", file: "lassi-rajbhog.jpg" },
    { name: "Rajwadi Lassi", file: "lassi-rajwadi.jpg" },
    { name: "Rose Lassi", file: "lassi-rose.jpg" },
    { name: "Mocha Cold Coffee", file: "frappe-mocha.jpg" },
    { name: "Classic Cold Coffee", file: "frappe-classic.jpg" },
    { name: "Cappucino Cold Coffee", file: "frappe-cappuccino.jpg" },
    { name: "Filter Coffee 100ml", file: "coffee-filter.jpg" },
    { name: "Ginger Tea", file: "tea-ginger.jpg" },
    { name: "Pudina Tea", file: "tea-pudina.jpg" },
    { name: "Masala Tea", file: "tea-masala.jpg" },
    { name: "Rose Milkshake", file: "shake-rose.jpg" },
    { name: "Chocolate Milkshake", file: "shake-chocolate-classic.jpg" },
    { name: "Kesar Thandai", file: "shake-thandai.jpg" },
    { name: "Nutella Milkshake", file: "shake-nutella.jpg" },
    { name: "Brownie Milkshake", file: "shake-brownie.jpg" },
    { name: "Tiramisu Milkshake", file: "shake-tiramisu-classic.jpg" },
    { name: "Ferrero Rocher Milkshake", file: "shake-ferrero.jpg" },
    { name: "Kit Kat Milkshake", file: "shake-kitkat.jpg" },
    { name: "Kaju Anjeer Milkshake", file: "shake-kaju-anjeer.jpg" },
    { name: "Chowpatty bhel", file: "raj-kachori.jpg" },
    { name: "Jhal muri", file: "masala-poori.jpg" },
    { name: "Dahi Chowpati bhel", file: "dahi-puri.jpg" },
    { name: "Kulche 1 pcs", file: "kulcha-chhole.jpg" },
    { name: "bhature 1 pcs", file: "bhature.jpg" },
    { name: "Pav 1 pcs", file: "batata-wada.jpg" },
    { name: "Water", file: "cooler-watermelon.jpg" },
    { name: "Samosa", file: "samosa.jpg" },
    { name: "Kachori", file: "kachori-chaat.jpg" },
    { name: "Dahi", file: "dahi-puri.jpg" }
  ];

  const updateStmt = db.prepare("UPDATE pos_products SET image = ? WHERE name = ?");
  for (const pair of websiteImageMappings) {
    updateStmt.run("https://badikatori.in/" + pair.file, pair.name);
  }
  console.log("Successfully updated all POS products images with badikatori.in website URLs.");
} catch (err) {
  console.error("Error updating POS product images with website URLs:", err);
}

// --- MAP POS PRODUCTS TO RECIPES ---
try {
  console.log('Mapping pos_products to recipes...');
  const allProducts = db.prepare('SELECT id, name FROM pos_products').all();
  const allRecipes = db.prepare('SELECT id, name FROM recipes').all();
  const updateProductRecipe = db.prepare('UPDATE pos_products SET recipeId = ? WHERE id = ?');
  
  let mapCount = 0;
  for (const p of allProducts) {
    // Try exact match
    let matchedRecipe = allRecipes.find(r => r.name.toLowerCase() === p.name.toLowerCase());
    
    // Fuzzy matching if exact fails
    if (!matchedRecipe) {
      matchedRecipe = allRecipes.find(r => {
        const rName = r.name.toLowerCase();
        const pName = p.name.toLowerCase();
        return pName.includes(rName) || rName.includes(pName);
      });
    }

    if (matchedRecipe) {
      updateProductRecipe.run(matchedRecipe.id, p.id);
      mapCount++;
    }
  }
  console.log(`Successfully mapped ${mapCount}/${allProducts.length} POS products to recipes.`);
} catch(e) {
  console.error('Error mapping pos_products to recipes:', e);
}

module.exports = { db, dbReady };
