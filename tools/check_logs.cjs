const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

console.log("--- Wastage Logs ---");
const wastage = db.prepare('SELECT * FROM wastage ORDER BY date DESC LIMIT 5').all();
console.table(wastage);

console.log("\n--- Product Sales Logs ---");
const sales = db.prepare('SELECT * FROM product_sales ORDER BY date DESC LIMIT 5').all();
console.table(sales);

console.log("\n--- Shift Logs (Attendance) ---");
const employees = db.prepare('SELECT * FROM employees').all();
let shiftLogs = [];
employees.forEach(emp => {
    if (emp.history) {
        const hist = JSON.parse(emp.history);
        hist.forEach(h => shiftLogs.push({...h, empName: emp.name}));
    }
});
console.table(shiftLogs.slice(0, 5));

console.log("\n--- EOD Reports ---");
const eods = db.prepare('SELECT * FROM eod_reports ORDER BY date DESC LIMIT 5').all();
console.table(eods);
