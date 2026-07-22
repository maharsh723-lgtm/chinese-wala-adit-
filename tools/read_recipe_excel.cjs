const XLSX = require('xlsx');

const excelPath = 'c:/Users/mahar/OneDrive/Desktop/bk/recipe costing.xlsx';
const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets['Sheet1'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

data.forEach((row, idx) => {
  console.log(`Row ${idx+1}:`, row);
});
