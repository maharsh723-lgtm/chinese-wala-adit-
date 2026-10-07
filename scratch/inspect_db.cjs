const Database = require('better-sqlite3');
const db = new Database('database.db');

console.log("=== TABLES ===");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables.map(t => t.name));

for (const table of tables) {
  const name = table.name;
  if (name.includes('user') || name.includes('store') || name.includes('location') || name.includes('outlet') || name.includes('address') || name.includes('branch')) {
    console.log(`\n--- ${name} schema ---`);
    console.log(db.prepare(`PRAGMA table_info(${name})`).all());
    console.log(`\n--- ${name} rows ---`);
    console.log(db.prepare(`SELECT * FROM ${name} LIMIT 10`).all());
  }
}
