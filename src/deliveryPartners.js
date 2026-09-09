// deliveryPartners.js - BK Operations India Enterprise Delivery Partners Module

document.addEventListener("DOMContentLoaded", () => {
    // 1. Core API Base Configuration
    // Absolute base URL if opened via file:// protocol or other ports
    let API_BASE = '';
    if (window.location.protocol.startsWith('file')) {
        API_BASE = 'http://localhost:3000';
    } else if (window.location.port && window.location.port !== '3000') {
        API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    // 2. State & Storage Schema Initialization
    let deliverySettlements = {}; // Maps orderId -> { status: 'Settled'|'Pending', settlementDate: 'YYYY-MM-DD' }
    let liveStateData = null; // Stored backend API data
    let marginChartInstance = null;

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
    function saveState() {
        localStorage.setItem("bk_delivery_settlements", JSON.stringify(deliverySettlements));
    }

    function loadState() {
        try {
            deliverySettlements = JSON.parse(localStorage.getItem("bk_delivery_settlements")) || {};
        } catch (e) {
            console.error("Failed to load delivery settlements state:", e);
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
            console.error("Failed to fetch live app state in delivery partners module:", e);
        }
    }

    // Interactive toggle to settle an order
    window.toggleOrderSettlement = function(orderId, platform) {
        const todayStr = new Date().toISOString().split('T')[0];
        
        if (deliverySettlements[orderId] && deliverySettlements[orderId].status === "Settled") {
            // Revert to pending
            deliverySettlements[orderId] = {
                status: "Pending",
                settlementDate: null
            };
        } else {
            // Mark as settled
            deliverySettlements[orderId] = {
                status: "Settled",
                settlementDate: todayStr
            };
        }

        saveState();
        
        // Re-render active view
        if (platform === "swiggy") {
            renderSwiggySettlementReport();
        } else {
            renderZomatoSettlementReport();
        }
    };

    // 3. SWIGGY SETTLEMENT REPORT IMPLEMENTATION
    const swiggyStart = document.getElementById("swiggyStartDate");
    const swiggyEnd = document.getElementById("swiggyEndDate");
    const swiggyStatus = document.getElementById("swiggyStatusSelect");

    // Initialize default dates (first day of month to today)
    const todayStr = new Date().toISOString().split('T')[0];
    const firstDayStr = todayStr.slice(0, 8) + "01";

    if (swiggyStart && swiggyEnd && swiggyStatus) {
        swiggyStart.value = firstDayStr;
        swiggyEnd.value = todayStr;

        swiggyStart.addEventListener("change", () => renderSwiggySettlementReport());
        swiggyEnd.addEventListener("change", () => renderSwiggySettlementReport());
        swiggyStatus.addEventListener("change", () => renderSwiggySettlementReport());
    }

    function renderSwiggySettlementReport() {
        const tbody = document.querySelector("#tableSwiggySettlement tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const startDate = document.getElementById("swiggyStartDate").value;
        const endDate = document.getElementById("swiggyEndDate").value;
        const statusFilter = document.getElementById("swiggyStatusSelect").value;

        const { store } = getCurrentRoleAndStore();
        const orders = liveStateData ? (liveStateData.posOrders || []) : [];

        // Filter Swiggy orders
        const swiggyOrders = orders.filter(o => {
            const matchStore = store === "All" || o.store === store;
            const matchDate = o.date >= startDate && o.date <= endDate;
            const isSwiggy = o.source === "swiggy";
            
            // Get settlement info
            const settleInfo = deliverySettlements[o.id] || { status: "Pending", settlementDate: null };
            const matchStatus = statusFilter === "All" || settleInfo.status === statusFilter;

            return matchStore && matchDate && isSwiggy && matchStatus;
        });

        // Sort orders descending by date
        swiggyOrders.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

        let totalValue = 0;
        let totalCommission = 0;
        let totalPayout = 0;
        let pendingSettlement = 0;

        if (swiggyOrders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-tertiary);">No Swiggy orders found.</td></tr>`;
        }

        swiggyOrders.forEach(o => {
            const value = parseFloat(o.grandTotal || 0);
            
            // Swiggy Standard parameters: 22% commission, ₹15 flat packaging fee, 2% ad cost
            const commPct = 22;
            const commAmt = value * (commPct / 100);
            const otherDeductions = 15 + (value * 0.02);
            const netPayout = value - commAmt - otherDeductions;

            const settleInfo = deliverySettlements[o.id] || { status: "Pending", settlementDate: null };

            totalValue += value;
            totalCommission += commAmt;

            if (settleInfo.status === "Settled") {
                totalPayout += netPayout;
            } else {
                pendingSettlement += netPayout;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${o.date} <span style="font-size:0.75rem; color:var(--text-tertiary);">${o.time}</span></td>
                <td><span class="pill-badge pill-badge-secondary">${o.id}</span></td>
                <td style="text-align:right;">${formatCurrency(value)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${commPct}%</td>
                <td style="text-align:right; color:var(--orange-primary); font-weight:500;">${formatCurrency(commAmt)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${formatCurrency(otherDeductions)}</td>
                <td style="text-align:right; font-weight:700; color:var(--success);">${formatCurrency(netPayout)}</td>
                <td>
                    <span class="pill-badge ${settleInfo.status === 'Settled' ? 'pill-badge-success' : 'pill-badge-warning'}">
                        ${settleInfo.status}
                    </span>
                    ${settleInfo.settlementDate ? `<div style="font-size:0.7rem; color:var(--text-tertiary); margin-top:2px;">${settleInfo.settlementDate}</div>` : ''}
                </td>
                <td>
                    <button class="saas-btn" style="padding: 4px 8px; font-size:0.75rem; border:1px solid var(--border); background:none; cursor:pointer;" onclick="toggleOrderSettlement('${o.id}', 'swiggy')">
                        ${settleInfo.status === 'Settled' ? 'Mark Pending' : 'Mark Settled'}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Set KPIs
        document.getElementById("swiggy-kpi-total-orders").textContent = formatCurrency(totalValue);
        document.getElementById("swiggy-kpi-total-commission").textContent = formatCurrency(totalCommission);
        document.getElementById("swiggy-kpi-total-payout").textContent = formatCurrency(totalPayout);
        document.getElementById("swiggy-kpi-pending-settlement").textContent = formatCurrency(pendingSettlement);
    }

    // 4. ZOMATO SETTLEMENT REPORT IMPLEMENTATION
    const zomatoStart = document.getElementById("zomatoStartDate");
    const zomatoEnd = document.getElementById("zomatoEndDate");
    const zomatoStatus = document.getElementById("zomatoStatusSelect");

    if (zomatoStart && zomatoEnd && zomatoStatus) {
        zomatoStart.value = firstDayStr;
        zomatoEnd.value = todayStr;

        zomatoStart.addEventListener("change", () => renderZomatoSettlementReport());
        zomatoEnd.addEventListener("change", () => renderZomatoSettlementReport());
        zomatoStatus.addEventListener("change", () => renderZomatoSettlementReport());
    }

    function renderZomatoSettlementReport() {
        const tbody = document.querySelector("#tableZomatoSettlement tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const startDate = document.getElementById("zomatoStartDate").value;
        const endDate = document.getElementById("zomatoEndDate").value;
        const statusFilter = document.getElementById("zomatoStatusSelect").value;

        const { store } = getCurrentRoleAndStore();
        const orders = liveStateData ? (liveStateData.posOrders || []) : [];

        // Filter Zomato orders
        const zomatoOrders = orders.filter(o => {
            const matchStore = store === "All" || o.store === store;
            const matchDate = o.date >= startDate && o.date <= endDate;
            const isZomato = o.source === "zomato";
            
            // Get settlement info
            const settleInfo = deliverySettlements[o.id] || { status: "Pending", settlementDate: null };
            const matchStatus = statusFilter === "All" || settleInfo.status === statusFilter;

            return matchStore && matchDate && isZomato && matchStatus;
        });

        // Sort orders descending by date
        zomatoOrders.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

        let totalValue = 0;
        let totalCommission = 0;
        let totalPayout = 0;
        let pendingSettlement = 0;

        if (zomatoOrders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-tertiary);">No Zomato orders found.</td></tr>`;
        }

        zomatoOrders.forEach(o => {
            const value = parseFloat(o.grandTotal || 0);
            
            // Zomato Standard parameters: 25% commission, ₹15 flat packaging fee, 2% ad cost
            const commPct = 25;
            const commAmt = value * (commPct / 100);
            const otherDeductions = 15 + (value * 0.02);
            const netPayout = value - commAmt - otherDeductions;

            const settleInfo = deliverySettlements[o.id] || { status: "Pending", settlementDate: null };

            totalValue += value;
            totalCommission += commAmt;

            if (settleInfo.status === "Settled") {
                totalPayout += netPayout;
            } else {
                pendingSettlement += netPayout;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${o.date} <span style="font-size:0.75rem; color:var(--text-tertiary);">${o.time}</span></td>
                <td><span class="pill-badge pill-badge-secondary">${o.id}</span></td>
                <td style="text-align:right;">${formatCurrency(value)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${commPct}%</td>
                <td style="text-align:right; color:var(--danger); font-weight:500;">${formatCurrency(commAmt)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${formatCurrency(otherDeductions)}</td>
                <td style="text-align:right; font-weight:700; color:var(--success);">${formatCurrency(netPayout)}</td>
                <td>
                    <span class="pill-badge ${settleInfo.status === 'Settled' ? 'pill-badge-success' : 'pill-badge-warning'}">
                        ${settleInfo.status}
                    </span>
                    ${settleInfo.settlementDate ? `<div style="font-size:0.7rem; color:var(--text-tertiary); margin-top:2px;">${settleInfo.settlementDate}</div>` : ''}
                </td>
                <td>
                    <button class="saas-btn" style="padding: 4px 8px; font-size:0.75rem; border:1px solid var(--border); background:none; cursor:pointer;" onclick="toggleOrderSettlement('${o.id}', 'zomato')">
                        ${settleInfo.status === 'Settled' ? 'Mark Pending' : 'Mark Settled'}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Set KPIs
        document.getElementById("zomato-kpi-total-orders").textContent = formatCurrency(totalValue);
        document.getElementById("zomato-kpi-total-commission").textContent = formatCurrency(totalCommission);
        document.getElementById("zomato-kpi-total-payout").textContent = formatCurrency(totalPayout);
        document.getElementById("zomato-kpi-pending-settlement").textContent = formatCurrency(pendingSettlement);
    }

    // 5. COMMISSION & MARGIN COMPARISON REPORT IMPLEMENTATION
    const marginStart = document.getElementById("marginStartDate");
    const marginEnd = document.getElementById("marginEndDate");

    if (marginStart && marginEnd) {
        marginStart.value = firstDayStr;
        marginEnd.value = todayStr;

        marginStart.addEventListener("change", () => renderCommissionMarginReport());
        marginEnd.addEventListener("change", () => renderCommissionMarginReport());
    }

    function renderCommissionMarginReport() {
        const tbody = document.querySelector("#tableCommissionMargin tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const startDate = document.getElementById("marginStartDate").value;
        const endDate = document.getElementById("marginEndDate").value;

        const { store } = getCurrentRoleAndStore();
        const orders = liveStateData ? (liveStateData.posOrders || []) : [];

        // Platform groupings
        const platformStats = {
            Swiggy: { count: 0, rawValue: 0, commission: 0, payout: 0, commissionPct: 22, name: 'Swiggy' },
            Zomato: { count: 0, rawValue: 0, commission: 0, payout: 0, commissionPct: 25, name: 'Zomato' },
            POS: { count: 0, rawValue: 0, commission: 0, payout: 0, commissionPct: 0, name: 'Dine-in / POS' }
        };

        orders.forEach(o => {
            if (o.date < startDate || o.date > endDate) return;
            if (store !== "All" && o.store !== store) return;
            if (o.status === "Refunded" || o.status === "Cancelled" || o.status === "Deleted") return;

            const value = parseFloat(o.grandTotal || 0);

            if (o.source === "swiggy") {
                const comm = value * 0.22;
                const deductions = 15 + (value * 0.02);
                platformStats.Swiggy.count++;
                platformStats.Swiggy.rawValue += value;
                platformStats.Swiggy.commission += comm;
                platformStats.Swiggy.payout += (value - comm - deductions);
            } else if (o.source === "zomato") {
                const comm = value * 0.25;
                const deductions = 15 + (value * 0.02);
                platformStats.Zomato.count++;
                platformStats.Zomato.rawValue += value;
                platformStats.Zomato.commission += comm;
                platformStats.Zomato.payout += (value - comm - deductions);
            } else {
                platformStats.POS.count++;
                platformStats.POS.rawValue += value;
                platformStats.POS.payout += value;
            }
        });

        let totalCommissionsPaid = platformStats.Swiggy.commission + platformStats.Zomato.commission;
        let totalRevenue = platformStats.Swiggy.rawValue + platformStats.Zomato.rawValue + platformStats.POS.rawValue;
        let overallPayout = platformStats.Swiggy.payout + platformStats.Zomato.payout + platformStats.POS.payout;
        let overallNetMarginPct = totalRevenue > 0 ? (overallPayout / totalRevenue) * 100 : 100;

        // Set KPIs
        document.getElementById("margin-kpi-total-commission-paid").textContent = formatCurrency(totalCommissionsPaid);
        document.getElementById("margin-kpi-overall-net-margin").textContent = `${overallNetMarginPct.toFixed(1)}%`;
        
        // Find highest commission platform
        const highestComm = platformStats.Zomato.commissionPct > platformStats.Swiggy.commissionPct ? "Zomato (25%)" : "Swiggy (22%)";
        document.getElementById("margin-kpi-highest-comm-platform").textContent = highestComm;

        // Render comparative table rows
        const statsArray = [platformStats.Swiggy, platformStats.Zomato, platformStats.POS];
        
        statsArray.forEach(p => {
            const effCommPct = p.rawValue > 0 ? (p.commission / p.rawValue) * 100 : 0;
            const payoutPct = p.rawValue > 0 ? (p.payout / p.rawValue) * 100 : 100;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${p.name}</strong></td>
                <td style="text-align:right;">${p.count}</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(p.rawValue)}</td>
                <td style="text-align:right; color:var(--danger); font-weight:500;">${formatCurrency(p.commission)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${effCommPct.toFixed(1)}%</td>
                <td style="text-align:right; font-weight:700; color:var(--success);">${formatCurrency(p.payout)}</td>
                <td style="text-align:right; font-weight:700; color:var(--orange-primary);">${payoutPct.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });

        // Render Chart.js comparison chart
        const ctx = document.getElementById("chartCommissionMargin").getContext("2d");
        if (marginChartInstance) {
            marginChartInstance.destroy();
        }

        marginChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Swiggy', 'Zomato', 'Dine-in / POS'],
                datasets: [
                    {
                        label: 'Total Sales (₹)',
                        data: [platformStats.Swiggy.rawValue, platformStats.Zomato.rawValue, platformStats.POS.rawValue],
                        backgroundColor: [
                            'rgba(242, 108, 37, 0.4)', // Swiggy Orange
                            'rgba(203, 32, 45, 0.4)',  // Zomato Red
                            'rgba(46, 35, 31, 0.4)'    // POS Brown
                        ],
                        borderColor: ['#f26c25', '#CB202D', '#2e231f'],
                        borderWidth: 1
                    },
                    {
                        label: 'Net Payout Received (₹)',
                        data: [platformStats.Swiggy.payout, platformStats.Zomato.payout, platformStats.POS.payout],
                        backgroundColor: [
                            'rgba(242, 108, 37, 0.85)',
                            'rgba(203, 32, 45, 0.85)',
                            'rgba(46, 35, 31, 0.85)'
                        ],
                        borderColor: ['#f26c25', '#CB202D', '#2e231f'],
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

    // 6. MAIN CONTROLLER NAV-CLICK DISPATCHER
    window.renderDeliveryScreen = async function(target) {
        if (!target) return;

        // Fetch fresh orders, etc.
        await fetchLiveAppState();

        if (target === 'swiggy-settlement-report') {
            renderSwiggySettlementReport();
        } else if (target === 'zomato-settlement-report') {
            renderZomatoSettlementReport();
        } else if (target === 'commission-margin-report') {
            renderCommissionMarginReport();
        }
    };

    // 7. ROUTING / SIDEBAR HANDLER AND BOOTSTRAP
    const targetScreens = [
        'swiggy-settlement-report', 'zomato-settlement-report', 'commission-margin-report'
    ];

    document.querySelectorAll(".nav-item").forEach(item => {
        const target = item.getAttribute("data-target");
        if (targetScreens.includes(target)) {
            item.addEventListener("click", () => {
                window.renderDeliveryScreen(target);
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
                        window.renderDeliveryScreen(target);
                    }
                }
            }, 200);
        });
    });

    // Initial load operations
    loadState();
});
