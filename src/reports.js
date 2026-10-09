// reports.js - BK Operations India Enterprise Reports Module

function _initThisModule() {
    // 1. Core API Base Configuration
    // Absolute base URL if opened via file:// protocol or other ports
    let API_BASE = '';
    if (window.location.protocol.startsWith('file')) {
        API_BASE = 'http://localhost:3000';
    } else if (window.location.port && window.location.port !== '3000') {
        API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    // 2. State & Storage schema
    let liveStateData = null;
    let consolidatedChartInstance = null;

    // Helper: Get active store and role based on local storage cache
    function getCurrentRoleAndStore() {
        const cachedRoleKey = localStorage.getItem("bk_current_role_key") || "bm-vesu";
        let store = "VESU";
        let role = "bm";

        if (cachedRoleKey === "owner") {
            role = "owner";
            store = "All";
        } else if (cachedRoleKey === "bm-vesu") {
            store = "VESU";
        } else if (cachedRoleKey === "bm-adajan") {
            store = "ADAJAN";
        } else if (cachedRoleKey === "bm-ctlight") {
            store = "CT LIGHT";
        }
        return { role, store };
    }

    // Currency Formatter
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2
        }).format(amount);
    }

    // Fetch Live State data from API
    async function fetchLiveAppState() {
        try {
            const res = await fetch(`${API_BASE}/api/state`);
            if (res.ok) {
                liveStateData = await res.json();
            }
        } catch (e) {
            console.error("Failed to fetch live app state in reports module:", e);
        }
    }

    // 3. DAILY CASH REPORT IMPLEMENTATION
    const cashDateInput = document.getElementById("dailyCashReportDate");
    const todayStr = new Date().toISOString().split('T')[0];

    if (cashDateInput) {
        cashDateInput.value = todayStr;
        cashDateInput.addEventListener("change", () => renderDailyCashReport());
    }

    function renderDailyCashReport() {
        const tbody = document.querySelector("#tableDailyCashReport tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const selectedDate = document.getElementById("dailyCashReportDate").value;
        const { store } = getCurrentRoleAndStore();

        // Data arrays
        const orders = liveStateData ? (liveStateData.posOrders || []) : [];
        const expenses = liveStateData ? (liveStateData.expenses || []) : [];
        
        let localReturns = [];
        try {
            localReturns = JSON.parse(localStorage.getItem("bk_sales_returns")) || [];
        } catch (e) {}

        const transactions = [];

        // Let's assume standard opening balance
        const openingBalance = 5000;
        let totalCashIn = 0;
        let totalCashOut = 0;

        // Filter Cash Sales
        const cashOrders = orders.filter(o => {
            return (store === "All" || o.store === store) && o.date === selectedDate && o.paymentMethod === "Cash" && o.status !== "Refunded" && o.status !== "Cancelled" && o.status !== "Deleted";
        });

        cashOrders.forEach(o => {
            const amount = parseFloat(o.grandTotal || 0);
            transactions.push({
                time: o.time || "12:00",
                ref: o.id,
                type: "Cash Sale",
                desc: `Order by ${o.customerName || 'Walk-in'}`,
                inflow: amount,
                outflow: 0
            });
            totalCashIn += amount;
        });

        // Filter Cash Returns
        const cashReturns = localReturns.filter(r => {
            return (store === "All" || r.store === store) && r.date === selectedDate && r.status === "Refunded";
        });

        cashReturns.forEach(r => {
            const amount = parseFloat(r.refundAmount || 0);
            transactions.push({
                time: "15:00",
                ref: r.orderRef,
                type: "Cash Refund",
                desc: `Return: ${r.items} (${r.reason})`,
                inflow: 0,
                outflow: amount
            });
            totalCashOut += amount;
        });

        // Filter Cash Expenses
        const cashExpenses = expenses.filter(e => {
            return (store === "All" || e.store === store) && e.date === selectedDate && (e.paymentMode === "Cash" || e.category === "Cash Payout");
        });

        cashExpenses.forEach(e => {
            const amount = parseFloat(e.amount || 0);
            transactions.push({
                time: "17:00",
                ref: e.id || "EXP-LOG",
                type: "Cash Expense",
                desc: `${e.category || 'General'} - ${e.description || 'Outward payment'}`,
                inflow: 0,
                outflow: amount
            });
            totalCashOut += amount;
        });

        // Sort transactions by time
        transactions.sort((a, b) => a.time.localeCompare(b.time));

        let currentBal = openingBalance;

        transactions.forEach(t => {
            currentBal = currentBal + t.inflow - t.outflow;
            t.runningBal = currentBal;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${selectedDate} <span style="font-size:0.75rem; color:var(--text-tertiary);">${t.time}</span></td>
                <td><span class="pill-badge pill-badge-secondary">${t.ref}</span></td>
                <td><span class="pill-badge ${t.inflow > 0 ? 'pill-badge-success' : 'pill-badge-danger'}">${t.type}</span></td>
                <td>${t.desc}</td>
                <td style="text-align:right; color:var(--success); font-weight:500;">${t.inflow > 0 ? formatCurrency(t.inflow) : "-"}</td>
                <td style="text-align:right; color:var(--danger); font-weight:500;">${t.outflow > 0 ? formatCurrency(t.outflow) : "-"}</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(t.runningBal)}</td>
            `;
            tbody.appendChild(tr);
        });

        if (transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-tertiary);">No cash logs recorded today.</td></tr>`;
        }

        // Set KPIs
        document.getElementById("cash-kpi-opening").textContent = formatCurrency(openingBalance);
        document.getElementById("cash-kpi-in").textContent = formatCurrency(totalCashIn);
        document.getElementById("cash-kpi-out").textContent = formatCurrency(totalCashOut);
        document.getElementById("cash-kpi-closing").textContent = formatCurrency(openingBalance + totalCashIn - totalCashOut);
    }

    // 4. MONTHLY P&L REPORT IMPLEMENTATION
    const plPeriodInput = document.getElementById("monthlyPlPeriod");
    if (plPeriodInput) {
        const currentMonthStr = todayStr.slice(0, 7); // "YYYY-MM"
        plPeriodInput.value = currentMonthStr;

        plPeriodInput.addEventListener("change", () => renderMonthlyPlReport());
    }

    function renderMonthlyPlReport() {
        const tbody = document.querySelector("#tableMonthlyPlReport tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const period = document.getElementById("monthlyPlPeriod").value; // "YYYY-MM"
        const { store } = getCurrentRoleAndStore();

        const orders = liveStateData ? (liveStateData.posOrders || []) : [];
        const productSales = liveStateData ? (liveStateData.productSales || []) : [];
        const recipes = liveStateData ? (liveStateData.recipes || []) : [];
        const expenses = liveStateData ? (liveStateData.expenses || []) : [];

        // Parse previous month period string
        const parts = period.split("-");
        let prevYear = parseInt(parts[0], 10);
        let prevMonth = parseInt(parts[1], 10) - 1;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear--;
        }
        const prevPeriod = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;

        // Compute metrics for current period
        const currentData = computePeriodPl(period, store, orders, productSales, recipes, expenses);
        // Compute metrics for previous period
        const prevData = computePeriodPl(prevPeriod, store, orders, productSales, recipes, expenses);

        // Update KPIs
        document.getElementById("pl-kpi-revenue").textContent = formatCurrency(currentData.revenue);
        document.getElementById("pl-kpi-cogs").textContent = formatCurrency(currentData.cogs);
        document.getElementById("pl-kpi-expenses").textContent = formatCurrency(currentData.expensesVal);
        document.getElementById("pl-kpi-margin").textContent = `${currentData.margin.toFixed(1)}%`;

        // Render Particulars list
        const particulars = [
            { name: "Total Gross Revenue", curr: currentData.revenue, prev: prevData.revenue },
            { name: "Cost of Goods Sold (COGS)", curr: currentData.cogs, prev: prevData.cogs },
            { name: "Gross Profit", curr: currentData.revenue - currentData.cogs, prev: prevData.revenue - prevData.cogs },
            { name: "Operating Expenses (Opex)", curr: currentData.expensesVal, prev: prevData.expensesVal },
            { name: "Net Profit Before Tax", curr: currentData.profit, prev: prevData.profit }
        ];

        particulars.forEach(p => {
            const diff = p.curr - p.prev;
            const pct = p.prev > 0 ? (diff / p.prev) * 100 : 0;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${p.name}</strong></td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(p.curr)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${formatCurrency(p.prev)}</td>
                <td style="text-align:right; font-weight:500; color:${diff < 0 ? 'var(--danger)' : (diff > 0 ? 'var(--success)' : 'inherit')};">
                    ${diff !== 0 ? (diff > 0 ? '+' : '') + formatCurrency(diff) : "-"}
                </td>
                <td style="text-align:right; font-weight:700; color:${pct < 0 ? 'var(--danger)' : (pct > 0 ? 'var(--success)' : 'inherit')};">
                    ${pct !== 0 ? (pct > 0 ? '+' : '') + pct.toFixed(1) + '%' : "-"}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function computePeriodPl(period, store, orders, productSales, recipes, expenses) {
        // Filter orders
        const periodOrders = orders.filter(o => {
            return o.date.startsWith(period) && (store === "All" || o.store === store) && o.status !== "Refunded" && o.status !== "Cancelled" && o.status !== "Deleted";
        });

        // Revenue
        let revenue = 0;
        periodOrders.forEach(o => revenue += parseFloat(o.grandTotal || 0));

        // COGS (units sold * recipe unitCost)
        let cogs = 0;
        const periodSales = productSales.filter(s => {
            return s.date.startsWith(period) && (store === "All" || s.store === store);
        });

        periodSales.forEach(s => {
            const recipe = recipes.find(r => r.id === s.recipeId || r.name.toLowerCase() === s.itemName.toLowerCase());
            const unitCost = recipe ? parseFloat(recipe.rawCost || 0) : 0;
            cogs += (s.qty * unitCost);
        });

        // Expenses
        let expensesVal = 0;
        const periodExpenses = expenses.filter(e => {
            return e.date.startsWith(period) && (store === "All" || e.store === store);
        });
        periodExpenses.forEach(e => expensesVal += parseFloat(e.amount || 0));

        const profit = revenue - cogs - expensesVal;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

        return {
            revenue,
            cogs,
            expensesVal,
            profit,
            margin
        };
    }

    // 5. BRANCH-WISE P&L STATEMENT IMPLEMENTATION
    const branchPlStart = document.getElementById("branchPlStartDate");
    const branchPlEnd = document.getElementById("branchPlEndDate");
    const branchPlSort = document.getElementById("branchPlSortSelect");

    if (branchPlStart && branchPlEnd && branchPlSort) {
        branchPlStart.value = firstDayStr;
        branchPlEnd.value = todayStr;

        branchPlStart.addEventListener("change", () => renderBranchPlReport());
        branchPlEnd.addEventListener("change", () => renderBranchPlReport());
        branchPlSort.addEventListener("change", () => renderBranchPlReport());
    }

    function renderBranchPlReport() {
        const tbody = document.querySelector("#tableBranchWisePl tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const startDate = document.getElementById("branchPlStartDate").value;
        const endDate = document.getElementById("branchPlEndDate").value;
        const sortBy = document.getElementById("branchPlSortSelect").value;

        const orders = liveStateData ? (liveStateData.posOrders || []) : [];
        const productSales = liveStateData ? (liveStateData.productSales || []) : [];
        const recipes = liveStateData ? (liveStateData.recipes || []) : [];
        const expenses = liveStateData ? (liveStateData.expenses || []) : [];

        // App stores registry
        const stores = ["VESU", "ADAJAN", "CT LIGHT"];
        const branchRows = [];

        stores.forEach(store => {
            // Compute metrics within dates range
            const filteredOrders = orders.filter(o => o.store === store && o.date >= startDate && o.date <= endDate && o.status !== "Refunded" && o.status !== "Cancelled" && o.status !== "Deleted");
            
            let revenue = 0;
            filteredOrders.forEach(o => revenue += parseFloat(o.grandTotal || 0));

            let cogs = 0;
            const filteredSales = productSales.filter(s => s.store === store && s.date >= startDate && s.date <= endDate);
            filteredSales.forEach(s => {
                const recipe = recipes.find(r => r.id === s.recipeId || r.name.toLowerCase() === s.itemName.toLowerCase());
                const unitCost = recipe ? parseFloat(recipe.rawCost || 0) : 0;
                cogs += (s.qty * unitCost);
            });

            let expensesVal = 0;
            const filteredExpenses = expenses.filter(e => e.store === store && e.date >= startDate && e.date <= endDate);
            filteredExpenses.forEach(e => expensesVal += parseFloat(e.amount || 0));

            const profit = revenue - cogs - expensesVal;
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

            branchRows.push({
                store,
                count: filteredOrders.length,
                revenue,
                cogs,
                expensesVal,
                profit,
                margin
            });
        });

        // Sorting
        if (sortBy === "revenue_desc") {
            branchRows.sort((a, b) => b.revenue - a.revenue);
        } else if (sortBy === "profit_desc") {
            branchRows.sort((a, b) => b.profit - a.profit);
        } else if (sortBy === "margin_desc") {
            branchRows.sort((a, b) => b.margin - a.margin);
        }

        branchRows.forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${r.store} Branch</strong></td>
                <td style="text-align:right;">${r.count}</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(r.revenue)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${formatCurrency(r.cogs)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${formatCurrency(r.expensesVal)}</td>
                <td style="text-align:right; font-weight:700; color:var(--success);">${formatCurrency(r.profit)}</td>
                <td style="text-align:right; font-weight:700; color:var(--orange-primary);">${r.margin.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 6. BRANCH CONSOLIDATED REPORT IMPLEMENTATION
    const consStart = document.getElementById("consolidatedStartDate");
    const consEnd = document.getElementById("consolidatedEndDate");

    if (consStart && consEnd) {
        consStart.value = firstDayStr;
        consEnd.value = todayStr;

        consStart.addEventListener("change", () => renderConsolidatedReport());
        consEnd.addEventListener("change", () => renderConsolidatedReport());
    }

    function renderConsolidatedReport() {
        const tbody = document.querySelector("#tableConsolidatedReport tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const startDate = document.getElementById("consolidatedStartDate").value;
        const endDate = document.getElementById("consolidatedEndDate").value;

        const orders = liveStateData ? (liveStateData.posOrders || []) : [];
        const stores = ["VESU", "ADAJAN", "CT LIGHT"];
        
        let localReturns = [];
        try {
            localReturns = JSON.parse(localStorage.getItem("bk_sales_returns")) || [];
        } catch (e) {}

        let grandRevenue = 0;
        let grandProfit = 0;
        const branchRollups = [];

        stores.forEach(store => {
            // Gross sales
            const filteredOrders = orders.filter(o => o.store === store && o.date >= startDate && o.date <= endDate && o.status !== "Refunded" && o.status !== "Cancelled" && o.status !== "Deleted");
            let grossVal = 0;
            filteredOrders.forEach(o => grossVal += parseFloat(o.grandTotal || 0));

            // Returns
            const filteredReturns = localReturns.filter(r => r.store === store && r.date >= startDate && r.date <= endDate);
            let returnsVal = 0;
            filteredReturns.forEach(r => returnsVal += parseFloat(r.refundAmount || 0));

            const netSales = grossVal - returnsVal;
            grandRevenue += netSales;

            branchRollups.push({
                store,
                count: filteredOrders.length,
                grossVal,
                returnsVal,
                netSales
            });
        });

        // Find Best & Worst
        let bestBranch = "--";
        let worstBranch = "--";

        if (branchRollups.length > 0) {
            const sortedRollups = [...branchRollups].sort((a, b) => b.netSales - a.netSales);
            bestBranch = `${sortedRollups[0].store} (${formatCurrency(sortedRollups[0].netSales)})`;
            worstBranch = `${sortedRollups[sortedRollups.length - 1].store} (${formatCurrency(sortedRollups[sortedRollups.length - 1].netSales)})`;
        }

        // Render KPI metrics
        document.getElementById("consolidated-kpi-revenue").textContent = formatCurrency(grandRevenue);
        document.getElementById("consolidated-kpi-best-branch").textContent = bestBranch;
        document.getElementById("consolidated-kpi-worst-branch").textContent = worstBranch;

        // For net profit consolidation, we pull total P&L details per branch
        const productSales = liveStateData ? (liveStateData.productSales || []) : [];
        const recipes = liveStateData ? (liveStateData.recipes || []) : [];
        const expenses = liveStateData ? (liveStateData.expenses || []) : [];

        let grandNetProfit = 0;
        const chartLabels = [];
        const chartRevenue = [];
        const chartProfit = [];

        branchRollups.forEach(r => {
            // Compute profit
            let cogs = 0;
            const filteredSales = productSales.filter(s => s.store === r.store && s.date >= startDate && s.date <= endDate);
            filteredSales.forEach(s => {
                const recipe = recipes.find(r => r.id === s.recipeId || r.name.toLowerCase() === s.itemName.toLowerCase());
                const unitCost = recipe ? parseFloat(recipe.rawCost || 0) : 0;
                cogs += (s.qty * unitCost);
            });

            let expensesVal = 0;
            const filteredExpenses = expenses.filter(e => e.store === r.store && e.date >= startDate && e.date <= endDate);
            filteredExpenses.forEach(e => expensesVal += parseFloat(e.amount || 0));

            const netProfit = r.netSales - cogs - expensesVal;
            grandNetProfit += netProfit;

            chartLabels.push(r.store);
            chartRevenue.push(r.netSales);
            chartProfit.push(netProfit);

            const marginPct = r.netSales > 0 ? (netProfit / r.netSales) * 100 : 0;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${r.store} Branch</strong></td>
                <td style="text-align:right;">${r.count}</td>
                <td style="text-align:right;">${formatCurrency(r.grossVal)}</td>
                <td style="text-align:right; color:var(--danger);">${formatCurrency(r.returnsVal)}</td>
                <td style="text-align:right; font-weight:700; color:var(--success);">${formatCurrency(r.netSales)}</td>
                <td style="text-align:right; font-weight:700; color:var(--orange-primary);">${marginPct.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById("consolidated-kpi-profit").textContent = formatCurrency(grandNetProfit);

        // Render consolidated comparison chart
        const ctx = document.getElementById("chartBranchConsolidated").getContext("2d");
        if (consolidatedChartInstance) {
            consolidatedChartInstance.destroy();
        }

        consolidatedChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Net Revenue (₹)',
                        data: chartRevenue,
                        backgroundColor: 'rgba(242, 108, 37, 0.85)', // Orange
                        borderWidth: 1
                    },
                    {
                        label: 'Net Profit (₹)',
                        data: chartProfit,
                        backgroundColor: 'rgba(16, 185, 129, 0.85)', // Green
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Value (₹)' },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                }
            }
        });
    }

    // 7. PRINTABLE EXCEL HUB AND ACTIONS
    // Initialize date/period pickers on the hub page
    const hubCashDate = document.getElementById("hubDailyCashDate");
    const hubPlPeriod = document.getElementById("hubMonthlyPlPeriod");
    const hubBStart = document.getElementById("hubBranchPlStart");
    const hubBEnd = document.getElementById("hubBranchPlEnd");
    const hubCStart = document.getElementById("hubConsolidatedStart");
    const hubCEnd = document.getElementById("hubConsolidatedEnd");

    if (hubCashDate) hubCashDate.value = todayStr;
    if (hubPlPeriod) hubPlPeriod.value = todayStr.slice(0, 7);
    if (hubBStart) hubBStart.value = firstDayStr;
    if (hubBEnd) hubBEnd.value = todayStr;
    if (hubCStart) hubCStart.value = firstDayStr;
    if (hubCEnd) hubCEnd.value = todayStr;

    // Excel Export dispatcher using global SheetJS XLSX
    window.triggerHubExport = function(reportType) {
        let sheetName = "Report";
        let dataRows = [];

        const { store } = getCurrentRoleAndStore();

        if (reportType === "daily-cash") {
            const date = document.getElementById("dailyCashReportDate")?.value || hubCashDate.value;
            sheetName = `Daily_Cash_${date}`;
            
            // Gather table columns
            dataRows.push(["Date/Time", "Reference ID", "Transaction Type", "Party / Description", "Cash In (₹)", "Cash Out (₹)", "Running Balance (₹)"]);
            
            const rows = document.querySelectorAll("#tableDailyCashReport tbody tr");
            rows.forEach(tr => {
                const cells = tr.querySelectorAll("td");
                if (cells.length > 1) {
                    dataRows.push(Array.from(cells).map(c => c.textContent.trim()));
                }
            });
        } 
        else if (reportType === "monthly-pl") {
            const period = document.getElementById("monthlyPlPeriod")?.value || hubPlPeriod.value;
            sheetName = `Monthly_PL_${period}`;
            
            dataRows.push(["Particulars", "Current Period (₹)", "Previous Month (₹)", "Variance Value (₹)", "Variance (%)"]);
            
            const rows = document.querySelectorAll("#tableMonthlyPlReport tbody tr");
            rows.forEach(tr => {
                const cells = tr.querySelectorAll("td");
                if (cells.length > 1) {
                    dataRows.push(Array.from(cells).map(c => c.textContent.trim()));
                }
            });
        }
        else if (reportType === "branch-pl") {
            const start = document.getElementById("branchPlStartDate")?.value || hubBStart.value;
            const end = document.getElementById("branchPlEndDate")?.value || hubBEnd.value;
            sheetName = `Branch_PL_${start}_to_${end}`;

            dataRows.push(["Branch / Store Name", "Invoice Count", "Total Revenue (₹)", "COGS (₹)", "Expenses (₹)", "Net Profit (₹)", "Profit Margin (%)"]);

            const rows = document.querySelectorAll("#tableBranchWisePl tbody tr");
            rows.forEach(tr => {
                const cells = tr.querySelectorAll("td");
                if (cells.length > 1) {
                    dataRows.push(Array.from(cells).map(c => c.textContent.trim()));
                }
            });
        }
        else if (reportType === "consolidated") {
            const start = document.getElementById("consolidatedStartDate")?.value || hubCStart.value;
            const end = document.getElementById("consolidatedEndDate")?.value || hubCEnd.value;
            sheetName = `Consolidated_PL_${start}_to_${end}`;

            dataRows.push(["Store / Branch Name", "Sales Count", "Gross Sales (₹)", "Refunds & Returns (₹)", "Net Sales (₹)", "Consolidated Margin (%)"]);

            const rows = document.querySelectorAll("#tableConsolidatedReport tbody tr");
            rows.forEach(tr => {
                const cells = tr.querySelectorAll("td");
                if (cells.length > 1) {
                    dataRows.push(Array.from(cells).map(c => c.textContent.trim()));
                }
            });
        }

        if (dataRows.length <= 1) {
            alert("No data available to export. Please view the page first to load transactions.");
            return;
        }

        // SheetJS binary workbook creation
        try {
            const ws = XLSX.utils.aoa_to_sheet(dataRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
            XLSX.writeFile(wb, `${sheetName}.xlsx`);
        } catch (e) {
            console.error("SheetJS export failed, falling back to CSV Blob download:", e);
            // CSV Fallback
            const csvContent = dataRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", `${sheetName}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // Print dispatcher opening clean window preview
    window.triggerHubPrint = function(reportType) {
        let printTitle = "Enterprise Performance Report";
        let contentHtml = "";

        const { store } = getCurrentRoleAndStore();

        if (reportType === "daily-cash") {
            const date = document.getElementById("dailyCashReportDate")?.value || hubDailyCashDate.value;
            printTitle = `Daily Cash Report - ${date}`;
            
            // Sync values if on hub
            if (!document.getElementById("dailyCashReportDate")) {
                document.getElementById("dailyCashReportDate").value = date;
                renderDailyCashReport();
            }
            contentHtml = document.getElementById("printDailyCashArea").innerHTML;
        }
        else if (reportType === "monthly-pl") {
            const period = document.getElementById("monthlyPlPeriod")?.value || hubPlPeriod.value;
            printTitle = `Monthly P&L Statement - ${period}`;
            
            if (!document.getElementById("monthlyPlPeriod")) {
                document.getElementById("monthlyPlPeriod").value = period;
                renderMonthlyPlReport();
            }
            contentHtml = document.getElementById("printMonthlyPlArea").innerHTML;
        }
        else if (reportType === "branch-pl") {
            const start = document.getElementById("branchPlStartDate")?.value || hubBStart.value;
            const end = document.getElementById("branchPlEndDate")?.value || hubBEnd.value;
            printTitle = `Multi-Branch P&L Analytics - ${start} to ${end}`;

            if (!document.getElementById("branchPlStartDate")) {
                document.getElementById("branchPlStartDate").value = start;
                document.getElementById("branchPlEndDate").value = end;
                renderBranchPlReport();
            }
            contentHtml = document.getElementById("printBranchPlArea").innerHTML;
        }
        else if (reportType === "consolidated") {
            const start = document.getElementById("consolidatedStartDate")?.value || hubCStart.value;
            const end = document.getElementById("consolidatedEndDate")?.value || hubCEnd.value;
            printTitle = `Consolidated Report - ${start} to ${end}`;

            if (!document.getElementById("consolidatedStartDate")) {
                document.getElementById("consolidatedStartDate").value = start;
                document.getElementById("consolidatedEndDate").value = end;
                renderConsolidatedReport();
            }
            contentHtml = document.getElementById("printConsolidatedArea").innerHTML;
        }

        const printWindow = window.open("", "_blank", "width=850,height=700");
        printWindow.document.write(`
            <html>
                <head>
                    <title>${printTitle}</title>
                    <style>
                        body { font-family: 'Outfit', Arial, sans-serif; padding: 30px; color: #2e231f; background: #fff; }
                        h2 { font-weight: 800; border-bottom: 2px solid #f26c25; padding-bottom: 10px; margin-bottom: 20px; }
                        .print-meta { margin-bottom: 25px; display:flex; justify-content:space-between; font-size:0.9rem; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #e2dcd9; padding: 12px; text-align: left; font-size:0.9rem; }
                        th { background-color: #f7f5f4; font-weight: bold; }
                        .text-right { text-align: right; }
                        strong { font-weight: 700; }
                    </style>
                </head>
                <body>
                    <h2>${printTitle}</h2>
                    <div class="print-meta">
                        <div><strong>Target Store:</strong> ${store === "All" ? "Consolidated (All Branches)" : store + " Branch"}</div>
                        <div><strong>Report Printed:</strong> ${new Date().toISOString().split('T')[0]}</div>
                    </div>
                    ${contentHtml}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    // 8. MAIN DISPATCHER CONTROLLER
    window.renderReportsScreen = async function(target) {
        if (!target) return;

        // Security Role Check for Branch-wise P&L
        if (target === 'branch-wise-pl') {
            const { role } = getCurrentRoleAndStore();
            if (role !== 'owner') {
                showToast('Access Denied: Branch-wise P&L is only accessible to Franchise Owners.');
                return;
            }
        }

        // Fetch fresh orders data
        await fetchLiveAppState();

        if (target === 'printable-excel-reports') {
            // Default load
        } else if (target === 'daily-cash-report') {
            renderDailyCashReport();
        } else if (target === 'monthly-pl-report') {
            renderMonthlyPlReport();
        } else if (target === 'branch-wise-pl') {
            renderBranchPlReport();
        } else if (target === 'branch-consolidated-report') {
            renderConsolidatedReport();
        }
    };

    window.refreshReportsData = async function() {
        await fetchLiveAppState();
        const activeItem = document.querySelector(".nav-item.active");
        if (activeItem) {
            const target = activeItem.getAttribute("data-target");
            if (targetScreens.includes(target)) {
                window.renderReportsScreen(target);
            }
        }
    };

    // 9. SIDEBAR NAVIGATION BINDINGS AND EVENT BOOTSTRAP
    const targetScreens = [
        'printable-excel-reports', 'monthly-pl-report', 'branch-wise-pl', 'branch-consolidated-report'
    ];

    document.querySelectorAll(".nav-item").forEach(item => {
        const target = item.getAttribute("data-target");
        if (targetScreens.includes(target)) {
            item.addEventListener("click", () => {
                window.renderReportsScreen(target);
            });
        }
    });

    // Listen to changes in the active Role dropdown
    const roleOptions = document.querySelectorAll(".role-option");
    roleOptions.forEach(opt => {
        opt.addEventListener("click", () => {
            setTimeout(() => {
                const activeItem = document.querySelector(".nav-item.active");
                if (activeItem) {
                    const target = activeItem.getAttribute("data-target");
                    if (targetScreens.includes(target)) {
                        window.renderReportsScreen(target);
                    }
                }
            }, 200);
        });
    });
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _initThisModule);
    } else {
        _initThisModule();
    }
}
