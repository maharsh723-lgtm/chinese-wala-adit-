const db = require('better-sqlite3')('database.db');
console.log(db.prepare("SELECT * FROM transactions WHERE id LIKE 'order-%' ORDER BY date DESC LIMIT 5").all());
