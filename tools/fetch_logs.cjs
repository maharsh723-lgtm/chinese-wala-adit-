const http = require('http');

http.get('http://localhost:3000/api/state', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const state = JSON.parse(data);
        console.log("--- Wastage Logs (First 3) ---");
        console.log(state.wastage.slice(0, 3));
        console.log("--- Product Sales (First 3) ---");
        console.log(state.productSales.slice(0, 3));
        console.log("--- Employee History (First 1) ---");
        const emps = Object.values(state.employees);
        if(emps.length > 0) console.log(emps[0].history);
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
