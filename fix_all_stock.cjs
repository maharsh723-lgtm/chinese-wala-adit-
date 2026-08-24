const db = require('better-sqlite3')('database.db');

const targetStores = ['VESU', 'LP SAVANI', 'GAURAV PATH', 'SUDAMA CHOWK', 'WAREHOUSE', 'MAIN'];
const inventory = db.prepare('SELECT * FROM inventory').all();
const recipes = db.prepare('SELECT * FROM recipes').all();
const insertInv = db.prepare(`INSERT INTO inventory (id, label, category, stock, unit, unitCost, store, status, openingStock, closingStock, reorder, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const updateStock = db.prepare(`UPDATE inventory SET stock = ? WHERE id = ?`);

let addedCount = 0;
let updatedCount = 0;

// Rebuild inventory map by store
let invMap = {};
inventory.forEach(inv => {
    let key = inv.label.toLowerCase() + '|' + inv.store;
    invMap[key] = inv;
});

recipes.forEach(r => {
    try {
        let ingredients = JSON.parse(r.ingredients);
        ingredients.forEach(ing => {
            targetStores.forEach(store => {
                let key = ing.name.toLowerCase() + '|' + store;
                if (!invMap[key]) {
                    let newId = 'inv-new-' + Date.now() + '-' + Math.floor(Math.random()*1000000);
                    insertInv.run(newId, ing.name, 'Uncategorized', 100, ing.unit || 'Piece', 0, store, 'Active', 0, 0, 0, '');
                    invMap[key] = { id: newId, stock: 100 };
                    addedCount++;
                }
            });
        });
    } catch(e) {}
});

// Update any existing items with <= 0 stock to 100
const updatedInventory = db.prepare('SELECT * FROM inventory').all();
updatedInventory.forEach(inv => {
    if (inv.stock <= 0) {
        updateStock.run(100, inv.id);
        updatedCount++;
    }
});

console.log(`Created ${addedCount} missing ingredients across all stores.`);
console.log(`Updated stock to 100 for ${updatedCount} items that had 0 or less stock.`);
