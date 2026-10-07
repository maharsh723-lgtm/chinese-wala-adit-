const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

console.log('Replacing VESU references with ADIT CAMPUS across the codebase...');

// 1. Update index.html
const indexHtmlPath = path.join(__dirname, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  html = html.replace(/VESU Outlet/g, 'ADIT Campus Outlet');
  html = html.replace(/VESU Branch/g, 'ADIT Campus');
  html = html.replace(/BK VESU West/g, 'ADIT Campus');
  html = html.replace(/BK VESU/g, 'ADIT Campus');
  html = html.replace(/VESU Store/g, 'ADIT Campus');
  html = html.replace(/Vesu Outlet/g, 'ADIT Campus Outlet');
  html = html.replace(/Vesu Branch/g, 'ADIT Campus');
  html = html.replace(/Vesu/g, 'ADIT Campus');
  html = html.replace(/VESU/g, 'ADIT CAMPUS');
  fs.writeFileSync(indexHtmlPath, html, 'utf8');
  console.log('Updated index.html');
}

// 2. Update src/app.js
const appJsPath = path.join(__dirname, 'src', 'app.js');
if (fs.existsSync(appJsPath)) {
  let code = fs.readFileSync(appJsPath, 'utf8');
  code = code.replace(/VESU Outlet/g, 'ADIT Campus Outlet');
  code = code.replace(/VESU Branch/g, 'ADIT Campus');
  code = code.replace(/Vesu Branch/g, 'ADIT Campus');
  code = code.replace(/BK VESU/g, 'ADIT Campus');
  code = code.replace(/Manager VESU/g, 'Manager ADIT CAMPUS');
  code = code.replace(/'VESU'/g, "'ADIT CAMPUS'");
  code = code.replace(/"VESU"/g, '"ADIT CAMPUS"');
  code = code.replace(/VESU/g, 'ADIT CAMPUS');
  fs.writeFileSync(appJsPath, code, 'utf8');
  console.log('Updated src/app.js');
}

// 3. Update db.cjs
const dbCjsPath = path.join(__dirname, 'db.cjs');
if (fs.existsSync(dbCjsPath)) {
  let code = fs.readFileSync(dbCjsPath, 'utf8');
  code = code.replace(/'VESU'/g, "'ADIT CAMPUS'");
  code = code.replace(/"VESU"/g, '"ADIT CAMPUS"');
  code = code.replace(/Manager VESU/g, 'Manager ADIT CAMPUS');
  code = code.replace(/VESU/g, 'ADIT CAMPUS');
  fs.writeFileSync(dbCjsPath, code, 'utf8');
  console.log('Updated db.cjs');
}

// 4. Update seed_chinese_wala_inventory.cjs
const seedInvPath = path.join(__dirname, 'seed_chinese_wala_inventory.cjs');
if (fs.existsSync(seedInvPath)) {
  let code = fs.readFileSync(seedInvPath, 'utf8');
  code = code.replace(/'VESU'/g, "'ADIT CAMPUS'");
  code = code.replace(/"VESU"/g, '"ADIT CAMPUS"');
  code = code.replace(/VESU/g, 'ADIT CAMPUS');
  fs.writeFileSync(seedInvPath, code, 'utf8');
  console.log('Updated seed_chinese_wala_inventory.cjs');
}

// 5. Update SQLite database database.db
const dbPath = path.join(__dirname, 'database.db');
if (fs.existsSync(dbPath)) {
  const db = new DatabaseSync(dbPath);
  try { db.exec("UPDATE inventory SET store = 'ADIT CAMPUS' WHERE store = 'VESU';"); } catch(e){}
  try { db.exec("UPDATE pos_orders SET store = 'ADIT CAMPUS' WHERE store = 'VESU';"); } catch(e){}
  try { db.exec("UPDATE product_sales SET store = 'ADIT CAMPUS' WHERE store = 'VESU';"); } catch(e){}
  try { db.exec("UPDATE employees SET store = 'ADIT CAMPUS' WHERE store = 'VESU';"); } catch(e){}
  try { db.exec("UPDATE wastage SET store = 'ADIT CAMPUS' WHERE store = 'VESU';"); } catch(e){}
  try { db.exec("UPDATE checklists SET store = 'ADIT CAMPUS' WHERE store = 'VESU';"); } catch(e){}
  try { db.exec("UPDATE eod_reports SET store = 'ADIT CAMPUS' WHERE store = 'VESU';"); } catch(e){}
  console.log('Updated database.db tables');
}

console.log('VESU replacement complete!');
