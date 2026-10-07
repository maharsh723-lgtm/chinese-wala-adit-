const Database = require('better-sqlite3');
const db = new Database('database.db');
const { hashPassword, verifyPassword } = require('../src/cryptoHelper.cjs');

const newPassword = 'LPpassword';
const hashedPassword = hashPassword(newPassword);

db.prepare(`UPDATE employees SET password = ? WHERE id = 'LP' OR id = 'EMP105'`).run(hashedPassword);

console.log('Password updated for LP and EMP105.');

const lpUser = db.prepare("SELECT id, name, role, store, password FROM employees WHERE id = 'LP'").get();
console.log('LP User Record:', lpUser);
console.log('Verify LPpassword:', verifyPassword('LPpassword', lpUser.password));
