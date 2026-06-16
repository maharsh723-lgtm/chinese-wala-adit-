document.addEventListener("DOMContentLoaded", () => {
    // === 1. LIVE STATE VARIABLES ===
    let employees = {};
    let leaveRequests = [];
    let purchaseRequests = [];
    let sops = [];
    let inventory = [];
    let wastage = [];
    let checklists = [];
    let eodReports = [];
    let recipes = [];
    let currentParsedBulkRecipes = [];
    let currentUser = null;

    let chartSales = null;
    let chartWastage = null;
    let isDarkMode = false;
    let currentRole = "bm"; // "bm" or "owner"
    let currentStore = "Mumbai Bandra"; // Active store for Branch Manager
    let lastStateJson = ""; // For comparing state changes in polling
    
    // Owner specific views state
    let ownerAttendanceStore = "Mumbai Bandra";
    let ownerChecklistStoreDetail = "Mumbai Bandra";
    let ownerEodStore = "Mumbai Bandra";
    let ownerInventoryStore = "Mumbai Bandra";
    let ownerEodDate = "2026-06-15";
    let ownerAttendanceTab = "daily"; // "daily" or "monthly"
    let ownerAttendanceSelectedEmployee = ""; // Selected employee for monthly history
    let ownerAttendanceSelectedMonth = "2026-06"; // Selected month (YYYY-MM format)

    // Absolute base URL if opened via file:// protocol
    const API_BASE = window.location.protocol.startsWith('file') ? 'http://localhost:3000' : '';

    const defaultEmployees = {
        "1": { id: "1", name: "John Doe", role: "Crew Member", mobile: "9876543210", shiftStart: "06:00", roleKey: "staff", password: "", status: "Active", store: "Mumbai Bandra", activePunch: null, history: [] },
        "EMP102": { id: "EMP102", name: "Alice Smith", role: "Kitchen Staff", mobile: "9876543211", shiftStart: "06:00", roleKey: "kitchen", password: "password123", status: "Active", store: "Mumbai Bandra", activePunch: null, history: [] },
        "EMP103": { id: "EMP103", name: "Bob Miller", role: "Branch Manager", mobile: "9876543212", shiftStart: "14:00", roleKey: "sm", password: "password123", status: "Active", store: "Bangalore Indiranagar", activePunch: null, history: [] },
        "EMP104": { id: "EMP104", name: "Rahul Sharma", role: "Branch Manager", mobile: "9876543213", shiftStart: "09:00", roleKey: "sm", password: "password123", status: "Active", store: "Mumbai Bandra", activePunch: null, history: [] },
        "EMP105": { id: "EMP105", name: "Priya Patel", role: "Branch Manager", mobile: "9876543214", shiftStart: "09:00", roleKey: "sm", password: "password123", status: "Active", store: "Delhi Connaught Place", activePunch: null, history: [] },
        "OWNER101": { id: "OWNER101", name: "Franchise Partner", role: "Owner", mobile: "9999999999", shiftStart: "09:00", roleKey: "owner", password: "ownerpassword", status: "Active", store: "All", activePunch: null, history: [] }
    };

    // Helper: Date String Format YYYY-MM-DD
    function getTodayDateStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // Helper: Safe Local Storage JSON Parse
    function getSafeLocalStorage(key, fallback) {
        try {
            const item = localStorage.getItem(key);
            if (!item || item === "undefined") return fallback;
            return JSON.parse(item);
        } catch (e) {
            console.warn(`Error parsing localStorage key "${key}":`, e);
            return fallback;
        }
    }

    function cleanFloat(val) {
        if (val === undefined || val === null) return 0.00;
        if (typeof val === 'number') return val;
        const cleaned = String(val).replace(/[₹$,\s]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0.00 : parsed;
    }

    // === 2. STATE SYNCHRONIZATION FROM SERVER ===
    async function syncStateFromServer(isInitial = false) {
        try {
            const response = await fetch(`${API_BASE}/api/state?_t=${Date.now()}`);
            if (!response.ok) throw new Error("HTTP error " + response.status);
            const data = await response.json();
            const stateJson = JSON.stringify(data);

            if (stateJson !== lastStateJson) {
                lastStateJson = stateJson;

                employees = data.employees || {};
                leaveRequests = data.leaveRequests || [];
                purchaseRequests = data.purchaseRequests || [];
                sops = data.sops || [];
                inventory = data.inventory || [];
                wastage = data.wastage || [];
                checklists = data.checklists || [];
                eodReports = data.eodReports || [];
                recipes = data.recipes || [];

                // Sync logged-in user with latest db record
                const cachedUser = getSafeLocalStorage("bk_logged_in_user", null);
                const targetId = cachedUser ? cachedUser.id : (currentUser ? currentUser.id : "EMP104");
                
                if (employees[targetId]) {
                    currentUser = employees[targetId];
                } else if (defaultEmployees[targetId]) {
                    currentUser = defaultEmployees[targetId];
                } else {
                    currentUser = defaultEmployees["EMP104"];
                }
                localStorage.setItem("bk_logged_in_user", JSON.stringify(currentUser));

                renderAllLists();
            }
        } catch (err) {
            console.warn('Failed to sync state from server. Using local defaults.', err);
            if (Object.keys(employees).length === 0) {
                employees = defaultEmployees;
                const cachedUser = getSafeLocalStorage("bk_logged_in_user", null);
                const targetId = cachedUser ? cachedUser.id : "EMP104";
                currentUser = employees[targetId] || employees["EMP104"];
                renderAllLists();
            }
        }
    }

    // Render all screens dynamically based on the current role
    function renderAllLists() {
        configureSidebarForRoles();
        renderDashboard();
        renderChecklistScreen('opening');
        renderChecklistScreen('closing');
        renderAttendanceScreen();
        renderInventoryScreen();
        renderPurchaseRequestsScreen();
        renderDayEndReportScreen();
        renderRecipeScreen();
    }

    // Periodic Polling loop (every 5 seconds)
    setInterval(() => {
        syncStateFromServer();
    }, 5000);

    // Configure Sidebar options and hide unnecessary menus
    function configureSidebarForRoles() {
        // Hide standard operations and settings groups
        const ho = document.getElementById("hoNavGroup");
        if (ho) ho.style.display = "none";
        const am = document.getElementById("amNavGroup");
        if (am) am.style.display = "none";
        const settings = document.getElementById("settingsNavGroup");
        if (settings) settings.style.display = "none";

        // Hide unused navigation options
        const unusedNavs = ["sop-management", "wastage-management"];
        
        document.querySelectorAll(".nav-item").forEach(item => {
            item.style.display = "";
        });

        unusedNavs.forEach(target => {
            const item = document.querySelector(`.nav-item[data-target="${target}"]`);
            if (item) item.style.display = "none";
        });
    }

    // === 3. ROLE SELECT ROUTER ===
    const roleSelectors = document.querySelectorAll(".role-option");
    roleSelectors.forEach(opt => {
        opt.addEventListener("click", () => {
            const selected = opt.getAttribute("data-role");
            setRole(selected);
        });
    });

    const roleSelectBtn = document.getElementById("roleSelectBtn");
    const roleDropdownPanel = document.getElementById("roleDropdownPanel");
    if (roleSelectBtn) {
        roleSelectBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            roleDropdownPanel.style.display = roleDropdownPanel.style.display === "block" ? "none" : "block";
        });
    }

    document.addEventListener("click", () => {
        if (roleDropdownPanel) roleDropdownPanel.style.display = "none";
    });

    const currentRoleText = document.getElementById("currentRoleText");
    const headerUserName = document.getElementById("headerUserName");
    const headerUserRole = document.getElementById("headerUserRole");
    const headerUserAvatar = document.getElementById("headerUserAvatar");
    const dashboardWelcomeTitle = document.getElementById("dashboardWelcomeTitle");

    function setRole(roleKey) {
        const validRoles = ["owner", "bm-mumbai", "bm-delhi", "bm-bangalore"];
        if (!validRoles.includes(roleKey)) {
            roleKey = "bm-mumbai";
        }
        const empList = Object.keys(employees).length > 0 ? employees : defaultEmployees;

        if (roleKey === "owner") {
            currentRole = "owner";
            currentStore = "All";
            currentUser = empList["OWNER101"] || defaultEmployees["OWNER101"];
            if (currentRoleText) currentRoleText.textContent = "Franchise Owner";
            if (headerUserName) headerUserName.textContent = currentUser.name;
            if (headerUserRole) headerUserRole.textContent = "Owner";
            if (headerUserAvatar) headerUserAvatar.textContent = "FO";
            if (dashboardWelcomeTitle) dashboardWelcomeTitle.textContent = "Welcome Back, Franchise Partner";
            enableWriteControls(true);
        } else {
            currentRole = "bm";
            if (roleKey === "bm-mumbai") {
                currentStore = "Mumbai Bandra";
                currentUser = empList["EMP104"] || defaultEmployees["EMP104"];
            } else if (roleKey === "bm-delhi") {
                currentStore = "Delhi Connaught Place";
                currentUser = empList["EMP105"] || defaultEmployees["EMP105"];
            } else if (roleKey === "bm-bangalore") {
                currentStore = "Bangalore Indiranagar";
                currentUser = empList["EMP103"] || defaultEmployees["EMP103"];
            }
            if (currentRoleText) currentRoleText.textContent = `BM - ${currentStore.split(' ')[0]}`;
            if (headerUserName) headerUserName.textContent = currentUser.name;
            if (headerUserRole) headerUserRole.textContent = "Branch Manager";
            if (headerUserAvatar) headerUserAvatar.textContent = "BM";
            if (dashboardWelcomeTitle) dashboardWelcomeTitle.textContent = `Welcome Back, Manager (${currentStore.split(' ')[0]})`;
            
            enableWriteControls(true);
        }

        localStorage.setItem("bk_logged_in_user", JSON.stringify(currentUser));
        localStorage.setItem("bk_current_role_key", roleKey);

        renderAllLists();
        navigateToScreen("dashboard");
    }

    function enableWriteControls(enable) {
        const createButtons = document.querySelectorAll("#dashGlobalCreateBtn, #btnCreatePrTop, #quickSopBtn, #quickInvBtn, #quickWastageBtn, #quickReportBtn, #quickEmpBtn, #fabAddStockBtn, #fabCreateSopBtn, #fabAddEmployeeBtn");
        createButtons.forEach(btn => {
            if (enable) {
                btn.removeAttribute("disabled");
                btn.style.opacity = "1";
                btn.style.cursor = "pointer";
            } else {
                btn.setAttribute("disabled", "true");
                btn.style.opacity = "0.5";
                btn.style.cursor = "not-allowed";
            }
        });
    }

    // === 4. DYNAMIC SCREEN RENDERS ===

    // SCREEN 1: DASHBOARD
    function renderDashboard() {
        const container = document.getElementById("screen-dashboard");
        if (!container) return;

        const todayStr = getTodayDateStr();

        if (currentRole === "bm") {
            const storeChecklists = checklists.filter(c => c.store === currentStore && c.date === todayStr);
            const openCl = storeChecklists.find(c => c.type === "opening");
            const closeCl = storeChecklists.find(c => c.type === "closing");

            const openProgress = openCl ? openCl.progress : 0;
            const closeProgress = closeCl ? closeCl.progress : 0;

            const storeStaff = Object.values(employees).filter(e => e.store === currentStore && e.roleKey !== "sm");
            const activeStaffCount = storeStaff.filter(e => e.activePunch).length;

            const storeWastage = wastage.filter(w => w.store === currentStore && w.date === todayStr);
            const wasteCost = storeWastage.reduce((sum, w) => sum + (w.qty * 300), 0);

            const todayEod = eodReports.find(r => r.store === currentStore && r.date === todayStr);
            const salesDisplay = todayEod ? `₹${todayEod.sales.toLocaleString()}` : "₹2,84,500 (Demo)";

            container.innerHTML = `
                <div class="screen-header-layout">
                    <div class="screen-title-desc">
                        <h1 id="dashboardWelcomeTitle">Welcome Back, Manager (${currentStore.split(' ')[0]})</h1>
                        <p>Here is your branch operational summary for today at ${currentStore}.</p>
                    </div>
                </div>

                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span>Today's Sales</span>
                            <i data-lucide="indian-rupee"></i>
                        </div>
                        <div class="kpi-value">${salesDisplay}</div>
                        <div class="kpi-meta">${todayEod ? '<span class="trend-up">Submitted</span>' : '<span style="color:var(--warning);">EOD Pending</span>'}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span>Opening Checklist</span>
                            <i data-lucide="clipboard-check"></i>
                        </div>
                        <div class="kpi-value">${openProgress}%</div>
                        <div class="kpi-meta">${openProgress === 100 ? 'Completed' : 'In Progress'}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span>Closing Checklist</span>
                            <i data-lucide="clipboard-x"></i>
                        </div>
                        <div class="kpi-value">${closeProgress}%</div>
                        <div class="kpi-meta">${closeProgress === 100 ? 'Completed' : 'In Progress'}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span>Staff Present</span>
                            <i data-lucide="users"></i>
                        </div>
                        <div class="kpi-value">${activeStaffCount} / ${storeStaff.length}</div>
                        <div class="kpi-meta">On active shift</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span>Wastage Cost</span>
                            <i data-lucide="trash-2" style="color: var(--danger);"></i>
                        </div>
                        <div class="kpi-value" style="color: var(--danger);">₹${wasteCost.toLocaleString()}</div>
                        <div class="kpi-meta">${storeWastage.length} spoiled logs</div>
                    </div>
                </div>

                <div class="widgets-grid" style="margin-top: 32px;">
                    <div class="widget-card">
                        <div class="widget-title">
                            <span>Today's Revenue Curve</span>
                            <span class="pill-badge pill-badge-success">LIVE</span>
                        </div>
                        <div class="widget-body" style="height: 200px; position: relative;">
                            <canvas id="dashSalesChart"></canvas>
                        </div>
                    </div>
                    <div class="widget-card">
                        <div class="widget-title">
                            <span>Low Stock Alerts</span>
                            <span class="pill-badge pill-badge-warning" id="lblLowStockCount">Alerts</span>
                        </div>
                        <div class="widget-body" style="display: flex; flex-direction: column; gap: 10px;" id="widgetInventoryAlerts">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                </div>
            `;
            initDashboardCharts();
            renderDashboardInventoryAlerts();
        } else {
            // Owner Dashboard
            const pendingPrCount = purchaseRequests.filter(p => p.status !== "approved" && p.status !== "rejected").length;
            const totalEmployees = Object.values(employees).filter(e => e.roleKey !== "owner" && e.roleKey !== "sm").length;
            const totalActiveStaff = Object.values(employees).filter(e => e.activePunch).length;

            const yesterdayStr = "2026-06-14";
            const yesterdayEods = eodReports.filter(r => r.date === yesterdayStr);
            const totalYesterdaySales = yesterdayEods.reduce((sum, r) => sum + r.sales, 0);
            const totalYesterdayExpenses = yesterdayEods.reduce((sum, r) => sum + r.expenses, 0);

            container.innerHTML = `
                <div class="screen-header-layout">
                    <div class="screen-title-desc">
                        <h1>Franchise Owner Command Center</h1>
                        <p>Real-time consolidated operations overview across all BK Indian outlets.</p>
                    </div>
                </div>

                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-header">Consolidated Sales (Yesterday)</div>
                        <div class="kpi-value">₹${totalYesterdaySales.toLocaleString()}</div>
                        <div class="kpi-meta">3 Branches EOD submitted</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">Consolidated Expenses (Yesterday)</div>
                        <div class="kpi-value">₹${totalYesterdayExpenses.toLocaleString()}</div>
                        <div class="kpi-meta">Net Operating Cost</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">Pending Requests (Approvals)</div>
                        <div class="kpi-value" style="color:var(--warning);">${pendingPrCount} Requests</div>
                        <div class="kpi-meta">Requires Owner review</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">Staff Attendance Overview</div>
                        <div class="kpi-value">${totalActiveStaff} / ${totalEmployees}</div>
                        <div class="kpi-meta">Clocked in across all branches</div>
                    </div>
                </div>

                <div class="widgets-grid" style="margin-top: 32px;">
                    <div class="widget-card">
                        <div class="widget-title">Checklists Progress (All Branches)</div>
                        <div class="widget-body" style="display:flex; flex-direction:column; gap:16px;" id="ownerDashboardChecklists">
                            <!-- Populated dynamically -->
                        </div>
                    </div>

                    <div class="widget-card">
                        <div class="widget-title">Branch-wise Sales Performance (Yesterday)</div>
                        <div class="widget-body" style="height: 220px; position: relative;">
                            <canvas id="ownerSalesComparisonChart"></canvas>
                        </div>
                    </div>
                </div>
            `;
            initOwnerDashboardCharts(yesterdayEods);
            renderOwnerDashboardChecklists();
        }

        if (window.lucide) window.lucide.createIcons();
    }

    // Helper: Dashboard Charts initialization
    function initDashboardCharts() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not loaded. Skipping chart initialization.');
            return;
        }
        const ctx = document.getElementById("dashSalesChart");
        if (!ctx) return;

        if (chartSales) chartSales.destroy();
        chartSales = new Chart(ctx, {
            type: "line",
            data: {
                labels: ["08:00", "11:00", "14:00", "17:00", "20:00", "23:00"],
                datasets: [{
                    label: "Hourly Revenue (₹)",
                    data: [35000, 92000, 184000, 142000, 320000, 110000],
                    borderColor: "#FF6B00",
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    // Helper: Owner Dashboard Comparison Chart
    function initOwnerDashboardCharts(eods) {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not loaded. Skipping chart initialization.');
            return;
        }
        const ctx = document.getElementById("ownerSalesComparisonChart");
        if (!ctx) return;

        const labels = ["Mumbai Bandra", "Delhi Connaught Place", "Bangalore Indiranagar"];
        const salesData = labels.map(lbl => {
            const match = eods.find(e => e.store === lbl);
            return match ? match.sales : 0;
        });

        new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels.map(l => l.split(' ')[0]),
                datasets: [{
                    label: "Yesterday Sales (₹)",
                    data: salesData,
                    backgroundColor: "#FF6B00",
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    // Helper: BM Inventory alerts on Dashboard
    function renderDashboardInventoryAlerts() {
        const widget = document.getElementById("widgetInventoryAlerts");
        const countLbl = document.getElementById("lblLowStockCount");
        if (!widget) return;
        widget.innerHTML = "";

        const storeInv = inventory.filter(i => i.store === currentStore);
        const lowStock = storeInv.filter(i => i.stock <= i.reorder);

        if (countLbl) countLbl.textContent = `${lowStock.length} Alerts`;

        if (lowStock.length === 0) {
            widget.innerHTML = `<div style="font-size:0.8rem; color:var(--text-tertiary);">All stock levels healthy.</div>`;
            return;
        }

        lowStock.forEach(item => {
            const div = document.createElement("div");
            div.style.display = "flex";
            div.style.justify = "space-between";
            div.style.alignItems = "center";
            div.style.background = "var(--bg-hover)";
            div.style.padding = "8px 12px";
            div.style.borderRadius = "6px";
            div.style.borderLeft = "4px solid var(--danger)";
            div.innerHTML = `
                <div style="font-size:0.75rem;">
                    <div style="font-weight:700;">${item.label}</div>
                    <div style="color:var(--text-tertiary);">${item.stock} ${item.unit} left (Reorder: ${item.reorder})</div>
                </div>
            `;
            widget.appendChild(div);
        });
    }

    // Helper: Owner Dashboard Checklists Monitor
    function renderOwnerDashboardChecklists() {
        const container = document.getElementById("ownerDashboardChecklists");
        if (!container) return;
        container.innerHTML = "";

        const todayStr = getTodayDateStr();
        const branches = ["Mumbai Bandra", "Delhi Connaught Place", "Bangalore Indiranagar"];

        branches.forEach(branch => {
            const branchCls = checklists.filter(c => c.store === branch && c.date === todayStr);
            const openCl = branchCls.find(c => c.type === "opening");
            const closeCl = branchCls.find(c => c.type === "closing");

            const openProgress = openCl ? openCl.progress : 0;
            const closeProgress = closeCl ? closeCl.progress : 0;

            const div = document.createElement("div");
            div.style.background = "var(--bg-hover)";
            div.style.padding = "12px 16px";
            div.style.borderRadius = "8px";
            div.style.border = "1px solid var(--border)";
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-weight:700; font-size:0.85rem; margin-bottom:8px;">
                    <span>${branch}</span>
                    <span style="color:var(--orange-primary);">Today</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:0.75rem;">
                    <div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span>Opening Checklist</span>
                            <strong>${openProgress}%</strong>
                        </div>
                        <div style="height:6px; background:var(--border); border-radius:3px; overflow:hidden;">
                            <div style="width:${openProgress}%; height:100%; background:var(--success);"></div>
                        </div>
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span>Closing Checklist</span>
                            <strong>${closeProgress}%</strong>
                        </div>
                        <div style="height:6px; background:var(--border); border-radius:3px; overflow:hidden;">
                            <div style="width:${closeProgress}%; height:100%; background:var(--success);"></div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    }


    // SCREEN 2 & 3: CHECKLISTS (OPENING & CLOSING)
    function renderChecklistScreen(type) {
        const container = document.getElementById(`screen-${type}-checklist`);
        if (!container) return;

        const todayStr = getTodayDateStr();

        if (currentRole === "bm") {
            const branchCl = checklists.find(c => c.store === currentStore && c.type === type && c.date === todayStr);
            const checkedIndices = branchCl ? branchCl.items : [];
            const progress = branchCl ? branchCl.progress : 0;

            const tasks = type === "opening" ? [
                { title: "Kitchen Cleaning Done", desc: "All food surfaces wiped and floor scrubbed." },
                { title: "Gas & Equipment Checked", desc: "Verify broiler valves and fryer elements are active." },
                { title: "Refrigeration Temperature Logged", desc: "Chiller temperature must read between 1°C and 4°C." },
                { title: "Raw Material Verified", desc: "Check starting levels of vegetables, buns, and chicken items." },
                { title: "Staff Attendance Completed", desc: "Verify all AM shift personnel are clocked in on time." }
            ] : [
                { title: "Cash Reconciliation Done", desc: "Verify counted register vault amounts match expected POS values." },
                { title: "Inventory Count Completed", desc: "Enter closing stock volumes of critical ingredients." },
                { title: "Fryers Off & Gas Safe", desc: "Shut down broiler conveyors, fryer power switches, and main gas lines." },
                { title: "Kitchen Deep Clean", desc: "Scrub grills, clean fryer filtration vats, and sanitise surface tops." },
                { title: "Doors and Vault Locked", desc: "Ensure safety locker is locked and double lock entrance gates." }
            ];

            let tasksHTML = "";
            tasks.forEach((task, idx) => {
                const isChecked = checkedIndices.includes(idx);
                tasksHTML += `
                    <div class="checklist-item ${isChecked ? 'checked' : ''}" data-index="${idx}">
                        <div class="checklist-checkbox-box">${isChecked ? '✓' : ''}</div>
                        <div>
                            <div class="checklist-item-title">${task.title}</div>
                            <div class="checklist-item-meta">${task.desc}</div>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = `
                <div class="screen-header-layout">
                    <div class="screen-title-desc">
                        <h1>Daily ${type.charAt(0).toUpperCase() + type.slice(1)} Checklist (${currentStore.split(' ')[0]})</h1>
                        <p>Complete standard audits for this branch to verify chain standards.</p>
                    </div>
                    <div class="screen-actions">
                        <button class="saas-btn saas-btn-primary" style="background:var(--success); border:none;" onclick="alert('${type.charAt(0).toUpperCase() + type.slice(1)} checklist completed!')">Mark Completed</button>
                    </div>
                </div>

                <div class="checklist-grid">
                    <div class="checklist-tasks-panel" id="checklistTasksPanel">
                        <h3 style="font-weight: 800; margin-bottom: 20px;">Audits Checklist</h3>
                        ${tasksHTML}
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 24px;">
                        <div class="widget-card">
                            <div class="widget-title">Checklist Progress</div>
                            <div style="text-align: center; padding: 20px 0;">
                                <div style="font-size: 3.5rem; font-weight: 800; color: var(--orange-primary);">${progress}%</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">
                                    ${checkedIndices.length} out of ${tasks.length} Tasks Completed
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.querySelectorAll(".checklist-item").forEach(item => {
                item.addEventListener("click", async () => {
                    const idx = parseInt(item.getAttribute("data-index"));
                    let newItems = [...checkedIndices];
                    if (newItems.includes(idx)) {
                        newItems = newItems.filter(i => i !== idx);
                    } else {
                        newItems.push(idx);
                    }

                    const newProgress = Math.round((newItems.length / tasks.length) * 100);
                    const completed = newProgress === 100 ? 1 : 0;

                    try {
                        await fetch(`${API_BASE}/api/checklists`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: `${type}-${currentStore}-${todayStr}`,
                                type,
                                store: currentStore,
                                date: todayStr,
                                progress: newProgress,
                                completed,
                                items: newItems
                            })
                        });
                        syncStateFromServer();
                    } catch (err) {
                        console.error('Failed to update checklist item:', err);
                    }
                });
            });

        } else {
            // Owner View
            const branches = ["Mumbai Bandra", "Delhi Connaught Place", "Bangalore Indiranagar"];
            let branchRowsHTML = "";

            branches.forEach(branch => {
                const branchCl = checklists.find(c => c.store === branch && c.type === type && c.date === todayStr);
                const progress = branchCl ? branchCl.progress : 0;
                const completedCount = branchCl ? branchCl.items.length : 0;

                branchRowsHTML += `
                    <tr>
                        <td style="font-weight: 700;">${branch}</td>
                        <td>${type.charAt(0).toUpperCase() + type.slice(1)}</td>
                        <td>
                            <div style="display:flex; align-items:center; gap:12px;">
                                <div style="flex:1; height:6px; background:var(--border); border-radius:3px; overflow:hidden;">
                                    <div style="width:${progress}%; height:100%; background:var(--success);"></div>
                                </div>
                                <strong>${progress}%</strong>
                            </div>
                        </td>
                        <td>${completedCount} / 5 tasks</td>
                        <td>
                            <span class="pill-badge ${progress === 100 ? 'pill-badge-success' : 'pill-badge-warning'}">
                                ${progress === 100 ? 'COMPLETED' : 'IN PROGRESS'}
                            </span>
                        </td>
                        <td>
                            <button class="saas-btn saas-btn-secondary" style="padding: 4px 8px; font-size:0.75rem;" onclick="openOwnerChecklistDrilldown('${branch}', '${type}')">View Details</button>
                        </td>
                    </tr>
                `;
            });

            let drilldownHTML = "";
            if (ownerChecklistStoreDetail) {
                const selectedCl = checklists.find(c => c.store === ownerChecklistStoreDetail && c.type === type && c.date === todayStr);
                const checkedIndices = selectedCl ? selectedCl.items : [];
                
                const tasks = type === "opening" ? [
                    "Kitchen Cleaning Done", "Gas & Equipment Checked", "Refrigeration Temperature Logged", "Raw Material Verified", "Staff Attendance Completed"
                ] : [
                    "Cash Reconciliation Done", "Inventory Count Completed", "Fryers Off & Gas Safe", "Kitchen Deep Clean", "Doors and Vault Locked"
                ];

                let detailItemsHTML = "";
                tasks.forEach((task, idx) => {
                    const isChecked = checkedIndices.includes(idx);
                    detailItemsHTML += `
                        <div style="display:flex; align-items:center; gap:12px; font-size:0.85rem; padding:8px 0; border-bottom: 1px solid var(--border);">
                            <div style="width:20px; height:20px; border-radius:4px; border:2px solid ${isChecked ? 'var(--success)' : 'var(--text-tertiary)'}; display:flex; align-items:center; justify-content:center; color:var(--success); font-weight:bold;">
                                ${isChecked ? '✓' : ''}
                            </div>
                            <span style="color: ${isChecked ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight:${isChecked ? 'bold' : 'normal'};">${task}</span>
                        </div>
                    `;
                });

                drilldownHTML = `
                    <div class="widget-card" style="margin-top:32px;">
                        <div class="widget-title">Checklist Details: ${ownerChecklistStoreDetail} (${type.toUpperCase()})</div>
                        <div class="widget-body" style="display:flex; flex-direction:column; gap:8px;">
                            ${detailItemsHTML}
                        </div>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="screen-header-layout">
                    <div class="screen-title-desc">
                        <h1>Consolidated ${type.charAt(0).toUpperCase() + type.slice(1)} Checklists Monitor</h1>
                        <p>Track standard opening/closing checklist parameters across all active franchises in India.</p>
                    </div>
                </div>

                <div class="saas-table-container">
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>Branch Name</th>
                                <th>Checklist Type</th>
                                <th style="width: 30%;">Progress</th>
                                <th>Tasks Completed</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${branchRowsHTML}
                        </tbody>
                    </table>
                </div>

                ${drilldownHTML}
            `;
        }

        if (window.lucide) window.lucide.createIcons();
    }

    window.openOwnerChecklistDrilldown = function(branch, type) {
        ownerChecklistStoreDetail = branch;
        renderChecklistScreen(type);
    };


    // SCREEN 4: ATTENDANCE TRACKER
    function renderAttendanceScreen() {
        const container = document.getElementById("screen-attendance-system");
        if (!container) return;

        if (currentRole === "bm") {
            const storeStaff = Object.values(employees).filter(e => e.store === currentStore && e.roleKey !== "sm");
            
            let staffRowsHTML = "";
            let presentCount = 0;
            let totalCount = storeStaff.length;

            storeStaff.forEach(emp => {
                const isClockedIn = emp.activePunch !== null;
                if (isClockedIn) presentCount++;

                const statusHTML = isClockedIn ? 
                    `<span class="pill-badge pill-badge-success">PUNCHED IN (${emp.activePunch.time})</span>` : 
                    `<span class="pill-badge pill-badge-secondary">OUT</span>`;

                const actionButton = isClockedIn ?
                    `<button class="saas-btn saas-btn-danger" style="padding: 4px 8px; font-size:0.75rem;" onclick="clockOutStaffPrompt('${emp.id}')">Clock Out</button>` :
                    `<button class="saas-btn saas-btn-primary" style="padding: 4px 8px; font-size:0.75rem; background:var(--success); border:none;" onclick="clockInStaffPrompt('${emp.id}')">Clock In</button>`;

                const lastPunch = emp.activePunch ? emp.activePunch.time : "--:--";
                const lastOut = (!isClockedIn && emp.history.length > 0) ? emp.history[0].punchOut : "--:--";

                staffRowsHTML += `
                    <tr>
                        <td style="font-weight:700;">${emp.id}</td>
                        <td>${emp.name}</td>
                        <td>${emp.role}</td>
                        <td>${statusHTML}</td>
                        <td>${lastPunch}</td>
                        <td>${lastOut}</td>
                        <td>
                            <div style="display:flex; gap:8px;">
                                ${actionButton}
                            </div>
                        </td>
                    </tr>
                `;
            });

            let shiftLogsHTML = "";
            const todayStr = new Date().toLocaleDateString();
            const todayLogs = [];
            storeStaff.forEach(emp => {
                emp.history.forEach(h => {
                    if (h.date === todayStr) {
                        todayLogs.push({ name: emp.name, role: emp.role, ...h });
                    }
                });
            });

            todayLogs.forEach(log => {
                shiftLogsHTML += `
                    <tr>
                        <td style="font-weight:700;">${log.name} (${log.role})</td>
                        <td>${log.punchIn}</td>
                        <td>${log.punchOut}</td>
                        <td>${log.hours} hrs</td>
                        <td><span class="pill-badge pill-badge-success">${log.status}</span></td>
                    </tr>
                `;
            });

            if (todayLogs.length === 0) {
                shiftLogsHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-tertiary); padding: 12px 0;">No shifts logged today.</td></tr>`;
            }

            container.innerHTML = `
                <div class="screen-header-layout">
                    <div class="screen-title-desc">
                        <h1>Staff Attendance Tracker (${currentStore.split(' ')[0]})</h1>
                        <p>Manage logins/logouts for employees assigned to this branch.</p>
                    </div>
                    <div class="screen-actions">
                        <button class="saas-btn saas-btn-primary" onclick="openManualAttendanceModal()">Log Manual Shift</button>
                    </div>
                </div>

                <div class="kpi-grid" style="margin-bottom:24px;">
                    <div class="kpi-card" style="padding:16px;">
                        <div class="kpi-header">Branch Roster Strength</div>
                        <div class="kpi-value">${totalCount}</div>
                    </div>
                    <div class="kpi-card" style="padding:16px;">
                        <div class="kpi-header">Punched In Today</div>
                        <div class="kpi-value">${presentCount}</div>
                    </div>
                    <div class="kpi-card" style="padding:16px;">
                        <div class="kpi-header">Absent Staff</div>
                        <div class="kpi-value">${totalCount - presentCount}</div>
                    </div>
                </div>

                <div class="saas-table-container">
                    <div style="padding:16px; font-weight:700; border-bottom:1px solid var(--border);">Employee Attendance Directory</div>
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Designation</th>
                                <th>Status</th>
                                <th>Punch In Time</th>
                                <th>Punch Out Time</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${staffRowsHTML}
                        </tbody>
                    </table>
                </div>

                <div class="saas-table-container" style="margin-top:32px;">
                    <div style="padding:16px; font-weight:700; border-bottom:1px solid var(--border);">Completed Shift Logs Today</div>
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>Staff Member</th>
                                <th>Punch In</th>
                                <th>Punch Out</th>
                                <th>Duration</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${shiftLogsHTML}
                        </tbody>
                    </table>
                </div>
            `;

        } else {
            // Owner Attendance View
            const tabsHTML = `
                <div class="mgr-tabs-container" style="display:flex; border-bottom:1px solid var(--border); margin-bottom:24px; gap:8px;">
                    <button class="mgr-tab-btn ${ownerAttendanceTab === 'daily' ? 'active' : ''}" onclick="setOwnerAttendanceTab('daily')" style="padding: 10px 16px; border:none; background:none; font-weight:700; cursor:pointer; color:${ownerAttendanceTab === 'daily' ? 'var(--orange-primary)' : 'var(--text-secondary)'}; border-bottom:${ownerAttendanceTab === 'daily' ? '2px solid var(--orange-primary)' : 'none'}">Daily Roster View</button>
                    <button class="mgr-tab-btn ${ownerAttendanceTab === 'monthly' ? 'active' : ''}" onclick="setOwnerAttendanceTab('monthly')" style="padding: 10px 16px; border:none; background:none; font-weight:700; cursor:pointer; color:${ownerAttendanceTab === 'monthly' ? 'var(--orange-primary)' : 'var(--text-secondary)'}; border-bottom:${ownerAttendanceTab === 'monthly' ? '2px solid var(--orange-primary)' : 'none'}">Employee Monthly History</button>
                </div>
            `;

            if (ownerAttendanceTab === "daily") {
                const branches = ["Mumbai Bandra", "Delhi Connaught Place", "Bangalore Indiranagar"];
                let storeOptionsHTML = "";
                branches.forEach(branch => {
                    storeOptionsHTML += `<option value="${branch}" ${ownerAttendanceStore === branch ? 'selected' : ''}>${branch}</option>`;
                });

                const selectedBranchStaff = Object.values(employees).filter(e => e.store === ownerAttendanceStore && e.roleKey !== "sm");
                
                let staffRowsHTML = "";
                selectedBranchStaff.forEach(emp => {
                    const isClockedIn = emp.activePunch !== null;
                    const statusHTML = isClockedIn ? 
                        `<span class="pill-badge pill-badge-success">ACTIVE</span>` : 
                        `<span class="pill-badge pill-badge-secondary">OUT</span>`;

                    const loginTime = isClockedIn ? emp.activePunch.time : "--:--";
                    const logoutTime = (!isClockedIn && emp.history.length > 0) ? emp.history[0].punchOut : "--:--";
                    const duration = isClockedIn ? "Active" : ((emp.history.length > 0) ? `${emp.history[0].hours} hrs` : "--:--");

                    staffRowsHTML += `
                        <tr>
                            <td style="font-weight:700;">${emp.id}</td>
                            <td>${emp.name}</td>
                            <td>${emp.role}</td>
                            <td>${loginTime}</td>
                            <td>${logoutTime}</td>
                            <td>${statusHTML}</td>
                            <td>${duration}</td>
                        </tr>
                    `;
                });

                if (selectedBranchStaff.length === 0) {
                    staffRowsHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-tertiary); padding: 12px 0;">No staff assigned to this branch.</td></tr>`;
                }

                container.innerHTML = `
                    <div class="screen-header-layout">
                        <div class="screen-title-desc">
                            <h1>Consolidated Attendance Records Monitor</h1>
                            <p>View real-time login and logout timestamps across all QSR outlets in India.</p>
                        </div>
                    </div>

                    ${tabsHTML}

                    <div style="background:var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px; display:flex; gap:16px; align-items:center;">
                        <div style="font-weight:700; font-size:0.9rem; color:var(--text-secondary);">Select Outlet Branch:</div>
                        <select class="saas-form-select" id="ownerAttendanceStoreSelect" style="width:250px; background:var(--bg-sidebar);">
                            ${storeOptionsHTML}
                        </select>
                    </div>

                    <div class="saas-table-container">
                        <table class="saas-table">
                            <thead>
                                <tr>
                                    <th>Employee ID</th>
                                    <th>Employee Name</th>
                                    <th>Designation</th>
                                    <th>Login Time</th>
                                    <th>Logout Time</th>
                                    <th>Attendance Status</th>
                                    <th>Working Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${staffRowsHTML}
                            </tbody>
                        </table>
                    </div>
                `;

                const selectEl = document.getElementById("ownerAttendanceStoreSelect");
                if (selectEl) {
                    selectEl.addEventListener("change", () => {
                        ownerAttendanceStore = selectEl.value;
                        renderAttendanceScreen();
                    });
                }
            } else {
                // Monthly Tab
                const empList = Object.values(employees).filter(e => e.roleKey !== "owner");
                if (!ownerAttendanceSelectedEmployee && empList.length > 0) {
                    ownerAttendanceSelectedEmployee = empList[0].id;
                }

                let employeeOptionsHTML = "";
                empList.forEach(emp => {
                    employeeOptionsHTML += `<option value="${emp.id}" ${ownerAttendanceSelectedEmployee === emp.id ? 'selected' : ''}>${emp.name} (${emp.role} - ${emp.store.split(' ')[0]})</option>`;
                });

                // Generate months dropdown (current and past months)
                const months = [
                    { value: "2026-06", label: "June 2026" },
                    { value: "2026-05", label: "May 2026" },
                    { value: "2026-04", label: "April 2026" }
                ];
                let monthOptionsHTML = "";
                months.forEach(m => {
                    monthOptionsHTML += `<option value="${m.value}" ${ownerAttendanceSelectedMonth === m.value ? 'selected' : ''}>${m.label}</option>`;
                });

                const targetEmp = employees[ownerAttendanceSelectedEmployee] || defaultEmployees[ownerAttendanceSelectedEmployee] || empList[0];
                let historyRowsHTML = "";
                let totalShifts = 0;
                let totalHours = 0;
                let avgHours = 0;

                if (targetEmp) {
                    const matchedHistory = targetEmp.history.filter(h => h.date && h.date.startsWith(ownerAttendanceSelectedMonth));
                    totalShifts = matchedHistory.length;
                    
                    matchedHistory.forEach(log => {
                        const parsedHrs = parseFloat(log.hours) || 0;
                        totalHours += parsedHrs;

                        historyRowsHTML += `
                            <tr>
                                <td style="font-weight:700;">${log.date}</td>
                                <td>${log.punchIn}</td>
                                <td>${log.punchOut}</td>
                                <td>${log.hours} hrs</td>
                                <td><span class="pill-badge pill-badge-success">${log.status}</span></td>
                                <td>${log.device || "Android Terminal"}</td>
                                <td>${log.location || targetEmp.store}</td>
                            </tr>
                        `;
                    });

                    totalHours = parseFloat(totalHours.toFixed(1));
                    avgHours = totalShifts > 0 ? parseFloat((totalHours / totalShifts).toFixed(1)) : 0;
                }

                if (historyRowsHTML === "") {
                    historyRowsHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-tertiary); padding: 12px 0;">No attendance records found for this employee in the selected month.</td></tr>`;
                }

                container.innerHTML = `
                    <div class="screen-header-layout">
                        <div class="screen-title-desc">
                            <h1>Consolidated Attendance Records Monitor</h1>
                            <p>View real-time login and logout timestamps across all QSR outlets in India.</p>
                        </div>
                    </div>

                    ${tabsHTML}

                    <div style="background:var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px; display:flex; gap:24px; align-items:center;">
                        <div style="display:flex; gap:12px; align-items:center; flex:1;">
                            <div style="font-weight:700; font-size:0.9rem; color:var(--text-secondary); white-space:nowrap;">Select Employee:</div>
                            <select class="saas-form-select" id="ownerHistoryEmployeeSelect" style="background:var(--bg-sidebar);">
                                ${employeeOptionsHTML}
                            </select>
                        </div>
                        <div style="display:flex; gap:12px; align-items:center; flex:0.6;">
                            <div style="font-weight:700; font-size:0.9rem; color:var(--text-secondary); white-space:nowrap;">Month:</div>
                            <select class="saas-form-select" id="ownerHistoryMonthSelect" style="background:var(--bg-sidebar);">
                                ${monthOptionsHTML}
                            </select>
                        </div>
                    </div>

                    <div class="kpi-grid" style="margin-bottom:24px; box-shadow:none; padding:0;">
                        <div class="kpi-card" style="padding:16px; background:var(--bg-sidebar); border:none;">
                            <div class="kpi-header">Shifts Completed</div>
                            <div class="kpi-value">${totalShifts}</div>
                        </div>
                        <div class="kpi-card" style="padding:16px; background:var(--bg-sidebar); border:none;">
                            <div class="kpi-header">Total Hours Worked</div>
                            <div class="kpi-value">${totalHours} hrs</div>
                        </div>
                        <div class="kpi-card" style="padding:16px; background:var(--bg-sidebar); border:none;">
                            <div class="kpi-header">Average Hours / Shift</div>
                            <div class="kpi-value">${avgHours} hrs</div>
                        </div>
                    </div>

                    <div class="saas-table-container">
                        <div style="padding:16px; font-weight:700; border-bottom:1px solid var(--border);">Attendance Log History Details</div>
                        <table class="saas-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Punch In</th>
                                    <th>Punch Out</th>
                                    <th>Duration</th>
                                    <th>Status</th>
                                    <th>Punch Source</th>
                                    <th>Store Location</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${historyRowsHTML}
                            </tbody>
                        </table>
                    </div>
                `;

                const empSelect = document.getElementById("ownerHistoryEmployeeSelect");
                if (empSelect) {
                    empSelect.addEventListener("change", () => {
                        ownerAttendanceSelectedEmployee = empSelect.value;
                        renderAttendanceScreen();
                    });
                }

                const monthSelect = document.getElementById("ownerHistoryMonthSelect");
                if (monthSelect) {
                    monthSelect.addEventListener("change", () => {
                        ownerAttendanceSelectedMonth = monthSelect.value;
                        renderAttendanceScreen();
                    });
                }
            }
        }
    }

    window.openManualAttendanceModal = function() {
        const selectEl = document.getElementById("manualAttendanceEmpSelect");
        if (selectEl) {
            selectEl.innerHTML = "";
            const storeStaff = Object.values(employees).filter(e => e.store === currentStore && e.roleKey !== "sm");
            storeStaff.forEach(emp => {
                const opt = document.createElement("option");
                opt.value = emp.id;
                opt.textContent = `${emp.name} (${emp.role})`;
                selectEl.appendChild(opt);
            });
        }
        const dateInput = document.getElementById("manualAttendanceDate");
        if (dateInput) {
            dateInput.value = getTodayDateStr();
        }
        openModal("modalManualAttendance");
    };

    window.setOwnerAttendanceTab = function(tab) {
        ownerAttendanceTab = tab;
        renderAttendanceScreen();
    };

    // BM Staff punch in/out prompts
    window.clockInStaffPrompt = async function(empId) {
        const emp = employees[empId];
        if (!emp) return;

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const todayStr = new Date().toLocaleDateString();

        const punchObj = {
            date: todayStr,
            time: timeStr,
            timestamp: now.getTime(),
            device: "Store Manager Console",
            location: `${currentStore} store`,
            isLate: false
        };

        try {
            await fetch(`${API_BASE}/api/employees/punch-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empId, activePunch: punchObj })
            });
            alert(`Punched in employee ${emp.name} at ${timeStr}.`);
            syncStateFromServer();
        } catch (err) {
            console.error(err);
        }
    };

    window.clockOutStaffPrompt = async function(empId) {
        const emp = employees[empId];
        if (!emp || !emp.activePunch) return;

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const diffMs = now.getTime() - emp.activePunch.timestamp;
        let hoursLogged = (diffMs / (1000 * 60 * 60)).toFixed(2);
        
        const inputHours = prompt(`Clock out ${emp.name}.\nClocked in at: ${emp.activePunch.time}\nElapsed hours: ${hoursLogged} hrs.\nEnter hours to log:`, hoursLogged);
        if (inputHours === null) return;
        hoursLogged = parseFloat(inputHours) || hoursLogged;

        const updatedHistory = [...emp.history];
        updatedHistory.unshift({
            date: emp.activePunch.date,
            punchIn: emp.activePunch.time,
            punchOut: timeStr,
            hours: hoursLogged.toString(),
            status: "Normal",
            device: "Store Manager Console",
            location: `${currentStore} store`
        });

        try {
            await fetch(`${API_BASE}/api/employees/punch-out`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empId, history: updatedHistory })
            });
            alert(`Clocked out employee ${emp.name}. Logged duration: ${hoursLogged} hrs.`);
            syncStateFromServer();
        } catch (err) {
            console.error(err);
        }
    };

    // === SCREEN 7: INVENTORY OVERVIEW (INVENTORY MANAGEMENT) ===
    function renderInventoryScreen() {
        const container = document.getElementById("screen-inventory-overview");
        if (!container) return;

        // Select store based on role
        const targetStore = currentRole === "owner" ? ownerInventoryStore : currentStore;
        const storeInv = inventory.filter(i => i.store === targetStore);

        // Calculate metrics
        const totalSKUs = storeInv.length;
        const itemsAvailable = storeInv.filter(i => i.stock > 0).length;
        const itemsOutOfStock = storeInv.filter(i => i.stock === 0).length;
        const totalValue = storeInv.reduce((sum, i) => sum + ((i.stock || 0) * (i.unitCost || 0)), 0);
        const reorderValue = storeInv.reduce((sum, i) => {
            if ((i.stock || 0) < (i.reorder || 0)) {
                return sum + (((i.reorder || 0) - (i.stock || 0)) * (i.unitCost || 0));
            }
            return sum;
        }, 0);

        // Branch Switcher dropdown for owner
        let selectHeaderHTML = "";
        if (currentRole === "owner") {
            const branches = ["Mumbai Bandra", "Delhi Connaught Place", "Bangalore Indiranagar"];
            let storeOptionsHTML = "";
            branches.forEach(branch => {
                storeOptionsHTML += `<option value="${branch}" ${ownerInventoryStore === branch ? 'selected' : ''}>${branch}</option>`;
            });
            selectHeaderHTML = `
                <div style="background:var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px; display:flex; gap:16px; align-items:center;">
                    <div style="font-weight:700; font-size:0.9rem; color:var(--text-secondary);">Select Outlet Branch:</div>
                    <select class="saas-form-select" id="ownerInventoryStoreSelect" style="width:250px; background:var(--bg-sidebar);">
                        ${storeOptionsHTML}
                    </select>
                </div>
            `;
        }

        // Header and actions
        // Both roles see Bulk Import; only Branch Managers see Add Stock
        const bulkImportButtonHTML = `<button class="saas-btn saas-btn-secondary" onclick="openModal('modalBulkImport')" style="margin-right:8px;">Bulk Import</button>`;
        const addStockButtonHTML = currentRole === "bm" ? 
            `<button class="saas-btn saas-btn-primary" onclick="openModal('modalAddInventory')">Add Stock</button>` : '';
        const headerActionsHTML = bulkImportButtonHTML + addStockButtonHTML;

        // Table rows
        let rowsHTML = "";
        storeInv.forEach(item => {
            // Status badge
            let statusBadge = "";
            if ((item.stock || 0) === 0) {
                statusBadge = `<span class="pill-badge pill-badge-danger">OUT OF STOCK</span>`;
            } else if ((item.stock || 0) < (item.reorder || 0)) {
                statusBadge = `<span class="pill-badge pill-badge-warning">LOW STOCK</span>`;
            } else {
                statusBadge = `<span class="pill-badge pill-badge-success">OK</span>`;
            }

            // Action buttons: Only BM can edit
            let actionsHTML = "";
            if (currentRole === "bm") {
                actionsHTML = `
                    <button class="saas-btn saas-btn-secondary" style="padding: 4px 12px; font-size:0.75rem;" onclick="editInventoryPrompt('${item.id}')">Edit</button>
                `;
            } else {
                actionsHTML = `<span style="color:var(--text-tertiary); font-size:0.8rem;">No Actions</span>`;
            }

            const itemCost = item.unitCost !== null && item.unitCost !== undefined ? `₹${parseFloat(item.unitCost).toFixed(2)}` : "₹0.00";
            const itemTotalValue = (item.stock && item.unitCost) ? `₹${(item.stock * item.unitCost).toFixed(2)}` : "₹0.00";
            const expiryStr = item.expiryDate || "N/A";

            rowsHTML += `
                <tr>
                    <td style="font-weight: 700;">${item.label}</td>
                    <td>${item.category}</td>
                    <td>${item.stock}</td>
                    <td>${item.unit}</td>
                    <td>${item.reorder}</td>
                    <td>${itemCost}</td>
                    <td>${itemTotalValue}</td>
                    <td>${expiryStr}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display:flex; gap:8px;">
                            ${actionsHTML}
                        </div>
                    </td>
                </tr>
            `;
        });

        if (storeInv.length === 0) {
            rowsHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-tertiary); padding: 12px 0;">No inventory items found.</td></tr>`;
        }

        container.innerHTML = `
            <div class="screen-header-layout">
                <div class="screen-title-desc">
                    <h1>Inventory Management ${currentRole === 'bm' ? `(${currentStore.split(' ')[0]})` : ''}</h1>
                    <p>Real-time ingredient levels with support for Indian measurement units.</p>
                </div>
                <div class="screen-actions">
                    ${headerActionsHTML}
                </div>
            </div>

            ${selectHeaderHTML}

            <!-- Inventory dashboard metrics -->
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-header">
                        <span>Total SKUs</span>
                        <i data-lucide="package"></i>
                    </div>
                    <div class="kpi-value">${totalSKUs}</div>
                    <div class="kpi-meta">Distinct items</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-header">
                        <span>Items Available</span>
                        <i data-lucide="check-circle" style="color:var(--success);"></i>
                    </div>
                    <div class="kpi-value">${itemsAvailable}</div>
                    <div class="kpi-meta">Stock > 0</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-header">
                        <span>Out of Stock</span>
                        <i data-lucide="alert-triangle" style="color:var(--danger);"></i>
                    </div>
                    <div class="kpi-value" style="color:${itemsOutOfStock > 0 ? 'var(--danger)' : 'inherit'};">${itemsOutOfStock}</div>
                    <div class="kpi-meta">Requires attention</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-header">
                        <span>Total Value</span>
                        <i data-lucide="indian-rupee"></i>
                    </div>
                    <div class="kpi-value">₹${totalValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <div class="kpi-meta">At cost price</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-header">
                        <span>Reorder Value</span>
                        <i data-lucide="trending-up"></i>
                    </div>
                    <div class="kpi-value">₹${reorderValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <div class="kpi-meta">To restore min level</div>
                </div>
            </div>

            <div class="saas-table-container">
                <table class="saas-table" id="inventoryTable">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Category</th>
                            <th>Current Stock</th>
                            <th>Unit</th>
                            <th>Reorder Level</th>
                            <th>Unit Cost</th>
                            <th>Total Value</th>
                            <th>Expiry Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="inventoryTableBody">
                        ${rowsHTML}
                    </tbody>
                </table>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        // Bind event for owner switcher
        if (currentRole === "owner") {
            const selectEl = document.getElementById("ownerInventoryStoreSelect");
            if (selectEl) {
                selectEl.addEventListener("change", () => {
                    ownerInventoryStore = selectEl.value;
                    renderInventoryScreen();
                });
            }
        }
    }

    // BM Edit inventory prompt (modal based)
    window.editInventoryPrompt = function(itemId) {
        const item = inventory.find(i => i.id === itemId);
        if (!item) return;

        document.getElementById("editInvItemId").value = item.id;
        document.getElementById("editInvItemLabel").textContent = item.label;
        document.getElementById("editInvStock").value = item.stock;
        document.getElementById("editInvReorder").value = item.reorder;
        document.getElementById("editInvUnitCost").value = item.unitCost || 0;
        document.getElementById("editInvExpiryDate").value = item.expiryDate || "";

        openModal("modalEditInventory");

        // Autofocus the stock field and highlight text
        setTimeout(() => {
            const stockInput = document.getElementById("editInvStock");
            if (stockInput) {
                stockInput.focus();
                stockInput.select();
            }
        }, 100);
    };

    window.adjustEditStock = function(amount) {
        const input = document.getElementById("editInvStock");
        if (input) {
            const val = parseInt(input.value, 10) || 0;
            input.value = Math.max(0, val + amount);
        }
    };

    window.adjustEditReorder = function(amount) {
        const input = document.getElementById("editInvReorder");
        if (input) {
            const val = parseInt(input.value, 10) || 0;
            input.value = Math.max(0, val + amount);
        }
    };


    // SCREEN 8: PURCHASE REQUESTS (REQUEST APPROVAL WORKFLOW)
    function renderPurchaseRequestsScreen() {
        const container = document.getElementById("screen-purchase-requests");
        if (!container) return;

        if (currentRole === "bm") {
            const branchPRs = purchaseRequests.filter(p => p.store === currentStore);
            let prHTML = "";

            branchPRs.forEach(item => {
                const id = item.id;
                const prDiv = document.createElement("div");
                prDiv.style.background = "var(--bg-hover)";
                prDiv.style.padding = "16px";
                prDiv.style.borderRadius = "8px";
                prDiv.style.border = "1px solid var(--border)";
                prDiv.id = id;

                if (item.status === 'rejected') {
                    prDiv.style.borderLeft = "4px solid var(--danger)";
                } else if (item.status === 'approved') {
                    prDiv.style.borderLeft = "4px solid var(--success)";
                }

                const smApproved = item.currentStep > 1 || item.status === 'approved';
                const smActive = item.currentStep === 1 && item.status !== 'rejected' && item.status !== 'approved';
                const amApproved = item.currentStep > 2 || item.status === 'approved';
                const amActive = item.currentStep === 2 && item.status !== 'rejected' && item.status !== 'approved';
                const hoApproved = item.status === 'approved';
                const hoActive = item.currentStep === 3 && item.status !== 'rejected' && item.status !== 'approved';

                const step1Class = smApproved ? 'approved' : (smActive ? 'active' : '');
                const step1Dot = smApproved ? '✓' : '1';
                const line2Class = amApproved ? 'approved' : '';
                const step2Class = amApproved ? 'approved' : (amActive ? 'active' : '');
                const step2Dot = amApproved ? '✓' : '2';
                const line3Class = hoApproved ? 'approved' : '';
                const step3Class = hoApproved ? 'approved' : (hoActive ? 'active' : '');
                const step3Dot = hoApproved ? '✓' : '3';

                const currentStatus = item.status === 'rejected' ? 'REJECTED' : (item.status === 'approved' ? 'APPROVED' : 'PENDING APPROVAL');

                prDiv.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; margin-bottom:8px;">
                        <span style="font-weight:700;">${item.name} (${item.qty} units)</span>
                        <span style="font-size:0.75rem; color:var(--text-tertiary);">${item.supplier} • Req: ${item.reqDate}</span>
                    </div>
                    <div class="approval-flow-wrapper">
                        <div class="approval-step ${step1Class}">
                            <div class="approval-step-dot">${step1Dot}</div>
                            <span>Store Mgr</span>
                        </div>
                        <div class="approval-step-line ${line2Class}"></div>
                        <div class="approval-step ${step2Class}">
                            <div class="approval-step-dot">${step2Dot}</div>
                            <span>Area Mgr</span>
                        </div>
                        <div class="approval-step-line ${line3Class}"></div>
                        <div class="approval-step ${step3Class}">
                            <div class="approval-step-dot">${step3Dot}</div>
                            <span>Head Office</span>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:flex-end; margin-top:12px; font-size:0.75rem; font-weight:700; color: ${item.status === 'approved' ? 'var(--success)' : (item.status === 'rejected' ? 'var(--danger)' : 'var(--warning)')};">
                        Status: ${currentStatus}
                    </div>
                `;
                prHTML += prDiv.outerHTML;
            });

            if (branchPRs.length === 0) {
                prHTML = `<div style="font-size:0.8rem; color:var(--text-tertiary);">No purchase requests submitted yet.</div>`;
            }

            container.innerHTML = `
                <div class="screen-header-layout">
                    <div class="screen-title-desc">
                        <h1>Purchase Requests Dashboard (${currentStore.split(' ')[0]})</h1>
                        <p>Submit procurement orders to regional and national command pipelines.</p>
                    </div>
                </div>

                <div class="wastage-form-container">
                    <div class="wastage-logger-card">
                        <h3 style="font-weight: 800; margin-bottom: 20px;">Submit Purchase Request</h3>
                        <form id="prForm">
                            <div class="saas-form-group">
                                <label class="saas-form-label" for="prItemSelect">Item Name</label>
                                <select class="saas-form-select" id="prItemSelect">
                                    <option value="Whopper Sesame Buns">Whopper Sesame Buns</option>
                                    <option value="Raw Chicken Patties">Raw Chicken Patties</option>
                                    <option value="Cheddar Cheese Slices">Cheddar Cheese Slices</option>
                                    <option value="BK Golden Fries Vats">BK Golden Fries Vats</option>
                                </select>
                            </div>
                            <div class="saas-form-group">
                                <label class="saas-form-label" for="prQtyInput">Quantity Required</label>
                                <input type="number" class="saas-form-input" id="prQtyInput" placeholder="e.g. 150" required>
                            </div>
                            <div class="saas-form-group">
                                <label class="saas-form-label" for="prSupplierSelect">Preferred Supplier</label>
                                <select class="saas-form-select" id="prSupplierSelect">
                                    <option value="BK Premium Bakery Delhi">BK Premium Bakery Delhi</option>
                                    <option value="BK Cold Storage Pune">BK Cold Storage Pune</option>
                                    <option value="BK Soho Procurement">BK Soho Procurement</option>
                                </select>
                            </div>
                            <div class="saas-form-group">
                                <label class="saas-form-label" for="prDateInput">Required By Date</label>
                                <input type="text" class="saas-form-input" id="prDateInput" value="18 June 2026" required>
                            </div>
                            <button type="submit" class="saas-btn saas-btn-primary" style="width:100%;">Submit PR</button>
                        </form>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:24px;">
                        <div class="saas-table-container" style="box-shadow:none; border:1px solid var(--border);">
                            <div style="padding:16px; font-weight:700; border-bottom:1px solid var(--border);">Active Procurement Pipelines</div>
                            <div style="padding:16px; display:flex; flex-direction:column; gap:16px;" id="activePrContainer">
                                ${prHTML}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const form = document.getElementById("prForm");
            if (form) {
                form.addEventListener("submit", async (e) => {
                    e.preventDefault();
                    const name = document.getElementById("prItemSelect").value;
                    const qty = parseInt(document.getElementById("prQtyInput").value);
                    const supplier = document.getElementById("prSupplierSelect").value;
                    const reqDate = document.getElementById("prDateInput").value;

                    const id = "pr-" + Date.now();
                    const newPr = {
                        id,
                        name,
                        qty,
                        supplier,
                        store: currentStore,
                        reqDate,
                        status: "sm_pending",
                        currentStep: 1,
                        history: []
                    };

                    try {
                        await fetch(`${API_BASE}/api/purchase-requests`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newPr)
                        });
                        alert("Purchase Request submitted to approval pipeline.");
                        syncStateFromServer();
                    } catch (err) {
                        console.error('Failed to submit purchase request:', err);
                    }
                });
            }

        } else {
            // Owner Request Approvals
            let pendingPrsHTML = "";
            let archivedPrsHTML = "";

            purchaseRequests.forEach(item => {
                const id = item.id;
                const smApproved = item.currentStep > 1 || item.status === 'approved';
                const smActive = item.currentStep === 1 && item.status !== 'rejected' && item.status !== 'approved';
                const amApproved = item.currentStep > 2 || item.status === 'approved';
                const amActive = item.currentStep === 2 && item.status !== 'rejected' && item.status !== 'approved';
                const hoApproved = item.status === 'approved';
                const hoActive = item.currentStep === 3 && item.status !== 'rejected' && item.status !== 'approved';

                const step1Class = smApproved ? 'approved' : (smActive ? 'active' : '');
                const step1Dot = smApproved ? '✓' : '1';
                const line2Class = amApproved ? 'approved' : '';
                const step2Class = amApproved ? 'approved' : (amActive ? 'active' : '');
                const step2Dot = amApproved ? '✓' : '2';
                const line3Class = hoApproved ? 'approved' : '';
                const step3Class = hoApproved ? 'approved' : (hoActive ? 'active' : '');
                const step3Dot = hoApproved ? '✓' : '3';

                const cardHTML = `
                    <div style="background:var(--bg-card); padding:16px; border-radius:8px; border:1px solid var(--border); margin-bottom:16px; ${item.status === 'rejected' ? 'border-left: 4px solid var(--danger);' : (item.status === 'approved' ? 'border-left:4px solid var(--success);' : '')}">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; margin-bottom:8px;">
                            <span style="font-weight:700; font-size:1rem;">${item.name} (${item.qty} units)</span>
                            <span style="font-size:0.75rem; color:var(--text-tertiary);">${item.supplier} • Req: ${item.reqDate}</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:12px;">Branch: <strong>${item.store}</strong></div>
                        <div class="approval-flow-wrapper">
                            <div class="approval-step ${step1Class}">
                                <div class="approval-step-dot">${step1Dot}</div>
                                <span>Store Mgr</span>
                            </div>
                            <div class="approval-step-line ${line2Class}"></div>
                            <div class="approval-step ${step2Class}">
                                <div class="approval-step-dot">${step2Dot}</div>
                                <span>Area Mgr</span>
                            </div>
                            <div class="approval-step-line ${line3Class}"></div>
                            <div class="approval-step ${step3Class}">
                                <div class="approval-step-dot">${step3Dot}</div>
                                <span>Head Office</span>
                            </div>
                        </div>
                        ${
                            (item.status !== 'approved' && item.status !== 'rejected') ? `
                                <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:16px;" class="pr-actions-wrapper">
                                    <button class="saas-btn saas-btn-secondary" style="padding: 4px 10px; font-size:0.75rem; background: var(--danger-light); color: var(--danger);" onclick="rejectPR('${id}')">Reject Request</button>
                                    <button class="saas-btn saas-btn-primary" style="padding: 4px 10px; font-size:0.75rem; background: var(--success); border:none;" onclick="approvePR('${id}')">Approve Request</button>
                                </div>
                            ` : `
                                <div style="display:flex; justify-content:flex-end; margin-top:12px; font-size:0.75rem; font-weight:700; color: ${item.status === 'approved' ? 'var(--success)' : 'var(--danger)'};">
                                    Status: ${item.status.toUpperCase()}
                                </div>
                            `
                        }
                    </div>
                `;

                if (item.status === 'approved' || item.status === 'rejected') {
                    archivedPrsHTML += cardHTML;
                } else {
                    pendingPrsHTML += cardHTML;
                }
            });

            if (pendingPrsHTML === "") {
                pendingPrsHTML = `<div style="font-size:0.8rem; color:var(--text-tertiary); padding: 12px 0;">No pending approval requests.</div>`;
            }
            if (archivedPrsHTML === "") {
                archivedPrsHTML = `<div style="font-size:0.8rem; color:var(--text-tertiary); padding: 12px 0;">No completed requests logs.</div>`;
            }

            container.innerHTML = `
                <div class="screen-header-layout">
                    <div class="screen-title-desc">
                        <h1>Procurement Approvals Workflow</h1>
                        <p>Approve or reject stock and inventory purchase requests from all branch managers.</p>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:32px;">
                    <div>
                        <h3 style="font-weight: 800; margin-bottom: 16px;">Pending Approvals</h3>
                        ${pendingPrsHTML}
                    </div>
                    <div>
                        <h3 style="font-weight: 800; margin-bottom: 16px;">Request Archive Logs</h3>
                        ${archivedPrsHTML}
                    </div>
                </div>
            `;
        }
    }

    window.approvePR = async function(prId) {
        const item = purchaseRequests.find(p => p.id === prId);
        if (!item) return;

        let nextStep = item.currentStep;
        let newStatus = item.status;
        const history = [...item.history];

        if (item.currentStep === 1) {
            nextStep = 2;
            newStatus = 'am_pending';
            history.push({ role: 'sm', action: 'approve', time: new Date().toLocaleString() });
            alert("Store Manager approved. Routing to Area Manager.");
        } else if (item.currentStep === 2) {
            nextStep = 3;
            newStatus = 'ho_pending';
            history.push({ role: 'am', action: 'approve', time: new Date().toLocaleString() });
            alert("Area Manager approved. Routing to Head Office for procurement.");
        } else if (item.currentStep === 3) {
            newStatus = 'approved';
            history.push({ role: 'ho', action: 'approve', time: new Date().toLocaleString() });
            alert("Purchase Request fully approved by Head Office. Stock orders released.");
        }

        try {
            await fetch(`${API_BASE}/api/purchase-requests/${prId}/approve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, currentStep: nextStep, history })
            });
            syncStateFromServer();
        } catch (err) {
            console.error(err);
        }
    };

    window.rejectPR = async function(prId) {
        try {
            await fetch(`${API_BASE}/api/purchase-requests/${prId}/reject`, {
                method: 'PUT'
            });
            alert("Purchase Request rejected.");
            syncStateFromServer();
        } catch (err) {
            console.error(err);
        }
    };


    // SCREEN 12: DAY END REPORT
    function renderDayEndReportScreen() {
        const container = document.getElementById("screen-day-end-report");
        if (!container) return;

        const todayStr = getTodayDateStr();

        if (currentRole === "bm") {
            const submittedEod = eodReports.find(r => r.store === currentStore && r.date === todayStr);

            let formHTML = "";
            if (submittedEod) {
                const expectedCash = submittedEod.sales - submittedEod.upi - submittedEod.card;
                const variance = submittedEod.cash - expectedCash;

                formHTML = `
                    <div style="background:var(--bg-hover); padding: 24px; border-radius: var(--radius-md); border:1px solid var(--border); text-align:center;">
                        <span class="pill-badge pill-badge-success" style="font-size:0.9rem; padding: 6px 12px; margin-bottom:16px;">EOD SUBMITTED</span>
                        <h2 style="font-weight:800; font-size:1.4rem;">Day End Report Registered</h2>
                        <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:8px;">
                            Submitted by ${submittedEod.submittedBy} at ${submittedEod.submittedAt}
                        </p>

                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:16px; margin-top:32px; text-align:left; font-size:0.85rem;">
                            <div>
                                <span style="color:var(--text-tertiary);">Gross Sales</span>
                                <div style="font-weight:800; font-size:1.15rem; color:var(--text-primary); margin-top:4px;">₹${submittedEod.sales.toLocaleString()}</div>
                            </div>
                            <div>
                                <span style="color:var(--text-tertiary);">Total Expenses</span>
                                <div style="font-weight:800; font-size:1.15rem; color:var(--danger); margin-top:4px;">₹${submittedEod.expenses.toLocaleString()}</div>
                            </div>
                            <div>
                                <span style="color:var(--text-tertiary);">Orders Completed</span>
                                <div style="font-weight:800; font-size:1.15rem; color:var(--text-primary); margin-top:4px;">${submittedEod.orders}</div>
                            </div>
                        </div>

                        <div class="saas-table-container" style="box-shadow:none; border:1px solid var(--border); margin-top:32px; text-align:left;">
                            <div style="padding: 12px 16px; font-weight:700; border-bottom: 1px solid var(--border);">Drawer Reconciliation</div>
                            <table class="saas-table">
                                <thead>
                                    <tr>
                                        <th>Cash Drawer</th>
                                        <th>Expected Cash</th>
                                        <th>Counted Cash</th>
                                        <th>Variance</th>
                                        <th>Reconciliation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="font-weight:700;">Main Register</td>
                                        <td>₹${expectedCash.toLocaleString()}</td>
                                        <td>₹${submittedEod.cash.toLocaleString()}</td>
                                        <td style="font-weight:700; color:${variance >= 0 ? 'var(--success)' : 'var(--danger)'}">
                                            ₹${variance.toLocaleString()}
                                        </td>
                                        <td>
                                            <span class="pill-badge ${Math.abs(variance) <= 50 ? 'pill-badge-success' : 'pill-badge-warning'}">
                                                ${Math.abs(variance) <= 50 ? 'MATCHED' : 'TOLERANCE WARN'}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            } else {
                formHTML = `
                    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius: var(--radius-md); padding: 32px; max-width: 600px; margin: 0 auto;">
                        <h3 style="font-weight: 800; margin-bottom: 24px; text-align:center;">Register Shift EOD Figures</h3>
                        <form id="eodSubmissionForm">
                            <div class="saas-form-group">
                                <label class="saas-form-label">Total Gross Sales (₹)</label>
                                <input type="number" class="saas-form-input" id="eodSalesInput" placeholder="e.g. 210000" required>
                            </div>
                            <div class="saas-form-group">
                                <label class="saas-form-label">Total Operating Expenses (₹)</label>
                                <input type="number" class="saas-form-input" id="eodExpensesInput" placeholder="e.g. 15000" required>
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">
                                <div class="saas-form-group">
                                    <label class="saas-form-label">Cash Collected (₹)</label>
                                    <input type="number" class="saas-form-input" id="eodCashInput" placeholder="e.g. 50000" required>
                                </div>
                                <div class="saas-form-group">
                                    <label class="saas-form-label">UPI Collected (₹)</label>
                                    <input type="number" class="saas-form-input" id="eodUpiInput" placeholder="e.g. 120000" required>
                                </div>
                                <div class="saas-form-group">
                                    <label class="saas-form-label">Card Collected (₹)</label>
                                    <input type="number" class="saas-form-input" id="eodCardInput" placeholder="e.g. 40000" required>
                                </div>
                            </div>
                            <div class="saas-form-group">
                                <label class="saas-form-label">Orders Completed Count</label>
                                <input type="number" class="saas-form-input" id="eodOrdersInput" placeholder="e.g. 1020" required>
                            </div>
                            <button type="submit" class="saas-btn saas-btn-primary" style="width:100%; margin-top:16px;">Submit EOD Report</button>
                        </form>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="screen-header-layout">
                    <div class="screen-title-desc">
                        <h1>Daily Shift EOD Report (${currentStore.split(' ')[0]})</h1>
                        <p>Submit daily branch EOD sales and expenses reconciliation report.</p>
                    </div>
                </div>
                ${formHTML}
            `;

            const eodForm = document.getElementById("eodSubmissionForm");
            if (eodForm) {
                eodForm.addEventListener("submit", async (e) => {
                    e.preventDefault();
                    const sales = parseFloat(document.getElementById("eodSalesInput").value) || 0;
                    const expenses = parseFloat(document.getElementById("eodExpensesInput").value) || 0;
                    const cash = parseFloat(document.getElementById("eodCashInput").value) || 0;
                    const upi = parseFloat(document.getElementById("eodUpiInput").value) || 0;
                    const card = parseFloat(document.getElementById("eodCardInput").value) || 0;
                    const orders = parseInt(document.getElementById("eodOrdersInput").value) || 0;

                    const id = `eod-${currentStore}-${todayStr}`;
                    const now = new Date();
                    const timeStr = now.toLocaleString();

                    const newEod = {
                        id,
                        store: currentStore,
                        date: todayStr,
                        sales,
                        expenses,
                        cash,
                        upi,
                        card,
                        orders,
                        submittedBy: currentUser.name,
                        submittedAt: timeStr
                    };

                    try {
                        await fetch(`${API_BASE}/api/eod-reports`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newEod)
                        });
                        alert("Day End Report submitted successfully.");
                        syncStateFromServer();
                    } catch (err) {
                        console.error('Failed to submit EOD:', err);
                    }
                });
            }

        } else {
            // Owner view
            const branches = ["Mumbai Bandra", "Delhi Connaught Place", "Bangalore Indiranagar"];
            let storeOptionsHTML = "";
            branches.forEach(branch => {
                storeOptionsHTML += `<option value="${branch}" ${ownerEodStore === branch ? 'selected' : ''}>${branch}</option>`;
            });

            const targetEods = eodReports.filter(r => r.date === ownerEodDate);
            const totalSales = targetEods.reduce((sum, r) => sum + r.sales, 0);
            const totalExpenses = targetEods.reduce((sum, r) => sum + r.expenses, 0);
            const totalCash = targetEods.reduce((sum, r) => sum + r.cash, 0);
            const totalUpi = targetEods.reduce((sum, r) => sum + r.upi, 0);
            const totalCard = targetEods.reduce((sum, r) => sum + r.card, 0);

            const branchHistoryEods = eodReports.filter(r => r.store === ownerEodStore).sort((a, b) => b.date.localeCompare(a.date));
            let historyRowsHTML = "";

            branchHistoryEods.forEach(report => {
                const expectedCash = report.sales - report.upi - report.card;
                const variance = report.cash - expectedCash;

                historyRowsHTML += `
                    <tr>
                        <td style="font-weight:700;">${report.date}</td>
                        <td>₹${report.sales.toLocaleString()}</td>
                        <td>₹${report.expenses.toLocaleString()}</td>
                        <td>₹${report.cash.toLocaleString()} / ₹${expectedCash.toLocaleString()}</td>
                        <td style="font-weight:700; color:${variance >= 0 ? 'var(--success)' : 'var(--danger)'}">
                            ₹${variance.toLocaleString()}
                        </td>
                        <td>${report.orders}</td>
                        <td style="font-size:0.75rem;">${report.submittedBy}<br><span style="color:var(--text-tertiary);">${report.submittedAt}</span></td>
                    </tr>
                `;
            });

            if (branchHistoryEods.length === 0) {
                historyRowsHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-tertiary); padding: 12px 0;">No historical EOD submissions found.</td></tr>`;
            }

            container.innerHTML = `
                <div class="screen-header-layout">
                    <div class="screen-title-desc">
                        <h1>Consolidated Day End Reports Center</h1>
                        <p>Analyze EOD figures, verify expected cash matching, and view summed operational summaries.</p>
                    </div>
                </div>

                <div class="widget-card" style="margin-bottom: 32px;">
                    <div class="widget-title" style="display:flex; justify-content:space-between; align-items:center;">
                        <span>Summed Consolidated Summary</span>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <span style="font-size:0.8rem; font-weight:normal; color:var(--text-secondary);">Reconcile Date:</span>
                            <select class="saas-form-select" id="ownerEodDateSelect" style="width:130px; padding: 4px 8px; font-size:0.75rem; background:var(--bg-sidebar);">
                                <option value="2026-06-15" ${ownerEodDate === "2026-06-15" ? 'selected' : ''}>15 June 2026</option>
                                <option value="2026-06-14" ${ownerEodDate === "2026-06-14" ? 'selected' : ''}>14 June 2026</option>
                            </select>
                        </div>
                    </div>
                    <div class="widget-body">
                        <div class="kpi-grid" style="box-shadow:none; padding:0; margin-bottom:0;">
                            <div class="kpi-card" style="background:var(--bg-sidebar); border:none; padding:12px;">
                                <div class="kpi-header">Total Consolidated Sales</div>
                                <div class="kpi-value">₹${totalSales.toLocaleString()}</div>
                            </div>
                            <div class="kpi-card" style="background:var(--bg-sidebar); border:none; padding:12px;">
                                <div class="kpi-header">Total Consolidated Expenses</div>
                                <div class="kpi-value" style="color:var(--danger);">₹${totalExpenses.toLocaleString()}</div>
                            </div>
                            <div class="kpi-card" style="background:var(--bg-sidebar); border:none; padding:12px;">
                                <div class="kpi-header">Total Cash Collection</div>
                                <div class="kpi-value">₹${totalCash.toLocaleString()}</div>
                            </div>
                            <div class="kpi-card" style="background:var(--bg-sidebar); border:none; padding:12px;">
                                <div class="kpi-header">Total UPI Collection</div>
                                <div class="kpi-value">₹${totalUpi.toLocaleString()}</div>
                            </div>
                            <div class="kpi-card" style="background:var(--bg-sidebar); border:none; padding:12px;">
                                <div class="kpi-header">Total Card Collection</div>
                                <div class="kpi-value">₹${totalCard.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="background:var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px; display:flex; gap:16px; align-items:center;">
                    <div style="font-weight:700; font-size:0.9rem; color:var(--text-secondary);">Select Branch Logs:</div>
                    <select class="saas-form-select" id="ownerEodStoreSelect" style="width:250px; background:var(--bg-sidebar);">
                        ${storeOptionsHTML}
                    </select>
                </div>

                <div class="saas-table-container">
                    <div style="padding:16px; font-weight:700; border-bottom:1px solid var(--border);">Historical EOD Reports: ${ownerEodStore}</div>
                    <table class="saas-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Gross Sales</th>
                                <th>Expenses</th>
                                <th>Counted / Expected Cash</th>
                                <th>Reconciliation Variance</th>
                                <th>Orders Count</th>
                                <th>Submitted By</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${historyRowsHTML}
                        </tbody>
                    </table>
                </div>
            `;

            const dateEl = document.getElementById("ownerEodDateSelect");
            if (dateEl) {
                dateEl.addEventListener("change", () => {
                    ownerEodDate = dateEl.value;
                    renderDayEndReportScreen();
                });
            }
            const storeEl = document.getElementById("ownerEodStoreSelect");
            if (storeEl) {
                storeEl.addEventListener("change", () => {
                    ownerEodStore = storeEl.value;
                    renderDayEndReportScreen();
                });
            }
        }
    }

    // SCREEN 9: RECIPE MASTER
    function renderRecipeScreen() {
        const container = document.getElementById("screen-recipe-management");
        if (!container) return;

        // Toggle header actions based on role
        const actionsContainer = document.getElementById("recipeScreenActions");
        if (actionsContainer) {
            if (currentRole === "owner") {
                actionsContainer.style.display = "flex";
            } else {
                actionsContainer.style.display = "none";
            }
        }

        const grid = document.getElementById("recipesGrid");
        if (!grid) return;

        grid.innerHTML = "";

        if (recipes.length === 0) {
            grid.innerHTML = `<div style="grid-column: span 3; text-align: center; padding: 40px; color: var(--text-tertiary);">No recipes available.</div>`;
            return;
        }

        recipes.forEach(recipe => {
            const marginPct = Number((recipe.rawCost / recipe.retailPrice) * 100);
            const marginPctFloored = Math.floor(marginPct * 10) / 10;
            
            // Margins coloring logic:
            // Less than 28% green (success), otherwise warning (>=28% and <30%) or danger (>=30%)
            let marginColor = "var(--success)";
            if (marginPctFloored >= 30) {
                marginColor = "var(--danger)";
            } else if (marginPctFloored >= 28) {
                marginColor = "var(--warning)";
            }

            const ingredients = Array.isArray(recipe.ingredients) 
                ? recipe.ingredients 
                : (typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : []);

            const card = document.createElement("div");
            card.className = "recipe-prod-card";
            card.innerHTML = `
                <div class="recipe-prod-header">
                    <div>
                        <div class="recipe-prod-name">${escapeHTML(recipe.name)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">${escapeHTML(recipe.portion)}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="pill-badge pill-badge-success">${escapeHTML(recipe.status || 'Active')}</span>
                        ${currentRole === "owner" ? `
                        <button class="saas-btn saas-btn-secondary delete-recipe-btn" onclick="deleteRecipePrompt('${recipe.id}')" style="padding: 4px 8px; color: var(--danger); background: none; border: 1px solid var(--border); border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
                <ul class="recipe-ingredient-list">
                    ${ingredients.map(ing => `
                    <li class="recipe-ingredient-item">
                        <span>${escapeHTML(ing.name)}</span>
                        <span>${escapeHTML(ing.qty)} ${escapeHTML(ing.unit)}</span>
                    </li>
                    `).join('')}
                </ul>
                <div class="cost-calculator-widget">
                    <div class="cost-calc-line"><span>Raw Cost Price</span> <span>₹${Number(recipe.rawCost).toFixed(2)}</span></div>
                    <div class="cost-calc-line"><span>Suggested Retail Price</span> <span>₹${Number(recipe.retailPrice).toFixed(2)}</span></div>
                    <div class="cost-calc-line"><span>Food Cost Margin</span> <span style="color: ${marginColor}; font-weight: 800;">${marginPctFloored.toFixed(1)}%</span></div>
                </div>
            `;
            grid.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    function escapeHTML(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // === NOTIFICATIONS DRAWER TOGGLE ===
    const notificationsTriggerBtn = document.getElementById("notificationsTriggerBtn");
    const drawerCloseBtn = document.getElementById("drawerCloseBtn");
    const drawerOverlay = document.getElementById("drawerOverlay");
    const notificationDrawer = document.getElementById("notificationDrawer");

    if (notificationsTriggerBtn && notificationDrawer && drawerOverlay) {
        notificationsTriggerBtn.addEventListener("click", () => {
            notificationDrawer.classList.add("active");
            drawerOverlay.classList.add("active");
        });
    }

    const closeDrawer = () => {
        if (notificationDrawer) notificationDrawer.classList.remove("active");
        if (drawerOverlay) drawerOverlay.classList.remove("active");
    };

    if (drawerCloseBtn) drawerCloseBtn.addEventListener("click", closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener("click", closeDrawer);

    window.resolveNotification = function(id) {
        const el = document.getElementById(id);
        if (el) {
            el.style.opacity = "0.5";
            el.style.pointerEvents = "none";
            alert("Notification resolved.");
        }
    };

    window.dismissNotification = function(id) {
        const el = document.getElementById(id);
        if (el) {
            el.style.transform = "translateX(100%)";
            el.style.opacity = "0";
            setTimeout(() => el.remove(), 300);
        }
    };

    // === FAB MENU TOGGLE ===
    const fabMainBtn = document.getElementById("fabMainBtn");
    const fabMenuOptions = document.getElementById("fabMenuOptions");
    if (fabMainBtn && fabMenuOptions) {
        fabMainBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            fabMenuOptions.classList.toggle("active");
        });
        document.addEventListener("click", () => {
            fabMenuOptions.classList.remove("active");
        });
    }

    // Nav Item Click router
    function navigateToScreen(screenId) {
        const screens = document.querySelectorAll(".app-screen");
        screens.forEach(s => s.classList.remove("active"));

        const targetScreen = document.getElementById(`screen-${screenId}`);
        if (targetScreen) {
            targetScreen.classList.add("active");
        }

        const navItems = document.querySelectorAll(".nav-item");
        navItems.forEach(item => {
            if (item.getAttribute("data-target") === screenId) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });
    }

    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            const target = item.getAttribute("data-target");
            if (target) {
                navigateToScreen(target);
            }
        });
    });

    window.openModal = function(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.style.display = "flex";
        if (modalId === 'modalCreateRecipe') {
            const container = document.getElementById("recipeIngredientsContainer");
            if (container && container.children.length === 0) {
                window.addRecipeIngredientRow("", "", "");
                window.addRecipeIngredientRow("", "", "");
            }
        }
    };

    window.closeModal = function(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.style.display = "none";
        if (modalId === 'modalCreateRecipe') {
            const form = document.getElementById("formCreateRecipe");
            if (form) form.reset();
            const container = document.getElementById("recipeIngredientsContainer");
            if (container) container.innerHTML = "";
        }
        if (modalId === 'modalBulkImportRecipes') {
            resetBulkImportRecipes();
        }
    };

    // === MANUAL ATTENDANCE FORM SUBMISSION ===
    const manualAttendanceForm = document.getElementById("formManualAttendance");
    if (manualAttendanceForm) {
        manualAttendanceForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const empId = document.getElementById("manualAttendanceEmpSelect").value;
            const date = document.getElementById("manualAttendanceDate").value;
            const inTimeRaw = document.getElementById("manualAttendanceInTime").value;
            const outTimeRaw = document.getElementById("manualAttendanceOutTime").value;
            const status = document.getElementById("manualAttendanceStatus").value;

            // Format times as "hh:mm AM/PM"
            const formatTime12h = (time24) => {
                const [hStr, mStr] = time24.split(':');
                const h = parseInt(hStr);
                const ampm = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;
                return `${String(h12).padStart(2, '0')}:${mStr} ${ampm}`;
            };

            const punchIn = formatTime12h(inTimeRaw);
            const punchOut = formatTime12h(outTimeRaw);

            // Calculate hours worked
            const [inH, inM] = inTimeRaw.split(':').map(Number);
            const [outH, outM] = outTimeRaw.split(':').map(Number);
            const diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
            const hours = Math.max(0, (diffMinutes / 60)).toFixed(1);

            try {
                const res = await fetch(`${API_BASE}/api/employees/${empId}/attendance-log`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({
                         date,
                         punchIn,
                         punchOut,
                         hours,
                         status,
                         device: "Manager Console (Manual Entry)",
                         location: `${currentStore} store`
                     })
                });
                if (res.ok) {
                     alert("Manual attendance record logged successfully.");
                     closeModal('modalManualAttendance');
                     syncStateFromServer();
                } else {
                     const errData = await res.json();
                     alert("Error: " + errData.error);
                }
            } catch (err) {
                 console.error(err);
                 alert("Failed to log attendance record.");
            }
        });
    }

    // === INVENTORY ADD FORM SUBMISSION ===
    const addInventoryForm = document.getElementById("formAddInventory");
    if (addInventoryForm) {
        addInventoryForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const label = document.getElementById("invItemLabel").value;
            const category = document.getElementById("invCategorySelect").value;
            const unit = document.getElementById("invUnitSelect").value;
            const stock = parseInt(document.getElementById("invStartingStock").value, 10);
            const reorder = parseInt(document.getElementById("invReorderLevel").value, 10);
            const unitCost = parseFloat(document.getElementById("invUnitCost").value);
            const expiryDate = document.getElementById("invExpiryDate").value;
            
            const id = 'inv-' + Date.now();
            const status = stock < reorder ? 'LOW STOCK' : 'OK';
            const store = currentStore;

            try {
                const res = await fetch(`${API_BASE}/api/inventory`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status
                    })
                });
                if (res.ok) {
                    alert("Inventory item added successfully.");
                    closeModal('modalAddInventory');
                    addInventoryForm.reset();
                    await syncStateFromServer();
                } else {
                    const errData = await res.json();
                    alert("Error: " + errData.error);
                }
            } catch (err) {
                console.error(err);
                alert("Failed to add inventory item.");
            }
        });
    }

    // === INVENTORY EDIT FORM SUBMISSION ===
    const editInventoryForm = document.getElementById("formEditInventory");
    if (editInventoryForm) {
        editInventoryForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const itemId = document.getElementById("editInvItemId").value;
            const stock = parseInt(document.getElementById("editInvStock").value, 10);
            const reorder = parseInt(document.getElementById("editInvReorder").value, 10);
            const unitCost = parseFloat(document.getElementById("editInvUnitCost").value);
            const expiryDate = document.getElementById("editInvExpiryDate").value;

            const originalItem = inventory.find(i => i.id === itemId);
            const label = originalItem ? originalItem.label : "";
            const category = originalItem ? originalItem.category : "";
            const unit = originalItem ? originalItem.unit : "";

            const status = stock < reorder ? 'LOW STOCK' : 'OK';

            try {
                const res = await fetch(`${API_BASE}/api/inventory/${itemId}/edit`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ label, category, stock, unit, reorder, unitCost, expiryDate, status })
                });
                if (res.ok) {
                    alert("Inventory item updated successfully.");
                    closeModal('modalEditInventory');
                    await syncStateFromServer();
                } else {
                    const errData = await res.json();
                    alert("Error: " + errData.error);
                }
            } catch (err) {
                console.error(err);
                alert("Failed to update inventory item.");
            }
        });
    }

    // === INVENTORY BULK IMPORT (EXCEL / IMAGE) ===
    let currentParsedBulkUpdates = [];

    const dropzone = document.getElementById("bulkImportDropzone");
    const fileInput = document.getElementById("bulkImportFileInput");
    const applyBtn = document.getElementById("btnBulkImportApply");

    if (dropzone && fileInput) {
        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.style.background = "var(--bg-hover)";
            dropzone.style.borderColor = "var(--orange-primary)";
        });

        dropzone.addEventListener("dragleave", () => {
            dropzone.style.background = "var(--bg-sidebar)";
            dropzone.style.borderColor = "var(--border)";
        });

        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.style.background = "var(--bg-sidebar)";
            dropzone.style.borderColor = "var(--border)";
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleBulkImportFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener("change", () => {
            if (fileInput.files && fileInput.files.length > 0) {
                handleBulkImportFile(fileInput.files[0]);
            }
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener("click", applyBulkUpdates);
    }

    window.closeBulkImportModal = function() {
        closeModal("modalBulkImport");
        resetBulkImport();
    };

    function handleBulkImportFile(file) {
        resetBulkImport();
        
        const dropzone = document.getElementById("bulkImportDropzone");
        const status = document.getElementById("bulkImportStatus");
        const statusText = document.getElementById("bulkImportStatusText");

        if (file.type.startsWith("image/")) {
            parseImage(file);
        } else {
            dropzone.style.display = "none";
            status.style.display = "block";
            statusText.textContent = "Reading and parsing Excel sheet...";
            setTimeout(() => {
                parseExcel(file);
                status.style.display = "none";
            }, 1000);
        }
    }

    function parseExcel(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, {header: 1});

                if (rows.length < 2) {
                    alert("The Excel sheet is empty or contains no data rows.");
                    resetBulkImport();
                    return;
                }

                 // Find headers with smart heuristic mapping (scan up to first 10 rows for non-empty headers)
                 let headerRowIndex = 0;
                 let headerRow = [];
                 let labelIdx = -1;

                 for (let r = 0; r < Math.min(10, rows.length); r++) {
                     const rowCells = rows[r];
                     if (!rowCells || rowCells.length === 0) continue;
                     const tempHeaders = rowCells.map(h => String(h || '').trim().toLowerCase());
                     const idx = tempHeaders.findIndex(h => 
                         (h.includes('name') || h.includes('label') || h === 'item' || h === 'product') && 
                         !h.includes('id') && !h.includes('no') && !h.includes('code') && !h.includes('num')
                     );
                     if (idx !== -1) {
                         headerRowIndex = r;
                         headerRow = tempHeaders;
                         labelIdx = idx;
                         break;
                     }
                 }

                 const categoryIdx = headerRow.findIndex(h => h.includes('category') || h.includes('group') || h.includes('dept') || h.includes('type'));
                 const unitIdx = headerRow.findIndex(h => h.includes('unit') || h.includes('measure') || h.includes('uom'));
                 const stockIdx = headerRow.findIndex(h => h.includes('stock') || h.includes('quantity') || h.includes('qty') || h.includes('count') || h === 'qty');
                 const reorderIdx = headerRow.findIndex(h => h.includes('reorder') || h.includes('min') || h.includes('minimum') || h.includes('limit'));
                 
                 // Prevent overlap between raw cost and selling/retail prices
                 const costIdx = headerRow.findIndex(h => 
                     h.includes('raw') || 
                     (h.includes('cost') && !h.includes('retail') && !h.includes('suggested') && !h.includes('selling') && !h.includes('price')) ||
                     h.includes('unit cost') || h.includes('rate')
                 );
                 const expiryIdx = headerRow.findIndex(h => h.includes('expiry') || h.includes('date') || h.includes('exp'));

                 // Fallback for label/item name index if name was not detected specifically
                 const finalLabelIdx = labelIdx !== -1 ? labelIdx : headerRow.findIndex(h => h.includes('item') || h.includes('product') || h.includes('label'));

                 if (finalLabelIdx === -1) {
                     alert("Could not identify the 'Item Name' column in Excel. Please check headers.");
                     resetBulkImport();
                     return;
                 }

                 const parsedUpdates = [];
                 const targetStore = currentRole === "owner" ? ownerInventoryStore : currentStore;
                 const storeInv = inventory.filter(i => i.store === targetStore);

                 for (let i = headerRowIndex + 1; i < rows.length; i++) {
                     const row = rows[i];
                     if (!row || row.length === 0) continue;

                     const labelVal = String(row[finalLabelIdx] || '').trim();
                     if (!labelVal) continue;

                     // Match with existing item
                     const matchedItem = storeInv.find(item => item.label.toLowerCase() === labelVal.toLowerCase());
                     
                     const categoryVal = categoryIdx !== -1 && row[categoryIdx] !== undefined ? String(row[categoryIdx]).trim() : (matchedItem ? matchedItem.category : 'Bulk Import');
                     const unitVal = unitIdx !== -1 && row[unitIdx] !== undefined ? String(row[unitIdx]).trim() : (matchedItem ? matchedItem.unit : 'Piece');
                     const newStock = stockIdx !== -1 && row[stockIdx] !== undefined ? parseInt(row[stockIdx], 10) : (matchedItem ? matchedItem.stock : 0);
                     const newReorder = reorderIdx !== -1 && row[reorderIdx] !== undefined ? parseInt(row[reorderIdx], 10) : (matchedItem ? matchedItem.reorder : 10);
                     const newCost = costIdx !== -1 && row[costIdx] !== undefined ? cleanFloat(row[costIdx]) : (matchedItem ? matchedItem.unitCost : 0.00);
                    const newExpiry = expiryIdx !== -1 && row[expiryIdx] !== undefined ? String(row[expiryIdx]) : (matchedItem ? matchedItem.expiryDate : "");

                    if (isNaN(newStock) || isNaN(newReorder)) continue;

                    if (matchedItem) {
                        parsedUpdates.push({
                            id: matchedItem.id,
                            isNew: false,
                            label: labelVal, // Allows updating label casing/name if matching
                            category: categoryVal,
                            unit: unitVal,
                            oldStock: matchedItem.stock,
                            newStock,
                            oldReorder: matchedItem.reorder,
                            newReorder,
                            oldCost: matchedItem.unitCost,
                            newCost: isNaN(newCost) ? 0.00 : newCost,
                            oldExpiry: matchedItem.expiryDate,
                            newExpiry: newExpiry || ""
                        });
                    } else {
                        // ADD AS A NEW ITEM
                        parsedUpdates.push({
                            id: 'inv-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                            isNew: true,
                            label: labelVal,
                            category: categoryVal,
                            unit: unitVal,
                            oldStock: 'N/A',
                            newStock: isNaN(newStock) ? 0 : newStock,
                            oldReorder: 'N/A',
                            newReorder: isNaN(newReorder) ? 10 : newReorder,
                            oldCost: 0.00,
                            newCost: isNaN(newCost) ? 0.00 : newCost,
                            oldExpiry: 'N/A',
                            newExpiry: newExpiry || ""
                        });
                    }
                }

                showBulkImportPreview(parsedUpdates);
            } catch (err) {
                console.error(err);
                alert("Error parsing Excel file. Please ensure it is a valid format.");
                resetBulkImport();
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function parseImage(file) {
        const dropzone = document.getElementById("bulkImportDropzone");
        const scanner = document.getElementById("bulkImportScannerContainer");
        const previewImg = document.getElementById("bulkImportImgPreview");
        const status = document.getElementById("bulkImportStatus");
        const statusText = document.getElementById("bulkImportStatusText");

        dropzone.style.display = "none";
        scanner.style.display = "block";
        status.style.display = "block";
        statusText.textContent = "Scanning image layout...";

        // Show image preview
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // Simulate OCR text extraction steps
        setTimeout(() => {
            statusText.textContent = "Running text extraction & OCR matching...";
        }, 1200);

        setTimeout(() => {
            statusText.textContent = "Updating stock values from image data...";
        }, 2400);

        setTimeout(() => {
            const targetStore = currentRole === "owner" ? ownerInventoryStore : currentStore;
            const storeInv = inventory.filter(i => i.store === targetStore);
            
            const parsedUpdates = [];
            const itemsToUpdate = storeInv.slice(0, 2);
            itemsToUpdate.forEach(item => {
                const diff = Math.floor(Math.random() * 21) - 10;
                const newStock = Math.max(0, item.stock + diff);
                const newCost = item.unitCost ? item.unitCost * 1.05 : 20.00;
                
                parsedUpdates.push({
                    id: item.id,
                    isNew: false,
                    label: item.label,
                    category: item.category,
                    unit: item.unit,
                    oldStock: item.stock,
                    newStock,
                    oldReorder: item.reorder,
                    newReorder: item.reorder,
                    oldCost: item.unitCost,
                    newCost: parseFloat(newCost.toFixed(2)),
                    oldExpiry: item.expiryDate,
                    newExpiry: item.expiryDate
                });
            });

            // Simulate finding 1 new item
            parsedUpdates.push({
                id: 'inv-' + Date.now() + '-new',
                isNew: true,
                label: "Premium Truffle Mayo",
                category: "Bulk Import",
                unit: "Packet",
                oldStock: "N/A",
                newStock: 50,
                oldReorder: "N/A",
                newReorder: 15,
                oldCost: 0.00,
                newCost: 180.00,
                oldExpiry: "N/A",
                newExpiry: "2026-09-01"
            });

            scanner.style.display = "none";
            status.style.display = "none";
            showBulkImportPreview(parsedUpdates);
        }, 3600);
    }

    function showBulkImportPreview(updates) {
        currentParsedBulkUpdates = updates;
        
        const previewBlock = document.getElementById("bulkImportPreviewBlock");
        const tableBody = document.getElementById("bulkImportPreviewTableBody");
        const applyBtn = document.getElementById("btnBulkImportApply");

        tableBody.innerHTML = "";

        if (updates.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">No matching inventory items found to update.</td></tr>`;
            applyBtn.disabled = true;
        } else {
            updates.forEach(item => {
                const oldCostStr = item.oldCost === "N/A" || item.oldCost === 0 ? "N/A" : `₹${parseFloat(item.oldCost).toFixed(2)}`;
                const newCostStr = item.newCost ? `₹${parseFloat(item.newCost).toFixed(2)}` : "₹0.00";
                const expiryStr = item.newExpiry || "N/A";
                const badge = item.isNew ? ' <span class="pill-badge pill-badge-success" style="font-size:0.6rem; padding: 2px 4px; vertical-align: middle;">NEW</span>' : '';
                
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="font-weight:700;">${item.label}${badge}</td>
                    <td style="color:var(--text-tertiary);">${item.oldStock}</td>
                    <td style="font-weight:700; color:var(--success);">${item.newStock}</td>
                    <td style="color:var(--text-tertiary);">${oldCostStr}</td>
                    <td style="font-weight:700; color:var(--success);">${newCostStr}</td>
                    <td>${expiryStr}</td>
                `;
                tableBody.appendChild(tr);
            });
            applyBtn.disabled = false;
        }

        previewBlock.style.display = "block";
    }

    function resetBulkImport() {
        currentParsedBulkUpdates = [];
        document.getElementById("bulkImportDropzone").style.display = "block";
        document.getElementById("bulkImportScannerContainer").style.display = "none";
        document.getElementById("bulkImportStatus").style.display = "none";
        document.getElementById("bulkImportPreviewBlock").style.display = "none";
        document.getElementById("bulkImportFileInput").value = "";
        
        const applyBtn = document.getElementById("btnBulkImportApply");
        applyBtn.disabled = true;
        applyBtn.textContent = "Apply Updates";
    }

    async function applyBulkUpdates() {
        if (currentParsedBulkUpdates.length === 0) return;

        const applyBtn = document.getElementById("btnBulkImportApply");
        applyBtn.disabled = true;
        applyBtn.textContent = "Applying...";

        const targetStore = currentRole === "owner" ? ownerInventoryStore : currentStore;

        let successCount = 0;
        for (const item of currentParsedBulkUpdates) {
            const status = item.newStock < item.newReorder ? 'LOW STOCK' : 'OK';
            
            if (item.isNew) {
                try {
                    const res = await fetch(`${API_BASE}/api/inventory`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: item.id,
                            label: item.label,
                            category: item.category || 'Bulk Import',
                            stock: item.newStock,
                            unit: item.unit || 'Piece',
                            reorder: item.newReorder,
                            unitCost: item.newCost,
                            expiryDate: item.newExpiry,
                            store: targetStore,
                            status
                        })
                    });
                    if (res.ok) successCount++;
                } catch (err) {
                    console.error("Failed to add new item during bulk import:", item.label, err);
                }
            } else {
                try {
                    const res = await fetch(`${API_BASE}/api/inventory/${item.id}/edit`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            label: item.label,
                            category: item.category,
                            stock: item.newStock,
                            unit: item.unit,
                            reorder: item.newReorder,
                            unitCost: item.newCost,
                            expiryDate: item.newExpiry,
                            status
                        })
                    });
                    if (res.ok) successCount++;
                } catch (err) {
                    console.error("Failed to update item during bulk import:", item.label, err);
                }
            }
        }

        alert(`Successfully processed ${successCount} items (updates and new additions).`);
        closeModal('modalBulkImport');
        resetBulkImport();
        await syncStateFromServer();
    }

    // === RECIPE MANAGEMENT EVENT HANDLERS ===
    window.addRecipeIngredientRow = function(name = "", qty = "", unit = "") {
        const container = document.getElementById("recipeIngredientsContainer");
        if (!container) return;

        const row = document.createElement("div");
        row.className = "recipe-ingredient-row";
        row.style.display = "flex";
        row.style.gap = "8px";
        row.style.marginBottom = "8px";
        row.style.alignItems = "center";

        row.innerHTML = `
            <input type="text" class="saas-form-input ing-name" placeholder="Ingredient Name" style="flex:2;" required value="${escapeHTML(name)}">
            <input type="number" step="any" class="saas-form-input ing-qty" placeholder="Qty" style="flex:1;" required value="${escapeHTML(qty)}">
            <input type="text" class="saas-form-input ing-unit" placeholder="Unit (gm, Piece)" style="flex:1;" required value="${escapeHTML(unit)}">
            <button type="button" class="saas-btn saas-btn-secondary" style="padding: 8px 12px; color: var(--danger); border: 1px solid var(--border);" onclick="this.parentElement.remove()">✕</button>
        `;
        container.appendChild(row);
    };

    const createRecipeForm = document.getElementById("formCreateRecipe");
    if (createRecipeForm) {
        createRecipeForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (currentRole !== "owner") {
                alert("Permission denied. Only Franchise Owner can perform this action.");
                return;
            }

            const name = document.getElementById("recipeNameInput").value.trim();
            const portion = document.getElementById("recipePortionInput").value.trim();
            const retailPrice = parseFloat(document.getElementById("recipeRetailPriceInput").value);
            const rawCost = parseFloat(document.getElementById("recipeRawCostInput").value);

            const ingredients = [];
            const rows = document.querySelectorAll("#recipeIngredientsContainer .recipe-ingredient-row");
            rows.forEach(row => {
                const ingName = row.querySelector(".ing-name").value.trim();
                const ingQty = parseFloat(row.querySelector(".ing-qty").value);
                const ingUnit = row.querySelector(".ing-unit").value.trim();
                if (ingName && !isNaN(ingQty)) {
                    ingredients.push({ name: ingName, qty: ingQty, unit: ingUnit });
                }
            });

            if (ingredients.length === 0) {
                alert("Please add at least one ingredient portioning.");
                return;
            }

            const newRecipe = {
                id: `rec-${Date.now()}`,
                name,
                portion,
                status: "Active",
                ingredients,
                rawCost,
                retailPrice
            };

            try {
                const res = await fetch(`${API_BASE}/api/recipes`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-User-Role': currentRole
                    },
                    body: JSON.stringify(newRecipe)
                });

                if (res.ok) {
                    alert("Recipe created successfully.");
                    closeModal("modalCreateRecipe");
                    await syncStateFromServer();
                } else {
                    const errData = await res.json();
                    alert("Error: " + errData.error);
                }
            } catch (err) {
                console.error(err);
                alert("Failed to create recipe.");
            }
        });
    }

    window.deleteRecipePrompt = async function(recipeId) {
        if (currentRole !== "owner") {
            alert("Permission denied. Only Franchise Owner can perform this action.");
            return;
        }

        const confirmDelete = confirm("Are you sure you want to delete this recipe?");
        if (!confirmDelete) return;

        try {
            const res = await fetch(`${API_BASE}/api/recipes/${recipeId}`, {
                method: 'DELETE',
                headers: {
                    'X-User-Role': currentRole
                }
            });

            if (res.ok) {
                alert("Recipe deleted successfully.");
                await syncStateFromServer();
            } else {
                const errData = await res.json();
                alert("Error: " + errData.error);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to delete recipe.");
        }
    };

    // === RECIPE BULK IMPORT (EXCEL) ===
    function parseIngredientsString(str) {
        if (!str) return [];
        const list = [];
        const parts = str.split(/[;,\n\r]+/);
        parts.forEach(part => {
            const cleaned = part.trim();
            if (!cleaned) return;

            // Pattern 1: Parentheses at the end, e.g. "Flour (200g)" or "Flour (200)" or "Flour (200 g)"
            let match = cleaned.match(/^(.+?)\s*\(\s*(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)?\s*\)$/);
            if (match) {
                list.push({
                    name: match[1].trim(),
                    qty: parseFloat(match[2]),
                    unit: (match[3] || 'Piece').trim()
                });
                return;
            }

            // Pattern 2: Delimiter followed by quantity at the end, e.g. "Flour - 200g" or "Flour: 200" or "Flour: 200 g"
            match = cleaned.match(/^(.+?)\s*[-:]\s*(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)?$/);
            if (match) {
                list.push({
                    name: match[1].trim(),
                    qty: parseFloat(match[2]),
                    unit: (match[3] || 'Piece').trim()
                });
                return;
            }

            // Pattern 3: Space followed by quantity (and optional unit) at the end, e.g. "Flour 200g" or "Flour 200" or "Flour 200 g"
            match = cleaned.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)?$/);
            if (match) {
                list.push({
                    name: match[1].trim(),
                    qty: parseFloat(match[2]),
                    unit: (match[3] || 'Piece').trim()
                });
                return;
            }

            // Pattern 4: Quantity (and optional unit) at the start, e.g. "200g Flour" or "2 Eggs" or "200 g Flour"
            match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)?\s+(?:-|:)?\s*(.+)$/);
            if (match) {
                list.push({
                    name: match[3].trim(),
                    qty: parseFloat(match[1]),
                    unit: (match[2] || 'Piece').trim()
                });
                return;
            }

            // Fallback: Just the name
            list.push({
                name: cleaned,
                qty: 1,
                unit: 'Piece'
            });
        });
        return list;
    }

    function resetBulkImportRecipes() {
        currentParsedBulkRecipes = [];
        const dropzone = document.getElementById("bulkImportRecipesDropzone");
        if (dropzone) dropzone.style.display = "block";
        const status = document.getElementById("bulkImportRecipesStatus");
        if (status) status.style.display = "none";
        const previewBlock = document.getElementById("bulkImportRecipesPreviewBlock");
        if (previewBlock) previewBlock.style.display = "none";
        const fileInput = document.getElementById("bulkImportRecipesFileInput");
        if (fileInput) fileInput.value = "";
        
        const applyBtn = document.getElementById("btnBulkImportRecipesApply");
        if (applyBtn) {
            applyBtn.disabled = true;
            applyBtn.textContent = "Apply Updates";
        }
    }

    function handleBulkImportRecipesFile(file) {
        resetBulkImportRecipes();
        const dropzone = document.getElementById("bulkImportRecipesDropzone");
        const status = document.getElementById("bulkImportRecipesStatus");
        const statusText = document.getElementById("bulkImportRecipesStatusText");

        if (dropzone) dropzone.style.display = "none";
        if (status) status.style.display = "block";
        if (statusText) statusText.textContent = "Reading and parsing Excel sheet...";

        setTimeout(() => {
            parseRecipesExcel(file);
            if (status) status.style.display = "none";
        }, 1000);
    }

    function parseRecipesExcel(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, {header: 1});

                if (rows.length < 2) {
                    alert("The Excel sheet is empty or contains no data rows.");
                    resetBulkImportRecipes();
                    return;
                }

                // Find headers with smart heuristic mapping (scan up to first 10 rows for non-empty headers)
                let headerRowIndex = 0;
                let headerRow = [];
                let nameIdx = -1;

                for (let r = 0; r < Math.min(10, rows.length); r++) {
                    const rowCells = rows[r];
                    if (!rowCells || rowCells.length === 0) continue;
                    const tempHeaders = rowCells.map(h => String(h || '').trim().toLowerCase());
                    
                    // Prefer columns containing "recipe", "recepie" or "product name", and avoid "ingredient"/"increadient"
                    let idx = tempHeaders.findIndex(h => 
                        (h.includes('recipe') || h.includes('recepie') || h === 'product name' || h === 'recipe name' || h === 'recepie name') && 
                        !h.includes('ingredient') && !h.includes('increadient') && !h.includes('ingred')
                    );
                    if (idx === -1) {
                        idx = tempHeaders.findIndex(h => 
                            (h.includes('name') || h === 'item' || h === 'product' || h === 'dish' || h === 'menu') && 
                            !h.includes('id') && !h.includes('no') && !h.includes('code') && 
                            !h.includes('ingredient') && !h.includes('increadient') && !h.includes('ingred')
                        );
                    }
                    
                    if (idx !== -1) {
                        headerRowIndex = r;
                        headerRow = tempHeaders;
                        nameIdx = idx;
                        break;
                    }
                }

                // Fallback: if we didn't find a matching header row, use the first non-empty row as header
                if (nameIdx === -1) {
                    for (let r = 0; r < Math.min(10, rows.length); r++) {
                        const rowCells = rows[r];
                        if (rowCells && rowCells.length > 0) {
                            headerRowIndex = r;
                            headerRow = rowCells.map(h => String(h || '').trim().toLowerCase());
                            break;
                        }
                    }
                }

                const portionIdx = headerRow.findIndex(h => h.includes('portion') || h.includes('size') || h.includes('desc'));
                
                // Prevent overlaps between retail price and raw cost
                const retailIdx = headerRow.findIndex(h => 
                    h.includes('retail') || 
                    h.includes('srp') || 
                    h.includes('suggested') || 
                    h.includes('selling') || 
                    (h.includes('price') && !h.includes('cost') && !h.includes('raw'))
                );
                const rawCostIdx = headerRow.findIndex(h => 
                    h.includes('raw') || 
                    (h.includes('cost') && !h.includes('retail') && !h.includes('suggested') && !h.includes('selling') && !h.includes('price'))
                );

                let finalNameIdx = nameIdx;
                if (finalNameIdx === -1 && headerRow.length > 0) {
                    finalNameIdx = headerRow.findIndex(h => 
                        (h.includes('recipe') || h.includes('recepie') || h.includes('item') || h.includes('name') || h.includes('dish') || h.includes('menu')) && 
                        !h.includes('ingredient') && !h.includes('increadient') && !h.includes('ingred')
                    );
                }
                if (finalNameIdx === -1) {
                    // Default to column 0 if no header matches
                    finalNameIdx = 0;
                }

                // Find separate ingredient name, qty, unit columns if they exist (Layout B)
                const ingredientNameIdx = headerRow.findIndex((h, idx) => 
                    idx !== finalNameIdx && 
                    (h.includes('ingredient') || h.includes('increadient') || h.includes('ingred') || h.includes('item') || h.includes('component') || h.includes('material') || h.includes('product') || h.includes('name') || h.includes('raw') || h.includes('particular'))
                );
                const qtyIdx = headerRow.findIndex(h => h.includes('qty') || h.includes('quantity') || h.includes('amount') || h.includes('vol') || h.includes('weight') || h.includes('wt') || h.includes('size') || h.includes('count'));
                const unitIdx = headerRow.findIndex(h => h.includes('unit') || h.includes('measure') || h.includes('uom') || h.includes('pkg') || h.includes('pack'));

                // Find ingredients list column (Layout A fallback)
                const ingredientsIdx = headerRow.findIndex(h => 
                    (h.includes('ingredients') || h.includes('increadients') || h.includes('items') || h.includes('details') || h.includes('portioning') || h.includes('list')) && 
                    h !== 'ingredient' && h !== 'ingredient name' && h !== 'increadient' && h !== 'increadient name'
                );

                // If separate ingredient name and (qty or unit) are present, it is a multi-row layout
                const isMultiRowLayout = (ingredientNameIdx !== -1 && (qtyIdx !== -1 || unitIdx !== -1));

                const parsedUpdatesMap = new Map();
                let lastRecipeName = "";
                let lastRecipeKey = "";

                for (let i = headerRowIndex + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    const nameVal = String(row[finalNameIdx] || '').trim();
                    
                    let finalName = '';
                    let nameKey = '';
                    if (nameVal) {
                        finalName = nameVal;
                        lastRecipeName = nameVal;
                        lastRecipeKey = nameVal.toLowerCase();
                        nameKey = lastRecipeKey;
                    } else if (isMultiRowLayout && lastRecipeName) {
                        finalName = lastRecipeName;
                        nameKey = lastRecipeKey;
                    } else {
                        continue;
                    }

                    // Parse ingredients for this row
                    const rowIngredients = [];
                    if (isMultiRowLayout) {
                        const ingName = String(row[ingredientNameIdx] || '').trim();
                        if (ingName) {
                            const rawQty = qtyIdx !== -1 && row[qtyIdx] !== undefined ? cleanFloat(row[qtyIdx]) : 1.0;
                            const ingQty = rawQty > 0 ? rawQty : 1.0;
                            const ingUnit = (unitIdx !== -1 && row[unitIdx] !== undefined && String(row[unitIdx]).trim()) ? String(row[unitIdx]).trim() : 'Piece';
                            rowIngredients.push({ name: ingName, qty: ingQty, unit: ingUnit });
                        }
                    } else {
                        // Fallback to Layout A (ingredients list column)
                        const targetIngIdx = ingredientsIdx !== -1 ? ingredientsIdx : ingredientNameIdx; // fallback to ingredients name column if list is there
                        const ingredientsVal = targetIngIdx !== -1 && row[targetIngIdx] !== undefined ? String(row[targetIngIdx]).trim() : '';
                        if (ingredientsVal) {
                            rowIngredients.push(...parseIngredientsString(ingredientsVal));
                        }
                    }

                    const retailPrice = retailIdx !== -1 && row[retailIdx] !== undefined ? cleanFloat(row[retailIdx]) : 0.00;
                    const rawCost = rawCostIdx !== -1 && row[rawCostIdx] !== undefined ? cleanFloat(row[rawCostIdx]) : 0.00;
                    const portionVal = portionIdx !== -1 && row[portionIdx] !== undefined ? String(row[portionIdx]).trim() : '';

                    if (parsedUpdatesMap.has(nameKey)) {
                        const existing = parsedUpdatesMap.get(nameKey);
                        // Merge ingredients
                        if (rowIngredients.length > 0) {
                            existing.ingredients = existing.ingredients.concat(rowIngredients);
                        }
                        // Overwrite with non-zero values if present
                        if (retailPrice > 0) existing.retailPrice = retailPrice;
                        if (rawCost > 0) existing.rawCost = rawCost;
                        if (portionVal) existing.portion = portionVal;
                    } else {
                        const matchedRecipe = recipes.find(r => r.name && r.name.toLowerCase() === nameKey);
                        const finalPortion = portionVal || (matchedRecipe ? matchedRecipe.portion : 'Standard size portion');
                        const finalRetailPrice = retailPrice || (matchedRecipe ? matchedRecipe.retailPrice : 0.00);
                        const finalRawCost = rawCost || (matchedRecipe ? matchedRecipe.rawCost : 0.00);
                        
                        const ingredients = rowIngredients.length > 0 ? rowIngredients : (matchedRecipe ? matchedRecipe.ingredients : []);

                        parsedUpdatesMap.set(nameKey, {
                            id: matchedRecipe ? matchedRecipe.id : ('rec-bulk-' + Date.now() + '-' + i + '-' + Math.floor(Math.random() * 100000)),
                            isNew: !matchedRecipe,
                            name: finalName,
                            portion: finalPortion,
                            ingredients,
                            rawCost: isNaN(finalRawCost) ? 0.00 : finalRawCost,
                            retailPrice: isNaN(finalRetailPrice) ? 0.00 : finalRetailPrice
                        });
                    }
                }

                const parsedUpdates = Array.from(parsedUpdatesMap.values());

                showBulkImportRecipesPreview(parsedUpdates);
            } catch (err) {
                console.error(err);
                alert("Error parsing Excel file. Please ensure it is a valid format.");
                resetBulkImportRecipes();
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function showBulkImportRecipesPreview(updates) {
        currentParsedBulkRecipes = updates;
        
        const previewBlock = document.getElementById("bulkImportRecipesPreviewBlock");
        const tableBody = document.getElementById("bulkImportRecipesPreviewTableBody");
        const applyBtn = document.getElementById("btnBulkImportRecipesApply");

        if (!tableBody || !previewBlock || !applyBtn) return;

        tableBody.innerHTML = "";

        if (updates.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">No valid recipes parsed from Excel.</td></tr>`;
            applyBtn.disabled = true;
        } else {
            updates.forEach(recipe => {
                const marginPct = Number((recipe.rawCost / recipe.retailPrice) * 100);
                const marginPctFloored = isNaN(marginPct) || !isFinite(marginPct) ? 0 : Math.floor(marginPct * 10) / 10;
                const badge = recipe.isNew ? ' <span class="pill-badge pill-badge-success" style="font-size:0.6rem; padding: 2px 4px; vertical-align: middle;">NEW</span>' : '';
                
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="font-weight:700;">${escapeHTML(recipe.name)}${badge}</td>
                    <td>${escapeHTML(recipe.portion)}</td>
                    <td>${recipe.ingredients.length} items</td>
                    <td>₹${recipe.rawCost.toFixed(2)}</td>
                    <td>₹${recipe.retailPrice.toFixed(2)}</td>
                    <td style="font-weight:700;">${marginPctFloored.toFixed(1)}%</td>
                `;
                tableBody.appendChild(tr);
            });
            applyBtn.disabled = false;
        }

        previewBlock.style.display = "block";
    }

    async function applyBulkRecipesUpdates() {
        if (currentParsedBulkRecipes.length === 0) return;

        const applyBtn = document.getElementById("btnBulkImportRecipesApply");
        if (applyBtn) {
            applyBtn.disabled = true;
            applyBtn.textContent = "Applying...";
        }

        let successCount = 0;
        for (const recipe of currentParsedBulkRecipes) {
            try {
                const res = await fetch(`${API_BASE}/api/recipes`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-User-Role': currentRole
                    },
                    body: JSON.stringify({
                        id: recipe.id,
                        name: recipe.name,
                        portion: recipe.portion,
                        status: "Active",
                        ingredients: recipe.ingredients,
                        rawCost: recipe.rawCost,
                        retailPrice: recipe.retailPrice
                    })
                });
                if (res.ok) successCount++;
            } catch (err) {
                console.error("Failed to sync recipe during bulk import:", recipe.name, err);
            }
        }

        alert(`Successfully imported ${successCount} recipes.`);
        closeModal('modalBulkImportRecipes');
        await syncStateFromServer();
    }

    // Setup event listeners for recipes drag/drop
    const recipesDropzone = document.getElementById("bulkImportRecipesDropzone");
    const recipesFileInput = document.getElementById("bulkImportRecipesFileInput");
    const recipesApplyBtn = document.getElementById("btnBulkImportRecipesApply");

    if (recipesDropzone && recipesFileInput) {
        recipesDropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            recipesDropzone.style.background = "var(--bg-hover)";
            recipesDropzone.style.borderColor = "var(--orange-primary)";
        });

        recipesDropzone.addEventListener("dragleave", () => {
            recipesDropzone.style.background = "var(--bg-sidebar)";
            recipesDropzone.style.borderColor = "var(--border)";
        });

        recipesDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            recipesDropzone.style.background = "var(--bg-sidebar)";
            recipesDropzone.style.borderColor = "var(--border)";
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleBulkImportRecipesFile(e.dataTransfer.files[0]);
            }
        });

        recipesDropzone.addEventListener("click", () => {
            recipesFileInput.click();
        });

        recipesFileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleBulkImportRecipesFile(e.target.files[0]);
            }
        });
    }

    if (recipesApplyBtn) {
        recipesApplyBtn.addEventListener("click", () => {
            applyBulkRecipesUpdates();
        });
    }


    // === INITIAL STARTUP SYNC ===
    syncStateFromServer(true).then(() => {
        const cachedRoleKey = localStorage.getItem("bk_current_role_key");
        const defaultRole = cachedRoleKey ? cachedRoleKey : "bm-mumbai";
        setRole(defaultRole);
    });
});
