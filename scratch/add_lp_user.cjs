const Database = require('better-sqlite3');
const db = new Database('database.db');
const { hashPassword } = require('../src/cryptoHelper.cjs');

const pass = hashPassword('managerbk/09#');

// Insert or update EMP105
db.prepare(`
  INSERT INTO employees (id, name, role, mobile, shiftStart, roleKey, password, status, store, activePunch, history, salary)
  VALUES ('EMP105', 'Manager LP SAVANI', 'Branch Manager', '9876543214', '09:00', 'sm', ?, 'Active', 'LP SAVANI', null, '[]', 38000)
  ON CONFLICT(id) DO UPDATE SET store='LP SAVANI', password=?
`).run(pass, pass);

// Insert or update LP
db.prepare(`
  INSERT OR REPLACE INTO employees (id, name, role, mobile, shiftStart, roleKey, password, status, store, activePunch, history, salary)
  VALUES ('LP', 'Manager LP SAVANI', 'Branch Manager', '9876543214', '09:00', 'sm', ?, 'Active', 'LP SAVANI', null, '[]', 38000)
`).run(pass);

console.log('Employees updated successfully:');
console.log(db.prepare("SELECT id, name, role, store FROM employees WHERE store LIKE '%LP%' OR id = 'LP'").all());
