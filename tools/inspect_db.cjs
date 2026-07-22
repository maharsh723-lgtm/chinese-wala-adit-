const Database = require('better-sqlite3');
const db = new Database('database.db');

try {
    const tables = ['eod_reports', 'inventory', 'wastage', 'recipes', 'pos_orders', 'pos_order_items', 'product_sales', 'purchase_requests'];
    tables.forEach(name => {
        try {
            const count = db.prepare(`SELECT count(*) as count FROM "${name}"`).get().count;
            console.log(`\nTable: ${name}, Count: ${count}`);
            if (count > 0) {
                const rows = db.prepare(`SELECT * FROM "${name}" LIMIT 3`).all();
                console.log("Sample rows:", JSON.stringify(rows, null, 2));
            }
        } catch (e) {
            console.error(`Error querying ${name}:`, e.message);
        }
    });
} catch (e) {
    console.error("Error inspecting database.db:", e);
} finally {
    db.close();
}
