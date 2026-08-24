const db = require('better-sqlite3')('database.db');

const targetStores = ['VESU', 'LP SAVANI', 'GAURAV PATH', 'SUDAMA CHOWK', 'WAREHOUSE'];
const inventory = db.prepare('SELECT * FROM inventory').all();
const insertInv = db.prepare(`INSERT INTO inventory (id, label, category, stock, unit, unitCost, store, status, openingStock, closingStock, reorder, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

let addedCount = 0;

const mainItems = inventory.filter(i => i.store === 'MAIN');

mainItems.forEach(mainItem => {
    targetStores.forEach(targetStore => {
        // Check if item exists in target store
        let exists = inventory.find(i => i.label.toLowerCase() === mainItem.label.toLowerCase() && i.store === targetStore);
        if (!exists) {
            let newId = 'inv-new-' + Date.now() + '-' + Math.floor(Math.random()*1000);
            insertInv.run(newId, mainItem.label, mainItem.category, mainItem.stock, mainItem.unit, mainItem.unitCost, targetStore, mainItem.status, 0, 0, 0, '');
            addedCount++;
        }
    });
});

console.log(`Replicated ${addedCount} inventory records across all stores.`);
