const Database = require('better-sqlite3');
const db = new Database('database.db');
const { verifyPassword } = require('../src/cryptoHelper.cjs');

const userLP = db.prepare("SELECT * FROM employees WHERE id = 'LP'").get();
console.log('LP User record:', userLP);
console.log('Verify LPpassword for LP:', verifyPassword('LPpassword', userLP.password));

const userEMP105 = db.prepare("SELECT * FROM employees WHERE id = 'EMP105'").get();
console.log('EMP105 User record:', userEMP105);
console.log('Verify LPpassword for EMP105:', verifyPassword('LPpassword', userEMP105.password));
