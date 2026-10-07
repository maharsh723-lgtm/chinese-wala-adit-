const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new DatabaseSync(dbPath);

console.log('Clearing all recipes from database.db...');

db.exec("DELETE FROM recipes;");
db.exec("UPDATE pos_products SET recipeId = NULL;");

console.log('Successfully cleared all recipes from database.db!');
