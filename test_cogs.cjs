const db = require('better-sqlite3')('database.db');
const activeBranch = "VESU";
const dateQuery = "date = ?";
const queryParams = ["2026-08-15"];

let cogsVal = 0;
let posCogsBranch = "";
let posCogsParams = [...queryParams];
if (activeBranch !== "All") {
  posCogsBranch = "AND o.store = ?";
  posCogsParams.push(activeBranch);
}
try {
const posCogsRows = db.prepare(`
  SELECT i.quantity, r.rawCost
  FROM pos_order_items i
  JOIN pos_orders o ON o.id = i.orderId
  JOIN pos_products p ON p.id = i.productId
  JOIN recipes r ON r.id = p.recipeId
  WHERE o.date ${dateQuery.replace('date', '')} ${posCogsBranch}
`).all(...posCogsParams);
console.log(posCogsRows);
} catch (e) { console.error(e); }
