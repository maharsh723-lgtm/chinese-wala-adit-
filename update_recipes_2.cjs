const db = require('better-sqlite3')('database.db');
const recipes = [
  {
    "name": "Raj Kachori",
    "ingredients": [
      {"name": "Raj Kachori", "qty": 1, "unit": "Piece"},
      {"name": "Mung Motha", "qty": 35, "unit": "gm"},
      {"name": "Aloo", "qty": 25, "unit": "gm"},
      {"name": "Bhalla", "qty": 1, "unit": "Piece"},
      {"name": "Papadi", "qty": 5, "unit": "Piece"},
      {"name": "Sonf Masala", "qty": 5, "unit": "gm"},
      {"name": "Lal Masala", "qty": 5, "unit": "gm"},
      {"name": "Green Chatny", "qty": 10, "unit": "gm"},
      {"name": "Sonth Chatny", "qty": 10, "unit": "gm"},
      {"name": "Dahi", "qty": 200, "unit": "gm"},
      {"name": "Green Chatny", "qty": 10, "unit": "gm"},
      {"name": "Sonth Chatny", "qty": 10, "unit": "gm"},
      {"name": "Sev", "qty": 10, "unit": "gm"},
      {"name": "Garnice", "qty": 15, "unit": "gm"},
      {"name": "Lal Masala", "qty": 2, "unit": "gm"},
      {"name": "Sonf Masala", "qty": 2, "unit": "gm"},
      {"name": "Masala Bundi", "qty": 5, "unit": "gm"}
    ]
  },
  {
    "name": "Dahi Bhalla",
    "ingredients": [
      {"name": "Bhalla", "qty": 50, "unit": "gm"},
      {"name": "Kala Namak", "qty": 0.1, "unit": "gm"},
      {"name": "Aloo", "qty": 30, "unit": "gm"},
      {"name": "Lal & Sonf Masala", "qty": 1, "unit": "gm"},
      {"name": "Dahi", "qty": 100, "unit": "gm"},
      {"name": "Sontha Chatny", "qty": 10, "unit": "gm"},
      {"name": "Green Chatny", "qty": 5, "unit": "gm"},
      {"name": "Naylin Sev", "qty": 8, "unit": "gm"},
      {"name": "Garnice&Dhaniy&Anar", "qty": 5, "unit": "gm"}
    ]
  },
  {
    "name": "Samosa Chaat",
    "ingredients": [
      {"name": "Samosa", "qty": 1, "unit": "Piece"},
      {"name": "Lal & Sonf Masala", "qty": 1, "unit": "gm"},
      {"name": "Dahi", "qty": 50, "unit": "gm"},
      {"name": "Green Chatny", "qty": 3, "unit": "gm"},
      {"name": "Sonth Chatny", "qty": 6, "unit": "gm"},
      {"name": "Laccha Onion", "qty": 7, "unit": "gm"},
      {"name": "Naylon Sev", "qty": 3, "unit": "gm"},
      {"name": "Garnice", "qty": 5, "unit": "gm"}
    ]
  },
  {
    "name": "Chole Samosa",
    "ingredients": [
      {"name": "Samosa", "qty": 1, "unit": "Piece"},
      {"name": "Chole", "qty": 100, "unit": "gm"},
      {"name": "Sontha Chatny", "qty": 8, "unit": "gm"},
      {"name": "Green Chatny", "qty": 3, "unit": "gm"},
      {"name": "Laccha Onion", "qty": 8, "unit": "gm"},
      {"name": "Dhaniy", "qty": 0.1, "unit": "gm"}
    ]
  },
  {
    "name": "Kadi Kachori & Samosa",
    "ingredients": [
      {"name": "Kachori", "qty": 3, "unit": "Piece"},
      {"name": "Samosa", "qty": 1, "unit": "Piece"},
      {"name": "Lal & Sonf Masala", "qty": 1, "unit": "gm"},
      {"name": "Kadi", "qty": 100, "unit": "gm"},
      {"name": "Bikaneri Bhujiya", "qty": 5, "unit": "gm"},
      {"name": "Dhaniya", "qty": 0.1, "unit": "gm"}
    ]
  },
  {
    "name": "Samosa",
    "ingredients": [
      {"name": "Green Mater", "qty": 50, "unit": "gm"},
      {"name": "Boil Aloo", "qty": 1500, "unit": "gm"},
      {"name": "Maida", "qty": 1000, "unit": "gm"},
      {"name": "Dalda Ghee", "qty": 20, "unit": "gm"},
      {"name": "Ajvain", "qty": 5, "unit": "gm"}
    ]
  },
  {
    "name": "Dahi Prep",
    "ingredients": [
      {"name": "Dahi", "qty": 1000, "unit": "gm"},
      {"name": "Bura", "qty": 100, "unit": "gm"},
      {"name": "Pani", "qty": 100, "unit": "gm"}
    ]
  },
  {
    "name": "Mung Moth Tadka",
    "ingredients": [
      {"name": "Oil", "qty": 20, "unit": "gm"},
      {"name": "Jira", "qty": 2, "unit": "gm"},
      {"name": "Mung Moth", "qty": 100, "unit": "gm"},
      {"name": "Kala Chana", "qty": 50, "unit": "gm"},
      {"name": "Hari Mircha Shop", "qty": 3, "unit": "gm"},
      {"name": "Tata Namak", "qty": 3, "unit": "gm"},
      {"name": "Lal Mirchi Powder", "qty": 3, "unit": "gm"},
      {"name": "Amchur Powder", "qty": 3, "unit": "gm"}
    ]
  },
  {
    "name": "Bhalla Prep",
    "ingredients": [
      {"name": "Bhalla", "qty": 370, "unit": "gm"},
      {"name": "Sugar", "qty": 50, "unit": "gm"},
      {"name": "Hing", "qty": 2, "unit": "gm"}
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
