const db = require('better-sqlite3')('database.db');
const recipes = [
  {
    "name": "Chole Bhature",
    "ingredients": [
      {"name": "Chole", "qty": 150, "unit": "gm"},
      {"name": "Bhatura", "qty": 110, "unit": "gm"},
      {"name": "Aloo Sabaji", "qty": 20, "unit": "gm"},
      {"name": "Onion", "qty": 20, "unit": "gm"},
      {"name": "Aachar", "qty": 10, "unit": "gm"},
      {"name": "Nimbu", "qty": 1, "unit": "Piece"},
      {"name": "Dhaniya", "qty": 0.1, "unit": "gm"}
    ]
  }
];

const inventories = db.prepare('SELECT * FROM inventory').all();
const dbRecipes = db.prepare('SELECT * FROM recipes').all();

const insertInv = db.prepare(`INSERT INTO inventory (id, label, category, stock, unit, unitCost, store, status, openingStock, closingStock, reorder, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertRec = db.prepare(`INSERT INTO recipes (id, name, portion, status, ingredients, rawCost, retailPrice, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
const updateRec = db.prepare(`UPDATE recipes SET ingredients = ?, rawCost = ? WHERE id = ?`);

let invMap = {};
inventories.forEach(inv => {
    invMap[inv.label.toLowerCase()] = inv;
});

recipes.forEach(r => {
    let rawCost = 0;
    
    // Check and create ingredients
    r.ingredients.forEach(ing => {
        let labelLower = ing.name.toLowerCase();
        let invItem = invMap[labelLower];
        if (!invItem) {
            let newId = 'inv-new-' + Date.now() + '-' + Math.floor(Math.random()*1000);
            invItem = {
                id: newId,
                label: ing.name,
                category: 'Uncategorized',
                stock: 0,
                unit: ing.unit,
                unitCost: 0,
                store: 'MAIN',
                status: 'Active'
            };
            insertInv.run(newId, invItem.label, invItem.category, 0, invItem.unit, 0, invItem.store, invItem.status, 0, 0, 0, '');
            invMap[labelLower] = invItem;
            console.log("Inserted new inventory item:", invItem.label);
        }
        
        // Calculate cost based on inventory unitCost
        let cost = (invItem.unitCost || 0) * ing.qty;
        ing.cost = cost;
        rawCost += cost;
    });
    
    // Check if recipe exists
    let existingRec = dbRecipes.find(dr => dr.name.toLowerCase() === r.name.toLowerCase());
    if (existingRec) {
        updateRec.run(JSON.stringify(r.ingredients), rawCost, existingRec.id);
        console.log("Updated recipe:", r.name);
    } else {
        let newId = 'rec-new-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        insertRec.run(newId, r.name, 'Standard Portion', 'Active', JSON.stringify(r.ingredients), rawCost, 0, 1);
        console.log("Inserted new recipe:", r.name);
    }
});
