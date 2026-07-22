const fs = require('fs');
const XLSX = require('xlsx');

const excelPath = 'c:/Users/mahar/OneDrive/Desktop/bk/recipe costing.xlsx';
const sqlPath = 'c:/Users/mahar/OneDrive/Desktop/bk/shh 2/shh/migration.sql';

const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets['Sheet1'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

let rawRecipes = [];
let currentRecipe = null;
let rawRows = [];

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (!row || row.length === 0) continue;

  const isHeader = row.some(cell => typeof cell === 'string' && cell.trim() === 'INGREDIENTS');
  if (isHeader) {
    if (currentRecipe) {
      rawRecipes.push({ currentRecipe, rawRows });
    }
    currentRecipe = {};
    rawRows = [];
    continue;
  }

  if (currentRecipe) {
    rawRows.push(row);
  }
}
if (currentRecipe) {
  rawRecipes.push({ currentRecipe, rawRows });
}

let recipesList = [];
let uniqueIngredients = {};

rawRecipes.forEach((item, idx) => {
  const rows = item.rawRows;
  const firstRow = rows[0];
  if (!firstRow) return;

  let name = '';
  rows.forEach(row => {
    const col0 = row[0];
    if (col0 && typeof col0 === 'string' && col0.includes(':')) {
      name = col0.replace(':', '').trim();
    }
  });

  if (!name) {
    for (let i = 1; i < rows.length; i++) {
      const col0 = rows[i][0];
      if (col0 && typeof col0 === 'string' && col0.trim() !== '' && isNaN(col0)) {
        name = col0.trim();
        break;
      }
    }
  }

  if (!name) {
    name = firstRow[1] || `Recipe-${idx+1}`;
  }

  const menuPrice = typeof firstRow[8] === 'number' ? firstRow[8] : 0;
  let totalCostVal = typeof firstRow[7] === 'number' ? firstRow[7] : (typeof firstRow[5] === 'number' ? firstRow[5] : 0);

  let recipeIngredients = [];
  let calculatedRawCost = 0;

  rows.forEach(row => {
    const ingName = row[1];
    const qty = row[2];
    const rate = row[3];
    const amount = row[4];

    if (ingName && typeof ingName === 'string' && ingName.trim() !== '' && ingName !== 'INGREDIENTS') {
      const cleanIngName = ingName.trim();
      const qVal = typeof qty === 'number' ? qty : 0;
      const rVal = typeof rate === 'number' ? rate : 0;
      const aVal = typeof amount === 'number' ? amount : (qVal * rVal);

      recipeIngredients.push({
        name: cleanIngName,
        qty: qVal,
        unit: 'gm',
        cost: aVal
      });

      calculatedRawCost += aVal;

      if (cleanIngName) {
        if (!uniqueIngredients[cleanIngName]) {
          uniqueIngredients[cleanIngName] = {
            rates: [],
            unit: 'gm'
          };
        }
        if (rVal > 0) {
          uniqueIngredients[cleanIngName].rates.push(rVal);
        }
      }
    }
  });

  recipeIngredients.forEach(ing => {
    const lower = ing.name.toLowerCase();
    if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('samosa') || lower.includes('kachori') || lower.includes('puri') || lower.includes('bhalla') || lower.includes('chilla') || lower.includes('kulche') || lower.includes('bhature') || lower.includes('tikki') || lower.includes('wedge')) {
      ing.unit = 'Piece';
    } else if (lower.includes('ml') || lower.includes('oil') || lower.includes('syrup') || lower.includes('water') || lower.includes('kadi') || lower.includes('batter')) {
      ing.unit = 'ml';
    } else {
      ing.unit = 'gm';
    }
  });

  recipesList.push({
    id: `rec-${idx+1}`,
    name: name,
    portion: 'Standard Portion',
    status: 'Active',
    ingredients: recipeIngredients,
    rawCost: totalCostVal || calculatedRawCost,
    retailPrice: menuPrice || (calculatedRawCost * 3)
  });
});

Object.keys(uniqueIngredients).forEach(name => {
  const item = uniqueIngredients[name];
  const avgRate = item.rates.length > 0 ? (item.rates.reduce((a,b)=>a+b, 0) / item.rates.length) : 10.00;
  item.unitCost = avgRate;
  
  const lower = name.toLowerCase();
  if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('plastic')) {
    item.unit = 'Piece';
  } else if (lower.includes('ml') || lower.includes('oil') || lower.includes('syrup') || lower.includes('water') || lower.includes('kadi') || lower.includes('batter')) {
    item.unit = 'ml';
  } else {
    item.unit = 'gm';
  }
});

function getCategory(name) {
  const lower = name.toLowerCase();
  if (lower.includes('bun') || lower.includes('bread') || lower.includes('kulche') || lower.includes('bhature') || lower.includes('puri') || lower.includes('kachori') || lower.includes('samosa')) {
    return 'Bakery Breads';
  }
  if (lower.includes('patty') || lower.includes('patties') || lower.includes('bhalla') || lower.includes('tikki') || lower.includes('munglet')) {
    return 'Frozen Foods';
  }
  if (lower.includes('chutney') || lower.includes('sauce') || lower.includes('chatney') || lower.includes('oil') || lower.includes('syrup') || lower.includes('kadi')) {
    return 'Sauces & Spreads';
  }
  if (lower.includes('dahi') || lower.includes('cheese') || lower.includes('butter') || lower.includes('cream')) {
    return 'Dairy Packets';
  }
  if (lower.includes('lettuce') || lower.includes('beet') || lower.includes('carrot') || lower.includes('onion') || lower.includes('tomato') || lower.includes('chilli') || lower.includes('adrak') || lower.includes('dhania') || lower.includes('lemon') || lower.includes('potato') || lower.includes('alu') || lower.includes('chana') || lower.includes('spices') || lower.includes('masala')) {
    return 'Fresh Produce';
  }
  if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('plastic')) {
    return 'Packaging & Cutlery';
  }
  return 'Chaat Ingredients';
}

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

let sql = `DELETE FROM recipes;\nDELETE FROM inventory;\n`;

const branches = ['VESU', 'ADAJAN', 'CT LIGHT', 'WAREHOUSE'];
let invCounter = 1;

Object.keys(uniqueIngredients).forEach(name => {
  const item = uniqueIngredients[name];
  const category = getCategory(name);

  branches.forEach(branch => {
    const stock = branch === 'WAREHOUSE' ? 50000 : 5000;
    const reorder = 1000;
    sql += `INSERT INTO inventory (id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status, openingStock, closingStock) VALUES ('inv-${invCounter++}', '${escapeSql(name)}', '${escapeSql(category)}', ${stock}, '${escapeSql(item.unit)}', ${reorder}, ${item.unitCost}, '2026-12-31', '${escapeSql(branch)}', 'OK', ${stock}, ${stock});\n`;
  });
});

recipesList.forEach(r => {
  sql += `INSERT INTO recipes (id, name, portion, status, ingredients, rawCost, retailPrice) VALUES ('${escapeSql(r.id)}', '${escapeSql(r.name)}', '${escapeSql(r.portion)}', '${escapeSql(r.status)}', '${escapeSql(JSON.stringify(r.ingredients))}', ${r.rawCost}, ${r.retailPrice});\n`;
});

fs.writeFileSync(sqlPath, sql, 'utf8');
console.log("migration.sql generated successfully!");
