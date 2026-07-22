const XLSX = require('xlsx');

// Mock frontend variables
const currentRole = "owner";
const currentStore = "VESU";
const inventory = [
    { id: "inv-1", store: "VESU", label: "Whopper Sesame Buns", unitCost: 15.5, stock: 120, unit: "Piece" },
    { id: "inv-2", store: "VESU", label: "Royale Mint Sauce", unitCost: 0.12, stock: 3000, unit: "gm" },
    { id: "inv-3", store: "VESU", label: "Cheddar Cheese Slices", unitCost: 8.5, stock: 320, unit: "Piece" },
    { id: "inv-4", store: "VESU", label: "Iceberg Lettuce", unitCost: 0.08, stock: 3000, unit: "gm" }
];

function parseRobustDate(dStr) {
    if (!dStr) return "2026-06-24";
    return dStr;
}

const getRowValue = (row, possibleHeaders) => {
    const keys = Object.keys(row);
    for (const header of possibleHeaders) {
        const cleanHeader = header.toLowerCase().replace(/\s+/g, '').trim();
        const foundKey = keys.find(k => k.toLowerCase().replace(/\s+/g, '').trim() === cleanHeader);
        if (foundKey !== undefined) {
            return row[foundKey];
        }
    }
    return undefined;
};

// Create a mock Excel workbook replicating the user's columns exactly
const ws_data = [
    ["Branch", "Item Name", "Category", "Current Stock", "Unit", "Unit Cost (₹)", "Expiry Date", "Wastage Qty", "Reason"],
    ["VESU", "Whopper Sesame Buns", "Bakery Breads", 119, "Piece", 15.5, "25-Jun-2026", 15, "Expired"],
    ["VESU", "Royale Mint Sauce", "Sauces & Spreads", 3000, "gm", 0.12, "15-07-2026", 12, "damaged"],
    ["VESU", "Cheddar Cheese Slices", "Dairy Packets", 320, "Piece", 8.5, "18-Jun-2026", 30, "Expired"],
    ["VESU", "Iceberg Lettuce", "Fresh Produce", 3000, "gm", 0.08, "20-Jun-2026", 800, "Spoilage"]
];
const ws = XLSX.utils.aoa_to_sheet(ws_data);
const rawRows = XLSX.utils.sheet_to_json(ws);

const validBranches = ["VESU", "ADAJAN", "CT LIGHT"];
const recordsToSave = [];
const errors = [];

rawRows.forEach((row, index) => {
    const rowNum = index + 2;

    const isEmptyRow = Object.values(row).every(val => val === null || val === undefined || val.toString().trim() === "");
    if (isEmptyRow) return;

    const branch = (getRowValue(row, ["Branch", "Store"]) || "").toString().trim().toUpperCase();
    const itemName = (getRowValue(row, ["Item Name", "Item", "Menu Item"]) || "").toString().trim();
    const qtyVal = getRowValue(row, ["Quantity", "Qty", "Wastage Qty", "Wastage Quantity"]);
    const reason = (getRowValue(row, ["Reason"]) || "").toString().trim();
    const loggedBy = (getRowValue(row, ["Logged By", "User"]) || "System").toString().trim();
    let dateStr = (getRowValue(row, ["Date"]) || "2026-06-24").toString().trim();

    if (!branch) {
        errors.push(`Row ${rowNum}: Branch is empty.`);
        return;
    }
    if (!validBranches.includes(branch)) {
        errors.push(`Row ${rowNum}: Invalid branch '${branch}'. Must be VESU, ADAJAN, or CT LIGHT.`);
        return;
    }
    
    if (currentRole === "bm" && branch !== currentStore) {
        errors.push(`Row ${rowNum}: Unauthorized branch '${branch}'. As a Branch Manager, you can only import wastage for your store: ${currentStore}.`);
        return;
    }
    
    if (!itemName) {
        errors.push(`Row ${rowNum}: Item Name is empty.`);
        return;
    }
    
    const findInv = inventory.find(inv => inv.store === branch && inv.label.toLowerCase() === itemName.toLowerCase());
    if (!findInv) {
        errors.push(`Row ${rowNum}: Item '${itemName}' does not exist in ${branch} inventory.`);
        return;
    }
    
    const qty = parseFloat(qtyVal);
    if (isNaN(qty) || qty <= 0) {
        errors.push(`Row ${rowNum}: Invalid quantity '${qtyVal}'. Must be a positive number.`);
        return;
    }
    
    if (!reason) {
        errors.push(`Row ${rowNum}: Reason is empty.`);
        return;
    }

    recordsToSave.push({
        id: "w-" + Date.now() + "-" + index,
        store: branch,
        name: findInv.label,
        qty: qty,
        unit: findInv.unit || 'Piece',
        reason: reason,
        date: dateStr,
        cost: qty * findInv.unitCost,
        loggedBy: loggedBy
    });
});

console.log("Errors:", errors);
console.log("Records:", recordsToSave);

