const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('database.db');
console.log(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
