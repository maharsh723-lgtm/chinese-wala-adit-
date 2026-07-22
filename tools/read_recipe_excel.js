const XLSX = require('xlsx');

const excelPath = 'c:/Users/mahar/OneDrive/Desktop/bk/recipe costing.xlsx';
const workbook = XLSX.readFile(excelPath);
console.log("Sheets in workbook:", workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  // Print first 40 rows
  data.slice(0, 40).forEach((row, idx) => {
    console.log(`Row ${idx+1}:`, row);
  });
});
