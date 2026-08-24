const db = require('better-sqlite3')('database.db');

const recipesToFix = [
    'Raj Kachori', 'Dahi Bhalla', 'Samosa Chaat', 'Chole Samosa', 
    'Kadi Kachori & Samosa', 'Samosa', 'Dahi Prep', 'Mung Moth Tadka', 
    'Bhalla Prep', 'Chole Bhature', 'Sev Puri', 'Dahi Puri', 
    'Maida Bhatura', 'Aaloo Chole Bhature', 'Aaloo Shop', 
    'Aloo Papadi Chaat', 'Bhalla Papadi Chaat', 'Kaju Katori', 
    'Ragada', 'Aloo Tikki Ragada'
];

let updatedCount = 0;
const inventory = db.prepare('SELECT * FROM inventory').all();
const updateStock = db.prepare('UPDATE inventory SET stock = ? WHERE id = ?');

// Find all recipes that match the names
const recipes = db.prepare('SELECT * FROM recipes').all();
let targetIngredients = new Set();

recipes.forEach(r => {
    if (recipesToFix.includes(r.name) || recipesToFix.some(name => r.name.toLowerCase().includes(name.toLowerCase()))) {
        try {
            let ingredients = JSON.parse(r.ingredients);
            ingredients.forEach(ing => targetIngredients.add(ing.name.toLowerCase()));
        } catch(e) {}
    }
});

inventory.forEach(inv => {
    if (targetIngredients.has(inv.label.toLowerCase()) && inv.stock <= 0) {
        updateStock.run(100, inv.id);
        console.log(`Updated stock for: ${inv.label}`);
        updatedCount++;
    }
});

console.log(`Successfully updated stock for ${updatedCount} inventory items.`);
