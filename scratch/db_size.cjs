const db = require('better-sqlite3')('../database.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => console.log(t.name + ': ' + db.prepare('SELECT count(*) as c FROM ' + t.name).get().c));
