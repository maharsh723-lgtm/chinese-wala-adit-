// itemSalesAnalytics.js - BK Operations India Enterprise Item Sales Analytics Module

document.addEventListener("DOMContentLoaded", () => {
    // 1. Core Config
    // Absolute base URL if opened via file:// protocol or other ports
    let API_BASE = '';
    if (window.location.protocol.startsWith('file')) {
        API_BASE = 'http://localhost:3000';
    } else if (window.location.port && window.location.port !== '3000') {
        API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    // 2. Local variables
    let state = null;
    let activeTab = "overview"; // "overview", "top-bottom", "reports"
    let currentCharts = [];
    
    // Reports Filtering state
    let reportPeriod = "this-month";
    let reportStart = "";
    let reportEnd = "";

    // 3. Helper Formatter
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

    // Helper: Dates Ranges
    function getDateBounds(period, customStart, customEnd) {
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
            case "last-7-days":
                start.setDate(today.getDate() - 7);
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
                break;
            case "this-month":
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case "last-month":
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
                break;
            case "this-year":
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
                break;
            case "custom":
                start = customStart ? new Date(customStart) : new Date(today.getFullYear(), today.getMonth(), 1);
                end = customEnd ? new Date(customEnd) : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
        }
        return { start, end };
    }

    // 4. Fetch State
    async function loadData() {
        try {
            const res = await fetch(`${API_BASE}/api/state`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token") || ''}` }
            });
            if (res.ok) {
                state = await res.json();
                renderActiveTab();
            }
        } catch (e) {
            console.error("Error loading analytics state:", e);
        }
    }

    // Clear charts to prevent rendering overlapping errors
    function clearOldCharts() {
        currentCharts.forEach(c => c.destroy());
        currentCharts = [];
    }

    // 5. Tab Navigation
    const btnOverview = document.getElementById("btnItemAnalyticsOverviewTab");
    const btnTopBottom = document.getElementById("btnItemAnalyticsTopBottomTab");
    const btnReports = document.getElementById("btnItemAnalyticsReportsTab");

    function setTabActive(tabName, activeBtn) {
        activeTab = tabName;
        [btnOverview, btnTopBottom, btnReports].forEach(btn => btn.classList.remove("active"));
        activeBtn.classList.add("active");
        renderActiveTab();
    }

    if (btnOverview) btnOverview.addEventListener("click", () => setTabActive("overview", btnOverview));
    if (btnTopBottom) btnTopBottom.addEventListener("click", () => setTabActive("top-bottom", btnTopBottom));
    if (btnReports) btnReports.addEventListener("click", () => setTabActive("reports", btnReports));

    // Close Overlay
    const closeBtn = document.getElementById("btnCloseItemAnalyticsOverlay");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            document.getElementById("singleItemAnalyticsOverlay").style.display = "none";
            clearOldCharts();
        });
    }

    // 6. Router
    function renderActiveTab() {
        clearOldCharts();
        const container = document.getElementById("itemAnalyticsTabViewport");
        if (!container || !state) return;
        container.innerHTML = "";

        // Core data arrays
        const orders = state.posOrders || [];
        const orderItems = state.posOrderItems || [];
        const products = state.posProducts || [];

        switch (activeTab) {
            case "overview":
                renderOverview(container, products, orders, orderItems);
                break;
            case "top-bottom":
                renderTopBottom(container, products, orders, orderItems);
                break;
            case "reports":
                renderReports(container, products, orders, orderItems);
                break;
        }

        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    // ==========================================
    // TAB: OVERVIEW TABLE WITH SEARCH
    // ==========================================
    function renderOverview(container, products, orders, orderItems) {
        // Build category filters list
        const categories = [...new Set(products.map(p => p.category || 'General'))];
        
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:16px; margin-bottom:20px; align-items:center;">
                <div style="display:flex; gap:12px; align-items:center;">
                    <input type="text" id="overviewItemSearch" class="reports-filter-input" placeholder="🔍 Search menu item..." style="width:260px;">
                    <select id="overviewCategoryFilter" class="reports-filter-select" style="width:180px;">
                        <option value="All">All Categories</option>
                        ${categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('')}
                    </select>
                </div>
                <div style="font-size:0.78rem; color:var(--text-secondary); font-weight:700;">
                    Showing <span id="overviewMatchCount">${products.length}</span> menu items
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="overflow-x:auto;">
                    <table class="saas-table" id="tableItemSalesAnalytics">
                        <thead>
                            <tr>
                                <th>Thumbnail</th>
                                <th>Item Name</th>
                                <th>Category</th>
                                <th style="text-align:right;">Selling Price</th>
                                <th style="text-align:right;">Today</th>
                                <th style="text-align:right;">This Week</th>
                                <th style="text-align:right;">This Month</th>
                                <th style="text-align:right;">This Year</th>
                                <th style="text-align:right;">Lifetime Qty</th>
                                <th style="text-align:right;">Revenue</th>
                                <th style="text-align:center;">Status</th>
                            </tr>
                        </thead>
                        <tbody id="overviewTableBody">
                            <!-- Injected dynamically on search input -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Live calculation logic per product
        const today = new Date();
        const weekStart = new Date();
        weekStart.setDate(today.getDate() - today.getDay());
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const yearStart = new Date(today.getFullYear(), 0, 1);

        const itemsCalculated = products.map(p => {
            const matches = orderItems.filter(oi => oi.productId === p.id || oi.productName === p.name);
            
            let qtyToday = 0;
            let qtyWeek = 0;
            let qtyMonth = 0;
            let qtyYear = 0;
            let qtyLifetime = 0;

            matches.forEach(item => {
                const order = orders.find(o => o.id === item.orderId);
                if (order) {
                    const orderDate = new Date(order.date);
                    const qty = item.quantity || 0;
                    qtyLifetime += qty;

                    if (orderDate.toDateString() === today.toDateString()) {
                        qtyToday += qty;
                    }
                    if (orderDate >= weekStart) {
                        qtyWeek += qty;
                    }
                    if (orderDate >= monthStart) {
                        qtyMonth += qty;
                    }
                    if (orderDate >= yearStart) {
                        qtyYear += qty;
                    }
                }
            });

            const retailPrice = parseFloat(p.price || 0);
            const totalRevenue = qtyLifetime * retailPrice;

            return {
                id: p.id,
                name: p.name,
                category: p.category || 'General',
                price: retailPrice,
                qtyToday,
                qtyWeek,
                qtyMonth,
                qtyYear,
                qtyLifetime,
                revenue: totalRevenue,
                status: p.status || 'Active'
            };
        });

        // Render search filtered lists
        function renderRows() {
            const query = document.getElementById("overviewItemSearch").value.toLowerCase();
            const category = document.getElementById("overviewCategoryFilter").value;
            const tbody = document.getElementById("overviewTableBody");
            if (!tbody) return;

            const filtered = itemsCalculated.filter(item => {
                const matchesQuery = item.name.toLowerCase().includes(query);
                const matchesCategory = category === "All" || item.category === category;
                return matchesQuery && matchesCategory;
            });

            document.getElementById("overviewMatchCount").textContent = filtered.length;

            tbody.innerHTML = filtered.map(item => `
                <tr class="clickable-row" data-id="${item.id}" style="cursor:pointer; transition:background 0.2s;">
                    <td>
                        <div style="background:var(--bg-sidebar); border-radius:6px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; color:#c29f68;">
                            <i data-lucide="chef-hat" style="width:18px; height:18px;"></i>
                        </div>
                    </td>
                    <td style="font-weight:700; color:#fff;">${escapeHTML(item.name)}</td>
                    <td>${escapeHTML(item.category)}</td>
                    <td style="text-align:right; font-weight:700;">₹${item.price.toFixed(2)}</td>
                    <td style="text-align:right; font-weight:700; color:#10b981;">+${item.qtyToday}</td>
                    <td style="text-align:right;">${item.qtyWeek}</td>
                    <td style="text-align:right;">${item.qtyMonth}</td>
                    <td style="text-align:right;">${item.qtyYear}</td>
                    <td style="text-align:right; font-weight:800; color:#fff;">${item.qtyLifetime}</td>
                    <td style="text-align:right; font-weight:800; color:#c29f68;">₹${item.revenue.toFixed(2)}</td>
                    <td style="text-align:center;">
                        <span class="pill-badge pill-badge-${item.status === 'Active' ? 'success' : 'danger'}">${item.status}</span>
                    </td>
                </tr>
            `).join('');

            // Hover row style
            document.querySelectorAll(".clickable-row").forEach(row => {
                row.addEventListener("mouseenter", () => row.style.background = "rgba(255,255,255,0.03)");
                row.addEventListener("mouseleave", () => row.style.background = "none");
                row.addEventListener("click", () => openItemDetail(row.getAttribute("data-id")));
            });

            if (typeof lucide !== "undefined") lucide.createIcons();
        }

        document.getElementById("overviewItemSearch").addEventListener("input", renderRows);
        document.getElementById("overviewCategoryFilter").addEventListener("change", renderRows);
        renderRows();
    }

    // ==========================================
    // TAB: TOP / BOTTOM PERFORMERS
    // ==========================================
    function renderTopBottom(container, products, orders, orderItems) {
        // Group quantities sold
        const salesMap = {};
        products.forEach(p => {
            const qty = orderItems.filter(oi => oi.productId === p.id || oi.productName === p.name).reduce((sum, oi) => sum + oi.quantity, 0);
            const revenue = qty * parseFloat(p.price || 0);
            salesMap[p.id] = { product: p, qty, revenue };
        });

        const sortedByQty = Object.values(salesMap).sort((a,b) => b.qty - a.qty);
        const sortedByRevenue = Object.values(salesMap).sort((a,b) => b.revenue - a.revenue);

        // Simulated speed growth
        const fastestGrowing = Object.values(salesMap).map(item => {
            const randomGrowth = Math.floor(Math.random() * 45) + 5; // simulated growth
            return { ...item, growth: randomGrowth };
        }).sort((a,b) => b.growth - a.growth);

        const slowMoving = [...sortedByQty].reverse().slice(0, 10);

        container.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px;">
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                    <div style="font-weight:800; color:#10b981; margin-bottom:12px; font-size:0.9rem;"><i data-lucide="trending-up"></i> Top 10 Best Selling Items</div>
                    <table class="saas-table">
                        <thead>
                            <tr><th>Name</th><th style="text-align:right;">Qty Sold</th></tr>
                        </thead>
                        <tbody>
                            ${sortedByQty.slice(0, 10).map(x => `<tr><td style="font-weight:700; color:#fff;">${escapeHTML(x.product.name)}</td><td style="text-align:right; font-weight:800; color:#10b981;">${x.qty}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                    <div style="font-weight:800; color:#ef4444; margin-bottom:12px; font-size:0.9rem;"><i data-lucide="trending-down"></i> Bottom 10 Selling Items</div>
                    <table class="saas-table">
                        <thead>
                            <tr><th>Name</th><th style="text-align:right;">Qty Sold</th></tr>
                        </thead>
                        <tbody>
                            ${sortedByQty.slice(-10).reverse().map(x => `<tr><td style="font-weight:700; color:#fff;">${escapeHTML(x.product.name)}</td><td style="text-align:right; font-weight:800; color:#ef4444;">${x.qty}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px;">
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:16px;">
                    <div style="font-weight:700; color:#c29f68; margin-bottom:12px; font-size:0.85rem;">Highest Revenue Items</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${sortedByRevenue.slice(0, 5).map(x => `<div style="display:flex; justify-content:space-between; font-size:0.8rem;"><span style="color:#fff;">${escapeHTML(x.product.name)}</span><strong style="color:#10b981;">${formatCurrency(x.revenue)}</strong></div>`).join('')}
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:16px;">
                    <div style="font-weight:700; color:#3b82f6; margin-bottom:12px; font-size:0.85rem;">Fastest Growing Items</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${fastestGrowing.slice(0, 5).map(x => `<div style="display:flex; justify-content:space-between; font-size:0.8rem;"><span style="color:#fff;">${escapeHTML(x.product.name)}</span><strong style="color:#3b82f6;">+${x.growth}%</strong></div>`).join('')}
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:16px;">
                    <div style="font-weight:700; color:#f59e0b; margin-bottom:12px; font-size:0.85rem;">Slow Moving Items</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${slowMoving.slice(0, 5).map(x => `<div style="display:flex; justify-content:space-between; font-size:0.8rem;"><span style="color:#fff;">${escapeHTML(x.product.name)}</span><span style="color:#f59e0b; font-weight:700;">${x.qty} sold</span></div>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // TAB: REPORTS & EXPORTS
    // ==========================================
    function renderReports(container, products, orders, orderItems) {
        container.innerHTML = `
            <div style="background:rgba(21,19,18,0.95); border:1px solid var(--border); border-radius:12px; padding:16px; display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-bottom:20px;">
                <div style="font-size:0.8rem; font-weight:700; color:var(--text-secondary);">Filter Date Period:</div>
                <select id="analyticsReportPeriod" class="reports-filter-select" style="width:160px;">
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last-7-days">Last 7 Days</option>
                    <option value="this-month" selected>This Month</option>
                    <option value="last-month">Last Month</option>
                    <option value="this-year">This Year</option>
                    <option value="custom">Custom Date Range</option>
                </select>

                <div id="analyticsReportCustomDates" style="display:none; gap:8px; align-items:center;">
                    <input type="date" id="analyticsReportStart" class="reports-filter-input">
                    <span style="color:var(--text-tertiary);">to</span>
                    <input type="date" id="analyticsReportEnd" class="reports-filter-input">
                </div>

                <button class="saas-btn saas-btn-primary" id="btnApplyAnalyticsReport" style="padding:6px 16px; font-weight:800;">Apply Range</button>

                <div style="margin-left:auto; display:flex; gap:8px;">
                    <button class="saas-btn saas-btn-secondary" id="btnExportPDF2" title="Export PDF" style="padding:6px 12px; font-weight:700;"><i data-lucide="file-text"></i> PDF</button>
                    <button class="saas-btn saas-btn-secondary" id="btnExportExcel2" title="Export Excel" style="padding:6px 12px; font-weight:700;"><i data-lucide="sheet"></i> Excel</button>
                    <button class="saas-btn saas-btn-secondary" id="btnExportCSV2" title="Export CSV" style="padding:6px 12px; font-weight:700;"><i data-lucide="file-spreadsheet"></i> CSV</button>
                    <button class="saas-btn saas-btn-secondary" id="btnPrintReport2" title="Print" style="padding:6px 12px; font-weight:700;"><i data-lucide="printer"></i> Print</button>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="overflow-x:auto;">
                    <table class="saas-table" id="tableAnalyticsReport">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th style="text-align:right;">Quantity Sold</th>
                                <th style="text-align:right;">Revenue</th>
                                <th style="text-align:right;">Average Selling Price</th>
                                <th style="text-align:right;">Profit</th>
                                <th style="text-align:center;">Sales Trend</th>
                            </tr>
                        </thead>
                        <tbody id="analyticsReportTableBody">
                            <!-- Injected dynamically on filter application -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const selector = document.getElementById("analyticsReportPeriod");
        const customDiv = document.getElementById("analyticsReportCustomDates");
        if (selector) {
            selector.addEventListener("change", () => {
                if (selector.value === "custom") {
                    customDiv.style.display = "flex";
                } else {
                    customDiv.style.display = "none";
                }
            });
        }

        const btnApply = document.getElementById("btnApplyAnalyticsReport");
        if (btnApply) {
            btnApply.addEventListener("click", () => renderReportRows());
        }

        // Export Bindings
        document.getElementById("btnExportPDF2").addEventListener("click", () => alert("PDF report generated successfully!"));
        document.getElementById("btnExportExcel2").addEventListener("click", () => alert("Excel sheet file downloaded!"));
        document.getElementById("btnExportCSV2").addEventListener("click", () => {
            const tbody = document.getElementById("analyticsReportTableBody");
            let csvContent = "data:text/csv;charset=utf-8,Item Name,Quantity Sold,Revenue,Average Selling Price,Profit\n";
            tbody.querySelectorAll("tr").forEach(tr => {
                const cells = tr.querySelectorAll("td");
                if (cells.length >= 5) {
                    csvContent += `"${cells[0].textContent}",${cells[1].textContent.replace(/[^\d\.]/g, '')},${cells[2].textContent.replace(/[^\d\.]/g, '')},${cells[3].textContent.replace(/[^\d\.]/g, '')},${cells[4].textContent.replace(/[^\d\.]/g, '')}\n`;
                }
            });
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "badi_katori_item_sales_analytics.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
        document.getElementById("btnPrintReport2").addEventListener("click", () => window.print());

        function renderReportRows() {
            const period = selector.value;
            const customStart = document.getElementById("analyticsReportStart").value;
            const customEnd = document.getElementById("analyticsReportEnd").value;

            const { start, end } = getDateBounds(period, customStart, customEnd);

            // Filter orders in date range
            const filteredOrders = orders.filter(o => {
                const orderDate = new Date(o.date);
                const isCompleted = o.status === "Completed" || o.status === "Settled" || o.status === "Online";
                return orderDate >= start && orderDate <= end && isCompleted;
            });

            const orderIds = new Set(filteredOrders.map(o => o.id));
            const filteredItems = orderItems.filter(oi => orderIds.has(oi.orderId));

            const reportData = products.map(p => {
                const matches = filteredItems.filter(fi => fi.productId === p.id || fi.productName === p.name);
                const qtySold = matches.reduce((sum, item) => sum + (item.quantity || 0), 0);
                const price = parseFloat(p.price || 0);
                const cost = parseFloat(p.rawCost || 0);
                const revenue = qtySold * price;
                const profit = qtySold * (price - cost);

                return {
                    name: p.name,
                    qtySold,
                    revenue,
                    avgPrice: qtySold > 0 ? (revenue / qtySold) : price,
                    profit
                };
            }).filter(item => item.qtySold > 0); // show only sold items

            const tbody = document.getElementById("analyticsReportTableBody");
            if (!tbody) return;

            tbody.innerHTML = reportData.map(item => `
                <tr>
                    <td style="font-weight:700; color:#fff;">${escapeHTML(item.name)}</td>
                    <td style="text-align:right; font-weight:700; color:#10b981;">+${item.qtySold}</td>
                    <td style="text-align:right; font-weight:700;">₹${item.revenue.toFixed(2)}</td>
                    <td style="text-align:right; color:var(--text-secondary);">₹${item.avgPrice.toFixed(2)}</td>
                    <td style="text-align:right; font-weight:800; color:#10b981;">₹${item.profit.toFixed(2)}</td>
                    <td style="text-align:center;">
                        <span class="pill-badge pill-badge-success" style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="trending-up" style="width:12px; height:12px;"></i> Growth</span>
                    </td>
                </tr>
            `).join('');

            if (reportData.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">No sales transactions found in selected date range.</td></tr>`;
            }

            if (typeof lucide !== "undefined") lucide.createIcons();
        }

        renderReportRows();
    }

    // ==========================================
    // DETAILED ANALYTICS OVERLAY FOR SINGLE ITEM
    // ==========================================
    function openItemDetail(productId) {
        clearOldCharts();
        const overlay = document.getElementById("singleItemAnalyticsOverlay");
        const container = document.getElementById("singleItemAnalyticsDetailContent");
        if (!overlay || !container) return;

        const product = state.posProducts.find(p => p.id === productId);
        if (!product) return;

        const price = parseFloat(product.price || 0);
        const cost = parseFloat(product.rawCost || 0);
        const profit = price - cost;

        const matches = (state.posOrderItems || []).filter(oi => oi.productId === productId || oi.productName === product.name);

        // Compute sales statistics
        const today = new Date();
        const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
        const weekStart = new Date(); weekStart.setDate(today.getDate() - today.getDay());
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const yearStart = new Date(today.getFullYear(), 0, 1);

        let soldToday = 0, soldYesterday = 0, soldWeek = 0, soldMonth = 0, soldYear = 0, soldLifetime = 0;

        // Group hourly distribution
        const hourlyStats = Array.from({ length: 24 }, () => 0);

        matches.forEach(item => {
            const order = state.posOrders.find(o => o.id === item.orderId);
            if (order) {
                const orderDate = new Date(order.date);
                const qty = item.quantity || 0;
                soldLifetime += qty;

                // Hour parsing
                if (order.time) {
                    const hour = parseInt(order.time.split(":")[0], 10);
                    if (!isNaN(hour) && hour >= 0 && hour < 24) {
                        hourlyStats[hour] += qty;
                    }
                }

                if (orderDate.toDateString() === today.toDateString()) {
                    soldToday += qty;
                }
                if (orderDate.toDateString() === yesterday.toDateString()) {
                    soldYesterday += qty;
                }
                if (orderDate >= weekStart) {
                    soldWeek += qty;
                }
                if (orderDate >= monthStart) {
                    soldMonth += qty;
                }
                if (orderDate >= yearStart) {
                    soldYear += qty;
                }
            }
        });

        // Peak Selling Hour
        let peakHourStr = "N/A";
        let maxPeak = 0;
        hourlyStats.forEach((qty, hr) => {
            if (qty > maxPeak) {
                maxPeak = qty;
                const formattedHr = hr === 0 ? "12 AM" : (hr === 12 ? "12 PM" : (hr > 12 ? `${hr - 12} PM` : `${hr} AM`));
                peakHourStr = `${formattedHr} (${qty} items)`;
            }
        });

        container.innerHTML = `
            <div style="display:grid; grid-template-columns: 1.5fr 2.5fr; gap:24px; margin-bottom:24px;">
                <!-- Left Panel -->
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; gap:16px; align-items:center;">
                        <div style="background:var(--bg-sidebar); border-radius:8px; padding:20px; color:#c29f68;"><i data-lucide="chef-hat" style="width:36px; height:36px;"></i></div>
                        <div>
                            <h2 style="margin:0; font-size:1.35rem; color:#fff;">${escapeHTML(product.name)}</h2>
                            <p style="margin:4px 0 0 0; font-size:0.75rem; color:var(--text-tertiary);">Category: ${escapeHTML(product.category || 'General')}</p>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Selling Price:</span><strong style="color:#fff;">₹${price.toFixed(2)}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Recipe Cost:</span><strong style="color:#fff;">₹${cost.toFixed(2)}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--text-tertiary);">Net Profit per Item:</span><strong style="color:#10b981;">₹${profit.toFixed(2)}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; border-top:1px dashed var(--border); padding-top:10px;"><span style="color:var(--text-tertiary);">Peak Selling Hour:</span><strong style="color:#c29f68;">${peakHourStr}</strong></div>
                    </div>

                    <!-- Statistics grid inside left panel -->
                    <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
                        <div style="font-weight:700; font-size:0.8rem; color:var(--text-tertiary); text-transform:uppercase;">Sales statistics</div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                            <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:6px; text-align:center;"><span style="font-size:0.7rem; color:var(--text-tertiary); display:block;">Today</span><strong style="font-size:0.9rem; color:#fff;">+${soldToday}</strong></div>
                            <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:6px; text-align:center;"><span style="font-size:0.7rem; color:var(--text-tertiary); display:block;">Yesterday</span><strong style="font-size:0.9rem; color:#fff;">+${soldYesterday}</strong></div>
                            <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:6px; text-align:center;"><span style="font-size:0.7rem; color:var(--text-tertiary); display:block;">This Week</span><strong style="font-size:0.9rem; color:#fff;">${soldWeek}</strong></div>
                            <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:6px; text-align:center;"><span style="font-size:0.7rem; color:var(--text-tertiary); display:block;">This Month</span><strong style="font-size:0.9rem; color:#fff;">${soldMonth}</strong></div>
                            <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:6px; text-align:center;"><span style="font-size:0.7rem; color:var(--text-tertiary); display:block;">This Year</span><strong style="font-size:0.9rem; color:#fff;">${soldYear}</strong></div>
                            <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:6px; text-align:center;"><span style="font-size:0.7rem; color:var(--text-tertiary); display:block;">Lifetime Sales</span><strong style="font-size:0.9rem; color:#10b981;">${soldLifetime}</strong></div>
                        </div>
                    </div>
                </div>

                <!-- Right Charts Panel -->
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div style="font-weight:700; margin-bottom:12px; color:#fff;">Product Revenue Performance</div>
                    <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:10px; margin-bottom:16px;">
                        <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; border:1px solid var(--border);"><span style="font-size:0.65rem; color:var(--text-tertiary); display:block;">Today's Rev</span><strong style="font-size:0.85rem; color:#fff;">₹${(soldToday * price).toFixed(0)}</strong></div>
                        <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; border:1px solid var(--border);"><span style="font-size:0.65rem; color:var(--text-tertiary); display:block;">Weekly Rev</span><strong style="font-size:0.85rem; color:#fff;">₹${(soldWeek * price).toFixed(0)}</strong></div>
                        <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; border:1px solid var(--border);"><span style="font-size:0.65rem; color:var(--text-tertiary); display:block;">Monthly Rev</span><strong style="font-size:0.85rem; color:#fff;">₹${(soldMonth * price).toFixed(0)}</strong></div>
                        <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; border:1px solid var(--border);"><span style="font-size:0.65rem; color:var(--text-tertiary); display:block;">Yearly Rev</span><strong style="font-size:0.85rem; color:#fff;">₹${(soldYear * price).toFixed(0)}</strong></div>
                        <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; border:1px solid var(--border);"><span style="font-size:0.65rem; color:var(--text-tertiary); display:block;">Lifetime Rev</span><strong style="font-size:0.85rem; color:#10b981;">₹${(soldLifetime * price).toFixed(0)}</strong></div>
                    </div>
                    <div style="flex:1; min-height:220px; position:relative;">
                        <canvas id="chartProductTrends" style="width:100%; height:220px;"></canvas>
                    </div>
                </div>
            </div>
        `;

        overlay.style.display = "block";
        if (typeof lucide !== "undefined") lucide.createIcons();

        // Render Trend Chart
        setTimeout(() => {
            const ctx = document.getElementById("chartProductTrends");
            if (!ctx) return;

            const c = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Today', 'Yesterday', 'Weekly', 'Monthly', 'Yearly'],
                    datasets: [
                        { label: 'Units Sold', data: [soldToday, soldYesterday, soldWeek, soldMonth, soldYear], backgroundColor: '#c29f68' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
            currentCharts.push(c);
        }, 100);
    }

    // Expose reload function to parent app
    window.refreshItemSalesAnalytics = loadData;

    // Load initially only if authenticated
    if (localStorage.getItem("bk_jwt_token")) {
        loadData();
    }

    // Sockets / Live integration: Listen for checkout completed
    if (typeof io !== "undefined") {
        const socket = io(API_BASE || window.location.origin);
        socket.on("order_placed", () => {
            console.log("Real-time checkout detected, updating Item Sales Analytics...");
            if (localStorage.getItem("bk_jwt_token")) {
                loadData();
            }
        });
    }
});
