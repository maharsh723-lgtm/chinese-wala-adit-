const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'database.db');
const db = new DatabaseSync(dbPath);
const users = db.prepare("SELECT id, name, role FROM employees").all();
console.log(users);
