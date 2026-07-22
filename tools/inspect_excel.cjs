const XLSX = require('xlsx');

try {
    const workbook = XLSX.readFile('/Users/nirmitkhasiya/Desktop/shh/test.xlsx');
    console.log("Sheet names in test.xlsx:", workbook.SheetNames);
    
    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`\nSheet: ${sheetName}`);
        console.log(`Total Rows: ${data.length}`);
        if (data.length > 0) {
            console.log("Headers / First 3 Rows:");
            data.slice(0, 5).forEach((row, i) => {
                console.log(`  Row ${i + 1}:`, row);
            });
        }
    });
} catch (e) {
    console.error("Error reading test.xlsx:", e);
}
