const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

const todayObj = new Date();
const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

console.log(`Patching all records to today's date: ${todayStr}`);

db.prepare('UPDATE wastage SET date = ?').run(todayStr);
db.prepare('UPDATE product_sales SET date = ?').run(todayStr);
db.prepare('UPDATE eod_reports SET date = ?').run(todayStr);
db.prepare('UPDATE checklists SET date = ?').run(todayStr);

// Also patch the employee histories to ensure any stray "DD/MM/YYYY" or old dates are upgraded
const employees = db.prepare('SELECT id, history FROM employees').all();
const updateEmp = db.prepare('UPDATE employees SET history = ? WHERE id = ?');

employees.forEach(emp => {
    if (emp.history) {
        try {
            const hist = JSON.parse(emp.history);
            let changed = false;
            hist.forEach(h => {
                if (h.date !== todayStr) {
                    h.date = todayStr;
                    changed = true;
                }
            });
            if (changed) {
                updateEmp.run(JSON.stringify(hist), emp.id);
            }
        } catch(e) {}
    }
});

console.log("Database patch complete!");
