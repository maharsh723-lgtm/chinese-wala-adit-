const db = require('better-sqlite3')('database.db');

const targetStores = ['VESU', 'LP SAVANI', 'GAURAV PATH', 'SUDAMA CHOWK', 'WAREHOUSE', 'MAIN'];
const inventory = db.prepare('SELECT * FROM inventory').all();
const posProducts = db.prepare('SELECT * FROM pos_products').all();
const insertInv = db.prepare(`INSERT INTO inventory (id, label, category, stock, unit, unitCost, store, status, openingStock, closingStock, reorder, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

let addedCount = 0;

let invMap = {};
inventory.forEach(inv => {
    let key = inv.label.toLowerCase() + '|' + inv.store;
    invMap[key] = inv;
});

posProducts.forEach(p => {
    if (p.ingredients) {
        try {
            let ingredients = JSON.parse(p.ingredients);
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
    }
});

console.log(`Created ${addedCount} missing ingredients from pos_products across all stores.`);
