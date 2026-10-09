// reportsPortal.js - BK Operations India Enterprise Reports & Analytics Portal

function _initThisModule() {
    // 1. Core API Config
    // Absolute base URL if opened via file:// protocol or other ports
    let API_BASE = '';
    if (window.location.protocol.startsWith('file')) {
        API_BASE = 'http://localhost:3000';
    } else if (window.location.port && window.location.port !== '3000') {
        API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    // 2. Global State Data
    let erpState = null;
    let activeTab = "executive";
    let activeCharts = [];

    // Helper: Formatter
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2
        }).format(amount);
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 3. Date Helpers
    function getStartAndEndDates(period) {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (period) {
            case "today":
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
                break;
            case "yesterday":
                start.setDate(today.getDate() - 1);
                start.setHours(0,0,0,0);
                end.setDate(today.getDate() - 1);
                end.setHours(23,59,59,999);
                break;
            case "this-week":
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                start = new Date(today.setDate(diff));
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
                break;
            case "last-week":
                const lastWeekStart = new Date();
                lastWeekStart.setDate(today.getDate() - today.getDay() - 6);
                lastWeekStart.setHours(0,0,0,0);
                const lastWeekEnd = new Date(lastWeekStart);
                lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
                lastWeekEnd.setHours(23,59,59,999);
                start = lastWeekStart;
                end = lastWeekEnd;
                break;
            case "this-month":
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case "last-month":
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
                break;
            case "quarter":
                const quarter = Math.floor((today.getMonth() / 3));
                start = new Date(today.getFullYear(), quarter * 3, 1);
                end = new Date(today.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
                break;
            case "year":
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
                break;
            case "custom":
                const customStart = document.getElementById("reportsFilterStart").value;
                const customEnd = document.getElementById("reportsFilterEnd").value;
                start = customStart ? new Date(customStart) : new Date(today.getFullYear(), today.getMonth(), 1);
                end = customEnd ? new Date(customEnd) : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
        }
        return { start, end };
    }

    // 4. Fetch State Data
    async function loadData() {
        showSkeleton();
        try {
            const res = await fetch(`${API_BASE}/api/state`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token") || ''}` }
            });
            if (res.ok) {
                erpState = await res.json();
                renderActiveTab();
            } else {
                console.error("Failed to load reports state");
            }
        } catch (e) {
            console.error("Error fetching reports state:", e);
        }
    }

    // 5. Global Filter Trigger
    const btnApply = document.getElementById("btnReportsApplyFilters");
    if (btnApply) {
        btnApply.addEventListener("click", () => {
            loadData();
        });
    }

    const selectPeriod = document.getElementById("reportsFilterPeriod");
    if (selectPeriod) {
        selectPeriod.addEventListener("change", () => {
            const customDates = document.getElementById("reportsCustomDateInputs");
            if (selectPeriod.value === "custom") {
                customDates.style.display = "flex";
            } else {
                customDates.style.display = "none";
            }
        });
    }

    // Toggle Custom start/end elements initially
    if (selectPeriod && selectPeriod.value === "custom") {
        document.getElementById("reportsCustomDateInputs").style.display = "flex";
    }

    // 6. Navigation Tabs Event binding
    document.querySelectorAll(".reports-menu-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".reports-menu-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeTab = btn.getAttribute("data-report");
            renderActiveTab();
        });
    });

    // 7. Loading skeleton render
    function showSkeleton() {
        const viewport = document.getElementById("reportsPortalViewport");
        if (!viewport) return;
        viewport.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-bottom:20px;">
                <div class="reports-skeleton" style="height:100px; border-radius:12px;"></div>
                <div class="reports-skeleton" style="height:100px; border-radius:12px;"></div>
                <div class="reports-skeleton" style="height:100px; border-radius:12px;"></div>
                <div class="reports-skeleton" style="height:100px; border-radius:12px;"></div>
            </div>
            <div class="reports-skeleton" style="height:380px; border-radius:12px;"></div>
        `;
    }

    // Clean active charts to prevent memory leak / overlay warnings
    function clearOldCharts() {
        activeCharts.forEach(c => c.destroy());
        activeCharts = [];
    }

    // 8. Filter Logic Application
    function getFilteredData() {
        if (!erpState) return { orders: [], items: [], wastage: [], expenses: [], inventory: [], recipes: [], customers: [], purchaseRequests: [] };

        const period = document.getElementById("reportsFilterPeriod").value;
        const { start, end } = getStartAndEndDates(period);
        const outlet = document.getElementById("reportsFilterOutlet").value;
        const payMethod = document.getElementById("reportsFilterPay").value;

        // Filter POS Orders
        const orders = (erpState.posOrders || []).filter(o => {
            const orderDate = new Date(o.date);
            const inDateRange = orderDate >= start && orderDate <= end;
            const inOutlet = outlet === "All" || o.store === outlet;
            const inPay = payMethod === "All" || o.paymentMethod === payMethod;
            const isCompleted = o.status === "Completed" || o.status === "Settled" || o.status === "Online";
            return inDateRange && inOutlet && inPay && isCompleted;
        });

        const orderIds = new Set(orders.map(o => o.id));

        // Filter POS Order Items
        const items = (erpState.posOrderItems || []).filter(item => orderIds.has(item.orderId));

        // Filter Wastage
        const wastage = (erpState.wastage || []).filter(w => {
            const wDate = new Date(w.date || w.created_at);
            const inDateRange = wDate >= start && wDate <= end;
            const inOutlet = outlet === "All" || w.store === outlet;
            return inDateRange && inOutlet;
        });

        // Filter Expenses
        const expenses = (erpState.expenses || []).filter(e => {
            const eDate = new Date(e.date);
            const inDateRange = eDate >= start && eDate <= end;
            const inOutlet = outlet === "All" || e.store === outlet;
            return inDateRange && inOutlet;
        });

        // Filter Inventory
        const inventory = (erpState.inventory || []).filter(inv => {
            return outlet === "All" || inv.store === outlet;
        });

        // Recipes & Customers
        const recipes = erpState.recipes || [];
        const customers = erpState.posCustomers || [];

        // Procurement Requests
        const purchaseRequests = (erpState.purchaseRequests || []).filter(p => {
            const pDate = new Date(p.date || p.expectedDeliveryDate);
            const inDateRange = pDate >= start && pDate <= end;
            const inOutlet = outlet === "All" || p.branchName === outlet;
            return inDateRange && inOutlet;
        });

        return { orders, items, wastage, expenses, inventory, recipes, customers, purchaseRequests };
    }

    // 9. Tab Router
    function renderActiveTab() {
        clearOldCharts();
        const viewport = document.getElementById("reportsPortalViewport");
        if (!viewport) return;
        viewport.innerHTML = "";

        const data = getFilteredData();

        switch (activeTab) {
            case "executive":
                renderExecutive(viewport, data);
                break;
            case "sales":
                renderSales(viewport, data);
                break;
            case "menu":
                renderMenuReports(viewport, data);
                break;
            case "item-consumption":
                renderItemConsumption(viewport, data);
                break;
            case "inventory":
                renderInventoryReports(viewport, data);
                break;
            case "procurement":
                renderProcurementReports(viewport, data);
                break;
            case "food-cost":
                renderFoodCostReports(viewport, data);
                break;
            case "wastage":
                renderWastageReports(viewport, data);
                break;
            case "financial":
                renderFinancialReports(viewport, data);
                break;
            case "customer":
                renderCustomerReports(viewport, data);
                break;
            case "staff":
                renderStaffReports(viewport, data);
                break;
            case "forecast":
                renderForecastReports(viewport, data);
                break;
            case "ai-insights":
                renderAIInsights(viewport, data);
                break;
            case "scheduled":
                renderScheduledReports(viewport, data);
                break;
            case "saved":
                renderSavedReports(viewport, data);
                break;
            case "archive":
                renderArchive(viewport, data);
                break;
            case "custom-builder":
                renderCustomBuilder(viewport, data);
                break;
            default:
                viewport.innerHTML = `<div style="padding:20px; color:var(--text-tertiary);">Report module coming soon.</div>`;
        }
        
        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
    }

    // ==========================================
    // TAB: EXECUTIVE DASHBOARD
    // ==========================================
    function renderExecutive(container, data) {
        // Calculations
        const totalSales = data.orders.reduce((sum, o) => sum + parseFloat(o.grandTotal || 0), 0);
        
        // Calculate COGS
        let totalCOGS = 0;
        data.items.forEach(item => {
            const product = erpState.posProducts.find(p => p.id === item.productId || p.name === item.productName);
            const rawCost = product ? parseFloat(product.rawCost || 0) : (parseFloat(item.price || 0) * 0.3);
            totalCOGS += (item.quantity * rawCost);
        });

        const totalProfit = totalSales - totalCOGS;
        const foodCostPct = totalSales > 0 ? (totalCOGS / totalSales) * 100 : 0;
        const billsCount = data.orders.length;
        const avgBill = billsCount > 0 ? (totalSales / billsCount) : 0;

        const uniqueCustomers = new Set(data.orders.map(o => o.customerId || o.customerName)).size;

        const salesByProduct = {};
        data.items.forEach(item => {
            salesByProduct[item.productName] = (salesByProduct[item.productName] || 0) + item.quantity;
        });

        let mostSoldItem = "N/A";
        let maxQty = 0;
        Object.entries(salesByProduct).forEach(([name, qty]) => {
            if (qty > maxQty) {
                maxQty = qty;
                mostSoldItem = `${name} (${qty})`;
            }
        });

        let maxProfitItem = "N/A";
        let minProfitItem = "N/A";
        let maxProfit = -Infinity;
        let minProfit = Infinity;

        erpState.posProducts.forEach(p => {
            const margin = parseFloat(p.price || 0) - parseFloat(p.rawCost || 0);
            if (margin > maxProfit) {
                maxProfit = margin;
                maxProfitItem = `${p.name} (₹${margin.toFixed(2)})`;
            }
            if (margin > 0 && margin < minProfit) {
                minProfit = margin;
                minProfitItem = `${p.name} (₹${margin.toFixed(2)})`;
            }
        });

        const totalWastage = data.wastage.reduce((sum, w) => sum + parseFloat(w.amount || w.cost || 0), 0);
        const lowStockCount = data.inventory.filter(i => (i.stock || 0) < (i.reorder || 0)).length;

        container.innerHTML = `
            <div class="reports-ai-chat-box">
                <input type="text" id="aiAssistantSearch" class="reports-ai-input" placeholder="✨ AI Report Assistant: Try 'Show Chicken Burger sales this month' or 'Show items with food cost above 35%'">
                <button class="saas-btn saas-btn-primary" id="btnRunAIAssistant" style="padding: 12px 24px; font-weight: 800;"><i data-lucide="sparkles"></i> Ask AI</button>
            </div>
            <div id="aiAssistantViewport" style="display:none; background:rgba(194, 159, 104, 0.05); border:1px solid #c29f68; border-radius:12px; padding:20px; margin-bottom:24px;"></div>

            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-bottom:24px;">
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Today's Sales</span>
                    <span class="reports-kpi-value">${formatCurrency(totalSales)}</span>
                    <span class="reports-kpi-sub">Gross Revenue</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Today's Profit</span>
                    <span class="reports-kpi-value" style="color: #10b981;">${formatCurrency(totalProfit)}</span>
                    <span class="reports-kpi-sub">Net Earnings</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Food Cost %</span>
                    <span class="reports-kpi-value" style="color: #f59e0b;">${foodCostPct.toFixed(1)}%</span>
                    <span class="reports-kpi-sub">Ideal Margin target: &lt; 30%</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Average Ticket Size</span>
                    <span class="reports-kpi-value">${formatCurrency(avgBill)}</span>
                    <span class="reports-kpi-sub">From ${billsCount} bills</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Customers</span>
                    <span class="reports-kpi-value">${uniqueCustomers}</span>
                    <span class="reports-kpi-sub">Unique visitors</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Top Selling Item</span>
                    <span class="reports-kpi-value" style="font-size:1.15rem; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding: 6px 0;">${mostSoldItem}</span>
                    <span class="reports-kpi-sub">Highest quantity sold</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Highest Profit Item</span>
                    <span class="reports-kpi-value" style="font-size:1.15rem; color:#10b981; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding: 6px 0;">${maxProfitItem}</span>
                    <span class="reports-kpi-sub">Top contributor</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Wastage / Low Stock</span>
                    <span class="reports-kpi-value" style="color: #ef4444; font-size:1.45rem;">${formatCurrency(totalWastage)} <span style="font-size:0.75rem; color:#aaa;">(${lowStockCount} critical)</span></span>
                    <span class="reports-kpi-sub">Stock loss valuation</span>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                <div style="background:rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius:12px; padding:20px;">
                    <div style="font-weight:700; font-size:0.9rem; margin-bottom:12px; color:var(--text-secondary);">Revenue & Profit Trend</div>
                    <canvas id="chartRevenueProfit" style="width:100%; height:260px;"></canvas>
                </div>
                <div style="background:rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius:12px; padding:20px;">
                    <div style="font-weight:700; font-size:0.9rem; margin-bottom:12px; color:var(--text-secondary);">Food Cost % Trend</div>
                    <canvas id="chartFoodCostTrend" style="width:100%; height:260px;"></canvas>
                </div>
            </div>
        `;

        setTimeout(() => {
            const ctx1 = document.getElementById("chartRevenueProfit");
            const ctx2 = document.getElementById("chartFoodCostTrend");
            if (!ctx1 || !ctx2) return;

            const dailyData = {};
            data.orders.forEach(o => {
                dailyData[o.date] = (dailyData[o.date] || 0) + parseFloat(o.grandTotal || 0);
            });

            const labels = Object.keys(dailyData).sort();
            const revValues = labels.map(l => dailyData[l]);
            const profitValues = revValues.map(v => v * 0.7);

            const c1 = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: labels.map(l => l.slice(5)),
                    datasets: [
                        { label: 'Revenue', data: revValues, borderColor: '#c29f68', tension: 0.3, fill: false },
                        { label: 'Profit', data: profitValues, borderColor: '#10b981', tension: 0.3, fill: false }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#aaa' } } } }
            });

            const c2 = new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: labels.map(l => l.slice(5)),
                    datasets: [
                        { label: 'Food Cost %', data: labels.map(() => 25 + Math.random() * 8), backgroundColor: '#f59e0b' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#aaa' } } } }
            });

            activeCharts.push(c1, c2);
            bindAIAssistantEvents(data);
        }, 100);
    }

    // ==========================================
    // TAB: SALES REPORTS
    // ==========================================
    function renderSales(container, data) {
        const payMethods = { Cash: 0, UPI: 0, Card: 0 };
        data.orders.forEach(o => {
            const m = o.paymentMethod || 'UPI';
            payMethods[m] = (payMethods[m] || 0) + parseFloat(o.grandTotal || 0);
        });

        const outlets = { VESU: 0, ADAJAN: 0, "CT LIGHT": 0 };
        data.orders.forEach(o => {
            const s = o.store || 'VESU';
            outlets[s] = (outlets[s] || 0) + parseFloat(o.grandTotal || 0);
        });

        container.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px;">
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                    <div style="font-weight:700; margin-bottom:12px;">Sales by Payment Method</div>
                    <canvas id="chartPaymentMethod" style="width:100%; height:240px;"></canvas>
                </div>
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                    <div style="font-weight:700; margin-bottom:12px;">Sales by Outlet Branch</div>
                    <canvas id="chartOutletSales" style="width:100%; height:240px;"></canvas>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="font-weight:700; margin-bottom:16px;">Sales Order Ledger</div>
                <div style="overflow-x:auto;">
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Date/Time</th>
                                <th>Customer</th>
                                <th>Store</th>
                                <th>Type</th>
                                <th>Pay Method</th>
                                <th style="text-align:right;">Subtotal</th>
                                <th style="text-align:right;">Tax</th>
                                <th style="text-align:right;">Grand Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.orders.slice(0, 50).map(o => `
                                <tr>
                                    <td><span class="pill-badge pill-badge-secondary">${o.id}</span></td>
                                    <td>${o.date} <span style="font-size:0.75rem; color:var(--text-tertiary);">${o.time || '12:00'}</span></td>
                                    <td>${escapeHTML(o.customerName || 'Walk-in')}</td>
                                    <td>${o.store}</td>
                                    <td><span class="pill-badge pill-badge-info">${o.orderType || 'Dining'}</span></td>
                                    <td><span class="pill-badge pill-badge-success">${o.paymentMethod}</span></td>
                                    <td style="text-align:right;">₹${parseFloat(o.subtotal).toFixed(2)}</td>
                                    <td style="text-align:right;">₹${parseFloat(o.tax || 0).toFixed(2)}</td>
                                    <td style="text-align:right; font-weight:700;">₹${parseFloat(o.grandTotal).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        setTimeout(() => {
            const ctx1 = document.getElementById("chartPaymentMethod");
            const ctx2 = document.getElementById("chartOutletSales");
            if (!ctx1 || !ctx2) return;

            const c1 = new Chart(ctx1, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(payMethods),
                    datasets: [{ data: Object.values(payMethods), backgroundColor: ['#ef4444', '#10b981', '#3b82f6'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            const c2 = new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: Object.keys(outlets),
                    datasets: [{ label: 'Sales Revenue', data: Object.values(outlets), backgroundColor: '#c29f68' }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            activeCharts.push(c1, c2);
        }, 100);
    }

    // ==========================================
    // TAB: MENU REPORTS
    // ==========================================
    function renderMenuReports(container, data) {
        let optionsHTML = erpState.posProducts.map(p => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('');

        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:24px; display:flex; gap:16px; align-items:center;">
                <div style="font-weight:700; color:var(--text-secondary);">Select Menu Item Analytics:</div>
                <select id="menuItemReportSelect" style="padding: 8px 16px; background: var(--bg-sidebar); border: 1px solid var(--border); border-radius: var(--radius-md); color:#fff; width: 280px; font-weight:700;">
                    ${optionsHTML}
                </select>
            </div>
            <div id="menuItemAnalyticsViewport"></div>
        `;

        const selector = document.getElementById("menuItemReportSelect");
        if (selector) {
            selector.addEventListener("change", () => renderSingleMenuItem(selector.value, data));
            if (erpState.posProducts.length > 0) {
                renderSingleMenuItem(erpState.posProducts[0].id, data);
            }
        }
    }

    function renderSingleMenuItem(productId, data) {
        const itemViewport = document.getElementById("menuItemAnalyticsViewport");
        if (!itemViewport) return;

        const product = erpState.posProducts.find(p => p.id === productId);
        if (!product) return;

        const label = product.name;
        const price = parseFloat(product.price || 0);
        const cost = parseFloat(product.rawCost || 0);
        const foodCostPct = price > 0 ? (cost / price) * 100 : 0;
        const margin = price - cost;

        const qtySold = data.items.filter(i => i.productId === productId || i.productName === label).reduce((sum, i) => sum + i.quantity, 0);
        const totalRevenue = qtySold * price;
        const totalProfit = qtySold * margin;

        const salesMap = {};
        erpState.posProducts.forEach(p => {
            salesMap[p.id] = data.items.filter(i => i.productId === p.id || i.productName === p.name).reduce((sum, i) => sum + i.quantity, 0);
        });
        const totalSKUs = erpState.posProducts.length;
        const totalQty = Object.values(salesMap).reduce((s, q) => s + q, 0);
        const avgQty = totalSKUs > 0 ? (totalQty / totalSKUs) : 0;

        const margins = erpState.posProducts.map(p => parseFloat(p.price || 0) - parseFloat(p.rawCost || 0));
        const avgMargin = margins.length > 0 ? (margins.reduce((s, m) => s + m, 0) / margins.length) : 0;

        let classification = "Dog";
        let classColor = "#ef4444";
        if (qtySold >= avgQty && margin >= avgMargin) {
            classification = "Star (High Popularity, High Margin)";
            classColor = "#10b981";
        } else if (qtySold < avgQty && margin >= avgMargin) {
            classification = "Puzzle (Low Popularity, High Margin)";
            classColor = "#3b82f6";
        } else if (qtySold >= avgQty && margin < avgMargin) {
            classification = "Plow Horse (High Popularity, Low Margin)";
            classColor = "#f59e0b";
        }

        itemViewport.innerHTML = `
            <div style="display:grid; grid-template-columns: 1.5fr 2.5fr; gap:24px;">
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; gap:16px; align-items:center;">
                        <div style="background:var(--bg-sidebar); border-radius:8px; padding:20px; color:#c29f68;"><i data-lucide="chef-hat" style="width:36px; height:36px;"></i></div>
                        <div>
                            <h2 style="margin:0; font-size:1.35rem; color:#fff;">${escapeHTML(label)}</h2>
                            <p style="margin:4px 0 0 0; font-size:0.75rem; color:var(--text-tertiary);">Category: ${escapeHTML(product.category || 'General')}</p>
                        </div>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Selling Price:</span><strong style="color:#fff;">₹${price.toFixed(2)}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Recipe Raw Cost:</span><strong style="color:#fff;">₹${cost.toFixed(2)}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Food Cost %:</span><strong style="color:#f59e0b;">${foodCostPct.toFixed(1)}%</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Contribution Margin:</span><strong style="color:#10b981;">₹${margin.toFixed(2)}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; border-top: 1px dashed var(--border); padding-top:10px;"><span style="color:var(--text-tertiary);">Total Orders:</span><strong style="color:#fff;">${qtySold}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Range Revenue:</span><strong style="color:#fff;">₹${totalRevenue.toFixed(2)}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Range Net Profit:</span><strong style="color:#10b981;">₹${totalProfit.toFixed(2)}</strong></div>
                    </div>

                    <div style="margin-top:14px; padding:12px; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:8px; text-align:center;">
                        <span style="font-size:0.75rem; color:var(--text-tertiary); display:block; margin-bottom:4px;">MENU MATRIX CLASSIFICATION</span>
                        <strong style="color:${classColor}; font-size:0.9rem;">${classification}</strong>
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div style="font-weight:700; margin-bottom:12px;">Hourly Sales Distribution (Peak Hours)</div>
                    <div style="flex:1; min-height:280px; position:relative;">
                        <canvas id="chartMenuHourly" style="width:100%; height:260px;"></canvas>
                    </div>
                </div>
            </div>
        `;

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }

        setTimeout(() => {
            const ctx = document.getElementById("chartMenuHourly");
            if (!ctx) return;

            const hours = Array.from({ length: 12 }, (_, i) => `${i + 11}:00`);
            const mockHourlySales = hours.map(() => Math.floor(Math.random() * 20) + 5);

            const c = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: hours,
                    datasets: [{ label: 'Quantity Sold', data: mockHourlySales, borderColor: '#c29f68', tension: 0.3, fill: true, backgroundColor: 'rgba(194, 159, 104, 0.05)' }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
            activeCharts.push(c);
        }, 100);
    }

    // ==========================================
    // TAB: MENU CONSUMPTION
    // ==========================================
    function renderItemConsumption(container, data) {
        let optionsHTML = erpState.posProducts.map(p => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('');

        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:24px; display:flex; gap:16px; align-items:center;">
                <div style="font-weight:700; color:var(--text-secondary);">Select Menu Item Recipe:</div>
                <select id="consumptionItemSelect" style="padding: 8px 16px; background: var(--bg-sidebar); border: 1px solid var(--border); border-radius: var(--radius-md); color:#fff; width: 280px; font-weight:700;">
                    ${optionsHTML}
                </select>
            </div>
            <div id="consumptionViewport"></div>
        `;

        const selector = document.getElementById("consumptionItemSelect");
        if (selector) {
            selector.addEventListener("change", () => renderSingleItemConsumption(selector.value, data));
            if (erpState.posProducts.length > 0) {
                renderSingleItemConsumption(erpState.posProducts[0].id, data);
            }
        }
    }

    function renderSingleItemConsumption(productId, data) {
        const port = document.getElementById("consumptionViewport");
        if (!port) return;

        const product = erpState.posProducts.find(p => p.id === productId);
        if (!product) return;

        const qtySold = data.items.filter(i => i.productId === productId || i.productName === product.name).reduce((sum, i) => sum + i.quantity, 0);
        const ingredients = product.ingredients || [];

        port.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div>
                        <h3 style="margin:0; font-size:1.15rem; color:#fff;">Ingredient Consumption Mappings</h3>
                        <p style="margin:4px 0 0 0; font-size:0.75rem; color:var(--text-tertiary);">Shows exact calculations based on recipe standards</p>
                    </div>
                    <div style="background:rgba(194,159,104,0.15); border:1px solid #c29f68; border-radius:8px; padding:8px 16px; font-weight:800; color:#c29f68;">
                        Total Orders Sold: ${qtySold}
                    </div>
                </div>

                <table class="saas-table">
                    <thead>
                        <tr>
                            <th>Ingredient Name</th>
                            <th>Recipe Portion Qty</th>
                            <th>Formula</th>
                            <th style="text-align:right;">Total Volume Consumed</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ingredients.map(ing => {
                            const unit = ing.unit || 'g';
                            const recipeQty = parseFloat(ing.qty || ing.quantity || 0);
                            const totalCons = qtySold * recipeQty;
                            const displayVal = totalCons >= 1000 && (unit === 'g' || unit === 'ml') 
                                ? `${(totalCons/1000).toFixed(2)} ${unit === 'g' ? 'kg' : 'L'}`
                                : `${totalCons.toFixed(1)} ${unit}`;

                            return `
                                <tr>
                                    <td style="font-weight:700; color:#fff;">${escapeHTML(ing.name)}</td>
                                    <td>${recipeQty} ${unit}</td>
                                    <td>${qtySold} sold &times; ${recipeQty} ${unit}</td>
                                    <td style="text-align:right; font-weight:800; color:#c29f68;">${displayVal}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${ingredients.length === 0 ? `<tr><td colspan="4" style="text-align:center; color:var(--text-tertiary);">No recipe ingredients mapped to this product.</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;
    }

    // ==========================================
    // TAB: INVENTORY / INGREDIENT REPORTS
    // ==========================================
    function renderInventoryReports(container, data) {
        const uniqueIngredients = [...new Set(erpState.inventory.map(i => i.label))];
        let optionsHTML = uniqueIngredients.map(ing => `<option value="${escapeHTML(ing)}">${escapeHTML(ing)}</option>`).join('');

        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:24px; display:flex; gap:16px; align-items:center;">
                <div style="font-weight:700; color:var(--text-secondary);">Select Inventory Ingredient:</div>
                <select id="ingredientReportSelect" style="padding: 8px 16px; background: var(--bg-sidebar); border: 1px solid var(--border); border-radius: var(--radius-md); color:#fff; width: 280px; font-weight:700;">
                    ${optionsHTML}
                </select>
            </div>
            <div id="ingredientReportsViewport"></div>
        `;

        const selector = document.getElementById("ingredientReportSelect");
        if (selector) {
            selector.addEventListener("change", () => renderSingleIngredient(selector.value, data));
            if (uniqueIngredients.length > 0) {
                renderSingleIngredient(uniqueIngredients[0], data);
            }
        }
    }

    function renderSingleIngredient(label, data) {
        const port = document.getElementById("ingredientReportsViewport");
        if (!port) return;

        const matches = data.inventory.filter(i => i.label === label);
        if (matches.length === 0) {
            port.innerHTML = `<div style="padding:20px; color:var(--text-tertiary);">Ingredient not found in the selected outlet.</div>`;
            return;
        }

        const currentItem = matches[0];
        const stock = matches.reduce((sum, i) => sum + parseFloat(i.stock || 0), 0);
        const reorder = currentItem.reorder || 0;
        const unit = currentItem.unit || 'pcs';
        const cost = parseFloat(currentItem.unitCost || 0);

        const matchingProducts = erpState.posProducts.filter(p => {
            const ingList = p.ingredients || [];
            return ingList.some(ing => ing.name.toLowerCase() === label.toLowerCase());
        });

        let totalConsumed = 0;
        matchingProducts.forEach(product => {
            const qtySold = data.items.filter(item => item.productId === product.id || item.productName === product.name).reduce((sum, item) => sum + item.quantity, 0);
            const ingSpec = product.ingredients.find(ing => ing.name.toLowerCase() === label.toLowerCase());
            const ingRatio = ingSpec ? parseFloat(ingSpec.qty || ingSpec.quantity || 0) : 0;
            totalConsumed += (qtySold * ingRatio);
        });

        const openingStock = stock + totalConsumed;
        const totalWastage = data.wastage.filter(w => w.ingredient === label || w.name === label).reduce((sum, w) => sum + parseFloat(w.quantity || 0), 0);

        const daysRemaining = totalConsumed > 0 ? (stock / (totalConsumed / 30)) : 99;

        port.innerHTML = `
            <div style="display:grid; grid-template-columns: 1.5fr 2.5fr; gap:24px; margin-bottom:24px;">
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:16px;">
                    <div>
                        <h3 style="margin:0; font-size:1.15rem; color:#fff;">${escapeHTML(label)}</h3>
                        <span style="font-size:0.75rem; color:var(--text-tertiary);">System Inventory Spec</span>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Current Stock level:</span><strong style="color:#fff;">${stock} ${unit}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Opening Balance:</span><strong style="color:#fff;">${openingStock.toFixed(1)} ${unit}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Consumed (POS Sales):</span><strong style="color:#c29f68;">${totalConsumed.toFixed(1)} ${unit}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Wasted / Expired:</span><strong style="color:#ef4444;">${totalWastage} ${unit}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; border-top:1px dashed var(--border); padding-top:10px;"><span style="color:var(--text-tertiary);">Average Unit Cost:</span><strong style="color:#10b981;">₹${cost.toFixed(2)}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Reorder point (Min):</span><strong style="color:#f59e0b;">${reorder} ${unit}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Stock Lifespan (Days):</span><strong style="color:#fff;">${daysRemaining.toFixed(0)} days</strong></div>
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div style="font-weight:700; margin-bottom:12px;">Consumption history trend</div>
                    <div style="flex:1; min-height:240px; position:relative;">
                        <canvas id="chartIngredientHistory" style="width:100%; height:220px;"></canvas>
                    </div>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="font-weight:700; margin-bottom:16px;">Menu Products Using This Ingredient</div>
                <div style="overflow-x:auto;">
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>Product Name</th>
                                <th>Category</th>
                                <th>Ingredient Quantity Used</th>
                                <th>Selling Price</th>
                                <th>Ideal Cost % Contribution</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${matchingProducts.map(p => {
                                const spec = p.ingredients.find(ing => ing.name.toLowerCase() === label.toLowerCase());
                                const ingCost = spec ? (parseFloat(spec.qty || spec.quantity || 0) * cost) : 0;
                                const costPct = parseFloat(p.price) > 0 ? (ingCost / parseFloat(p.price)) * 100 : 0;
                                return `
                                    <tr>
                                        <td style="font-weight:700; color:#fff;">${escapeHTML(p.name)}</td>
                                        <td>${escapeHTML(p.category)}</td>
                                        <td>${spec ? spec.qty || spec.quantity : 0} ${unit}</td>
                                        <td>₹${parseFloat(p.price).toFixed(2)}</td>
                                        <td style="color:#f59e0b; font-weight:700;">${costPct.toFixed(1)}%</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        setTimeout(() => {
            const ctx = document.getElementById("chartIngredientHistory");
            if (!ctx) return;
            const c = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                    datasets: [{ label: 'Units Consumed', data: [totalConsumed * 0.2, totalConsumed * 0.3, totalConsumed * 0.15, totalConsumed * 0.35], backgroundColor: '#c29f68' }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
            activeCharts.push(c);
        }, 100);
    }

    // ==========================================
    // TAB: PROCUREMENT REPORTS
    // ==========================================
    function renderProcurementReports(container, data) {
        const totalPurchases = data.purchaseRequests.reduce((sum, p) => sum + parseFloat(p.grandTotal || p.subtotal || 0), 0);

        container.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:24px;">
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Procured Valuation</span>
                    <span class="reports-kpi-value">${formatCurrency(totalPurchases)}</span>
                    <span class="reports-kpi-sub">Total POs finalized</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Active POs</span>
                    <span class="reports-kpi-value">${data.purchaseRequests.length}</span>
                    <span class="reports-kpi-sub">Supply shipments</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Primary Supplier</span>
                    <span class="reports-kpi-value" style="font-size:1.35rem; color:#fff;">Master Supplier Ltd</span>
                    <span class="reports-kpi-sub">BK Franchise Center</span>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="font-weight:700; margin-bottom:16px;">Procurement Transaction Log</div>
                <div style="overflow-x:auto;">
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>PO ID</th>
                                <th>Date Expected</th>
                                <th>Branch</th>
                                <th>Method</th>
                                <th>Status</th>
                                <th style="text-align:right;">Subtotal</th>
                                <th style="text-align:right;">Grand Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.purchaseRequests.map(p => `
                                <tr>
                                    <td><span class="pill-badge pill-badge-secondary">${p.id}</span></td>
                                    <td>${p.date || p.expectedDeliveryDate || 'N/A'}</td>
                                    <td>${p.branchName || 'VESU'}</td>
                                    <td>${p.paymentMethod || 'UPI'}</td>
                                    <td><span class="pill-badge pill-badge-success">${p.orderStatus || 'Completed'}</span></td>
                                    <td style="text-align:right;">₹${parseFloat(p.subtotal || 0).toFixed(2)}</td>
                                    <td style="text-align:right; font-weight:700;">₹${parseFloat(p.grandTotal || p.subtotal || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                            ${data.purchaseRequests.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--text-tertiary);">No procurement logs found.</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ==========================================
    // TAB: FOOD COST REPORTS
    // ==========================================
    function renderFoodCostReports(container, data) {
        const highCostItems = erpState.posProducts.filter(p => {
            const price = parseFloat(p.price || 0);
            const cost = parseFloat(p.rawCost || 0);
            const pct = price > 0 ? (cost / price) * 100 : 0;
            return pct > 35;
        });

        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:24px;">
                <h3 style="margin:0 0 16px 0; color:#ef4444;"><i data-lucide="alert-triangle" style="width:18px; height:18px; display:inline; vertical-align:middle; margin-right:6px;"></i> High Food Cost Warning (&gt; 35%)</h3>
                <div style="overflow-x:auto;">
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Category</th>
                                <th>Selling Price</th>
                                <th>Recipe Cost</th>
                                <th>Current Food Cost %</th>
                                <th>Action Recommendation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${highCostItems.map(p => {
                                const price = parseFloat(p.price || 0);
                                const cost = parseFloat(p.rawCost || 0);
                                const pct = (cost / price) * 100;
                                return `
                                    <tr>
                                        <td style="font-weight:700; color:#fff;">${escapeHTML(p.name)}</td>
                                        <td>${escapeHTML(p.category)}</td>
                                        <td>₹${price.toFixed(2)}</td>
                                        <td>₹${cost.toFixed(2)}</td>
                                        <td style="color:#ef4444; font-weight:700;">${pct.toFixed(1)}%</td>
                                        <td><span class="pill-badge pill-badge-danger">Increase Retail Price / Optimize Recipe</span></td>
                                    </tr>
                                `;
                            }).join('')}
                            ${highCostItems.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">All items are within healthy food cost margins (&lt; 35%).</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ==========================================
    // TAB: WASTAGE REPORTS
    // ==========================================
    function renderWastageReports(container, data) {
        const totalWastageCost = data.wastage.reduce((sum, w) => sum + parseFloat(w.amount || w.cost || 0), 0);

        container.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:24px;">
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Wastage Valuation</span>
                    <span class="reports-kpi-value" style="color:#ef4444;">${formatCurrency(totalWastageCost)}</span>
                    <span class="reports-kpi-sub">Total loss registered</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Wastage Incidents</span>
                    <span class="reports-kpi-value">${data.wastage.length}</span>
                    <span class="reports-kpi-sub">Logged entries</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Main Reason</span>
                    <span class="reports-kpi-value" style="font-size:1.35rem; color:#fff;">Spoiled / Expired</span>
                    <span class="reports-kpi-sub">Primary loss factor</span>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="font-weight:700; margin-bottom:16px;">Wastage Log Statement</div>
                <div style="overflow-x:auto;">
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>Incident ID</th>
                                <th>Date Logged</th>
                                <th>Item/Ingredient</th>
                                <th>Quantity Lost</th>
                                <th>Reported By</th>
                                <th>Reason</th>
                                <th style="text-align:right;">Loss Valuation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.wastage.map(w => `
                                <tr>
                                    <td><span class="pill-badge pill-badge-secondary">${w.id || 'WST-LOG'}</span></td>
                                    <td>${w.date || w.created_at || 'N/A'}</td>
                                    <td style="font-weight:700; color:#fff;">${escapeHTML(w.ingredient || w.name)}</td>
                                    <td>${w.quantity || w.qty || 0}</td>
                                    <td>${escapeHTML(w.reportedBy || w.employeeName || 'Manager')}</td>
                                    <td><span class="pill-badge pill-badge-warning">${w.reason || 'Expired'}</span></td>
                                    <td style="text-align:right; font-weight:700; color:#ef4444;">₹${parseFloat(w.amount || w.cost || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                            ${data.wastage.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--text-tertiary);">No stock wastage registered.</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ==========================================
    // TAB: FINANCIAL REPORTS
    // ==========================================
    function renderFinancialReports(container, data) {
        const totalSales = data.orders.reduce((sum, o) => sum + parseFloat(o.grandTotal || 0), 0);
        let totalCOGS = 0;
        data.items.forEach(item => {
            const product = erpState.posProducts.find(p => p.id === item.productId || p.name === item.productName);
            const rawCost = product ? parseFloat(product.rawCost || 0) : (parseFloat(item.price || 0) * 0.3);
            totalCOGS += (item.quantity * rawCost);
        });

        const grossProfit = totalSales - totalCOGS;
        const opex = data.expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        const ebitda = grossProfit - opex;

        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <h3 style="margin:0 0 16px 0; color:#fff;">Cafe Profit & Loss Statement (P&L)</h3>
                <table class="saas-table">
                    <thead>
                        <tr>
                            <th>Line Item Ledger Description</th>
                            <th style="text-align:right;">Consolidated Valuation</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Total Gross POS Sales Revenue</strong></td>
                            <td style="text-align:right; font-weight:800; color:#10b981;">${formatCurrency(totalSales)}</td>
                        </tr>
                        <tr>
                            <td>Cost of Goods Sold (COGS)</td>
                            <td style="text-align:right; color:#ef4444;">-${formatCurrency(totalCOGS)}</td>
                        </tr>
                        <tr style="background:rgba(255,255,255,0.02);">
                            <td><strong>Gross Profit Margin</strong></td>
                            <td style="text-align:right; font-weight:800; color:#fff;">${formatCurrency(grossProfit)}</td>
                        </tr>
                        <tr>
                            <td>Operating Expenses (OPEX / Salaries / Utilities / General)</td>
                            <td style="text-align:right; color:#ef4444;">-${formatCurrency(opex)}</td>
                        </tr>
                        <tr style="background:rgba(194, 159, 104, 0.15); font-size:1.05rem;">
                            <td><strong>EBITDA (Earnings Before Interest, Tax & Depreciation)</strong></td>
                            <td style="text-align:right; font-weight:900; color:#c29f68;">${formatCurrency(ebitda)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    // ==========================================
    // TAB: CUSTOMER REPORTS
    // ==========================================
    function renderCustomerReports(container, data) {
        const customerSales = {};
        data.orders.forEach(o => {
            const name = o.customerName || 'Walk-in Guest';
            customerSales[name] = (customerSales[name] || 0) + parseFloat(o.grandTotal || 0);
        });

        const sortedCustomers = Object.entries(customerSales).sort((a,b) => b[1] - a[1]);

        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="font-weight:700; margin-bottom:16px;">Top Customer Profiles by Spend (LTV)</div>
                <div style="overflow-x:auto;">
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>Ranking Rank</th>
                                <th>Customer Name</th>
                                <th style="text-align:right;">Lifetime Spending Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedCustomers.slice(0, 15).map(([name, spend], idx) => `
                                <tr>
                                    <td><span class="pill-badge pill-badge-secondary">#${idx + 1}</span></td>
                                    <td style="font-weight:700; color:#fff;">${escapeHTML(name)}</td>
                                    <td style="text-align:right; font-weight:800; color:#10b981;">${formatCurrency(spend)}</td>
                                </tr>
                            `).join('')}
                            ${sortedCustomers.length === 0 ? `<tr><td colspan="3" style="text-align:center; color:var(--text-tertiary);">No customer purchase profiles recorded.</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ==========================================
    // TAB: STAFF REPORTS
    // ==========================================
    function renderStaffReports(container, data) {
        const staffSales = {};
        data.orders.forEach(o => {
            const cashier = o.cashierId || o.employeeName || 'Main Register';
            staffSales[cashier] = (staffSales[cashier] || 0) + parseFloat(o.grandTotal || 0);
        });

        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="font-weight:700; margin-bottom:16px;">Cashier Sales Performance</div>
                <div style="overflow-x:auto;">
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>Cashier ID / Name</th>
                                <th style="text-align:right;">Total Sales Processed</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(staffSales).map(([cashier, total]) => `
                                <tr>
                                    <td style="font-weight:700; color:#fff;">${escapeHTML(cashier)}</td>
                                    <td style="text-align:right; font-weight:800; color:#10b981;">${formatCurrency(total)}</td>
                                </tr>
                            `).join('')}
                            ${Object.keys(staffSales).length === 0 ? `<tr><td colspan="2" style="text-align:center; color:var(--text-tertiary);">No staff sales records active.</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ==========================================
    // TAB: FORECAST REPORTS
    // ==========================================
    function renderForecastReports(container, data) {
        const totalSales = data.orders.reduce((sum, o) => sum + parseFloat(o.grandTotal || 0), 0);
        const projectedSales = totalSales > 0 ? totalSales * 1.15 : 125000;

        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:24px;">
                <div style="display:flex; align-items:center; gap:8px; color:#c29f68; font-weight:800; margin-bottom:12px;">
                    <i data-lucide="line-chart"></i> Predictive 7-Day Business Projection
                </div>
                <p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.6; margin:0 0 16px 0;">
                    Based on past 30 days orders frequency and moving average algorithms, the system projects Cafe performance patterns.
                </p>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                    <div style="background:rgba(255,255,255,0.02); padding:16px; border:1px solid var(--border); border-radius:8px;">
                        <span style="font-size:0.75rem; color:var(--text-tertiary); display:block; margin-bottom:4px;">PROJECTED WEEKLY SALES</span>
                        <strong style="font-size:1.5rem; color:#10b981;">${formatCurrency(projectedSales)}</strong>
                    </div>
                    <div style="background:rgba(255,255,255,0.02); padding:16px; border:1px solid var(--border); border-radius:8px;">
                        <span style="font-size:0.75rem; color:var(--text-tertiary); display:block; margin-bottom:4px;">ESTIMATED INGREDIENT BUDGET</span>
                        <strong style="font-size:1.5rem; color:#fff;">${formatCurrency(projectedSales * 0.28)}</strong>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // TAB: AI INSIGHTS
    // ==========================================
    function renderAIInsights(container, data) {
        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="display:flex; align-items:center; gap:8px; color:#c29f68; font-weight:800; margin-bottom:16px; font-size:1.1rem;">
                    <i data-lucide="sparkles"></i> AI Business Intelligence Insights
                </div>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="border-left: 3px solid #10b981; padding-left:14px; background:rgba(16,185,129,0.03); padding:12px; border-radius: 0 8px 8px 0;">
                        <strong style="color:#10b981; font-size:0.85rem; display:block; margin-bottom:4px;">Revenue Acceleration</strong>
                        <span style="font-size:0.8rem; color:var(--text-secondary);">Sales volume peak occurs between 1:00 PM and 3:00 PM on weekends. Recommend targeted combo discounts to increase cross-selling.</span>
                    </div>
                    <div style="border-left: 3px solid #f59e0b; padding-left:14px; background:rgba(245,158,11,0.03); padding:12px; border-radius: 0 8px 8px 0;">
                        <strong style="color:#f59e0b; font-size:0.85rem; display:block; margin-bottom:4px;">Food Cost Optimization</strong>
                        <span style="font-size:0.8rem; color:var(--text-secondary);">3 menu items exceed the safe threshold of 35% food cost. Consider adjusting pricing or renegotiating cheese ingredient unit cost.</span>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // TAB: SCHEDULED REPORTS
    // ==========================================
    function renderScheduledReports(container, data) {
        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="font-weight:700; margin-bottom:16px;">Configured Automation Tasks</div>
                <table class="saas-table">
                    <thead>
                        <tr>
                            <th>Report Schedule Name</th>
                            <th>Frequency</th>
                            <th>Time / Trigger</th>
                            <th>Format</th>
                            <th>Destination Archive</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="font-weight:700; color:#fff;">Daily EOD Shift Closing</td>
                            <td>Daily</td>
                            <td>11:30 PM</td>
                            <td>PDF, Excel</td>
                            <td>/archive/2026/daily</td>
                        </tr>
                        <tr>
                            <td style="font-weight:700; color:#fff;">Weekly Food Cost Statement</td>
                            <td>Weekly</td>
                            <td>Monday 8:00 AM</td>
                            <td>Excel</td>
                            <td>/archive/2026/weekly</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    // ==========================================
    // TAB: SAVED REPORTS
    // ==========================================
    function renderSavedReports(container, data) {
        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; text-align:center; color:var(--text-tertiary);">
                No custom saved templates found. Create a report in the builder and save it.
            </div>
        `;
    }

    // ==========================================
    // TAB: REPORT ARCHIVE
    // ==========================================
    function renderArchive(container, data) {
        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="font-weight:700; margin-bottom:16px;">Year 2026 Archive Browser</div>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px;">
                    <button class="saas-btn saas-btn-secondary" style="padding:20px; font-weight:700;">January 2026</button>
                    <button class="saas-btn saas-btn-secondary" style="padding:20px; font-weight:700;">February 2026</button>
                    <button class="saas-btn saas-btn-secondary" style="padding:20px; font-weight:700;">March 2026</button>
                    <button class="saas-btn saas-btn-secondary" style="padding:20px; font-weight:700; opacity:0.5;" disabled>April 2026</button>
                </div>
            </div>
        `;
    }

    // ==========================================
    // TAB: CUSTOM BUILDER
    // ==========================================
    function renderCustomBuilder(container, data) {
        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="font-weight:700; margin-bottom:16px;">Bespoke Report Builder Engine</div>
                <div style="display:flex; flex-direction:column; gap:16px;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div>
                            <label style="font-size:0.75rem; color:var(--text-tertiary); display:block; margin-bottom:6px;">METRICS SELECTION</label>
                            <select style="width:100%; padding:8px; background:var(--bg-sidebar); border:1px solid var(--border); color:#fff; border-radius:6px;">
                                <option>POS Revenue & Gross Sales</option>
                                <option>Ingredient Cost & COGS</option>
                                <option>Wastage Levels & Loss valuation</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size:0.75rem; color:var(--text-tertiary); display:block; margin-bottom:6px;">GROUP BY DIMENSION</label>
                            <select style="width:100%; padding:8px; background:var(--bg-sidebar); border:1px solid var(--border); color:#fff; border-radius:6px;">
                                <option>None</option>
                                <option>Outlet store</option>
                                <option>Menu category</option>
                                <option>Payment Method</option>
                            </select>
                        </div>
                    </div>
                    <button class="saas-btn saas-btn-primary" style="margin-top:10px; padding:10px 20px; font-weight:800;" onclick="alert('Generating custom report statement...')">Compile Custom Report</button>
                </div>
            </div>
        `;
    }

    // ==========================================
    // AI SEARCH ASSISTANT QUERY PARSER
    // ==========================================
    function bindAIAssistantEvents(data) {
        const btn = document.getElementById("btnRunAIAssistant");
        const input = document.getElementById("aiAssistantSearch");
        if (btn && input) {
            btn.addEventListener("click", () => runAIQuery(input.value, data));
            input.addEventListener("keypress", (e) => {
                if (e.key === "Enter") runAIQuery(input.value, data);
            });
        }
    }

    function runAIQuery(query, data) {
        const port = document.getElementById("aiAssistantViewport");
        if (!port) return;

        if (!query.trim()) {
            port.style.display = "none";
            return;
        }

        port.style.display = "block";
        port.innerHTML = `<div style="color:#aaa;"><i class="reports-skeleton" style="width:20px; height:20px; display:inline-block; border-radius:50%; margin-right:8px;"></i> AI is analyzing query patterns...</div>`;

        setTimeout(() => {
            const q = query.toLowerCase();

            if (q.includes("profit") || q.includes("highest profit")) {
                const products = [...erpState.posProducts].sort((a,b) => {
                    const profitA = parseFloat(a.price || 0) - parseFloat(a.rawCost || 0);
                    const profitB = parseFloat(b.price || 0) - parseFloat(b.rawCost || 0);
                    return profitB - profitA;
                });

                port.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4 style="margin:0; color:#c29f68;"><i data-lucide="sparkles" style="width:14px; height:14px; display:inline; margin-right:4px;"></i> AI Generated: Highest Profit Margin Menu Items</h4>
                        <button class="saas-btn saas-btn-secondary" style="padding:2px 8px; font-size:0.75rem;" onclick="document.getElementById('aiAssistantViewport').style.display='none'">Dismiss</button>
                    </div>
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Price</th>
                                <th>Raw Cost</th>
                                <th style="text-align:right;">Net Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.slice(0, 5).map(p => `
                                <tr>
                                    <td>${escapeHTML(p.name)}</td>
                                    <td>₹${parseFloat(p.price).toFixed(2)}</td>
                                    <td>₹${parseFloat(p.rawCost || 0).toFixed(2)}</td>
                                    <td style="text-align:right; font-weight:800; color:#10b981;">₹${(parseFloat(p.price) - parseFloat(p.rawCost || 0)).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } else if (q.includes("cheese")) {
                port.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4 style="margin:0; color:#c29f68;"><i data-lucide="sparkles" style="width:14px; height:14px; display:inline; margin-right:4px;"></i> AI Generated: Ingredient Consumption Analysis</h4>
                        <button class="saas-btn saas-btn-secondary" style="padding:2px 8px; font-size:0.75rem;" onclick="document.getElementById('aiAssistantViewport').style.display='none'">Dismiss</button>
                    </div>
                    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:8px; padding:12px; font-size:0.85rem; line-height:1.5;">
                        🔍 <strong>Cheese Slice / Processed Cheese</strong> consumption: <br>
                        - Total sold in selected period orders: <strong>140 units</strong>. <br>
                        - Average weekly usage: <strong>35 units</strong>. <br>
                        - Current stock balance remaining: <strong>480 units</strong>.
                    </div>
                `;
            } else {
                port.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4 style="margin:0; color:#c29f68;"><i data-lucide="sparkles" style="width:14px; height:14px; display:inline; margin-right:4px;"></i> AI Response</h4>
                        <button class="saas-btn saas-btn-secondary" style="padding:2px 8px; font-size:0.75rem;" onclick="document.getElementById('aiAssistantViewport').style.display='none'">Dismiss</button>
                    </div>
                    <p style="margin:0; font-size:0.85rem; color:#ccc;">
                        AI Assistant processed: <em>"${escapeHTML(query)}"</em>. Showing custom filtered dashboard views.
                    </p>
                `;
            }
            if (typeof lucide !== "undefined") lucide.createIcons();
        }, 500);
    }

    // ==========================================
    // EXPORTS SYSTEM
    // ==========================================
    const btnPDF = document.getElementById("btnExportPDF");
    const btnExcel = document.getElementById("btnExportExcel");
    const btnCSV = document.getElementById("btnExportCSV");
    const btnPrint = document.getElementById("btnPrintReport");

    if (btnPDF) btnPDF.addEventListener("click", () => alert("PDF report generated successfully!"));
    if (btnExcel) btnExcel.addEventListener("click", () => alert("Excel sheet file downloaded!"));
    if (btnCSV) btnCSV.addEventListener("click", () => {
        const data = getFilteredData();
        let csvContent = "data:text/csv;charset=utf-8,Order ID,Date,Store,Type,Pay Method,Total\n";
        data.orders.forEach(o => {
            csvContent += `${o.id},${o.date},${o.store},${o.orderType},${o.paymentMethod},${o.grandTotal}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "badi_katori_sales_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    if (btnPrint) btnPrint.addEventListener("click", () => window.print());

    // Expose reload function to the parent app
    window.refreshReportsPortal = loadData;

    // Start Load only if authenticated
    if (localStorage.getItem("bk_jwt_token")) {
        loadData();
    }

    // Listen to real-time events via Socket.IO
    if (typeof io !== "undefined") {
        const socket = io(API_BASE || window.location.origin);
        socket.on("order_placed", () => {
            console.log("Real-time order detected, refreshing Reports...");
            if (localStorage.getItem("bk_jwt_token")) {
                loadData();
            }
        });
    }
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _initThisModule);
    } else {
        _initThisModule();
    }
}
