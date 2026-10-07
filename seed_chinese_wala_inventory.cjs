const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new DatabaseSync(dbPath);

console.log('Seeding Chinese Wala ADIT Campus Inventory & Recipes...');

// 1. CLEAR OLD INVENTORY, RECIPES, AND ITEM SUPPLIER MAPPINGS
db.exec("DELETE FROM inventory;");
db.exec("DELETE FROM recipes;");
db.exec("DELETE FROM suppliers;");
db.exec("DELETE FROM inventory_item_suppliers;");
db.exec("DELETE FROM inventory_ledger;");
db.exec("DELETE FROM inventory_consumption;");

// 2. DEFINE MASTER INVENTORY ITEMS
const masterInventory = [
  // --- Chinese Staples ---
  { label: "Hakka Noodles (Dry)", category: "Chinese Staples", unit: "gm", unitCost: 0.08, stock: 50000, reorder: 5000 },
  { label: "Steam Rice (Raw)", category: "Chinese Staples", unit: "gm", unitCost: 0.06, stock: 50000, reorder: 5000 },
  { label: "Manchurian Balls (Prep)", category: "Chinese Staples", unit: "Piece", unitCost: 3.50, stock: 2000, reorder: 300 },
  { label: "Crispy Fried Noodles", category: "Chinese Staples", unit: "gm", unitCost: 0.10, stock: 20000, reorder: 3000 },
  { label: "MSG / Tasting Salt", category: "Chinese Staples", unit: "gm", unitCost: 0.15, stock: 5000, reorder: 1000 },

  // --- Sauces & Seasonings ---
  { label: "Schezwan Sauce", category: "Sauces & Spreads", unit: "gm", unitCost: 0.12, stock: 25000, reorder: 5000 },
  { label: "Dark Soy Sauce", category: "Sauces & Spreads", unit: "ml", unitCost: 0.09, stock: 20000, reorder: 4000 },
  { label: "Green Chilli Sauce", category: "Sauces & Spreads", unit: "ml", unitCost: 0.08, stock: 20000, reorder: 4000 },
  { label: "Red Chilli Sauce", category: "Sauces & Spreads", unit: "ml", unitCost: 0.08, stock: 20000, reorder: 4000 },
  { label: "Vinegar", category: "Sauces & Spreads", unit: "ml", unitCost: 0.04, stock: 25000, reorder: 5000 },
  { label: "Tomato Ketchup", category: "Sauces & Spreads", unit: "gm", unitCost: 0.07, stock: 30000, reorder: 5000 },
  { label: "Peri Peri Powder", category: "Sauces & Spreads", unit: "gm", unitCost: 0.40, stock: 5000, reorder: 1000 },
  { label: "Oregano & Chilli Flakes", category: "Sauces & Spreads", unit: "gm", unitCost: 0.50, stock: 5000, reorder: 1000 },
  { label: "Pizza Sauce", category: "Sauces & Spreads", unit: "gm", unitCost: 0.14, stock: 20000, reorder: 3000 },

  // --- Fresh Vegetables ---
  { label: "Cabbage (Shredded)", category: "Fresh Produce", unit: "gm", unitCost: 0.025, stock: 40000, reorder: 5000 },
  { label: "Capsicum (Chopped)", category: "Fresh Produce", unit: "gm", unitCost: 0.04, stock: 30000, reorder: 4000 },
  { label: "Carrots (Diced)", category: "Fresh Produce", unit: "gm", unitCost: 0.035, stock: 30000, reorder: 4000 },
  { label: "Onions (Chopped)", category: "Fresh Produce", unit: "gm", unitCost: 0.03, stock: 50000, reorder: 8000 },
  { label: "Spring Onion", category: "Fresh Produce", unit: "gm", unitCost: 0.05, stock: 15000, reorder: 2000 },
  { label: "Ginger-Garlic Paste", category: "Fresh Produce", unit: "gm", unitCost: 0.10, stock: 20000, reorder: 3000 },
  { label: "Potatoes (Boiled)", category: "Fresh Produce", unit: "gm", unitCost: 0.025, stock: 60000, reorder: 10000 },
  { label: "Sweet Corn", category: "Fresh Produce", unit: "gm", unitCost: 0.09, stock: 20000, reorder: 3000 },
  { label: "Jalapeños", category: "Fresh Produce", unit: "gm", unitCost: 0.30, stock: 5000, reorder: 1000 },
  { label: "Cucumber & Tomato", category: "Fresh Produce", unit: "gm", unitCost: 0.03, stock: 20000, reorder: 3000 },

  // --- Dairy & Cheese ---
  { label: "Paneer (Fresh)", category: "Dairy & Cheese", unit: "gm", unitCost: 0.32, stock: 30000, reorder: 4000 },
  { label: "Mozzarella Cheese", category: "Dairy & Cheese", unit: "gm", unitCost: 0.45, stock: 20000, reorder: 3000 },
  { label: "Amul Cheese Slice", category: "Dairy & Cheese", unit: "Piece", unitCost: 8.00, stock: 1500, reorder: 200 },
  { label: "Amul Butter", category: "Dairy & Cheese", unit: "gm", unitCost: 0.52, stock: 15000, reorder: 2000 },
  { label: "Mayonnaise", category: "Dairy & Cheese", unit: "gm", unitCost: 0.12, stock: 20000, reorder: 3000 },
  { label: "Liquid Cheese Dip", category: "Dairy & Cheese", unit: "gm", unitCost: 0.25, stock: 15000, reorder: 2000 },
  { label: "Fresh Milk", category: "Dairy & Cheese", unit: "ml", unitCost: 0.06, stock: 60000, reorder: 10000 },

  // --- Bakery & Bases ---
  { label: "Burger Buns", category: "Bakery & Bases", unit: "Piece", unitCost: 6.00, stock: 1000, reorder: 150 },
  { label: "Sandwich Bread Slice", category: "Bakery & Bases", unit: "Piece", unitCost: 2.50, stock: 2000, reorder: 300 },
  { label: "Pizza Base 7\"", category: "Bakery & Bases", unit: "Piece", unitCost: 12.00, stock: 800, reorder: 100 },
  { label: "Garlic Loaf Slice", category: "Bakery & Bases", unit: "Piece", unitCost: 10.00, stock: 600, reorder: 100 },

  // --- Frozen Foods ---
  { label: "Frozen French Fries", category: "Frozen Foods", unit: "gm", unitCost: 0.12, stock: 40000, reorder: 5000 },
  { label: "Aloo Tikki Patty", category: "Frozen Foods", unit: "Piece", unitCost: 8.00, stock: 1000, reorder: 150 },
  { label: "Raw Veg Momos", category: "Frozen Foods", unit: "Piece", unitCost: 4.50, stock: 3000, reorder: 400 },
  { label: "Regular Puff Pastry", category: "Frozen Foods", unit: "Piece", unitCost: 6.00, stock: 800, reorder: 100 },
  { label: "Punjabi Samosa", category: "Frozen Foods", unit: "Piece", unitCost: 7.00, stock: 800, reorder: 100 },

  // --- Gujarati Staples ---
  { label: "Pauva / Poha", category: "Gujarati Staples", unit: "gm", unitCost: 0.05, stock: 30000, reorder: 5000 },
  { label: "Gram Flour Sev", category: "Gujarati Staples", unit: "gm", unitCost: 0.12, stock: 20000, reorder: 3000 },
  { label: "Wheat Atta", category: "Gujarati Staples", unit: "gm", unitCost: 0.04, stock: 50000, reorder: 8000 },
  { label: "Sev Khamani Mix", category: "Gujarati Staples", unit: "gm", unitCost: 0.08, stock: 15000, reorder: 2000 },
  { label: "Gujarati Subji / Dal Prep", category: "Gujarati Staples", unit: "gm", unitCost: 0.06, stock: 40000, reorder: 5000 },
  { label: "Buttermilk / Chaash", category: "Gujarati Staples", unit: "ml", unitCost: 0.02, stock: 30000, reorder: 5000 },

  // --- Beverages & Tea/Coffee ---
  { label: "Assam Tea Leaves", category: "Beverages & Tea/Coffee", unit: "gm", unitCost: 0.35, stock: 8000, reorder: 1000 },
  { label: "Instant Coffee Powder", category: "Beverages & Tea/Coffee", unit: "gm", unitCost: 1.10, stock: 5000, reorder: 500 },
  { label: "Bournvita Powder", category: "Beverages & Tea/Coffee", unit: "gm", unitCost: 0.40, stock: 8000, reorder: 1000 },
  { label: "Sugar", category: "Beverages & Tea/Coffee", unit: "gm", unitCost: 0.045, stock: 40000, reorder: 5000 },
  { label: "Pepsi 250ml Bottle", category: "Beverages & Tea/Coffee", unit: "Piece", unitCost: 10.00, stock: 500, reorder: 100 },
  { label: "Mountain Dew 250ml Bottle", category: "Beverages & Tea/Coffee", unit: "Piece", unitCost: 10.00, stock: 500, reorder: 100 },
  { label: "7 Up 250ml Bottle", category: "Beverages & Tea/Coffee", unit: "Piece", unitCost: 10.00, stock: 500, reorder: 100 },

  // --- Packaging & Disposables ---
  { label: "Paper Noodle Box 500ml", category: "Packaging & Disposables", unit: "Piece", unitCost: 3.50, stock: 3000, reorder: 500 },
  { label: "Pizza Box 7\"", category: "Packaging & Disposables", unit: "Piece", unitCost: 4.50, stock: 1500, reorder: 300 },
  { label: "Food Wrap Paper", category: "Packaging & Disposables", unit: "Piece", unitCost: 1.00, stock: 5000, reorder: 1000 },
  { label: "French Fries Cone Box", category: "Packaging & Disposables", unit: "Piece", unitCost: 2.00, stock: 2000, reorder: 400 },
  { label: "Thali Disposable Tray", category: "Packaging & Disposables", unit: "Piece", unitCost: 6.00, stock: 1500, reorder: 300 },
  { label: "Wooden Spoon", category: "Packaging & Disposables", unit: "Piece", unitCost: 0.60, stock: 8000, reorder: 1500 },
  { label: "Tissue Napkin", category: "Packaging & Disposables", unit: "Piece", unitCost: 0.20, stock: 15000, reorder: 3000 }
];

const stores = ['ADIT CAMPUS', 'LP SAVANI', 'GAURAV PATH', 'SUDAMA CHOWK', 'MAIN', 'WAREHOUSE'];

const insertInvStmt = db.prepare(`
  INSERT INTO inventory (id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status, openingStock, closingStock)
  VALUES (?, ?, ?, ?, ?, ?, ?, '2026-12-31', ?, 'IN STOCK', ?, ?)
`);

let invIdCount = 1;
for (const storeName of stores) {
  for (const item of masterInventory) {
    const stockMultiplier = storeName === 'WAREHOUSE' ? 3 : 1;
    const itemStock = Math.round(item.stock * stockMultiplier);
    const invId = `inv-${storeName.toLowerCase()}-${invIdCount++}`;
    insertInvStmt.run(invId, item.label, item.category, itemStock, item.unit, item.reorder, item.unitCost, storeName, itemStock, itemStock);
  }
}
console.log(`Successfully inserted ${masterInventory.length} inventory items across ${stores.length} store locations.`);

// 3. SEED SUPPLIERS
db.prepare(`
  INSERT INTO suppliers (id, name, contactPerson, mobileNumber, whatsappNumber, email, gstNumber, address, paymentTerms, deliveryDays, notes, status, isPreferred)
  VALUES ('SUP-CW-1', 'Surat Fresh Chinese Supplies', 'Ramesh Patel', '+91 98795 12345', '+91 98795 12345', 'orders@suratchinese.com', '24AAACB1234F1Z5', 'Vesu, Surat, Gujarat', 'Net 15', 1, 'Primary supplier for sauces, noodles & fresh veggies.', 'Active', 1)
`).run();

db.prepare(`
  INSERT INTO suppliers (id, name, contactPerson, mobileNumber, whatsappNumber, email, gstNumber, address, paymentTerms, deliveryDays, notes, status, isPreferred)
  VALUES ('SUP-CW-2', 'Amul Dairy Surat Distributor', 'Sanjay Shah', '+91 98251 67890', '+91 98251 67890', 'dairy@amulsurat.com', '24BBBCD5678G1Z0', 'Ring Road, Surat, Gujarat', 'Net 30', 2, 'Dairy, butter, paneer and cheese distributor.', 'Active', 1)
`).run();

db.prepare(`
  INSERT INTO suppliers (id, name, contactPerson, mobileNumber, whatsappNumber, email, gstNumber, address, paymentTerms, deliveryDays, notes, status, isPreferred)
  VALUES ('SUP-CW-3', 'Campus Packaging & Disposables', 'Vijay Mehta', '+91 99042 34567', '+91 99042 34567', 'sales@campuspack.in', '24CCCCD9012H1Z1', 'Adajan, Surat, Gujarat', 'COD', 1, 'Paper boxes, pizza boxes, cutlery & food wraps.', 'Active', 0)
`).run();

// Map suppliers to inventory items
const allInvItems = db.prepare("SELECT id, label, category FROM inventory").all();
const insertMapping = db.prepare(`
  INSERT OR IGNORE INTO inventory_item_suppliers (itemId, supplierId, isDefault, unitCost)
  VALUES (?, ?, ?, ?)
`);

allInvItems.forEach(item => {
  if (item.category === 'Dairy & Cheese') {
    insertMapping.run(item.id, 'SUP-CW-2', 1, 35.00);
  } else if (item.category === 'Packaging & Disposables') {
    insertMapping.run(item.id, 'SUP-CW-3', 1, 2.50);
  } else {
    insertMapping.run(item.id, 'SUP-CW-1', 1, 15.00);
  }
});
console.log('Seeded suppliers and item-supplier mappings successfully.');

// 4. BUILD RECIPES & BOM FOR ALL 88 POS PRODUCTS
const posProducts = db.prepare("SELECT * FROM pos_products").all();

const insertRecipeStmt = db.prepare(`
  INSERT INTO recipes (id, name, portion, status, ingredients, rawCost, retailPrice)
  VALUES (?, ?, 'Standard Portion', 'Active', ?, ?, ?)
`);

const updatePosRecipeStmt = db.prepare(`
  UPDATE pos_products SET recipeId = ? WHERE id = ?
`);

function getRecipeIngredientsForProduct(p) {
  const cat = p.category;
  const name = p.name;
  
  if (cat === "Noodles") {
    return [
      { name: "Hakka Noodles (Dry)", qty: 120, unit: "gm", cost: 9.60 },
      { name: "Cabbage (Shredded)", qty: 30, unit: "gm", cost: 0.75 },
      { name: "Capsicum (Chopped)", qty: 20, unit: "gm", cost: 0.80 },
      { name: "Carrots (Diced)", qty: 15, unit: "gm", cost: 0.52 },
      { name: "Spring Onion", qty: 10, unit: "gm", cost: 0.50 },
      { name: "Dark Soy Sauce", qty: 10, unit: "ml", cost: 0.90 },
      { name: "Green Chilli Sauce", qty: 10, unit: "ml", cost: 0.80 },
      { name: "Vinegar", qty: 5, unit: "ml", cost: 0.20 },
      { name: "Ginger-Garlic Paste", qty: 10, unit: "gm", cost: 1.00 },
      { name: "Paper Noodle Box 500ml", qty: 1, unit: "Piece", cost: 3.50 },
      { name: "Wooden Spoon", qty: 1, unit: "Piece", cost: 0.60 }
    ];
  } else if (cat === "Rice") {
    return [
      { name: "Steam Rice (Raw)", qty: 140, unit: "gm", cost: 8.40 },
      { name: "Cabbage (Shredded)", qty: 25, unit: "gm", cost: 0.62 },
      { name: "Capsicum (Chopped)", qty: 20, unit: "gm", cost: 0.80 },
      { name: "Carrots (Diced)", qty: 15, unit: "gm", cost: 0.52 },
      { name: "Spring Onion", qty: 10, unit: "gm", cost: 0.50 },
      { name: "Dark Soy Sauce", qty: 10, unit: "ml", cost: 0.90 },
      { name: "Ginger-Garlic Paste", qty: 10, unit: "gm", cost: 1.00 },
      { name: "Paper Noodle Box 500ml", qty: 1, unit: "Piece", cost: 3.50 },
      { name: "Wooden Spoon", qty: 1, unit: "Piece", cost: 0.60 }
    ];
  } else if (cat === "Chinese Starters") {
    if (name.includes("Manchurian")) {
      return [
        { name: "Manchurian Balls (Prep)", qty: 8, unit: "Piece", cost: 28.00 },
        { name: "Capsicum (Chopped)", qty: 25, unit: "gm", cost: 1.00 },
        { name: "Onions (Chopped)", qty: 25, unit: "gm", cost: 0.75 },
        { name: "Schezwan Sauce", qty: 25, unit: "gm", cost: 3.00 },
        { name: "Ginger-Garlic Paste", qty: 15, unit: "gm", cost: 1.50 },
        { name: "Paper Noodle Box 500ml", qty: 1, unit: "Piece", cost: 3.50 }
      ];
    } else if (name.includes("Paneer")) {
      return [
        { name: "Paneer (Fresh)", qty: 100, unit: "gm", cost: 32.00 },
        { name: "Capsicum (Chopped)", qty: 30, unit: "gm", cost: 1.20 },
        { name: "Onions (Chopped)", qty: 30, unit: "gm", cost: 0.90 },
        { name: "Green Chilli Sauce", qty: 15, unit: "ml", cost: 1.20 },
        { name: "Dark Soy Sauce", qty: 10, unit: "ml", cost: 0.90 },
        { name: "Paper Noodle Box 500ml", qty: 1, unit: "Piece", cost: 3.50 }
      ];
    } else {
      return [
        { name: "Crispy Fried Noodles", qty: 100, unit: "gm", cost: 10.00 },
        { name: "Cabbage (Shredded)", qty: 30, unit: "gm", cost: 0.75 },
        { name: "Schezwan Sauce", qty: 30, unit: "gm", cost: 3.60 },
        { name: "Spring Onion", qty: 10, unit: "gm", cost: 0.50 },
        { name: "Paper Noodle Box 500ml", qty: 1, unit: "Piece", cost: 3.50 }
      ];
    }
  } else if (cat === "French Fries") {
    return [
      { name: "Frozen French Fries", qty: 150, unit: "gm", cost: 18.00 },
      { name: "Peri Peri Powder", qty: 8, unit: "gm", cost: 3.20 },
      { name: "French Fries Cone Box", qty: 1, unit: "Piece", cost: 2.00 }
    ];
  } else if (cat === "Momos") {
    return [
      { name: "Raw Veg Momos", qty: 6, unit: "Piece", cost: 27.00 },
      { name: "Schezwan Sauce", qty: 25, unit: "gm", cost: 3.00 },
      { name: "Mayonnaise", qty: 20, unit: "gm", cost: 2.40 },
      { name: "Paper Noodle Box 500ml", qty: 1, unit: "Piece", cost: 3.50 }
    ];
  } else if (cat === "Cold Drinks") {
    return [
      { name: name.includes("Pepsi") ? "Pepsi 250ml Bottle" : (name.includes("Dew") ? "Mountain Dew 250ml Bottle" : "7 Up 250ml Bottle"), qty: 1, unit: "Piece", cost: 10.00 }
    ];
  } else if (cat === "Chai Coffee") {
    if (name.includes("Chai")) {
      return [
        { name: "Fresh Milk", qty: 100, unit: "ml", cost: 6.00 },
        { name: "Assam Tea Leaves", qty: 5, unit: "gm", cost: 1.75 },
        { name: "Sugar", qty: 10, unit: "gm", cost: 0.45 }
      ];
    } else if (name.includes("Coffee")) {
      return [
        { name: "Fresh Milk", qty: 150, unit: "ml", cost: 9.00 },
        { name: "Instant Coffee Powder", qty: 6, unit: "gm", cost: 6.60 },
        { name: "Sugar", qty: 15, unit: "gm", cost: 0.68 }
      ];
    } else {
      return [
        { name: "Wheat Atta", qty: 60, unit: "gm", cost: 2.40 },
        { name: "Amul Butter", qty: 10, unit: "gm", cost: 5.20 }
      ];
    }
  } else if (cat === "Breakfast") {
    if (name.includes("Pauva")) {
      return [
        { name: "Pauva / Poha", qty: 120, unit: "gm", cost: 6.00 },
        { name: "Gram Flour Sev", qty: 20, unit: "gm", cost: 2.40 },
        { name: "Onions (Chopped)", qty: 20, unit: "gm", cost: 0.60 }
      ];
    } else if (name.includes("Puff")) {
      return [
        { name: "Regular Puff Pastry", qty: 1, unit: "Piece", cost: 6.00 },
        { name: "Tomato Ketchup", qty: 15, unit: "gm", cost: 1.05 }
      ];
    } else if (name.includes("Samosa")) {
      return [
        { name: "Punjabi Samosa", qty: 1, unit: "Piece", cost: 7.00 },
        { name: "Tomato Ketchup", qty: 15, unit: "gm", cost: 1.05 }
      ];
    } else {
      return [
        { name: "Sandwich Bread Slice", qty: 2, unit: "Piece", cost: 5.00 },
        { name: "Amul Butter", qty: 15, unit: "gm", cost: 7.80 }
      ];
    }
  } else if (cat === "Pizza") {
    return [
      { name: "Pizza Base 7\"", qty: 1, unit: "Piece", cost: 12.00 },
      { name: "Pizza Sauce", qty: 40, unit: "gm", cost: 5.60 },
      { name: "Mozzarella Cheese", qty: 70, unit: "gm", cost: 31.50 },
      { name: "Capsicum (Chopped)", qty: 20, unit: "gm", cost: 0.80 },
      { name: "Oregano & Chilli Flakes", qty: 5, unit: "gm", cost: 2.50 },
      { name: "Pizza Box 7\"", qty: 1, unit: "Piece", cost: 4.50 }
    ];
  } else if (cat === "Burger") {
    return [
      { name: "Burger Buns", qty: 1, unit: "Piece", cost: 6.00 },
      { name: "Aloo Tikki Patty", qty: 1, unit: "Piece", cost: 8.00 },
      { name: "Cabbage (Shredded)", qty: 15, unit: "gm", cost: 0.38 },
      { name: "Mayonnaise", qty: 15, unit: "gm", cost: 1.80 },
      { name: "Food Wrap Paper", qty: 1, unit: "Piece", cost: 1.00 }
    ];
  } else if (cat === "Sandwich") {
    return [
      { name: "Sandwich Bread Slice", qty: 2, unit: "Piece", cost: 5.00 },
      { name: "Potatoes (Boiled)", qty: 40, unit: "gm", cost: 1.00 },
      { name: "Cucumber & Tomato", qty: 30, unit: "gm", cost: 0.90 },
      { name: "Amul Butter", qty: 10, unit: "gm", cost: 5.20 },
      { name: "Food Wrap Paper", qty: 1, unit: "Piece", cost: 1.00 }
    ];
  } else if (cat === "Garlic Bread") {
    return [
      { name: "Garlic Loaf Slice", qty: 2, unit: "Piece", cost: 20.00 },
      { name: "Amul Butter", qty: 15, unit: "gm", cost: 7.80 },
      { name: "Mozzarella Cheese", qty: 30, unit: "gm", cost: 13.50 },
      { name: "Oregano & Chilli Flakes", qty: 4, unit: "gm", cost: 2.00 }
    ];
  } else { // Gujarati Thali
    return [
      { name: "Wheat Atta", qty: 80, unit: "gm", cost: 3.20 },
      { name: "Gujarati Subji / Dal Prep", qty: 250, unit: "gm", cost: 15.00 },
      { name: "Steam Rice (Raw)", qty: 100, unit: "gm", cost: 6.00 },
      { name: "Gram Flour Sev", qty: 30, unit: "gm", cost: 3.60 },
      { name: "Thali Disposable Tray", qty: 1, unit: "Piece", cost: 6.00 }
    ];
  }
}

let recipeCount = 0;
for (const p of posProducts) {
  const ingredients = getRecipeIngredientsForProduct(p);
  const rawCost = ingredients.reduce((sum, ing) => sum + ing.cost, 0);
  const recipeId = `rec-cw-${p.id}`;

  insertRecipeStmt.run(
    recipeId,
    p.name,
    JSON.stringify(ingredients),
    rawCost,
    p.price
  );

  updatePosRecipeStmt.run(recipeId, p.id);
  recipeCount++;
}

console.log(`Successfully seeded ${recipeCount} recipes and mapped all POS products to their BOM recipes.`);
console.log('Chinese Wala ADIT Campus Inventory & Recipe seeding complete!');
