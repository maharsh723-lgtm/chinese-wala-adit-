const Database = require('better-sqlite3');
const db = new Database('database.db');
const employees = db.prepare('SELECT id, name, role, store, roleKey FROM employees').all();
console.log("Employees inside database:", employees);
