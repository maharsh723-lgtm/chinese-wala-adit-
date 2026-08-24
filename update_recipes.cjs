const db = require('better-sqlite3')('database.db');
const recipes = [
  {
    "name": "Sev Puri",
    "ingredients": [
      {"name": "Papadi", "qty": 23.4, "unit": "gm"},
      {"name": "Aaloo", "qty": 50, "unit": "gm"},
      {"name": "Tomato", "qty": 12, "unit": "gm"},
      {"name": "Onion", "qty": 8, "unit": "gm"},
      {"name": "Lal Masala", "qty": 0.5, "unit": "gm"},
      {"name": "Sonth Masala", "qty": 0.5, "unit": "gm"},
      {"name": "Lasan Chatny", "qty": 5, "unit": "gm"},
      {"name": "Green Chatny", "qty": 6, "unit": "gm"},
      {"name": "Sotha Chatny", "qty": 8, "unit": "gm"},
      {"name": "Nimbu", "qty": 0.5, "unit": "gm"},
      {"name": "Naylon Sev", "qty": 12, "unit": "gm"},
      {"name": "Hara Dhaniya", "qty": 0.1, "unit": "gm"}
    ]
  },
  {
    "name": "Dahi Puri",
    "ingredients": [
      {"name": "Sooji Puri", "qty": 60, "unit": "gm"},
      {"name": "Aloo", "qty": 22, "unit": "gm"},
      {"name": "Lal Masala", "qty": 0.1, "unit": "gm"},
      {"name": "Sonf Masala", "qty": 0.1, "unit": "gm"},
      {"name": "Sontha Chatny", "qty": 10, "unit": "gm"},
      {"name": "Dahi", "qty": 100, "unit": "gm"},
      {"name": "Green Chatny", "qty": 5, "unit": "gm"},
      {"name": "Sontha Chatny", "qty": 15, "unit": "gm"},
      {"name": "Naylon Sev", "qty": 7, "unit": "gm"},
      {"name": "Garnice & Dhaniya", "qty": 5, "unit": "gm"}
    ]
  },
  {
    "name": "Maida Bhatura",
    "ingredients": [
      {"name": "Maida", "qty": 500, "unit": "gm"},
      {"name": "Tata Namak", "qty": 20, "unit": "gm"},
      {"name": "Pani", "qty": 600, "unit": "gm"},
      {"name": "Baking Powder", "qty": 20, "unit": "gm"},
      {"name": "Hara Dhanya", "qty": 15, "unit": "gm"}
    ]
  },
  {
    "name": "Aaloo Chole Bhature",
    "ingredients": [
      {"name": "Aaloo", "qty": 100, "unit": "gm"},
      {"name": "Jira", "qty": 2, "unit": "gm"},
      {"name": "Hing", "qty": 2, "unit": "gm"},
      {"name": "Green Chatny", "qty": 10, "unit": "gm"}
    ]
  },
  {
    "name": "Aaloo Shop",
    "ingredients": [
      {"name": "Aaloo", "qty": 250, "unit": "gm"},
      {"name": "Kala Chana", "qty": 20, "unit": "gm"},
      {"name": "Lal Masala", "qty": 3, "unit": "gm"},
      {"name": "Sonf Masala", "qty": 3, "unit": "gm"},
      {"name": "Hara Dhaniya", "qty": 2, "unit": "gm"}
    ]
  },
  {
    "name": "Aloo Papadi Chaat",
    "ingredients": [
      {"name": "Papadi", "qty": 30, "unit": "gm"},
      {"name": "Aloo", "qty": 30, "unit": "gm"},
      {"name": "Lal & Sonf Masala", "qty": 1, "unit": "gm"},
      {"name": "Dahi", "qty": 100, "unit": "gm"},
      {"name": "Sotha Chatny", "qty": 8, "unit": "gm"},
      {"name": "Green Chatny", "qty": 7, "unit": "gm"},
      {"name": "Naylon Sev", "qty": 8, "unit": "gm"},
      {"name": "Garnice & Dhaniya", "qty": 5, "unit": "gm"}
    ]
  },
  {
    "name": "Bhalla Papadi Chaat",
    "ingredients": [
      {"name": "Bhalla", "qty": 50, "unit": "gm"},
      {"name": "Aloo", "qty": 20, "unit": "gm"},
      {"name": "Lal & Sonf Masala", "qty": 1, "unit": "gm"},
      {"name": "Dahi", "qty": 100, "unit": "gm"},
      {"name": "Green Chatny", "qty": 5, "unit": "gm"},
      {"name": "Sonth Chatny", "qty": 5, "unit": "gm"},
      {"name": "Naylin Sev", "qty": 5, "unit": "gm"},
      {"name": "Ganice & Dhaniya & Anar", "qty": 5, "unit": "gm"},
      {"name": "Papadi", "qty": 15, "unit": "gm"},
      {"name": "Kala Namak", "qty": 0.1, "unit": "gm"}
    ]
  },
  {
    "name": "Kaju Katori",
    "ingredients": [
      {"name": "Lachha Tokari", "qty": 1, "unit": "Piece"},
      {"name": "Bhalla", "qty": 1, "unit": "Piece"},
      {"name": "Mun Motha", "qty": 20, "unit": "gm"},
      {"name": "Kala Namak", "qty": 0.1, "unit": "gm"},
      {"name": "Papadi", "qty": 13, "unit": "gm"},
      {"name": "Aloo", "qty": 25, "unit": "gm"},
      {"name": "Lal & Sonf Masala", "qty": 1, "unit": "gm"},
      {"name": "Sontha Cgatny", "qty": 15, "unit": "gm"},
      {"name": "Green Chatny", "qty": 7, "unit": "gm"},
      {"name": "Dahi", "qty": 40, "unit": "gm"},
      {"name": "Mini Kachori", "qty": 1, "unit": "Piece"},
      {"name": "Aloo Tikki", "qty": 1, "unit": "Piece"},
      {"name": "Surti Mix Namkin", "qty": 15, "unit": "gm"},
      {"name": "Chana Dal Masala", "qty": 5, "unit": "gm"},
      {"name": "Chapta Chana", "qty": 7, "unit": "gm"},
      {"name": "Ratlami Sev", "qty": 5, "unit": "gm"},
      {"name": "Dahi", "qty": 150, "unit": "gm"},
      {"name": "Sonth Chatny", "qty": 20, "unit": "gm"},
      {"name": "Green Chatny", "qty": 10, "unit": "gm"},
      {"name": "Naylon Sev", "qty": 10, "unit": "gm"},
      {"name": "Masala Bundi", "qty": 5, "unit": "gm"},
      {"name": "Garnice & Dhaniy", "qty": 5, "unit": "gm"},
      {"name": "Palak Patta", "qty": 20, "unit": "gm"},
      {"name": "Lal & Sonf Masala", "qty": 1, "unit": "gm"}
    ]
  },
  {
    "name": "Ragada",
    "ingredients": [
      {"name": "Oil", "qty": 20, "unit": "gm"},
      {"name": "Jira", "qty": 1, "unit": "gm"},
      {"name": "Hari Mirchi", "qty": 5, "unit": "gm"},
      {"name": "Hing", "qty": 1, "unit": "gm"},
      {"name": "Tomato", "qty": 10, "unit": "gm"},
      {"name": "Kala Namak", "qty": 1, "unit": "gm"},
      {"name": "Haldi Powder", "qty": 0.1, "unit": "gm"},
      {"name": "Ragada Masala", "qty": 2, "unit": "gm"},
      {"name": "Chatta Masala", "qty": 2, "unit": "gm"}
    ]
  },
  {
    "name": "Aloo Tikki Ragada",
    "ingredients": [
      {"name": "Aloo Tikki", "qty": 60, "unit": "gm"},
      {"name": "Lal & Sonf Masala", "qty": 1, "unit": "gm"},
      {"name": "Ragda", "qty": 100, "unit": "gm"},
      {"name": "Sontha Chatny", "qty": 3, "unit": "gm"},
      {"name": "Green Chatny", "qty": 3, "unit": "gm"},
      {"name": "Tikha Pani", "qty": 3, "unit": "gm"},
      {"name": "Laccha Onion", "qty": 8, "unit": "gm"},
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
        let cost = invItem.unitCost * ing.qty;
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
