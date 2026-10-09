// plDashboard.js - BK Operations India Enterprise P&L Management Module

function _initThisModule() {
    // 1. Core API Base Configuration
    // Absolute base URL if opened via file:// protocol or other ports
    let API_BASE = '';
    if (window.location.protocol.startsWith('file')) {
        API_BASE = 'http://localhost:3000';
    } else if (window.location.port && window.location.port !== '3000') {
        API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    let livePLData = null; // Stores parsed response
    
    // Global Chart Instance registries
    let chartDailySales = null;
    let chartExpensesShare = null;
    let chartRevenueChannels = null;
    let chartBranchComparison = null;

    // Helper: Get active store and role based on local storage cache
    function getCurrentRoleAndStore() {
        const cachedRoleKey = localStorage.getItem("bk_current_role_key") || "bm-adit";
        let store = "ADIT CAMPUS";
        let role = "bm";

        if (cachedRoleKey === "owner") {
            role = "owner";
            store = "All";
        } else if (cachedRoleKey === "bm-adit") {
            store = "ADIT CAMPUS";
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

    // Toggle custom date range view
    const dateFilterSelect = document.getElementById("plDateFilterSelect");
    const customDateRangePicker = document.getElementById("plCustomDateRangePicker");
    const plStartDate = document.getElementById("plStartDate");
    const plEndDate = document.getElementById("plEndDate");
    const plBranchSelect = document.getElementById("plBranchSelect");

    const todayStr = new Date().toISOString().split('T')[0];
    if (plStartDate) plStartDate.value = todayStr.slice(0, 8) + "01";
    if (plEndDate) plEndDate.value = todayStr;

    if (dateFilterSelect) {
        dateFilterSelect.addEventListener("change", () => {
            if (dateFilterSelect.value === 'custom') {
                customDateRangePicker.style.display = 'flex';
            } else {
                customDateRangePicker.style.display = 'none';
            }
            refreshPLDashboard();
        });
    }

    if (plStartDate) plStartDate.addEventListener("change", refreshPLDashboard);
    if (plEndDate) plEndDate.addEventListener("change", refreshPLDashboard);
    if (plBranchSelect) plBranchSelect.addEventListener("change", refreshPLDashboard);

    // Main API aggregation trigger
    async function refreshPLDashboard() {
        const { role, store } = getCurrentRoleAndStore();

        // Lockdown selector for manager
        if (role === 'bm') {
            plBranchSelect.value = store;
            plBranchSelect.disabled = true;
            document.getElementById("plOwnerKPIsGrid").style.display = 'none';
            document.getElementById("plBranchComparisonCards").style.display = 'none';
            document.getElementById("plBranchComparisonTableContainer").style.display = 'none';
            document.getElementById("chartPLBranchComparisonContainer").style.display = 'none';
        } else {
            plBranchSelect.disabled = false;
            document.getElementById("plOwnerKPIsGrid").style.display = 'grid';
            document.getElementById("plBranchComparisonCards").style.display = 'grid';
            document.getElementById("plBranchComparisonTableContainer").style.display = 'block';
            document.getElementById("chartPLBranchComparisonContainer").style.display = 'block';
        }

        const dateFilter = dateFilterSelect.value;
        const start = plStartDate.value;
        const end = plEndDate.value;
        const branch = plBranchSelect.value;

        try {
            const url = `${API_BASE}/api/pl/live-summary?dateFilter=${dateFilter}&startDate=${start}&endDate=${end}&branch=${branch}`;
            const res = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`,
                    "X-User-Role": role
                }
            });
            if (res.ok) {
                livePLData = await res.json();
                renderPLUI(livePLData);
            }
        } catch (e) {
            console.error("Failed to query live P&L data:", e);
        }
    }

    // Render Metrics and Charts
    function renderPLUI(data) {
        if (!data) return;

        const s = data.summary;
        const isProfit = s.netProfit >= 0;

        // 1. KPI Cards
        document.getElementById("pl-kpi-total-sales").textContent = formatCurrency(s.totalSales);
        if (document.getElementById("pl-kpi-cash-received")) document.getElementById("pl-kpi-cash-received").textContent = formatCurrency(s.cashInHand || 0);
        if (document.getElementById("pl-kpi-online-received")) document.getElementById("pl-kpi-online-received").textContent = formatCurrency(s.bankBalance || 0);
        if (document.getElementById("pl-kpi-daily-expense")) document.getElementById("pl-kpi-daily-expense").textContent = formatCurrency(s.todayExpense || 0);
        document.getElementById("pl-kpi-total-expenses").textContent = formatCurrency(s.totalExpenses);
        
        const netProfitEl = document.getElementById("pl-kpi-net-profit");
        netProfitEl.textContent = formatCurrency(s.netProfit);
        netProfitEl.style.color = isProfit ? "var(--success)" : "var(--danger)";
        
        document.getElementById("pl-kpi-profit-margin").textContent = `Margin: ${s.profitMargin.toFixed(1)}%`;
        
        document.getElementById("pl-kpi-gross-profit").textContent = formatCurrency(s.grossProfit);
        document.getElementById("pl-kpi-gross-margin").textContent = `Margin: ${s.grossMargin.toFixed(1)}%`;

        document.getElementById("pl-kpi-yearly-revenue").textContent = formatCurrency(s.yearlyRevenue || 0);
        document.getElementById("pl-kpi-monthly-expense").textContent = formatCurrency(s.monthlyExpense || 0);

        // Balance sheet KPIs
        document.getElementById("pl-kpi-gst-collected").textContent = formatCurrency(s.totalGstCollected);
        document.getElementById("pl-kpi-gst-paid").textContent = formatCurrency(s.totalGstPaid);
        document.getElementById("pl-kpi-cash-in-hand").textContent = formatCurrency(s.cashInHand);
        document.getElementById("pl-kpi-bank-balance").textContent = formatCurrency(s.bankBalance);
        document.getElementById("pl-kpi-customer-outstanding").textContent = formatCurrency(s.outstandingCustomer);
        document.getElementById("pl-kpi-supplier-outstanding").textContent = formatCurrency(s.outstandingSupplier);

        // Styling the profit card wrapper
        const pCard = document.getElementById("plNetProfitKpiCard");
        if (pCard) {
            pCard.style.borderLeft = `4px solid ${isProfit ? 'var(--success)' : 'var(--danger)'}`;
            pCard.style.background = isProfit ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
        }

        // 2. Combined P&L Particulars
        document.getElementById("pl-det-gross-sales").textContent = formatCurrency(s.totalSales);
        document.getElementById("pl-det-sales-returns").textContent = formatCurrency(data.salesReturns);
        document.getElementById("pl-det-net-sales").textContent = formatCurrency(data.netSales);
        document.getElementById("pl-det-cogs").textContent = formatCurrency(data.cogs);
        document.getElementById("pl-det-gross-profit").textContent = formatCurrency(s.grossProfit);
        document.getElementById("pl-det-opex").textContent = formatCurrency(s.totalExpenses);
        
        const rowProfit = document.getElementById("pl-det-net-profit");
        rowProfit.textContent = formatCurrency(s.netProfit);
        rowProfit.style.color = isProfit ? "var(--success)" : "var(--danger)";
        
        const pctGross = (s.totalSales / data.netSales) * 100;
        const pctReturns = (data.salesReturns / data.netSales) * 100;
        const pctCogs = (data.cogs / data.netSales) * 100;
        const pctGrossProfit = (s.grossProfit / data.netSales) * 100;
        const pctOpex = (s.totalExpenses / data.netSales) * 100;
        const pctNetProfit = (s.netProfit / data.netSales) * 100;

        document.getElementById("pl-pct-gross-sales").textContent = `${pctGross.toFixed(1)}%`;
        document.getElementById("pl-pct-sales-returns").textContent = `${pctReturns.toFixed(1)}%`;
        document.getElementById("pl-pct-cogs").textContent = `${pctCogs.toFixed(1)}%`;
        document.getElementById("pl-pct-gross-profit").textContent = `${pctGrossProfit.toFixed(1)}%`;
        document.getElementById("pl-pct-opex").textContent = `${pctOpex.toFixed(1)}%`;
        
        const plPctNetProfit = document.getElementById("pl-pct-net-profit");
        plPctNetProfit.textContent = `${pctNetProfit.toFixed(1)}%`;
        plPctNetProfit.style.color = isProfit ? "var(--success)" : "var(--danger)";

        // Style the row
        const rowWrapper = document.getElementById("plStatementNetProfitRow");
        if (rowWrapper) {
            rowWrapper.style.background = isProfit ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
        }

        // 3. Branch cards (owner views)
        const b = data.branchDetails;
        if (b) {
            // Vesu
            document.getElementById("pl-card-vesu-today-sales").textContent = formatCurrency(b.VESU.todaySales);
            document.getElementById("pl-card-vesu-today-profit").textContent = formatCurrency(b.VESU.todayProfit);
            document.getElementById("pl-card-vesu-today-profit").style.color = b.VESU.todayProfit >= 0 ? "var(--success)" : "var(--danger)";
            document.getElementById("pl-card-vesu-monthly-sales").textContent = formatCurrency(b.VESU.monthlySales);
            document.getElementById("pl-card-vesu-monthly-profit").textContent = formatCurrency(b.VESU.monthlyProfit);
            
            // Adajan
            document.getElementById("pl-card-adajan-today-sales").textContent = formatCurrency(b.ADAJAN.todaySales);
            document.getElementById("pl-card-adajan-today-profit").textContent = formatCurrency(b.ADAJAN.todayProfit);
            document.getElementById("pl-card-adajan-today-profit").style.color = b.ADAJAN.todayProfit >= 0 ? "var(--success)" : "var(--danger)";
            document.getElementById("pl-card-adajan-monthly-sales").textContent = formatCurrency(b.ADAJAN.monthlySales);
            document.getElementById("pl-card-adajan-monthly-profit").textContent = formatCurrency(b.ADAJAN.monthlyProfit);

            // CT Light
            document.getElementById("pl-card-ctlight-today-sales").textContent = formatCurrency(b["CT LIGHT"].todaySales);
            document.getElementById("pl-card-ctlight-today-profit").textContent = formatCurrency(b["CT LIGHT"].todayProfit);
            document.getElementById("pl-card-ctlight-today-profit").style.color = b["CT LIGHT"].todayProfit >= 0 ? "var(--success)" : "var(--danger)";
            document.getElementById("pl-card-ctlight-monthly-sales").textContent = formatCurrency(b["CT LIGHT"].monthlySales);
            document.getElementById("pl-card-ctlight-monthly-profit").textContent = formatCurrency(b["CT LIGHT"].monthlyProfit);
        }

        // 4. Revenue channels list
        const revTbody = document.querySelector("#tablePLRevenueSources tbody");
        if (revTbody) {
            revTbody.innerHTML = "";
            let totalRevenueSum = Object.values(data.revenueSources).reduce((x, y) => x + y, 0);

            Object.entries(data.revenueSources).forEach(([source, val]) => {
                const tr = document.createElement("tr");
                const pct = totalRevenueSum > 0 ? (val / totalRevenueSum) * 100 : 0;
                tr.innerHTML = `
                    <td><strong>${source}</strong></td>
                    <td style="text-align:right; font-weight:700;">${formatCurrency(val)}</td>
                    <td style="text-align:right; color:var(--orange-primary);">${pct.toFixed(1)}%</td>
                `;
                revTbody.appendChild(tr);
            });
        }

        // 5. Expense categories list
        const expTbody = document.querySelector("#tablePLExpenseCategories tbody");
        if (expTbody) {
            expTbody.innerHTML = "";
            let totalExpSum = Object.values(data.expenseCategories).reduce((x, y) => x + y, 0);

            Object.entries(data.expenseCategories).forEach(([cat, val]) => {
                const tr = document.createElement("tr");
                const pct = totalExpSum > 0 ? (val / totalExpSum) * 100 : 0;
                tr.innerHTML = `
                    <td><strong>${cat}</strong></td>
                    <td style="text-align:right; font-weight:700; color:var(--danger);">${formatCurrency(val)}</td>
                    <td style="text-align:right;">${pct.toFixed(1)}%</td>
                `;
                expTbody.appendChild(tr);
            });
        }

        // 6. Multi-Branch Comparative table (owner only)
        const cmpTbody = document.querySelector("#tablePLBranchComparisonMatrix tbody");
        if (cmpTbody && b) {
            cmpTbody.innerHTML = "";
            Object.keys(b).forEach(bKey => {
                const bDetails = b[bKey];
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${bKey} Cafe</strong></td>
                    <td style="text-align:right;">${formatCurrency(bDetails.todaySales)}</td>
                    <td style="text-align:right; font-weight:700;">${formatCurrency(bDetails.monthlySales)}</td>
                    <td style="text-align:right; font-weight:700; color:var(--success);">${formatCurrency(bDetails.monthlyProfit)}</td>
                    <td style="text-align:right; color:var(--danger);">${formatCurrency(bDetails.monthlyExpense)}</td>
                    <td style="text-align:right; font-weight:700; color:var(--orange-primary);">${bDetails.margin.toFixed(1)}%</td>
                    <td style="text-align:right;"><span class="pill-badge pill-badge-success">+${bDetails.growth.toFixed(1)}%</span></td>
                `;
                cmpTbody.appendChild(tr);
            });
        }

        // 7. Performance KPIs
        document.getElementById("pl-kpi-labour-pct").textContent = `${(s.labourCostPct || 0).toFixed(1)}%`;
        document.getElementById("pl-kpi-food-pct").textContent = `${(s.foodCostPct || 0).toFixed(1)}%`;
        document.getElementById("pl-kpi-opex-ratio").textContent = `${(s.expenseRatio || 0).toFixed(1)}%`;
        document.getElementById("pl-kpi-inventory-turnover").textContent = `${(s.inventoryTurnover || 0).toFixed(1)}x`;
        document.getElementById("pl-kpi-avg-order-val").textContent = formatCurrency(s.avgOrderValue || 0);
        document.getElementById("pl-kpi-avg-daily-sales").textContent = formatCurrency(s.avgDailySales || 0);
        document.getElementById("pl-kpi-working-capital").textContent = formatCurrency(s.workingCapital || 0);
        
        const growthEl = document.getElementById("pl-kpi-growth-pct");
        if (growthEl) {
            const growth = s.growthPct || 0;
            growthEl.textContent = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
            growthEl.style.color = growth >= 0 ? "var(--success)" : "var(--danger)";
        }

        // 8. Render Charts
        renderPLCharts(data.charts, b);
    }

    function transactionsCountDays() {
        const val = dateFilterSelect.value;
        if (val === 'today') return 1;
        if (val === 'yesterday') return 1;
        if (val === 'last_7') return 7;
        if (val === 'last_30' || val === 'this_month' || val === 'last_month') return 30;
        if (val === 'this_quarter') return 90;
        if (val === 'this_year') return 365;
        return 30; // fallback
    }

    function renderPLCharts(chartsData, branchDetails) {
        // Chart 1: Daily Revenue & Profits
        const ctxDaily = document.getElementById("chartPLDailySales").getContext("2d");
        if (chartDailySales) chartDailySales.destroy();
        chartDailySales = new Chart(ctxDaily, {
            type: 'line',
            data: {
                labels: chartsData.labels,
                datasets: [
                    {
                        label: 'Sales Revenue (₹)',
                        data: chartsData.sales,
                        borderColor: '#f26c25', // Orange
                        backgroundColor: 'rgba(242, 108, 37, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Net Profit (₹)',
                        data: chartsData.profit,
                        borderColor: '#10b981', // Green
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });

        // Chart 2: Expenses Share Pie
        const ctxExp = document.getElementById("chartPLExpensesShare").getContext("2d");
        if (chartExpensesShare) chartExpensesShare.destroy();
        chartExpensesShare = new Chart(ctxExp, {
            type: 'doughnut',
            data: {
                labels: chartsData.expenseNames,
                datasets: [{
                    data: chartsData.expenseValues,
                    backgroundColor: [
                        '#ef4444', '#f26c25', '#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#a855f7'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } }
            }
        });

        // Chart 3: Revenue channels share
        const ctxRev = document.getElementById("chartPLRevenueChannels").getContext("2d");
        if (chartRevenueChannels) chartRevenueChannels.destroy();
        chartRevenueChannels = new Chart(ctxRev, {
            type: 'pie',
            data: {
                labels: chartsData.revenueSourcesNames,
                datasets: [{
                    data: chartsData.revenueSourcesValues,
                    backgroundColor: [
                        '#10b981', '#3b82f6', '#f26c25', '#9f7c46', '#eab308', '#6366f1'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } }
            }
        });

        // Chart 4: Multi-Branch comparison bar
        const ctxCmp = document.getElementById("chartPLBranchComparison");
        if (ctxCmp && branchDetails) {
            const ctx = ctxCmp.getContext("2d");
            if (chartBranchComparison) chartBranchComparison.destroy();

            const branches = Object.keys(branchDetails);
            const salesData = branches.map(k => branchDetails[k].monthlySales);
            const profitsData = branches.map(k => branchDetails[k].monthlyProfit);

            chartBranchComparison = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: branches,
                    datasets: [
                        {
                            label: 'Monthly Revenue (₹)',
                            data: salesData,
                            backgroundColor: 'rgba(242, 108, 37, 0.85)'
                        },
                        {
                            label: 'Monthly Net Profit (₹)',
                            data: profitsData,
                            backgroundColor: 'rgba(16, 185, 129, 0.85)'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    }

    // PDF, Excel, and CSV Exports
    // Safe toast notification helper
    function triggerToast(msg, type = "success") {
        if (typeof window.showToast === "function") {
            window.showToast(msg);
            return;
        }
        let toast = document.getElementById("posToast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "posToast";
            toast.style.cssText = "position:fixed; bottom:20px; right:20px; background:var(--accent-green); color:#fff; padding:12px 24px; border-radius:8px; z-index:99999; box-shadow:var(--shadow-lg); font-size:0.85rem; font-weight:700; transition:all 0.3s cubic-bezier(0.16, 1, 0.3, 1); opacity:0; pointer-events:none; transform:translateY(10px);";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.background = type === "danger" ? "var(--danger)" : "var(--accent-green)";
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
        }, 3000);
    }

    // PDF, Excel, and CSV Exports calling backend APIs directly
    window.exportPLReport = async function(format) {
        const btn = document.querySelector(`button[onclick="window.exportPLReport('${format}')"]`);
        let originalHTML = "";
        if (btn) {
            originalHTML = btn.innerHTML;
            btn.disabled = true;
            if (!document.getElementById("pl-export-spin-style")) {
                const style = document.createElement("style");
                style.id = "pl-export-spin-style";
                style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
                document.head.appendChild(style);
            }
            btn.innerHTML = `<span style="display:inline-block; width:12px; height:12px; border:2px solid rgba(255,255,255,0.3); border-radius:50%; border-top-color:#fff; animation:spin 1s ease-in-out infinite; margin-right:6px; vertical-align:middle;"></span> Exporting...`;
        }

        const period = dateFilterSelect.value;
        const start = plStartDate.value;
        const end = plEndDate.value;
        const branch = plBranchSelect.value;

        try {
            const url = `${API_BASE}/api/export/${format}?dateFilter=${period}&startDate=${start}&endDate=${end}&branch=${branch}`;
            const res = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`,
                    "X-User-Role": localStorage.getItem("bk_user_role") || "owner"
                }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const errMsg = errData.error || "No data available for export.";
                triggerToast(errMsg, "danger");
                return;
            }

            const blob = await res.blob();
            const contentDisposition = res.headers.get("content-disposition");
            let filename = `Branch-${branch}_PnL_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
            triggerToast("Report downloaded successfully.");
        } catch (e) {
            console.error("Export operation failed:", e);
            triggerToast("Export process encountered an error.", "danger");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        }
    };

    // Nav-click event activation binding dispatcher
    window.renderPLEventScreen = async function(target) {
        if (target === 'pl-management-dashboard') {
            await refreshPLDashboard();
        }
    };

    document.querySelectorAll(".nav-item").forEach(item => {
        const target = item.getAttribute("data-target");
        if (target === 'pl-management-dashboard') {
            item.addEventListener("click", () => {
                window.renderPLEventScreen(target);
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
                    if (target === 'pl-management-dashboard') {
                        window.renderPLEventScreen(target);
                    }
                }
            }, 200);
        });
    });

    // Listen for custom event from app.js to update P&L instantly on order placed
    window.addEventListener('bk_order_placed', () => {
        const activeItem = document.querySelector(".nav-item.active");
        if (activeItem && activeItem.getAttribute("data-target") === 'pl-management-dashboard') {
            refreshPLDashboard();
        }
    });
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _initThisModule);
    } else {
        _initThisModule();
    }
}
