// sales.js - BK Operations India Enterprise Sales Module

document.addEventListener("DOMContentLoaded", () => {
    // 1. Core API Base Configuration
    let API_BASE = '';
    if (window.location.protocol.startsWith('file')) {
        API_BASE = window.location.origin;
    } else if (window.location.port && window.location.port !== '3000') {
        API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    // 2. State & Storage Schema Initialization
    let salesReturns = [];
    let paymentReconciliations = [];
    let liveStateData = null; // Stored backend API data

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

    // Save and Load Helpers
    function saveState(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    function loadState() {
        try {
            salesReturns = JSON.parse(localStorage.getItem("bk_sales_returns")) || [];
            paymentReconciliations = JSON.parse(localStorage.getItem("bk_payment_reconciliations")) || [];
        } catch (e) {
            console.error("Failed to load sales state:", e);
        }
    }

    // 3. Seeding Default Data for Returns and Reconciliation
    function seedDefaultData() {
        if (!localStorage.getItem("bk_sales_returns")) {
            const initialReturns = [
                {
                    id: "ret-seed-1",
                    date: "2026-07-09",
                    orderRef: "ORD-99881",
                    items: "1x Paneer Tikka, 1x Garlic Naan",
                    reason: "Quality issue - too spicy",
                    refundAmount: 380,
                    refundedBy: "Rahul Sharma",
                    status: "Refunded",
                    store: "VESU"
                },
                {
                    id: "ret-seed-2",
                    date: "2026-07-09",
                    orderRef: "ORD-99882",
                    items: "2x Mango Lassi",
                    reason: "Spilled during delivery",
                    refundAmount: 240,
                    refundedBy: "Sneha Patel",
                    status: "Refunded",
                    store: "ADAJAN"
                }
            ];
            saveState("bk_sales_returns", initialReturns);
            salesReturns = initialReturns;
        }

        if (!localStorage.getItem("bk_payment_reconciliations")) {
            const initialReconciliation = [
                {
                    id: "recon-seed-1",
                    date: "2026-07-09",
                    mode: "UPI",
                    expected: 43000,
                    actual: 43000,
                    difference: 0,
                    status: "Matched",
                    store: "VESU"
                },
                {
                    id: "recon-seed-2",
                    date: "2026-07-09",
                    mode: "Cash",
                    expected: 7500,
                    actual: 7300,
                    difference: -200,
                    status: "Mismatch",
                    store: "VESU"
                }
            ];
            saveState("bk_payment_reconciliations", initialReconciliation);
            paymentReconciliations = initialReconciliation;
        }
    }

    // Fetch Live State data from API
    async function fetchLiveAppState() {
        try {
            const res = await fetch(`${API_BASE}/api/state`);
            if (res.ok) {
                liveStateData = await res.json();
            }
        } catch (e) {
            console.error("Failed to fetch live app state in sales module:", e);
        }
    }

    // 4. Modal Helpers
    window.openSalesModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            if (modalId === 'modalNewSalesReturn') {
                populateOrderDropdown();
            }
        }
    };

    window.closeSalesModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    };

    // 5. SALES RETURN PAGE IMPLEMENTATION

    // Populate order dropdown from live posOrders database
    function populateOrderDropdown() {
        const select = document.getElementById("returnOrderSelect");
        if (!select) return;
        select.innerHTML = '<option value="" disabled selected>-- Select Order --</option>';

        const { store } = getCurrentRoleAndStore();
        const orders = liveStateData ? (liveStateData.posOrders || []) : [];

        // Filter orders by active store
        const filteredOrders = orders.filter(o => store === "All" || o.store === store);

        filteredOrders.forEach(o => {
            const opt = document.createElement("option");
            opt.value = o.id;
            opt.textContent = `${o.id} - ${o.customerName || 'Walk-in'} (₹${o.grandTotal.toFixed(2)})`;
            select.appendChild(opt);
        });

        // Trigger items population on select change
        select.removeEventListener("change", handleOrderSelection);
        select.addEventListener("change", handleOrderSelection);
    }

    // Populate items list when order is chosen
    async function handleOrderSelection(e) {
        const orderId = e.target.value;
        const container = document.getElementById("returnItemsContainer");
        if (!container) return;
        container.innerHTML = '<span style="color:var(--text-tertiary); font-size:0.85rem;">Loading items...</span>';

        try {
            // Find order items from SQLite backend or fall back to simulated items
            const order = liveStateData.posOrders.find(o => o.id === orderId);
            if (!order) {
                container.innerHTML = '<span style="color:var(--danger); font-size:0.85rem;">Order not found.</span>';
                return;
            }

            // Retrieve order items directly from global posOrderItems list
            let items = (liveStateData.posOrderItems || []).filter(oi => oi.orderId === orderId);

            if (items.length === 0) {
                // Mock items if empty/offline
                items = [
                    { productName: "Paneer Tikka", price: 280, quantity: 1 },
                    { productName: "Garlic Naan", price: 100, quantity: 1 }
                ];
            }

            container.innerHTML = '';
            items.forEach((item, idx) => {
                const div = document.createElement("div");
                div.style.display = "flex";
                div.style.alignItems = "center";
                div.style.gap = "8px";
                div.innerHTML = `
                    <input type="checkbox" class="return-item-checkbox" data-name="${item.productName}" data-price="${item.price}" data-qty="${item.quantity}" id="ret_item_${idx}" checked style="width:16px; height:16px;">
                    <label for="ret_item_${idx}" style="font-size:0.85rem; color:var(--text-primary); cursor:pointer;">
                        ${item.productName} (x${item.quantity}) - ₹${(item.price * item.quantity).toFixed(2)}
                    </label>
                `;
                container.appendChild(div);
            });

            // Update refund amount automatically
            calculateAutoRefund();
            container.querySelectorAll(".return-item-checkbox").forEach(chk => {
                chk.addEventListener("change", calculateAutoRefund);
            });

        } catch (err) {
            console.error("Failed to load order items for return:", err);
            container.innerHTML = '<span style="color:var(--danger); font-size:0.85rem;">Failed to load items.</span>';
        }
    }

    function calculateAutoRefund() {
        const checkboxes = document.querySelectorAll(".return-item-checkbox:checked");
        let total = 0;
        checkboxes.forEach(chk => {
            const price = parseFloat(chk.getAttribute("data-price"));
            const qty = parseInt(chk.getAttribute("data-qty"));
            total += price * qty;
        });
        const input = document.getElementById("returnRefundAmount");
        if (input) {
            input.value = total.toFixed(2);
        }
    }

    // Submit new sales return
    const formReturn = document.getElementById("formNewSalesReturn");
    if (formReturn) {
        formReturn.addEventListener("submit", (e) => {
            e.preventDefault();

            const orderId = document.getElementById("returnOrderSelect").value;
            const reason = document.getElementById("returnReason").value;
            const refundAmount = parseFloat(document.getElementById("returnRefundAmount").value);
            const refundedBy = document.getElementById("returnRefundedBy").value;
            const status = document.getElementById("returnStatus").value;

            // Get selected items
            const checkboxes = document.querySelectorAll(".return-item-checkbox:checked");
            if (checkboxes.length === 0) {
                alert("Please select at least one item to return.");
                return;
            }

            const returnedItemsText = Array.from(checkboxes).map(chk => {
                const name = chk.getAttribute("data-name");
                const qty = chk.getAttribute("data-qty");
                return `${qty}x ${name}`;
            }).join(", ");

            const { store } = getCurrentRoleAndStore();

            const newReturn = {
                id: "ret-" + Date.now().toString().slice(-6),
                date: new Date().toISOString().split('T')[0],
                orderRef: orderId,
                items: returnedItemsText,
                reason,
                refundAmount,
                refundedBy,
                status,
                store: store === "All" ? "VESU" : store // Fallback to current store
            };

            salesReturns.push(newReturn);
            saveState("bk_sales_returns", salesReturns);

            // Sync with backend P&L transactions
            fetch(`${API_BASE}/api/pos/returns`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                },
                body: JSON.stringify(newReturn)
            }).then(r => {
                if (r.ok) {
                    console.log("Sales return synced successfully with backend P&L.");
                }
            }).catch(e => console.error("Failed to sync sales return to backend:", e));

            // Clean up and close modal
            formReturn.reset();
            document.getElementById("returnItemsContainer").innerHTML = '<span style="color:var(--text-tertiary); font-size:0.85rem;">Select an order first...</span>';
            window.closeSalesModal("modalNewSalesReturn");

            // Re-render
            renderSalesReturn();
        });
    }

    // Render returns page content
    function renderSalesReturn() {
        const tbody = document.querySelector("#tableSalesReturn tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const { store } = getCurrentRoleAndStore();

        // Filter returns based on selected store
        const filteredReturns = salesReturns.filter(r => store === "All" || r.store === store);

        // Sort returns descending by date
        filteredReturns.sort((a, b) => b.date.localeCompare(a.date));

        // KPIs calculation
        const todayStr = new Date().toISOString().split('T')[0];
        let todayCount = 0;
        let todayRefund = 0;
        let monthCount = 0;

        const currentMonthStr = todayStr.slice(0, 7); // "YYYY-MM"

        filteredReturns.forEach(r => {
            if (r.date === todayStr) {
                todayCount++;
                todayRefund += r.refundAmount;
            }
            if (r.date.startsWith(currentMonthStr)) {
                monthCount++;
            }
        });

        // Set KPI fields
        document.getElementById("sales-return-kpi-today-count").textContent = todayCount;
        document.getElementById("sales-return-kpi-today-refund").textContent = formatCurrency(todayRefund);
        document.getElementById("sales-return-kpi-month-count").textContent = monthCount;

        if (filteredReturns.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-tertiary);">No returns recorded.</td></tr>`;
            return;
        }

        filteredReturns.forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${r.date}</td>
                <td><span class="pill-badge pill-badge-secondary">${r.orderRef}</span></td>
                <td>${r.items}</td>
                <td>${r.reason}</td>
                <td style="text-align:right; font-weight:700; color:var(--danger);">${formatCurrency(r.refundAmount)}</td>
                <td>${r.refundedBy}</td>
                <td><span class="pill-badge ${r.status === 'Refunded' ? 'pill-badge-danger' : (r.status === 'Approved' ? 'pill-badge-success' : 'pill-badge-warning')}">${r.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // PAYMENT RECONCILIATION PAGE IMPLEMENTATION
    const formRecon = document.getElementById("formNewPaymentRecon");
    if (formRecon) {
        formRecon.addEventListener("submit", (e) => {
            e.preventDefault();
            const date = document.getElementById("reconDate").value;
            const mode = document.getElementById("reconMode").value;
            const actual = parseFloat(document.getElementById("reconActualAmount").value);
            const { store } = getCurrentRoleAndStore();

            const existingIdx = paymentReconciliations.findIndex(r => r.date === date && r.mode === mode && (store === "All" || r.store === store));
            
            const newRecon = {
                id: "recon-" + Date.now().toString().slice(-6),
                date,
                mode,
                actual,
                store: store === "All" ? "VESU" : store
            };

            if (existingIdx > -1) {
                paymentReconciliations[existingIdx] = { ...paymentReconciliations[existingIdx], actual };
            } else {
                paymentReconciliations.push(newRecon);
            }

            saveState("bk_payment_reconciliations", paymentReconciliations);
            formRecon.reset();
            window.closeSalesModal("modalNewPaymentRecon");
            renderPaymentReconciliation();
        });
    }

    function renderPaymentReconciliation() {
        const tbody = document.querySelector("#tablePaymentReconciliation tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const { store } = getCurrentRoleAndStore();
        const orders = liveStateData ? (liveStateData.posOrders || []) : [];

        // Generate expected amounts by Date and Payment Mode for the last 7 days
        const expectedMap = {};
        const datesSet = new Set();
        const modes = ["Cash", "Card", "UPI", "Swiggy", "Zomato"];

        // Filter orders by active store
        const filteredOrders = orders.filter(o => store === "All" || o.store === store);

        filteredOrders.forEach(o => {
            if (!o.date) return;
            datesSet.add(o.date);
            
            // Map payment mode
            let mode = "Cash";
            if (o.source === "swiggy") mode = "Swiggy";
            else if (o.source === "zomato") mode = "Zomato";
            else if (o.paymentMethod === "Card") mode = "Card";
            else if (o.paymentMethod === "UPI") mode = "UPI";
            
            const key = `${o.date}_${mode}`;
            expectedMap[key] = (expectedMap[key] || 0) + parseFloat(o.grandTotal || 0);
        });

        // Add today and yesterday to date list to ensure they always display
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        datesSet.add(today);
        datesSet.add(yesterday);

        // Convert set to sorted array (descending order)
        const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));

        let totalExpected = 0;
        let totalReceived = 0;
        let totalDiscrepancy = 0;

        const tableRows = [];

        sortedDates.slice(0, 10).forEach(date => { // Display last 10 days
            modes.forEach(mode => {
                const key = `${date}_${mode}`;
                const expected = expectedMap[key] || 0;

                // Find user entered actuals
                const userRecon = paymentReconciliations.find(r => r.date === date && r.mode === mode && (store === "All" || r.store === store));
                
                // Seed default actual to expected if matching seed, otherwise default to 0 or seed value
                let actual = 0;
                if (userRecon) {
                    actual = userRecon.actual;
                } else {
                    // Seed initial data fallback
                    const seed = paymentReconciliations.find(r => r.date === date && r.mode === mode);
                    if (seed) actual = seed.actual;
                }

                const diff = actual - expected;
                const status = Math.abs(diff) < 0.01 ? "Matched" : "Mismatch";

                totalExpected += expected;
                totalReceived += actual;
                totalDiscrepancy += diff;

                tableRows.push({
                    date,
                    mode,
                    expected,
                    actual,
                    diff,
                    status
                });
            });
        });

        // Update KPIs
        document.getElementById("recon-kpi-expected").textContent = formatCurrency(totalExpected);
        document.getElementById("recon-kpi-received").textContent = formatCurrency(totalReceived);
        document.getElementById("recon-kpi-discrepancy").textContent = formatCurrency(totalDiscrepancy);
        document.getElementById("recon-kpi-discrepancy").style.color = totalDiscrepancy < 0 ? "var(--danger)" : "var(--success)";

        if (tableRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">No reconciliation records.</td></tr>`;
            return;
        }

        tableRows.forEach(r => {
            const tr = document.createElement("tr");
            
            // Highlight mismatched rows with red background/text style
            if (r.status === "Mismatch") {
                tr.style.background = "rgba(239, 68, 68, 0.06)";
            }

            tr.innerHTML = `
                <td>${r.date}</td>
                <td><span class="pill-badge pill-badge-secondary">${r.mode}</span></td>
                <td style="text-align:right;">${formatCurrency(r.expected)}</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(r.actual)}</td>
                <td style="text-align:right; font-weight:700; color:${r.diff < 0 ? 'var(--danger)' : (r.diff > 0 ? 'var(--success)' : 'inherit')};">
                    ${r.diff !== 0 ? (r.diff > 0 ? '+' : '') + formatCurrency(r.diff) : "-"}
                </td>
                <td><span class="pill-badge ${r.status === 'Matched' ? 'pill-badge-success' : 'pill-badge-danger'}">${r.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // HOURLY SALES REPORT PAGE IMPLEMENTATION
    let hourlyChartInstance = null;

    // Set default date
    const dateInput = document.getElementById("hourlyReportDate");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
        dateInput.addEventListener("change", () => renderHourlySalesReport());
    }

    function renderHourlySalesReport() {
        const tbody = document.querySelector("#tableHourlySales tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const selectedDate = document.getElementById("hourlyReportDate").value;
        const { store } = getCurrentRoleAndStore();
        const orders = liveStateData ? (liveStateData.posOrders || []) : [];

        // Initialize hourly slots (e.g. 08:00 to 23:00)
        const hourlyData = {};
        for (let h = 8; h <= 23; h++) {
            hourlyData[h] = { count: 0, revenue: 0 };
        }

        // Filter orders by active store and date
        const filteredOrders = orders.filter(o => {
            return (store === "All" || o.store === store) && o.date === selectedDate && o.status !== "Refunded";
        });

        let totalRevenue = 0;
        let totalOrders = filteredOrders.length;

        filteredOrders.forEach(o => {
            if (!o.time) return;
            const hour = parseInt(o.time.split(":")[0], 10);
            totalRevenue += parseFloat(o.grandTotal || 0);

            if (hourlyData[hour] !== undefined) {
                hourlyData[hour].count++;
                hourlyData[hour].revenue += parseFloat(o.grandTotal || 0);
            }
        });

        // Fill KPIs
        document.getElementById("hourly-kpi-revenue").textContent = formatCurrency(totalRevenue);
        document.getElementById("hourly-kpi-orders").textContent = totalOrders;
        const overallAOV = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        document.getElementById("hourly-kpi-aov").textContent = formatCurrency(overallAOV);

        // Populate Table and Chart arrays
        const labels = [];
        const revenueDataset = [];
        const ordersDataset = [];

        for (let h = 8; h <= 23; h++) {
            const slotStr = `${h.toString().padStart(2, '0')}:00–${(h + 1).toString().padStart(2, '0')}:00`;
            const count = hourlyData[h].count;
            const revenue = hourlyData[h].revenue;
            const aov = count > 0 ? revenue / count : 0;

            labels.push(`${h.toString().padStart(2, '0')}:00`);
            revenueDataset.push(revenue);
            ordersDataset.push(count);

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${slotStr}</td>
                <td style="text-align:right; font-weight:700;">${count}</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(revenue)}</td>
                <td style="text-align:right; font-weight:700; color:var(--text-secondary);">${formatCurrency(aov)}</td>
            `;
            tbody.appendChild(tr);
        }

        // Render Chart.js visualization
        const ctx = document.getElementById("chartHourlySales").getContext("2d");
        if (hourlyChartInstance) {
            hourlyChartInstance.destroy();
        }

        hourlyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenue (₹)',
                        data: revenueDataset,
                        backgroundColor: 'rgba(242, 108, 37, 0.85)', // Orange theme matching brand
                        borderColor: '#f26c25',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Orders Count',
                        data: ordersDataset,
                        type: 'line',
                        borderColor: '#2e231f', // Dark brown matching brand
                        backgroundColor: 'rgba(46, 35, 31, 0.15)',
                        borderWidth: 2,
                        tension: 0.3,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Revenue (₹)' },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Orders count' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    // ITEM-WISE PROFIT PAGE IMPLEMENTATION

    // Initialize default dates
    const todayStr = new Date().toISOString().split('T')[0];
    const firstDayStr = todayStr.slice(0, 8) + "01"; // First day of the month

    const pStartInput = document.getElementById("profitStartDate");
    const pEndInput = document.getElementById("profitEndDate");
    const pSortSelect = document.getElementById("profitSortSelect");

    if (pStartInput && pEndInput && pSortSelect) {
        pStartInput.value = firstDayStr;
        pEndInput.value = todayStr;

        pStartInput.addEventListener("change", () => renderItemWiseProfit());
        pEndInput.addEventListener("change", () => renderItemWiseProfit());
        pSortSelect.addEventListener("change", () => renderItemWiseProfit());
    }

    function renderItemWiseProfit() {
        const tbody = document.querySelector("#tableItemWiseProfit tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const startDate = document.getElementById("profitStartDate").value;
        const endDate = document.getElementById("profitEndDate").value;
        const sortBy = document.getElementById("profitSortSelect").value;

        const { store } = getCurrentRoleAndStore();
        
        const rawSales = liveStateData ? (liveStateData.productSales || []) : [];
        const recipes = liveStateData ? (liveStateData.recipes || []) : [];

        // Group sales by recipe ID / item name
        const itemProfitMap = {};

        rawSales.forEach(s => {
            // Check date range
            if (s.date < startDate || s.date > endDate) return;

            // Check store name filter
            if (store !== "All" && s.store !== store) return;

            const key = s.recipeId || s.itemName;
            if (!itemProfitMap[key]) {
                // Find cost from recipes master
                const recipe = recipes.find(r => r.id === s.recipeId || r.name.toLowerCase() === s.itemName.toLowerCase());
                const unitCost = recipe ? parseFloat(recipe.rawCost || 0) : 0;

                itemProfitMap[key] = {
                    name: s.itemName,
                    category: s.category || "General",
                    qty: 0,
                    revenue: 0,
                    unitCost: unitCost
                };
            }

            itemProfitMap[key].qty += parseInt(s.qty || 0);
            itemProfitMap[key].revenue += parseFloat(s.revenue || 0);
        });

        // Convert Map to Array and compute gross profit and margins
        const itemRows = Object.values(itemProfitMap).map(item => {
            const totalCost = item.qty * item.unitCost;
            const grossProfit = item.revenue - totalCost;
            const margin = item.revenue > 0 ? (grossProfit / item.revenue) * 100 : 0;

            return {
                ...item,
                totalCost,
                grossProfit,
                margin
            };
        });

        // Sort items
        if (sortBy === "revenue_desc") {
            itemRows.sort((a, b) => b.revenue - a.revenue);
        } else if (sortBy === "profit_desc") {
            itemRows.sort((a, b) => b.grossProfit - a.grossProfit);
        } else if (sortBy === "margin_desc") {
            itemRows.sort((a, b) => b.margin - a.margin);
        } else if (sortBy === "qty_desc") {
            itemRows.sort((a, b) => b.qty - a.qty);
        }

        // Calculate Overall KPIs
        let totalRevenue = 0;
        let totalCost = 0;

        itemRows.forEach(row => {
            totalRevenue += row.revenue;
            totalCost += row.totalCost;
        });

        const overallGrossProfit = totalRevenue - totalCost;
        const overallMarginPct = totalRevenue > 0 ? (overallGrossProfit / totalRevenue) * 100 : 0;

        // Find Most and Least Profitable items
        let mostProfitableItem = "--";
        let leastProfitableItem = "--";

        if (itemRows.length > 0) {
            // Find max gross profit row
            const maxProfitRow = [...itemRows].sort((a, b) => b.grossProfit - a.grossProfit)[0];
            mostProfitableItem = `${maxProfitRow.name} (${formatCurrency(maxProfitRow.grossProfit)})`;

            // Find min gross profit row
            const minProfitRow = [...itemRows].sort((a, b) => a.grossProfit - b.grossProfit)[0];
            leastProfitableItem = `${minProfitRow.name} (${formatCurrency(minProfitRow.grossProfit)})`;
        }

        // Render KPI fields
        document.getElementById("profit-kpi-most-profitable").textContent = mostProfitableItem;
        document.getElementById("profit-kpi-least-profitable").textContent = leastProfitableItem;
        document.getElementById("profit-kpi-overall-margin").textContent = `${overallMarginPct.toFixed(1)}%`;

        if (itemRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-tertiary);">No item-wise sales records for this period.</td></tr>`;
            return;
        }

        itemRows.forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${r.name}</strong></td>
                <td><span class="pill-badge pill-badge-secondary">${r.category}</span></td>
                <td style="text-align:right;">${r.qty}</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(r.revenue)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${formatCurrency(r.totalCost)}</td>
                <td style="text-align:right; font-weight:700; color:var(--success);">${formatCurrency(r.grossProfit)}</td>
                <td style="text-align:right; font-weight:700; color:var(--orange-primary);">${r.margin.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 6. MAIN SALES MODULE CONTROLLER NAV-CLICK DISPATCHER
    window.renderSalesScreen = async function(target) {
        if (!target) return;

        // Fetch fresh orders, etc.
        await fetchLiveAppState();

        if (target === 'sales-return') {
            renderSalesReturn();
        } else if (target === 'payment-reconciliation') {
            renderPaymentReconciliation();
        } else if (target === 'hourly-sales-report') {
            renderHourlySalesReport();
        } else if (target === 'item-wise-profit') {
            renderItemWiseProfit();
        }
    };

    // 7. ROUTING / SIDEBAR HANDLER AND BOOTSTRAP
    const targetScreens = [
        'sales-return', 'payment-reconciliation', 'hourly-sales-report', 'item-wise-profit'
    ];

    document.querySelectorAll(".nav-item").forEach(item => {
        const target = item.getAttribute("data-target");
        if (targetScreens.includes(target)) {
            item.addEventListener("click", () => {
                window.renderSalesScreen(target);
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
                        window.renderSalesScreen(target);
                    }
                }
            }, 200);
        });
    });

    // Initial seeding & loading operations
    seedDefaultData();
    loadState();
});
