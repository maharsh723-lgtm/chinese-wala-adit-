const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

const fetchLogic = `
// ==========================================
// P&L AND BALANCE SHEET AUTOMATION
// ==========================================
window.fetchAndRenderPnL = async function() {
    try {
        const res = await fetch('http://localhost:5174/api/pl/live-summary?branch=VESU&dateFilter=month', {
            headers: {
                'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
            }
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        // --- Render P&L ---
        const plTable = document.querySelector('#plSheetTable tbody');
        if (plTable && data.summary) {
            plTable.innerHTML = \`
                <tr>
                    <td>Revenue (Gross Sales)</td>
                    <td style="text-align:right;">POS Sales</td>
                    <td style="text-align:right;">₹\${data.summary.totalSales.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                    <td>Less: Cost of Goods Sold (COGS)</td>
                    <td style="text-align:right;">Inventory</td>
                    <td style="text-align:right;">₹\${data.cogs.toLocaleString('en-IN')}</td>
                </tr>
                <tr style="font-weight:700; background:#f7f5f4;">
                    <td>Gross Profit</td>
                    <td style="text-align:right;"></td>
                    <td style="text-align:right;">₹\${data.summary.grossProfit.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                    <td>Operating Expenses</td>
                    <td style="text-align:right;">Ledger</td>
                    <td style="text-align:right;">₹\${data.summary.totalExpenses.toLocaleString('en-IN')}</td>
                </tr>
                <tr style="font-weight:800; background:var(--orange-light); border-top:2px solid var(--orange-primary);">
                    <td>Net Profit / Loss</td>
                    <td style="text-align:right;"></td>
                    <td style="text-align:right;">₹\${data.summary.netProfit.toLocaleString('en-IN')}</td>
                </tr>
            \`;
        }

        // --- Render Balance Sheet ---
        if (data.summary && document.querySelector('#tableBSAssets tbody')) {
            const totalAssets = data.cashInHand + data.bankBalance + data.inventoryValue + data.outstandingCustomer;
            const totalLiabilities = data.outstandingSupplier;
            const totalEquity = totalAssets - totalLiabilities;

            document.querySelector('#tableBSAssets tbody').innerHTML = \`
                <tr><td>Cash in Hand</td><td style="text-align:right;">₹\${data.cashInHand.toLocaleString('en-IN')}</td></tr>
                <tr><td>Bank Balance</td><td style="text-align:right;">₹\${data.bankBalance.toLocaleString('en-IN')}</td></tr>
                <tr><td>Inventory Value</td><td style="text-align:right;">₹\${data.inventoryValue.toLocaleString('en-IN')}</td></tr>
                <tr><td>Accounts Receivable</td><td style="text-align:right;">₹\${data.outstandingCustomer.toLocaleString('en-IN')}</td></tr>
            \`;
            document.getElementById('bsTotalAssets').innerText = \`₹\${totalAssets.toLocaleString('en-IN')}\`;

            document.querySelector('#tableBSLiabilities tbody').innerHTML = \`
                <tr><td>Accounts Payable</td><td style="text-align:right;">₹\${data.outstandingSupplier.toLocaleString('en-IN')}</td></tr>
            \`;
            document.getElementById('bsTotalLiabilities').innerText = \`₹\${totalLiabilities.toLocaleString('en-IN')}\`;

            document.querySelector('#tableBSEquity tbody').innerHTML = \`
                <tr><td>Retained Earnings</td><td style="text-align:right;">₹\${totalEquity.toLocaleString('en-IN')}</td></tr>
            \`;
            document.getElementById('bsTotalEquity').innerText = \`₹\${totalEquity.toLocaleString('en-IN')}\`;
        }
    } catch (e) {
        console.error("Error fetching P&L data", e);
    }
};

// Hook it to execute occasionally or on load
setInterval(() => {
    if (window.currentActiveScreen === 'balance-sheet' || window.currentActiveScreen === 'pl-automation') {
        window.fetchAndRenderPnL();
    }
}, 5000);
`;

if (!js.includes('fetchAndRenderPnL')) {
    js += '\n\n' + fetchLogic;
}

// Hook inside navigateToScreen
if (!js.includes('window.fetchAndRenderPnL();')) {
    js = js.replace(
        'if (screenId === "training") renderTrainingScreen();',
        'if (screenId === "training") renderTrainingScreen();\n        if (screenId === "balance-sheet" || screenId === "pl-automation") window.fetchAndRenderPnL();'
    );
}

// Ensure the POST /api/pos/orders refresh
if (js.includes("console.log('Order created on backend:', data);")) {
    js = js.replace(
        "console.log('Order created on backend:', data);",
        "console.log('Order created on backend:', data);\n                if (window.fetchAndRenderPnL) window.fetchAndRenderPnL();"
    );
}

fs.writeFileSync('app.js', js);
console.log("Injected P&L and Balance Sheet frontend logic.");
