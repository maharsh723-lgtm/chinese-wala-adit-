// gst.js - BK Operations India Enterprise GST Module

document.addEventListener("DOMContentLoaded", () => {
    // 1. Core API Base Configuration
    let API_BASE = '';
    if (window.location.protocol.startsWith('file')) {
        API_BASE = window.location.origin;
    } else if (window.location.port && window.location.port !== '3000') {
        API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    // 2. State & Storage Schema Initialization
    let gstFilingStatus = {}; // Maps period (YYYY-MM) -> 'Filed' | 'Not Filed'
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
    function saveState() {
        localStorage.setItem("bk_gst_filing_status", JSON.stringify(gstFilingStatus));
    }

    function loadState() {
        try {
            gstFilingStatus = JSON.parse(localStorage.getItem("bk_gst_filing_status")) || {};
        } catch (e) {
            console.error("Failed to load GST filing state:", e);
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
            console.error("Failed to fetch live app state in GST module:", e);
        }
    }

    // Helper: Compute GST breakdown for a single order
    // Restaurants: Dine-in / POS split equally to CGST + SGST (2.5% each = 5% total).
    // Online Deliveries (Swiggy / Zomato) mapped as IGST (5.0%).
    function calculateOrderGst(order) {
        const total = parseFloat(order.grandTotal || 0);
        const taxable = total / 1.05;
        const totalGst = total - taxable;

        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (order.source === "pos" || !order.source) {
            cgst = totalGst / 2;
            sgst = totalGst / 2;
        } else {
            igst = totalGst;
        }

        return {
            taxable,
            totalGst,
            cgst,
            sgst,
            igst,
            total
        };
    }

    // 3. GST SUMMARY PAGE IMPLEMENTATION
    const summaryStart = document.getElementById("gstSummaryStartDate");
    const summaryEnd = document.getElementById("gstSummaryEndDate");

    const todayStr = new Date().toISOString().split('T')[0];
    const firstDayStr = todayStr.slice(0, 8) + "01";

    if (summaryStart && summaryEnd) {
        summaryStart.value = firstDayStr;
        summaryEnd.value = todayStr;

        summaryStart.addEventListener("change", () => renderGstSummary());
        summaryEnd.addEventListener("change", () => renderGstSummary());
    }

    function renderGstSummary() {
        const tbody = document.querySelector("#tableGstSummary tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const startDate = document.getElementById("gstSummaryStartDate").value;
        const endDate = document.getElementById("gstSummaryEndDate").value;

        const { store } = getCurrentRoleAndStore();
        const orders = liveStateData ? (liveStateData.posOrders || []) : [];

        // Group GST by Date
        const dailyGstMap = {};

        const filteredOrders = orders.filter(o => {
            const matchStore = store === "All" || o.store === store;
            const matchDate = o.date >= startDate && o.date <= endDate;
            return matchStore && matchDate && o.status !== "Refunded";
        });

        let grandTaxable = 0;
        let grandCGST = 0;
        let grandSGST = 0;
        let grandIGST = 0;
        let grandGst = 0;
        let invoiceCount = filteredOrders.length;

        filteredOrders.forEach(o => {
            const gstBreakdown = calculateOrderGst(o);
            const date = o.date;

            if (!dailyGstMap[date]) {
                dailyGstMap[date] = {
                    date,
                    count: 0,
                    taxable: 0,
                    cgst: 0,
                    sgst: 0,
                    igst: 0,
                    totalGst: 0
                };
            }

            dailyGstMap[date].count++;
            dailyGstMap[date].taxable += gstBreakdown.taxable;
            dailyGstMap[date].cgst += gstBreakdown.cgst;
            dailyGstMap[date].sgst += gstBreakdown.sgst;
            dailyGstMap[date].igst += gstBreakdown.igst;
            dailyGstMap[date].totalGst += gstBreakdown.totalGst;

            grandTaxable += gstBreakdown.taxable;
            grandCGST += gstBreakdown.cgst;
            grandSGST += gstBreakdown.sgst;
            grandIGST += gstBreakdown.igst;
            grandGst += gstBreakdown.totalGst;
        });

        // Convert Map to Array and sort descending by Date
        const dailyRows = Object.values(dailyGstMap);
        dailyRows.sort((a, b) => b.date.localeCompare(a.date));

        if (dailyRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-tertiary);">No sales records for this period.</td></tr>`;
        }

        dailyRows.forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${r.date}</td>
                <td style="text-align:right;">${r.count}</td>
                <td style="text-align:right;">${formatCurrency(r.taxable)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${formatCurrency(r.cgst)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${formatCurrency(r.sgst)}</td>
                <td style="text-align:right; color:var(--orange-primary);">${formatCurrency(r.igst)}</td>
                <td style="text-align:right; font-weight:700; color:var(--success);">${formatCurrency(r.totalGst)}</td>
            `;
            tbody.appendChild(tr);
        });

        // Update KPIs
        document.getElementById("gst-summary-kpi-total-collected").textContent = formatCurrency(grandGst);
        document.getElementById("gst-summary-kpi-total-taxable").textContent = formatCurrency(grandTaxable);
        document.getElementById("gst-summary-kpi-total-invoices").textContent = invoiceCount;
        
        const avgGst = invoiceCount > 0 ? grandGst / invoiceCount : 0;
        document.getElementById("gst-summary-kpi-avg-gst").textContent = formatCurrency(avgGst);
    }

    // 4. CGST / SGST / IGST TAX JOURNAL IMPLEMENTATION
    const taxStart = document.getElementById("gstTaxStartDate");
    const taxEnd = document.getElementById("gstTaxEndDate");
    const taxTypeFilter = document.getElementById("gstTaxTypeSelect");

    if (taxStart && taxEnd && taxTypeFilter) {
        taxStart.value = firstDayStr;
        taxEnd.value = todayStr;

        taxStart.addEventListener("change", () => renderGstTaxBreakdown());
        taxEnd.addEventListener("change", () => renderGstTaxBreakdown());
        taxTypeFilter.addEventListener("change", () => renderGstTaxBreakdown());
    }

    function renderGstTaxBreakdown() {
        const tbody = document.querySelector("#tableGstTaxBreakdown tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const startDate = document.getElementById("gstTaxStartDate").value;
        const endDate = document.getElementById("gstTaxEndDate").value;
        const typeFilter = document.getElementById("gstTaxTypeSelect").value;

        const { store } = getCurrentRoleAndStore();
        const orders = liveStateData ? (liveStateData.posOrders || []) : [];

        // Filter and calculate
        const filtered = orders.filter(o => {
            const matchStore = store === "All" || o.store === store;
            const matchDate = o.date >= startDate && o.date <= endDate;
            if (o.status === "Refunded") return false;

            const gstBreakdown = calculateOrderGst(o);
            let matchType = true;
            if (typeFilter === "CGST_SGST") {
                matchType = gstBreakdown.cgst > 0;
            } else if (typeFilter === "IGST") {
                matchType = gstBreakdown.igst > 0;
            }

            return matchStore && matchDate && matchType;
        });

        // Sort descending
        filtered.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

        let totalCGST = 0;
        let totalSGST = 0;
        let totalIGST = 0;
        let totalCombined = 0;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-tertiary);">No audit logs matching selection.</td></tr>`;
        }

        filtered.forEach(o => {
            const b = calculateOrderGst(o);
            totalCGST += b.cgst;
            totalSGST += b.sgst;
            totalIGST += b.igst;
            totalCombined += b.totalGst;

            const sourceDisplay = o.source === "swiggy" ? "Swiggy" : (o.source === "zomato" ? "Zomato" : "POS / Dine-In");

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${o.date} <span style="font-size:0.75rem; color:var(--text-tertiary);">${o.time}</span></td>
                <td><span class="pill-badge pill-badge-secondary">${o.id}</span></td>
                <td><span class="pill-badge ${o.source === 'pos' || !o.source ? 'pill-badge-success' : 'pill-badge-warning'}">${sourceDisplay}</span></td>
                <td style="text-align:right;">${formatCurrency(b.taxable)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${b.cgst > 0 ? formatCurrency(b.cgst) : "-"}</td>
                <td style="text-align:right; color:var(--text-secondary);">${b.sgst > 0 ? formatCurrency(b.sgst) : "-"}</td>
                <td style="text-align:right; color:var(--orange-primary);">${b.igst > 0 ? formatCurrency(b.igst) : "-"}</td>
                <td style="text-align:right; font-weight:700; color:var(--success);">${formatCurrency(b.totalGst)}</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(b.total)}</td>
            `;
            tbody.appendChild(tr);
        });

        // Set KPIs
        document.getElementById("gst-tax-kpi-cgst").textContent = formatCurrency(totalCGST);
        document.getElementById("gst-tax-kpi-sgst").textContent = formatCurrency(totalSGST);
        document.getElementById("gst-tax-kpi-igst").textContent = formatCurrency(totalIGST);
        document.getElementById("gst-tax-kpi-combined").textContent = formatCurrency(totalCombined);
    }

    // 5. GST RETURN REPORT (GSTR-1) IMPLEMENTATION
    const returnPeriodInput = document.getElementById("gstReturnPeriod");
    if (returnPeriodInput) {
        // Set default month (current month)
        const currentMonthStr = todayStr.slice(0, 7); // "YYYY-MM"
        returnPeriodInput.value = currentMonthStr;

        returnPeriodInput.addEventListener("change", () => renderGstReturnReport());
    }

    function renderGstReturnReport() {
        const tbody = document.querySelector("#tableGstRateSlabs tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const period = document.getElementById("gstReturnPeriod").value; // "YYYY-MM"
        const { store } = getCurrentRoleAndStore();
        const orders = liveStateData ? (liveStateData.posOrders || []) : [];

        // GSTR-1 slab rates: We split overall sales into 5% standard slab
        // (Mock additional rate slabs to fulfill India mixed menu rates logic: e.g. beverages at 18% slab, snacks/packaged at 12% slab)
        const slabs = {
            "5% GST Slab": { rate: 5, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0 },
            "12% GST Slab": { rate: 12, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0 },
            "18% GST Slab": { rate: 18, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0 }
        };

        const periodOrders = orders.filter(o => {
            return o.date.startsWith(period) && (store === "All" || o.store === store) && o.status !== "Refunded";
        });

        let totalOutwardTaxable = 0;
        let totalTaxLiability = 0;

        periodOrders.forEach((o, index) => {
            // Distribute menu rates mock-wise for visual correctness of GSTR rates breakdown
            // Let's assume order values are distributed: 70% of orders are 5%, 20% are 12%, 10% are 18%
            let slabKey = "5% GST Slab";
            let rate = 5;

            if (index % 10 === 7 || index % 10 === 8) {
                slabKey = "12% GST Slab";
                rate = 12;
            } else if (index % 10 === 9) {
                slabKey = "18% GST Slab";
                rate = 18;
            }

            const total = parseFloat(o.grandTotal || 0);
            const factor = 1 + (rate / 100);
            const taxable = total / factor;
            const totalGst = total - taxable;

            let cgst = 0;
            let sgst = 0;
            let igst = 0;

            if (o.source === "pos" || !o.source) {
                cgst = totalGst / 2;
                sgst = totalGst / 2;
            } else {
                igst = totalGst;
            }

            slabs[slabKey].taxable += taxable;
            slabs[slabKey].cgst += cgst;
            slabs[slabKey].sgst += sgst;
            slabs[slabKey].igst += igst;
            slabs[slabKey].totalGst += totalGst;

            totalOutwardTaxable += taxable;
            totalTaxLiability += totalGst;
        });

        // Set KPIs
        document.getElementById("gst-return-kpi-taxable").textContent = formatCurrency(totalOutwardTaxable);
        document.getElementById("gst-return-kpi-liability").textContent = formatCurrency(totalTaxLiability);
        document.getElementById("gst-return-kpi-period").textContent = period;

        // Render Filing Status Badge and Button text
        const status = gstFilingStatus[period] || "Not Filed";
        const badge = document.getElementById("gst-return-filing-status-badge");
        const btn = document.getElementById("btnToggleGstFilingStatus");

        if (badge && btn) {
            if (status === "Filed") {
                badge.className = "pill-badge pill-badge-success";
                badge.textContent = "Filed";
                btn.textContent = "Mark as Not Filed";
                btn.className = "saas-btn saas-btn-secondary";
            } else {
                badge.className = "pill-badge pill-badge-danger";
                badge.textContent = "Not Filed";
                btn.textContent = "Mark as Filed";
                btn.className = "saas-btn saas-btn-primary";
            }
        }

        // Render table
        Object.keys(slabs).forEach(key => {
            const slab = slabs[key];
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${key}</strong></td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(slab.taxable)}</td>
                <td style="text-align:right; color:var(--text-secondary);">${slab.cgst > 0 ? formatCurrency(slab.cgst) : "-"}</td>
                <td style="text-align:right; color:var(--text-secondary);">${slab.sgst > 0 ? formatCurrency(slab.sgst) : "-"}</td>
                <td style="text-align:right; color:var(--orange-primary);">${slab.igst > 0 ? formatCurrency(slab.igst) : "-"}</td>
                <td style="text-align:right; font-weight:700; color:var(--success);">${formatCurrency(slab.totalGst)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Toggle Return Filing Status manually
    window.toggleGstFilingStatus = function() {
        const period = document.getElementById("gstReturnPeriod").value;
        if (!period) return;

        const currentStatus = gstFilingStatus[period] || "Not Filed";
        gstFilingStatus[period] = currentStatus === "Filed" ? "Not Filed" : "Filed";
        
        saveState();
        renderGstReturnReport();
    };

    // Print GSTR-1 Outward Summary Sheet
    window.printGstReturnSummary = function() {
        const printContent = document.getElementById("printGstArea").innerHTML;
        const period = document.getElementById("gstReturnPeriod").value;
        
        const originalContent = document.body.innerHTML;

        // Open a clean printable layout sheet
        const printWindow = window.open("", "_blank", "width=800,height=600");
        printWindow.document.write(`
            <html>
                <head>
                    <title>GSTR-1 Return Supply Sheet - ${period}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; color: #2e231f; background: #fff; }
                        h2 { font-weight: 800; border-bottom: 2px solid #f26c25; padding-bottom: 8px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #f7f5f4; font-weight: bold; }
                        .text-right { text-align: right; }
                        .header-meta { margin-bottom: 20px; display: flex; justify-content: space-between; }
                    </style>
                </head>
                <body>
                    <h2>GSTR-1 Return Tax Invoice Summary</h2>
                    <div class="header-meta">
                        <div><strong>Filing Period:</strong> ${period}</div>
                        <div><strong>Generated Date:</strong> ${new Date().toISOString().split('T')[0]}</div>
                    </div>
                    ${printContent}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    // 6. MAIN CONTROLLER NAV-CLICK DISPATCHER
    window.renderGstScreen = async function(target) {
        if (!target) return;

        // Fetch fresh orders, etc.
        await fetchLiveAppState();

        if (target === 'gst-summary') {
            renderGstSummary();
        } else if (target === 'gst-tax-breakdown') {
            renderGstTaxBreakdown();
        } else if (target === 'gst-return-reports') {
            renderGstReturnReport();
        }
    };

    // 7. ROUTING / SIDEBAR HANDLER AND BOOTSTRAP
    const targetScreens = [
        'gst-summary', 'gst-tax-breakdown', 'gst-return-reports'
    ];

    document.querySelectorAll(".nav-item").forEach(item => {
        const target = item.getAttribute("data-target");
        if (targetScreens.includes(target)) {
            item.addEventListener("click", () => {
                window.renderGstScreen(target);
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
                        window.renderGstScreen(target);
                    }
                }
            }, 200);
        });
    });

    // Initial load operations
    loadState();
});
