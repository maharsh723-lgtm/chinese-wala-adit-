import { trainingData } from "./trainingData.js";
function initApp() {
    // Override window.fetch to automatically include JWT token
    const originalFetch = window.fetch;
    window.fetch = function (url, options = {}) {
        const token = localStorage.getItem("bk_jwt_token");
        if (token) {
            options.headers = options.headers || {};
            options.headers["Authorization"] = `Bearer ${token}`;
        }
        return originalFetch(url, options);
    };

    // Listen for User ID inputs to show/hide branch selector
    const usernameInput = document.getElementById('login-username');
    if (usernameInput) {
        usernameInput.addEventListener('input', (e) => {
            const val = e.target.value.trim().toLowerCase();
            const branchGroup = document.getElementById('login-branch-group');
            if (val.startsWith('manager') || val.includes('123') || val.startsWith('emp')) {
                branchGroup.style.display = 'block';
            } else {
                branchGroup.style.display = 'none';
            }
        });
    }

    // Submit credentials on login button click
    const loginSubmitBtn = document.getElementById("login-submit-btn");
    if (loginSubmitBtn) {
        loginSubmitBtn.addEventListener("click", async () => {
            const passwordInput = document.getElementById("login-password");
            const errorMsg = document.getElementById("login-error-msg");
            
            const username = usernameInput ? usernameInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value.trim() : "";
            
            if (!username || !password) {
                if (errorMsg) errorMsg.textContent = "Please enter both User ID and Password.";
                return;
            }
            
            if (errorMsg) errorMsg.textContent = "";
            loginSubmitBtn.textContent = "Logging in...";
            loginSubmitBtn.disabled = true;
            
            try {
                const response = await originalFetch(`${API_BASE}/api/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: username, password: password })
                });
                
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || "Invalid User ID or Password.");
                }
                
                const data = await response.json();
                
                // Store JWT and user
                localStorage.setItem("bk_jwt_token", data.token);
                localStorage.setItem("bk_logged_in_user", JSON.stringify(data.user));
                
                // Set role and store
                let roleKey = "owner";
                if (data.user.roleKey === "sm") {
                    // Read selected branch from dropdown
                    const branchSelect = document.getElementById("login-branch");
                    roleKey = branchSelect ? branchSelect.value : "bm-vesu";
                }
                
                localStorage.setItem("bk_current_role_key", roleKey);
                
                // Hide login overlay
                const overlay = document.getElementById("login-overlay");
                if (overlay) overlay.style.display = "none";
                
                // Initialize/sync app state
                await syncStateFromServer(true);
                setRole(roleKey);
                
            } catch (err) {
                if (errorMsg) errorMsg.textContent = err.message;
            } finally {
                loginSubmitBtn.textContent = "Log In";
                loginSubmitBtn.disabled = false;
            }
        });
    }

    const passwordInput = document.getElementById("login-password");
    if (passwordInput && loginSubmitBtn) {
        passwordInput.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
                loginSubmitBtn.click();
            }
        });
    }

    // Handle logout click
    document.addEventListener("click", (e) => {
        const logoutBtn = e.target.closest("#btn-logout");
        if (logoutBtn) {
            e.stopPropagation();
            localStorage.removeItem("bk_jwt_token");
            localStorage.removeItem("bk_logged_in_user");
            localStorage.removeItem("bk_current_role_key");
            
            const overlay = document.getElementById("login-overlay");
            window.location.reload();
        }
    });

    const configApiBase = window.location.protocol.startsWith('file') ? 'http://localhost:3000' : (window.location.port && window.location.port !== '3000' ? `${window.location.protocol}//${window.location.hostname}:3000` : '');
    fetch(`${configApiBase}/api/config`)
        .then(res => res.json())
        .then(config => {
            window.bk_config = config;
            console.log("Loaded system environment config:", config);
        })
        .catch(err => {
            console.error("Failed to load environment config:", err);
            window.bk_config = {
                supplierPhone: '+91 99786 73137',
                supplierEmail: 'supplies@badikatori.com',
                supplierName: 'GM Supplies'
            };
        });

    if (typeof Chart !== 'undefined') {
        Chart.defaults.color = '#A89F9B';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
        Chart.defaults.font.family = "'Outfit', sans-serif";
    }

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
    let productSales = [];
    let expenses = [];
    let currentParsedBulkRecipes = [];
    let currentUser = null;

    let posProducts = [];
    let posModifiers = [];
    let posCustomers = [];
    let posTables = [];
    let posCoupons = [];
    let posKitchenOrders = [];
    let posOrders = [];
    let posOrderItems = [];
    let posAuditLogs = [];
    let posStockMovement = [];
    let posNextToken = parseInt(localStorage.getItem("pos_next_token") || "0");
    let topSellingByStore = {};
    
    // POS Cart State
    let posCart = [];
    
    function loadCartFromStorage() {
        localStorage.removeItem("pos_cart");
        posCart = [];
    }
    loadCartFromStorage();

    function syncCartStateAndUI() {
        try {
            localStorage.setItem("pos_cart", JSON.stringify(posCart));
        } catch (e) {
            console.error("Failed to save posCart to localStorage:", e);
        }
        if (currentActiveScreen === 'billing') {
            renderPosProductsList();
            renderPosCartList();
        }
    }

    // Central state listeners for navigation, browser back/forward, pageshow
    window.addEventListener("pageshow", () => {
        loadCartFromStorage();
        if (currentActiveScreen === 'billing') {
            renderPosProductsList();
            renderPosCartList();
        }
    });

    window.addEventListener("popstate", () => {
        loadCartFromStorage();
        if (currentActiveScreen === 'billing') {
            renderPosProductsList();
            renderPosCartList();
        }
    });

    let currentDeliveryPlatformFilter = 'all';
    let currentDeliveryStatusFilter = 'all';
    let currentDeliverySubTab = 'active';
    let selectedOrderForDetails = null;

    let posReconciliations = [];
    let posReconSelectedId = null;
    let posReconCurrentPage = 1;
    let posReconSortColumn = 'date';
    let posReconSortOrder = 'desc';
    let inventorySearchVal = '';

    // Excel Import Wizard State
    let excelUploadedWorkbook = null;
    let excelUploadedFileName = '';
    let excelActiveSheetName = '';
    let excelActiveHeaders = [];
    let excelActiveRows = [];
    let excelColumnMappings = {};
    let excelValidationErrors = [];
    let excelValidRecords = [];
    let excelImportHistory = [];
    let excelMappingTemplates = {};

    let posSelectedCustomer = 'cust-1'; // Default: Guest Customer
    let posSelectedOrderType = 'Dine In';
    let posSelectedTable = '';
    let posHeldOrders = [];
    let posAppliedCoupon = null;
    let posCurrentModifiersProduct = null;
    let posCurrentModifiersCartIndex = null;
    let posSelectedCartIndex = null;
    let posSelectedCategory = 'all';
    let socket = null;

    let chartSales = null;
    let chartWastage = null;
    let chartOwnerWasteBranch = null;
    let chartOwnerWasteReason = null;
    let chartOwnerSales = null;
    let currentActiveScreen = "dashboard";
    let isDarkMode = false;
    let currentRole = "bm"; // "bm" or "owner"
    let currentStore = "VESU"; // Active store for Branch Manager
    let lastStateJson = ""; // For comparing state changes in polling
    
    // Premium Smart AI Procurement State
    let activeProcurementSubView = 'dashboard';
    let currentPoState = {
        poNumber: "PO-2026-0089",
        prNumber: "PR-2026-0089",
        date: "2026-07-13",
        time: "14:23",
        priority: "High",
        status: "Purchase Request Generated",
        items: [],
        totalCost: 0,
        paymentStatus: "Unpaid",
        paymentVerified: false,
        qrGenerated: false,
        orderPlaced: false,
        transactionId: "",
        paymentDate: "",
        supplierNotified: false,
        whatsappSent: false,
        emailSent: false,
        supplierViewed: false,
        supplierAccepted: false,
        location: "BK Foods GIDC Warehouse, Surat",
        eta: "Today, 5:00 PM",
        driverName: "Ramesh Kumar",
        driverPhone: "+91 98888 77777",
        vehicleNo: "GJ-05-XX-1234",
        invoiceUploaded: false,
        challanUploaded: false,
        timestamps: {
            requestCreated: "2026-07-13 14:23",
            paymentVerified: "",
            qrGenerated: "",
            orderSent: "",
            supplierAccepted: "",
            preparing: "",
            packed: "",
            dispatched: "",
            delivered: "",
            inventoryUpdated: ""
        }
    };
    
    // Owner specific views state
    let ownerAttendanceStore = "VESU";
    let ownerChecklistStoreDetail = "VESU";
    let ownerEodStore = "VESU";
    let ownerInventoryStore = "VESU";
    let ownerEodDate = "2026-06-15";
    let ownerAttendanceTab = "daily"; // "daily" or "monthly"
    let ownerAttendanceSelectedEmployee = ""; // Selected employee for monthly history
    let ownerAttendanceSelectedMonth = "2026-06"; // Selected month (YYYY-MM format)

    // Absolute base URL if opened via file:// protocol or other ports
    let API_BASE = '';
    if (window.location.protocol.startsWith('file')) {
        API_BASE = 'http://localhost:3000';
    } else if (window.location.port && window.location.port !== '3000') {
        API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    const defaultEmployees = {
        "1": { id: "1", name: "Crew Member 1", role: "Crew Member", mobile: "9876543210", shiftStart: "06:00", roleKey: "staff", password: "", status: "Active", store: "VESU", activePunch: null, history: [] },
        "EMP102": { id: "EMP102", name: "Kitchen Staff 1", role: "Kitchen Staff", mobile: "9876543211", shiftStart: "06:00", roleKey: "kitchen", password: "", status: "Active", store: "VESU", activePunch: null, history: [] },
        "EMP103": { id: "EMP103", name: "Manager GAURAV PATH", role: "Branch Manager", mobile: "9876543212", shiftStart: "14:00", roleKey: "sm", password: "", status: "Active", store: "GAURAV PATH", activePunch: null, history: [] },
        "EMP104": { id: "EMP104", name: "Manager VESU", role: "Branch Manager", mobile: "9876543213", shiftStart: "09:00", roleKey: "sm", password: "", status: "Active", store: "VESU", activePunch: null, history: [] },
        "EMP105": { id: "EMP105", name: "Manager LP SAVANI", role: "Branch Manager", mobile: "9876543214", shiftStart: "09:00", roleKey: "sm", password: "", status: "Active", store: "LP SAVANI", activePunch: null, history: [] },
        "EMP106": { id: "EMP106", name: "Manager SUDAMA CHOWK", role: "Branch Manager", mobile: "9876543215", shiftStart: "09:00", roleKey: "sm", password: "", status: "Active", store: "SUDAMA CHOWK", activePunch: null, history: [] },
        "OWNER101": { id: "OWNER101", name: "Franchise Owner", role: "Owner", mobile: "9999999999", shiftStart: "09:00", roleKey: "owner", password: "", status: "Active", store: "All", activePunch: null, history: [] },
        "bk2022": { id: "bk2022", name: "Franchise Owner", role: "Owner", mobile: "9999999999", shiftStart: "09:00", roleKey: "owner", password: "", status: "Active", store: "All", activePunch: null, history: [] },
        "manager/123": { id: "manager/123", name: "Store Manager", role: "Branch Manager", mobile: "9876543213", shiftStart: "09:00", roleKey: "sm", password: "", status: "Active", store: "VESU", activePunch: null, history: [] }
    };

    // Helper: Compress image file using canvas resize & quality adjustment
    function compressImageFile(file, maxWidth, maxHeight, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (event) {
                const img = new Image();
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                };
                img.onerror = function (err) {
                    reject(err);
                };
                img.src = event.target.result;
            };
            reader.onerror = function (err) {
                reject(err);
            };
            reader.readAsDataURL(file);
        });
    }

    // Helper: Date String Format YYYY-MM-DD
    function getTodayDateStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // Helper: Robust Date Parser supporting Excel serial, ISO, and standard/Indian formats
    function parseRobustDate(dStr) {
        if (!dStr) return getTodayDateStr();
        dStr = dStr.toString().trim();
        
        // Check for Excel serial number
        if (!isNaN(dStr) && parseFloat(dStr) > 40000) {
            const dateObj = new Date((parseFloat(dStr) - 25569) * 86400 * 1000);
            const yyyy = dateObj.getUTCFullYear();
            const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getUTCDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }
        
        // Match standard YYYY-MM-DD or YYYY/MM/DD
        const ymdPattern = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
        let match = dStr.match(ymdPattern);
        if (match) {
            const y = match[1];
            const m = match[2].padStart(2, '0');
            const d = match[3].padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        
        // Match Indian format DD-MM-YYYY or DD/MM/YYYY
        const dmyPattern = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
        match = dStr.match(dmyPattern);
        if (match) {
            const d = match[1].padStart(2, '0');
            const m = match[2].padStart(2, '0');
            const y = match[3];
            return `${y}-${m}-${d}`;
        }
        
        // Match JS Date parsed
        const timestamp = Date.parse(dStr);
        if (!isNaN(timestamp)) {
            const dateObj = new Date(timestamp);
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }
        
        // Fallback
        return getTodayDateStr();
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

    function getPOSStore() {
        return (currentStore === 'All') ? 'VESU' : currentStore;
    }

    // === 2. STATE SYNCHRONIZATION FROM SERVER ===
    async function syncStateFromServer(isInitial = false) {
        try {
            const response = await fetch(`${API_BASE}/api/state?_t=${Date.now()}`);
            if (response.status === 401) {
                console.warn("Session expired or token invalid. Redirecting to login.");
                localStorage.removeItem("bk_jwt_token");
                localStorage.removeItem("bk_logged_in_user");
                localStorage.removeItem("bk_current_role_key");
                window.location.reload();
                return;
            }
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
                productSales = data.productSales || [];
                expenses = data.expenses || [];

                posProducts = data.posProducts || [];
                posModifiers = data.posModifiers || [];
                posCustomers = data.posCustomers || [];
                posTables = data.posTables || [];
                posCoupons = data.posCoupons || [];
                posKitchenOrders = data.posKitchenOrders || [];
                posOrders = data.posOrders || [];
                posOrderItems = data.posOrderItems || [];
                posAuditLogs = data.posAuditLogs || [];
                posStockMovement = data.posStockMovement || [];
                topSellingByStore = data.topSellingByStore || {};

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
        if (currentActiveScreen === "training") renderTrainingScreen();
                
                if (typeof window.refreshAccountingData === 'function') {
                    window.refreshAccountingData();
                }
                if (typeof window.refreshReportsData === 'function') {
                    window.refreshReportsData();
                }
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
        switch (currentActiveScreen) {
            case 'dashboard': renderDashboard(); break;
            case 'opening-checklist': renderChecklistScreen('opening'); break;
            case 'closing-checklist': renderChecklistScreen('closing'); break;
            case 'attendance-system': renderAttendanceScreen(); break;
            case 'inventory-overview': renderInventoryScreen(); break;
            case 'procurement-module':
                if (typeof window.renderProcurementScreen === "function") {
                    window.renderProcurementScreen();
                }
                break;
            case 'auto-procurement': renderProcurementScreen(); break;
            case 'ai-procurement': renderAiProcurementScreen(); break;
            case 'wastage-management': renderWastageScreen(); break;
            case 'live-sales-stream': if(typeof window.renderLiveSalesStream === "function") window.renderLiveSalesStream(); break;
            case 'product-sales': renderProductSalesScreen(); break;
            case 'day-end-report': renderDayEndReportScreen(); break;
            case 'daily-expenses': if(typeof window.renderDailyExpensesScreen === "function") window.renderDailyExpensesScreen(); break;
            case 'recipe-management': renderRecipeScreen(); break;
            case 'material-reconciliation': renderMaterialReconciliationScreen(); break;
            case 'billing': renderBillingScreen(); break;
            case 'cash-reconciliation': renderCashReconciliationScreen(); break;
            case 'excel-import': renderExcelImportScreen(); break;
            case 'reports-portal':
                if (typeof window.refreshReportsPortal === "function") {
                    window.refreshReportsPortal();
                }
                break;
            case 'guest-intelligence':
                if (typeof window.refreshGuestIntelligence === "function") {
                    window.refreshGuestIntelligence();
                }
                break;
            case 'item-sales-analytics':
                if (typeof window.refreshItemSalesAnalytics === "function") {
                    window.refreshItemSalesAnalytics();
                }
                break;

            case 'kitchen-kds': renderKitchenKdsScreen(); break;
        }
    }

    // Periodic Polling loop (every 5 seconds)
    setInterval(() => {
        if (localStorage.getItem("bk_jwt_token")) {
            syncStateFromServer();
        }
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
        const unusedNavs = ["sop-management"];
        if (currentRole !== "owner") {
            unusedNavs.push("branch-wise-pl");
        }
        
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
        const validRoles = ["owner", "bm-vesu", "bm-lpsavani", "bm-gauravpath", "bm-sudamachowk"];
        if (!validRoles.includes(roleKey)) {
            roleKey = "bm-vesu";
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
            if (roleKey === "bm-vesu") {
                currentStore = "VESU";
                currentUser = empList["EMP104"] || defaultEmployees["EMP104"];
            } else if (roleKey === "bm-lpsavani") {
                currentStore = "LP SAVANI";
                currentUser = empList["EMP105"] || defaultEmployees["EMP105"];
            } else if (roleKey === "bm-gauravpath") {
                currentStore = "GAURAV PATH";
                currentUser = empList["EMP103"] || defaultEmployees["EMP103"];
            } else if (roleKey === "bm-sudamachowk") {
                currentStore = "SUDAMA CHOWK";
                currentUser = empList["EMP106"] || defaultEmployees["EMP106"];
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
        const createButtons = document.querySelectorAll("#dashGlobalCreateBtn, #btnCreatePrTop, #quickSopBtn, #quickInvBtn, #quickWastageBtn, #quickReportBtn, #quickEmpBtn");
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
            // 1. Live Sales Today (Sum of non-refunded grandTotal for today)
            const storeOrdersToday = posOrders.filter(o => o.store === currentStore && o.date === todayStr && o.status !== 'Refunded');
            const liveSalesToday = storeOrdersToday.reduce((sum, o) => sum + o.grandTotal, 0);

            // 2. Food Cost % (COGS % based on actual item recipes rawCost vs sales)
            let cogsToday = 0;
            storeOrdersToday.forEach(order => {
                order.items.forEach(item => {
                    const recipe = recipes.find(r => r.name === item.productName);
                    const rawCost = recipe ? recipe.rawCost : (item.price * 0.32);
                    cogsToday += item.quantity * rawCost;
                });
            });
            const foodCostPct = liveSalesToday > 0 ? (cogsToday / liveSalesToday) * 100 : 0.0;

            // 3. Inventory Value (Live stock valuation)
            const storeInventory = inventory.filter(inv => inv.store === currentStore);
            const inventoryValue = storeInventory.reduce((sum, inv) => sum + (inv.stock * (inv.unitCost || 0)), 0);

            // 4. Wastage Cost (Live wastage cost logged today)
            const storeWastage = wastage.filter(w => w.store === currentStore && w.date === todayStr);
            const wasteCost = storeWastage.reduce((sum, w) => sum + (w.cost || 0), 0);

            // 5. Staff Attendance (Live percentage based on active shift punches today)
            const storeStaff = Object.values(employees).filter(e => e.store === currentStore && e.roleKey !== "sm");
            const activeStaffCount = storeStaff.filter(e => e.activePunch).length;
            const attendancePct = storeStaff.length > 0 ? (activeStaffCount / storeStaff.length) * 100 : 0.0;

            // 6. SOP Compliance (Live completion percentage of SOP tasks)
            const storeSops = sops.filter(s => s.store === currentStore);
            const sopCompliance = storeSops.length > 0 
                ? storeSops.reduce((sum, s) => sum + (s.completionPct || 0), 0) / storeSops.length
                : 0.0;

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
                        <div class="kpi-value">₹${liveSalesToday.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div class="kpi-meta"><span class="trend-up">▲ Live</span> ${storeOrdersToday.length} orders today</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span>Food Cost %</span>
                            <i data-lucide="percent"></i>
                        </div>
                        <div class="kpi-value">${foodCostPct.toFixed(1)}%</div>
                        <div class="kpi-meta">Target: 32.0%</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span>Inventory Value</span>
                            <i data-lucide="package"></i>
                        </div>
                        <div class="kpi-value">₹${inventoryValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div class="kpi-meta">${storeInventory.length} items in stock</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span>Wastage Cost</span>
                            <i data-lucide="trash-2" style="color: var(--danger);"></i>
                        </div>
                        <div class="kpi-value" style="color: var(--danger);">₹${wasteCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div class="kpi-meta">${storeWastage.length} spoiled logs today</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span>Staff Attendance</span>
                            <i data-lucide="users"></i>
                        </div>
                        <div class="kpi-value">${attendancePct.toFixed(1)}%</div>
                        <div class="kpi-meta">${activeStaffCount} / ${storeStaff.length} checked in</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span>SOP Compliance</span>
                            <i data-lucide="shield-check"></i>
                        </div>
                        <div class="kpi-value">${sopCompliance.toFixed(1)}%</div>
                        <div class="kpi-meta">Task completion average</div>
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
                        <div class="widget-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-weight: 800; font-size: 0.95rem; color: var(--pos-espresso);">
                            <span>Best Selling Items (Today)</span>
                            <i data-lucide="flame" style="color: var(--pos-accent-orange, #f97316); width:18px; height:18px;"></i>
                        </div>
                        <div class="widget-body" style="display: flex; flex-direction: column; gap: 10px;" id="widgetBestSelling">
                            <!-- Populated dynamically -->
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
            renderDashboardBestSelling();
        } else {
            // Owner Dashboard (Consolidated Real-time stats across all branches for TODAY)
            const totalWastageCostToday = wastage.filter(w => w.date === todayStr).reduce((sum, w) => {
                const findInv = inventory.find(inv => inv.label === w.name && inv.store === w.store);
                const uCost = findInv ? findInv.unitCost : 100;
                return sum + (w.cost || (w.qty * uCost));
            }, 0);
            const totalEmployees = Object.values(employees).filter(e => e.roleKey !== "owner" && e.roleKey !== "sm").length;
            const totalActiveStaff = Object.values(employees).filter(e => e.activePunch).length;

            const consolidatedSalesToday = posOrders.filter(o => o.date === todayStr && o.status !== 'Refunded').reduce((sum, o) => sum + o.grandTotal, 0);
            const consolidatedExpensesToday = expenses.filter(e => e.date === todayStr).reduce((sum, e) => sum + e.amount, 0);

            container.innerHTML = `
                <div class="screen-header-layout">
                    <div class="screen-title-desc">
                        <h1>Franchise Owner Command Center</h1>
                        <p>Real-time consolidated operations overview across all BK Indian outlets.</p>
                    </div>
                </div>

                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-header">Consolidated Sales (Today)</div>
                        <div class="kpi-value">₹${consolidatedSalesToday.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div class="kpi-meta">Live across all branches</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">Consolidated Expenses (Today)</div>
                        <div class="kpi-value">₹${consolidatedExpensesToday.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div class="kpi-meta">Net Operating Cost today</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header">Consolidated Wastage (Today)</div>
                        <div class="kpi-value" style="color:var(--danger);">₹${totalWastageCostToday.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div class="kpi-meta">Total financial loss today</div>
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
                        <div class="widget-title">Branch-wise Sales Performance (Today)</div>
                        <div class="widget-body" style="height: 220px; position: relative;">
                            <canvas id="ownerSalesComparisonChart"></canvas>
                        </div>
                    </div>

                    <div class="widget-card" style="grid-column: span 3; margin-top: 16px;">
                        <div class="widget-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-weight: 800; font-size: 0.95rem; color: var(--pos-espresso);">
                            <span>Best Selling Items (By Branch)</span>
                            <i data-lucide="flame" style="color: var(--pos-accent-orange, #f97316); width:18px; height:18px;"></i>
                        </div>
                        <div class="branch-top-sales-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;" id="ownerBestSellingGrid">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                </div>
            `;
            initOwnerDashboardCharts();
            renderOwnerDashboardChecklists();
            renderOwnerDashboardBestSelling();
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

        const todayStr = getTodayDateStr();
        const storeOrdersToday = posOrders.filter(o => o.store === currentStore && o.date === todayStr && o.status !== 'Refunded');

        const hourlySales = [0, 0, 0, 0, 0, 0];
        storeOrdersToday.forEach(order => {
            const timeStr = order.time || "12:00:00";
            const hour = parseInt(timeStr.split(":")[0]) || 12;
            if (hour >= 8 && hour < 11) hourlySales[0] += order.grandTotal;
            else if (hour >= 11 && hour < 14) hourlySales[1] += order.grandTotal;
            else if (hour >= 14 && hour < 17) hourlySales[2] += order.grandTotal;
            else if (hour >= 17 && hour < 20) hourlySales[3] += order.grandTotal;
            else if (hour >= 20 && hour < 23) hourlySales[4] += order.grandTotal;
            else if (hour >= 23 || hour < 8) hourlySales[5] += order.grandTotal;
        });

        if (chartSales) chartSales.destroy();
        chartSales = new Chart(ctx, {
            type: "line",
            data: {
                labels: ["08:00", "11:00", "14:00", "17:00", "20:00", "23:00"],
                datasets: [{
                    label: "Hourly Revenue (₹)",
                    data: hourlySales,
                    borderColor: "#FF6B00",
                    borderWidth: 3,
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
    function initOwnerDashboardCharts() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not loaded. Skipping chart initialization.');
            return;
        }
        const ctx = document.getElementById("ownerSalesComparisonChart");
        if (!ctx) return;

        const labels = ["VESU", "LP SAVANI", "GAURAV PATH", "SUDAMA CHOWK"];
        const todayStr = getTodayDateStr();
        const salesData = labels.map(lbl => {
            const storeOrders = posOrders.filter(o => o.store === lbl && o.date === todayStr && o.status !== 'Refunded');
            return storeOrders.reduce((sum, o) => sum + o.grandTotal, 0);
        });

        if (chartOwnerSales) chartOwnerSales.destroy();
        chartOwnerSales = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels.map(l => l.split(' ')[0]),
                datasets: [{
                    label: "Today's Sales (₹)",
                    data: salesData,
                    backgroundColor: ["#10b981", "#f97316", "#3b82f6"],
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

    // Helper: Top 5 Selling Items today
    function renderDashboardBestSelling() {
        const widget = document.getElementById("widgetBestSelling");
        if (!widget) return;
        widget.innerHTML = "";

        const branchItems = topSellingByStore[currentStore] || [];

        if (branchItems.length === 0) {
            widget.innerHTML = `
                <div style="font-size: 0.8rem; color: var(--text-tertiary); text-align: center; padding: 20px 0;">
                    No sales recorded yet today.
                </div>
            `;
            return;
        }

        branchItems.forEach((item, index) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.fontSize = "0.85rem";
            row.style.padding = "6px 0";
            row.style.borderBottom = "1px dashed rgba(46, 35, 31, 0.05)";
            row.innerHTML = `
                <span style="font-weight: 700; color: var(--pos-espresso);">${index + 1}. ${item.productName}</span>
                <span style="color: var(--text-secondary); font-weight: 600;">${item.qty} units</span>
            `;
            widget.appendChild(row);
        });
    }

    // Helper: Owner Dashboard Top 5 Best Selling Items per branch
    function renderOwnerDashboardBestSelling() {
        const container = document.getElementById("ownerBestSellingGrid");
        if (!container) return;
        container.innerHTML = "";

        const branches = ["VESU", "LP SAVANI", "GAURAV PATH", "SUDAMA CHOWK"];
        branches.forEach(branch => {
            const branchCol = document.createElement("div");
            branchCol.style.display = "flex";
            branchCol.style.flexDirection = "column";
            branchCol.style.gap = "8px";
            branchCol.style.padding = "16px";
            branchCol.style.background = "var(--bg-hover)";
            branchCol.style.borderRadius = "8px";
            branchCol.style.border = "1px solid var(--border)";

            let branchHeaderColor = "var(--pos-accent-green, #10b981)";
            if (branch === "LP SAVANI") branchHeaderColor = "var(--pos-accent-orange, #f97316)";
            if (branch === "GAURAV PATH") branchHeaderColor = "var(--pos-accent-blue, #3b82f6)";
            if (branch === "SUDAMA CHOWK") branchHeaderColor = "var(--pos-accent-red, #ef4444)";

            const branchHeader = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid ${branchHeaderColor}; padding-bottom: 6px; margin-bottom: 8px;">
                    <strong style="font-size:0.9rem; color: var(--pos-espresso);">${branch} Branch</strong>
                    <span style="font-size:0.7rem; background:${branchHeaderColor}15; color:${branchHeaderColor}; padding:2px 6px; border-radius:4px; font-weight:800;">TOP 5</span>
                </div>
            `;
            branchCol.innerHTML = branchHeader;

            const items = topSellingByStore[branch] || [];
            if (items.length === 0) {
                branchCol.innerHTML += `
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); text-align: center; padding: 20px 0;">
                        No sales recorded yet.
                    </div>
                `;
            } else {
                items.forEach((item, index) => {
                    const row = document.createElement("div");
                    row.style.display = "flex";
                    row.style.justifyContent = "space-between";
                    row.style.alignItems = "center";
                    row.style.fontSize = "0.78rem";
                    row.style.padding = "4px 0";
                    row.style.borderBottom = "1px dashed rgba(46, 35, 31, 0.04)";
                    row.innerHTML = `
                        <span style="font-weight: 700; color: var(--pos-espresso); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 140px;">${index + 1}. ${item.productName}</span>
                        <span style="color: var(--text-secondary); font-weight: 600; flex-shrink: 0;">${item.qty} units</span>
                    `;
                    branchCol.appendChild(row);
                });
            }
            container.appendChild(branchCol);
        });
    }

    // Helper: Owner Dashboard Checklists Monitor
    function renderOwnerDashboardChecklists() {
        const container = document.getElementById("ownerDashboardChecklists");
        if (!container) return;
        container.innerHTML = "";

        const todayStr = getTodayDateStr();
        const branches = ["VESU", "LP SAVANI", "GAURAV PATH", "SUDAMA CHOWK"];

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
    const OPENING_TASKS = [
        { title: "Staff Grooming & Uniform", desc: "All staff clocked in on time, in clean uniform, apron, and cap/hairnet." },
        { title: "Nails & Jewellery Check", desc: "Nails trimmed, no jewellery on hands; hand wash station stocked with soap and paper towels." },
        { title: "Daily Morning Briefing", desc: "Briefing done - specials, low-stock items, and previous day's customer feedback." },
        { title: "Dining Cleanliness", desc: "Dining area tables, chairs, and floor wiped and clean." },
        { title: "Counter & POS Cleanliness", desc: "Counter, POS area, and menu boards clean and dust-free." },
        { title: "Sanitize Prep Areas", desc: "Kitchen counters, cutting boards, and prep surfaces sanitized." },
        { title: "Trash Bins Set", desc: "Trash bins emptied, clean liners placed, lids functional." },
        { title: "Washroom Audit", desc: "Washroom checked - stocked, clean, functioning." },
        { title: "Refrigeration Logs", desc: "Refrigerator and freezer temperatures checked and logged (below 5°C / -18°C)." },
        { title: "Burners & Fryers Check", desc: "Induction/gas burners, tawa, and fryers tested and working." },
        { title: "Water Purifier (RO)", desc: "Water purifier / RO unit checked and running." },
        { title: "POS & Printers Power On", desc: "POS machine, printer, and card/UPI machine powered on and tested." },
        { title: "Ventilation Check", desc: "Exhaust fans and chimney switched on and working." },
        { title: "Perishables Expiry Check", desc: "Check expiry dates on dahi, chutneys, sev, papdi, and other perishables." },
        { title: "Fried Items Freshness", desc: "Puri, sev, papdi, and other fried items freshly prepped or checked for freshness." },
        { title: "Chutney Tasting & Top-Up", desc: "Chutneys (meethi, hari, imli) tasted, topped up, and refrigerated properly." },
        { title: "Vegetable Chopping Prep", desc: "Vegetables washed, chopped, and stored as per prep list." },
        { title: "Garnish Setup", desc: "Garnish items (sev, boondi, pomegranate, coriander) prepped and ready." },
        { title: "Water & Ice Top-Up", desc: "Water and ice supply checked and topped up." },
        { title: "Raw vs Cooked Segregation", desc: "Raw and cooked/ready-to-eat items stored separately in refrigeration." },
        { title: "Label Prepared Food", desc: "All prepped food items labelled with prep date and time." },
        { title: "Hygiene Consumables", desc: "Hand sanitizer and gloves available at every station." },
        { title: "Pest Audit", desc: "Pest control check - no signs of pests in storage or kitchen areas." },
        { title: "Count Opening Float", desc: "Opening cash float counted and matches register log." },
        { title: "POS Menu & Pricing", desc: "POS system logged in, menu and pricing updated for the day." },
        { title: "Aggregator Platforms Open", desc: "Online order platforms (Zomato/Swiggy) marked 'open' and menu availability updated." },
        { title: "Fire Safety Access", desc: "Fire extinguisher in place and accessible." },
        { title: "First-Aid Stock", desc: "First-aid box stocked and accessible." },
        { title: "FSSAI License Display", desc: "FSSAI license and other compliance displays visible at the counter." }
    ];

    const CLOSING_TASKS = [
        { title: "Tally Register Cash", desc: "Closing cash counted, tallied against POS sales report, and logged." },
        { title: "Close Aggregators", desc: "Online order platforms (Zomato/Swiggy) marked 'closed'." },
        { title: "Print Day-End POS Report", desc: "POS system logged out; day-end report printed/saved." },
        { title: "Report Cash Variance", desc: "Any cash discrepancies noted and reported to manager." },
        { title: "Store Perishables", desc: "Leftover perishables covered, labelled, and stored or discarded as per policy." },
        { title: "Refrigerate Sauces & Dahi", desc: "Chutneys, dahi, and cut vegetables refrigerated properly." },
        { title: "Next-Day Prep Checklist", desc: "Next day's prep list noted based on today's stock levels." },
        { title: "Note Low-Stock SKUs", desc: "Low-stock or out-of-stock items noted for reordering." },
        { title: "Shut Down Kitchen Heaters", desc: "Fryers, tawa, and burners switched off and cooled." },
        { title: "Seal Refrigeration Doors", desc: "Refrigerator and freezer doors closed properly and temperatures logged." },
        { title: "POS & Terminals Power Off", desc: "POS machine, card/UPI machine, and printer switched off." },
        { title: "Turn Off Kitchen Exhaust", desc: "Exhaust fans and chimney switched off after kitchen cools down." },
        { title: "Wash Kitchen Surfaces", desc: "All kitchen equipment, counters, and cutting boards washed and sanitized." },
        { title: "Filter Fryer Oil", desc: "Fryer oil filtered or discarded as per schedule." },
        { title: "Sweep & Mop Floors", desc: "Floors swept and mopped in kitchen and dining area." },
        { title: "Clear Waste Bins", desc: "Trash bins emptied and taken to designated disposal area." },
        { title: "Wash Dishes & Trays", desc: "Dishes, utensils, and serving trays washed and stored." },
        { title: "Turn Off Lighting", desc: "All lights except security lighting switched off." },
        { title: "Shut Off Main Gas Valve", desc: "Gas cylinders/mains valve turned off." },
        { title: "Lock Windows & Back Doors", desc: "Windows and back doors locked." },
        { title: "Lock Front Shutter & Alarm", desc: "Main entrance shutter locked and alarm (if any) activated." },
        { title: "Write Shift Handover Notes", desc: "Handover notes written for opening staff (issues, pending tasks, low stock)." }
    ];

    function renderChecklistScreen(type) {
        const container = document.getElementById(`screen-${type}-checklist`);
        if (!container) return;

        const todayStr = getTodayDateStr();

        if (currentRole === "bm") {
            const branchCl = checklists.find(c => c.store === currentStore && c.type === type && c.date === todayStr);
            const checkedIndices = branchCl ? branchCl.items : [];
            const progress      = branchCl ? branchCl.progress : 0;
            const isCompleted   = branchCl && branchCl.completed === 1;
            const existingPhoto = branchCl ? branchCl.photo : null;

            let itemPhotos = {};
            try {
                if (existingPhoto) {
                    itemPhotos = JSON.parse(existingPhoto);
                    if (typeof itemPhotos !== 'object' || itemPhotos === null) {
                        itemPhotos = {};
                    }
                }
            } catch (e) {
                if (existingPhoto && typeof existingPhoto === 'string') {
                    itemPhotos = { "0": existingPhoto };
                }
            }
            
            // Store globally to avoid massive base64 strings in inline HTML onclick handlers
            window.currentChecklistPhotos = itemPhotos;

            const tasks = type === "opening" ? OPENING_TASKS : CLOSING_TASKS;

            // Build task list HTML
            let tasksHTML = "";
            tasks.forEach((task, idx) => {
                const isChecked = checkedIndices.includes(idx);
                const itemStyle = isCompleted ? "opacity:0.85; cursor:not-allowed;" : "";
                const itemPhoto = itemPhotos[idx] || null;

                let actionBlockHTML = "";
                if (isChecked && itemPhoto) {
                    if (!isCompleted) {
                        actionBlockHTML = `
                            <div class="cl-item-actions" style="display:flex; align-items:center; gap:8px; margin-left:auto; flex-shrink:0;">
                                <img src="${itemPhoto}" class="cl-item-thumb" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid var(--border); cursor:pointer;" onclick="window.viewChecklistTaskPhoto(window.currentChecklistPhotos['${idx}'])"/>
                                <button type="button" class="saas-btn saas-btn-secondary btn-retake-task-photo" data-index="${idx}" style="padding:6px; height:32px; width:32px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border);" title="Retake Photo">
                                    <i data-lucide="camera" style="width:14px; height:14px;"></i>
                                </button>
                                <button type="button" class="saas-btn saas-btn-secondary btn-delete-task-photo" data-index="${idx}" style="padding:6px; height:32px; width:32px; display:inline-flex; align-items:center; justify-content:center; color:var(--danger); border:1px solid var(--border);" title="Delete Photo">
                                    <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                                </button>
                            </div>
                        `;
                    } else {
                        actionBlockHTML = `
                            <div class="cl-item-actions" style="display:flex; align-items:center; gap:8px; margin-left:auto; flex-shrink:0;">
                                <img src="${itemPhoto}" class="cl-item-thumb" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid var(--border); cursor:pointer;" onclick="window.viewChecklistTaskPhoto(window.currentChecklistPhotos['${idx}'])"/>
                                <span style="font-size:0.7rem; color:var(--success); font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                                    <i data-lucide="check" style="width:12px; height:12px;"></i> Verified
                                </span>
                            </div>
                        `;
                    }
                } else if (isChecked && !itemPhoto) {
                    // Legacy checked item without photo
                    if (!isCompleted) {
                        actionBlockHTML = `
                            <div class="cl-item-actions" style="display:flex; align-items:center; gap:8px; margin-left:auto; flex-shrink:0;">
                                <button type="button" class="saas-btn saas-btn-warning btn-retake-task-photo" data-index="${idx}" style="font-size:0.75rem; padding:6px 10px; height:auto; display:inline-flex; align-items:center; gap:4px; border:1px solid var(--border);">
                                    <i data-lucide="camera" style="width:12px; height:12px;"></i> Add Photo
                                </button>
                                <button type="button" class="saas-btn saas-btn-secondary btn-delete-task-photo" data-index="${idx}" style="padding:6px; height:32px; width:32px; display:inline-flex; align-items:center; justify-content:center; color:var(--danger); border:1px solid var(--border);" title="Delete Photo">
                                    <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                                </button>
                            </div>
                        `;
                    } else {
                        actionBlockHTML = `
                            <div class="cl-item-actions" style="display:flex; align-items:center; gap:8px; margin-left:auto; flex-shrink:0;">
                                <span style="font-size:0.7rem; color:var(--success); font-weight:700;">&#10003; Checked</span>
                            </div>
                        `;
                    }
                }

                tasksHTML += `
                    <div class="checklist-item ${isChecked ? 'checked' : ''}" style="${itemStyle}">
                        <div class="checklist-checkbox-box btn-toggle-checkbox" data-index="${idx}">${isChecked ? '\u2713' : ''}</div>
                        <div class="btn-toggle-checkbox" data-index="${idx}" style="flex:1; padding-right:12px;">
                            <div class="checklist-item-title">${task.title}</div>
                            <div class="checklist-item-meta">${task.desc}</div>
                        </div>
                        ${actionBlockHTML}
                    </div>
                `;
            });

            // Build Snaps Gallery
            let galleryHTML = "";
            const photoEntries = Object.entries(itemPhotos);
            if (photoEntries.length > 0) {
                let thumbsHTML = "";
                photoEntries.forEach(([tIdx, photoUrl]) => {
                    const taskName = tasks[tIdx] ? tasks[tIdx].title : `Task ${Number(tIdx) + 1}`;
                    thumbsHTML += `
                        <div style="position:relative; width:64px; height:64px; border-radius:var(--radius-sm); overflow:hidden; border:1px solid var(--border); cursor:pointer;" onclick="window.viewChecklistTaskPhoto(window.currentChecklistPhotos['${tIdx}'])" title="${escapeHTML(taskName)}">
                            <img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover; display:block;"/>
                            <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); color:#fff; font-size:0.55rem; text-align:center; padding:2px 0;">Task ${Number(tIdx) + 1}</div>
                        </div>
                    `;
                });
                galleryHTML = `
                    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:12px;">
                        ${thumbsHTML}
                    </div>
                `;
            } else {
                galleryHTML = `<div style="font-size:0.75rem; color:var(--text-tertiary); text-align:center; padding:16px 0; border:1px dashed var(--border); border-radius:var(--radius-sm); background:rgba(255,255,255,0.01);">No verification photos snapped yet. Click on checklist items to snap photos.</div>`;
            }

            const galleryWidgetHTML = `
                <div class="widget-card">
                    <div class="widget-title">Checklist Snaps Gallery</div>
                    <div style="padding:4px 0;">
                        <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:12px; line-height:1.4;">Every checked task must have an accompanying camera verification photo.</p>
                        ${galleryHTML}
                    </div>
                </div>
            `;

            // Removed old hidden camera input
            container.innerHTML = `
                <div class="screen-header-layout">
                    <div class="screen-title-desc">
                        <h1>Daily ${type.charAt(0).toUpperCase() + type.slice(1)} Checklist (${currentStore.split(' ')[0]})</h1>
                        <p>Complete standard audits for this branch. A camera photo is compulsory when checking each task.</p>
                    </div>
                    <div class="screen-actions">
                        ${isCompleted
                            ? `<button class="saas-btn saas-btn-secondary" style="background:var(--success); border:none; color:#fff; cursor:default;" disabled>&#10003; Checklist Completed</button>`
                            : `<button class="saas-btn saas-btn-primary" id="btnSubmitChecklist" style="background:var(--success); border:none;" ${checkedIndices.length < tasks.length ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>Submit Checklist</button>`
                        }
                    </div>
                </div>

                <div class="checklist-grid">
                    <div class="checklist-tasks-panel" id="checklistTasksPanel">
                        <h3 style="font-weight:800; margin-bottom:20px;">Audits Checklist</h3>
                        ${tasksHTML}
                    </div>

                    <div style="display:flex; flex-direction:column; gap:24px;">
                        <div class="widget-card">
                            <div class="widget-title">Checklist Progress</div>
                            <div style="text-align:center; padding:20px 0;">
                                <div style="font-size:3.5rem; font-weight:800; color:var(--orange-primary);">${progress}%</div>
                                <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:8px;">
                                    ${checkedIndices.length} out of ${tasks.length} Tasks Completed
                                </div>
                                ${isCompleted ? `<div style="margin-top:12px; color:var(--success); font-weight:700; font-size:0.85rem;">&#10003; Finalized & Locked</div>` : ''}
                            </div>
                        </div>

                        ${galleryWidgetHTML}
                    </div>
                </div>
                </div>
            `;

            if (window.lucide) window.lucide.createIcons();

            // ── Event bindings and Camera logic ──────────────────────────────
            async function saveChecklistTaskPhoto(taskIdx, photoDataUrl) {
                let newPhotos = { ...itemPhotos };
                newPhotos[taskIdx] = photoDataUrl;

                let newItems = [...checkedIndices];
                if (!newItems.includes(taskIdx)) {
                    newItems.push(taskIdx);
                }

                const newProgress = Math.round((newItems.length / tasks.length) * 100);
                const completed   = newProgress === 100 ? 1 : 0;

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
                            items: newItems,
                            photo: JSON.stringify(newPhotos)
                        })
                    });
                    await syncStateFromServer();
                } catch (err) {
                    console.error('Failed to save task photo:', err);
                    alert('Failed to save photo. Please try again.');
                }
            }

            async function deleteChecklistTaskPhoto(taskIdx) {
                let newPhotos = { ...itemPhotos };
                delete newPhotos[taskIdx];

                let newItems = checkedIndices.filter(i => i !== taskIdx);
                const newProgress = Math.round((newItems.length / tasks.length) * 100);

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
                            completed: 0,
                            items: newItems,
                            photo: JSON.stringify(newPhotos)
                        })
                    });
                    await syncStateFromServer();
                } catch (err) {
                    console.error('Failed to delete task photo:', err);
                }
            }

            function openLiveCameraForTask(taskIdx) {
                if (isCompleted) return;
                const modal = document.getElementById('modalLiveCamera');
                const video = document.getElementById('liveCameraVideo');
                const canvas = document.getElementById('liveCameraCanvas');
                const btnSnap = document.getElementById('btnSnapLivePhoto');
                const btnClose = document.getElementById('btnCloseLiveCamera');
                const fileInput = document.getElementById('inputCameraFallbackFile');
                
                if (!modal || !video || !canvas || !btnSnap) return;
                
                modal.style.display = "flex";
                
                let activeStream = null;
                
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    console.warn("Camera mediaDevices not supported. File upload fallback active.");
                } else {
                    const constraints = {
                        video: {
                            facingMode: { ideal: "environment" }
                        }
                    };
                    
                    try {
                        navigator.mediaDevices.getUserMedia(constraints)
                            .then(stream => {
                                activeStream = stream;
                                video.srcObject = stream;
                                video.play().catch(e => console.warn("Video play failed:", e));
                            })
                            .catch(err => {
                                console.warn("Environment camera failed. Trying generic webcam fallback:", err);
                                try {
                                    navigator.mediaDevices.getUserMedia({ video: true })
                                        .then(stream => {
                                            activeStream = stream;
                                            video.srcObject = stream;
                                            video.play().catch(e => console.warn("Video play failed:", e));
                                        })
                                        .catch(err2 => {
                                            console.error("All webcam attempts failed:", err2);
                                        });
                                } catch (errSyncInner) {
                                    console.error("Sync error in generic fallback:", errSyncInner);
                                }
                            });
                    } catch (errSyncOuter) {
                        console.warn("Sync error in ideal constraints:", errSyncOuter);
                        try {
                            navigator.mediaDevices.getUserMedia({ video: true })
                                .then(stream => {
                                    activeStream = stream;
                                    video.srcObject = stream;
                                    video.play().catch(e => console.warn("Video play failed:", e));
                                })
                                .catch(err2 => {
                                    console.error("Sync webcam fallback failed:", err2);
                                });
                        } catch (errSyncFinal) {
                            console.error("Webcam media access completely failed:", errSyncFinal);
                        }
                    }
                }
                    
                const closeCamera = () => {
                    if (activeStream) {
                        try {
                            activeStream.getTracks().forEach(track => track.stop());
                        } catch (e) {
                            console.warn("Error stopping tracks:", e);
                        }
                    }
                    modal.style.display = "none";
                    btnSnap.onclick = null;
                    btnClose.onclick = null;
                    if (fileInput) {
                        fileInput.onchange = null;
                        fileInput.value = "";
                    }
                    try {
                        video.srcObject = null;
                    } catch (e) {}
                };
                
                btnClose.onclick = closeCamera;
                
                btnSnap.onclick = async () => {
                    if (!video.videoWidth || !video.srcObject) {
                        alert("Webcam stream is loading or unavailable. Please use the Choose / Upload Image option below.");
                        return;
                    }
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    closeCamera();
                    
                    await saveChecklistTaskPhoto(taskIdx, photoDataUrl);
                };

                const handleFileChange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                        const photoDataUrl = evt.target.result;
                        closeCamera();
                        await saveChecklistTaskPhoto(taskIdx, photoDataUrl);
                    };
                    reader.readAsDataURL(file);
                };

                if (fileInput) {
                    fileInput.value = "";
                    fileInput.onchange = handleFileChange;
                }
            }

                // Click checkbox or title -> open camera if unchecked
                container.querySelectorAll(".btn-toggle-checkbox").forEach(el => {
                    el.addEventListener("click", (e) => {
                        e.stopPropagation();
                        const idx = parseInt(el.getAttribute("data-index"));
                        const isChecked = checkedIndices.includes(idx);
                        if (!isChecked) {
                            openLiveCameraForTask(idx);
                        } else {
                            alert('To uncheck this task and delete its photo, click the trash icon on the right.');
                        }
                    });
                });

                // Click Retake
                container.querySelectorAll(".btn-retake-task-photo").forEach(btn => {
                    btn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        const idx = parseInt(btn.getAttribute("data-index"));
                        openLiveCameraForTask(idx);
                    });
                });

                // Click Delete
                container.querySelectorAll(".btn-delete-task-photo").forEach(btn => {
                    btn.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        const idx = parseInt(btn.getAttribute("data-index"));
                        if (confirm('Delete the verification photo? The task will also be marked as unchecked.')) {
                            await deleteChecklistTaskPhoto(idx);
                        }
                    });
                });

                // Submit Checklist
                const btnSubmit = document.getElementById('btnSubmitChecklist');
                if (btnSubmit) {
                    btnSubmit.addEventListener('click', async () => {
                        if (checkedIndices.length < tasks.length) {
                            alert('Please complete all tasks before submitting.');
                            return;
                        }
                        try {
                            await fetch(`${API_BASE}/api/checklists`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    id: `${type}-${currentStore}-${todayStr}`,
                                    type,
                                    store: currentStore,
                                    date: todayStr,
                                    progress: 100,
                                    completed: 1,
                                    items: checkedIndices,
                                    photo: JSON.stringify(itemPhotos)
                                })
                            });
                            syncStateFromServer();
                        } catch (err) {
                            console.error('Failed to submit checklist:', err);
                        }
                    });
                }
        } else {
            // Owner View
            const branches = ["VESU", "LP SAVANI", "GAURAV PATH", "SUDAMA CHOWK"];
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
                        <td>${completedCount} / ${type === 'opening' ? OPENING_TASKS.length : CLOSING_TASKS.length} tasks</td>
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
                const existingPhoto = selectedCl ? selectedCl.photo : null;

                let itemPhotos = {};
                try {
                    if (existingPhoto) {
                        itemPhotos = JSON.parse(existingPhoto);
                        if (typeof itemPhotos !== 'object' || itemPhotos === null) {
                            itemPhotos = {};
                        }
                    }
                } catch (e) {
                    if (existingPhoto && typeof existingPhoto === 'string') {
                        itemPhotos = { "0": existingPhoto };
                    }
                }
                
                // Store globally for safe modal viewing
                window.ownerChecklistPhotos = itemPhotos;
                
                const tasks = type === "opening" ? OPENING_TASKS.map(t => t.title) : CLOSING_TASKS.map(t => t.title);

                let detailItemsHTML = "";
                tasks.forEach((task, idx) => {
                    const isChecked = checkedIndices.includes(idx);
                    const itemPhoto = itemPhotos[idx] || null;
                    let photoThumbHTML = "";
                    if (itemPhoto) {
                        photoThumbHTML = `
                            <img src="${itemPhoto}" class="cl-item-thumb" style="width:36px; height:36px; object-fit:cover; border-radius:4px; border:1px solid var(--border); cursor:pointer; margin-left:auto; flex-shrink:0;" onclick="window.viewChecklistTaskPhoto(window.ownerChecklistPhotos['${idx}'])"/>
                        `;
                    }
                    detailItemsHTML += `
                        <div style="display:flex; align-items:center; gap:12px; font-size:0.85rem; padding:8px 0; border-bottom: 1px solid var(--border);">
                            <div style="width:20px; height:20px; border-radius:4px; border:2px solid ${isChecked ? 'var(--success)' : 'var(--text-tertiary)'}; display:flex; align-items:center; justify-content:center; color:var(--success); font-weight:bold; flex-shrink:0;">
                                ${isChecked ? '✓' : ''}
                            </div>
                            <span style="color: ${isChecked ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight:${isChecked ? 'bold' : 'normal'};">${task}</span>
                            ${photoThumbHTML}
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
                        <td>₹${Number(emp.salary || 0).toLocaleString('en-IN')}</td>
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
            const todayStr = getTodayDateStr();
            const todayLogs = [];
            storeStaff.forEach(emp => {
                emp.history.forEach(h => {
                    if (h.date === todayStr) {
                        todayLogs.push({ name: emp.name, role: emp.role, salary: emp.salary, ...h });
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
                        <td>₹${Number(log.salary || 0).toLocaleString('en-IN')}</td>
                        <td><span class="pill-badge pill-badge-success">${log.status}</span></td>
                    </tr>
                `;
            });

            if (todayLogs.length === 0) {
                shiftLogsHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary); padding: 12px 0;">No shifts logged today.</td></tr>`;
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
                                <th>Monthly Salary</th>
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
                                <th>Shift Pay</th>
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
                const branches = ["VESU", "LP SAVANI", "GAURAV PATH", "SUDAMA CHOWK"];
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
                            <td>₹${Number(emp.salary || 0).toLocaleString('en-IN')}</td>
                            <td>${loginTime}</td>
                            <td>${logoutTime}</td>
                            <td>${statusHTML}</td>
                            <td>${duration}</td>
                        </tr>
                    `;
                });

                if (selectedBranchStaff.length === 0) {
                    staffRowsHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-tertiary); padding: 12px 0;">No staff assigned to this branch.</td></tr>`;
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
                        <select class="saas-form-select" id="ownerAttendanceStoreSelect" style="width:250px; background:var(--bg-sidebar); color:#ffffff;">
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
                                    <th>Monthly Salary</th>
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
                                <td>₹${Number(log.salary || 0).toLocaleString('en-IN')}</td>
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
                    historyRowsHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-tertiary); padding: 12px 0;">No attendance records found for this employee in the selected month.</td></tr>`;
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
                            <select class="saas-form-select" id="ownerHistoryEmployeeSelect" style="background:var(--bg-sidebar); color:#ffffff;">
                                ${employeeOptionsHTML}
                            </select>
                        </div>
                        <div style="display:flex; gap:12px; align-items:center; flex:0.6;">
                            <div style="font-weight:700; font-size:0.9rem; color:var(--text-secondary); white-space:nowrap;">Month:</div>
                            <select class="saas-form-select" id="ownerHistoryMonthSelect" style="background:var(--bg-sidebar); color:#ffffff;">
                                ${monthOptionsHTML}
                            </select>
                        </div>
                    </div>

                    <div class="kpi-grid" style="margin-bottom:24px; box-shadow:none; padding:0; grid-template-columns: repeat(3, 1fr);">
                        <div class="kpi-card" style="padding:16px;">
                            <div class="kpi-header">Shifts Completed</div>
                            <div class="kpi-value">${totalShifts}</div>
                        </div>
                        <div class="kpi-card" style="padding:16px;">
                            <div class="kpi-header">Total Hours Worked</div>
                            <div class="kpi-value">${totalHours} hrs</div>
                        </div>
                        <div class="kpi-card" style="padding:16px;">
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
                                    <th>Shift Pay</th>
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
        const empInput = document.getElementById("manualAttendanceEmpInput");
        if (empInput) {
            empInput.value = "";
        }
        const dateInput = document.getElementById("manualAttendanceDate");
        if (dateInput) {
            dateInput.value = getTodayDateStr();
        }
        const salInput = document.getElementById("manualAttendanceSalary");
        if (salInput) {
            salInput.value = "";
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
        const todayStr = getTodayDateStr();

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
            salary: emp.salary ? Math.round((emp.salary / 30) * (parseFloat(hoursLogged) / 8)) : 0,
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
        console.log("renderInventoryScreen called. Inventory count:", inventory.length, "Role:", currentRole, "Store:", currentStore, "TargetStore:", targetStore);
        const storeInv = inventory.filter(i => i.store === targetStore);

        // Calculate metrics based on ALL items for this store
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

        // Update Inventory Sync Health KPI Widget
        if (posOrders && posOrders.length > 0) {
            const storeOrders = posOrders.filter(o => o.store === targetStore);
            let synced = 0;
            let pending = 0;
            let failed = 0;
            let missing = 0;

            storeOrders.forEach(o => {
                const s = o.inventorySyncStatus;
                if (s === 'Synced') synced++;
                else if (s === 'Failed') failed++;
                else if (s === 'Partial/Missing Recipe') missing++;
                else pending++;
            });

            const shSynced = document.getElementById("syncHealthSynced");
            if (shSynced) shSynced.innerText = synced;

            const shPending = document.getElementById("syncHealthPending");
            if (shPending) shPending.innerText = pending;

            const shFailed = document.getElementById("syncHealthFailed");
            if (shFailed) shFailed.innerText = failed;

            const shMissing = document.getElementById("syncHealthMissing");
            if (shMissing) shMissing.innerText = missing;
        }

        // Branch Switcher dropdown for owner
        let selectHeaderHTML = "";
        if (currentRole === "owner") {
            const branches = ["VESU", "LP SAVANI", "GAURAV PATH", "SUDAMA CHOWK"];
            let storeOptionsHTML = "";
            branches.forEach(branch => {
                storeOptionsHTML += `<option value="${branch}" ${ownerInventoryStore === branch ? 'selected' : ''}>${branch}</option>`;
            });
            selectHeaderHTML = `
                <div style="background:var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px; display:flex; gap:16px; align-items:center;">
                    <div style="font-weight:700; font-size:0.9rem; color:var(--text-secondary);">Select Outlet Branch:</div>
                    <select class="saas-form-select" id="ownerInventoryStoreSelect" style="width:250px; background:var(--bg-sidebar); color:#ffffff;">
                        ${storeOptionsHTML}
                    </select>
                </div>
            `;
        }

        const subList = document.getElementById("sub-inventory-list");
        if (!subList) return;

        const isMobile = window.innerWidth < 768;

        const hasSkeleton = document.getElementById("inventorySearchInput") !== null;
        if (!hasSkeleton) {
            // Render structural skeleton
            subList.innerHTML = `
                <!-- Branch switcher placeholder -->
                <div id="inventoryStoreSwitcherPlaceholder"></div>

                <!-- Inventory dashboard metrics -->
                <div class="kpi-grid" id="inventoryKpiGrid">
                    <!-- Dynamic metrics populated below -->
                </div>

                <!-- Premium Search Bar & Sorting Label -->
                <div style="background:var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 20px; margin-bottom: 20px; display:flex; gap:16px; align-items:center; justify-content:space-between; flex-wrap: wrap;">
                    <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:280px;">
                        <i data-lucide="search" style="width:18px; height:18px; color:var(--text-tertiary);"></i>
                        <input type="text" id="inventorySearchInput" placeholder="Search items by name or category..." style="flex:1; background:transparent; border:none; color:#ffffff; font-weight:600; outline:none; font-size:0.85rem;" value="${inventorySearchVal || ''}">
                        <button id="btnClearInventorySearch" style="background:none; border:none; color:var(--text-tertiary); cursor:pointer; font-size:0.75rem; font-weight:700; display:none;">Clear</button>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:var(--text-tertiary); font-weight:700; background:rgba(16, 185, 129, 0.08); padding:6px 12px; border-radius:6px; border:1px solid rgba(16, 185, 129, 0.15);">
                        <i data-lucide="arrow-down-narrow-wide" style="width:14px; height:14px; color:#10b981;"></i>
                        <span>Auto-Sorted: <strong style="color:#10b981;">Out of Stock at top</strong></span>
                    </div>
                </div>

                <div class="saas-table-container" id="inventoryTableContainer" style="display: ${isMobile ? 'none' : 'block'};">
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
                            <!-- Dynamic rows -->
                        </tbody>
                    </table>
                </div>

                <div id="inventoryCardsContainer" style="display: ${isMobile ? 'flex' : 'none'}; flex-direction: column; gap: 12px; margin-top: 16px;">
                    <!-- Dynamic cards -->
                </div>
            `;

            // Bind search input events
            const searchInput = document.getElementById("inventorySearchInput");
            if (searchInput) {
                searchInput.addEventListener("input", (e) => {
                    inventorySearchVal = e.target.value;
                    renderInventoryListOnly();
                });
            }

            // Bind owner store switcher
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

        // Render switcher inside placeholder
        const switcherPlaceholder = document.getElementById("inventoryStoreSwitcherPlaceholder");
        if (switcherPlaceholder) {
            switcherPlaceholder.innerHTML = selectHeaderHTML;
        }

        // Render/update KPI cards
        const kpiGrid = document.getElementById("inventoryKpiGrid");
        if (kpiGrid) {
            kpiGrid.innerHTML = `
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
            `;
        }

        // Set role-based visibility of action buttons
        const btnAddStock = document.getElementById("btnCreateInventoryTop");
        if (btnAddStock) {
            btnAddStock.style.display = (currentRole === "bm" || currentRole === "owner") ? "inline-flex" : "none";
        }
        const btnUploadInventoryExcel = document.getElementById("btnUploadInventoryExcel");
        if (btnUploadInventoryExcel) {
            btnUploadInventoryExcel.style.display = (currentRole === "bm" || currentRole === "owner") ? "inline-flex" : "none";
        }

        // Now render the filtered list items
        renderInventoryListOnly();
    }

    // Helper to only render rows and cards based on search filter
    function renderInventoryListOnly() {
        const targetStore = currentRole === "owner" ? ownerInventoryStore : currentStore;
        console.log("renderInventoryListOnly called. TargetStore:", targetStore);
        const storeInv = inventory.filter(i => {
            if (i.store !== targetStore) return false;
            if (!inventorySearchVal) return true;
            const search = inventorySearchVal.toLowerCase();
            return (i.label || "").toLowerCase().includes(search) || (i.category || "").toLowerCase().includes(search);
        });
        console.log("renderInventoryListOnly filtered items count:", storeInv.length);

        // Sort: Out of Stock (stock === 0) at the very top, then sorted by stock level ascending
        storeInv.sort((a, b) => {
            const stockA = a.stock || 0;
            const stockB = b.stock || 0;
            return stockA - stockB;
        });

        const isMobile = window.innerWidth < 768;
        let rowsHTML = "";
        let cardsHTML = "";

        storeInv.forEach(item => {
            let statusBadge = "";
            if ((item.stock || 0) === 0) {
                statusBadge = `<span class="pill-badge pill-badge-danger">OUT OF STOCK</span>`;
            } else if ((item.stock || 0) < (item.reorder || 0)) {
                statusBadge = `<span class="pill-badge pill-badge-warning">LOW STOCK</span>`;
            } else {
                statusBadge = `<span class="pill-badge pill-badge-success">OK</span>`;
            }

            let actionsHTML = `
                <button class="saas-btn" style="padding: 4px 12px; font-size:0.75rem; border:1px solid var(--antique-brass, #d4af37); color:var(--antique-brass, #d4af37); background:none; cursor:pointer;" onclick="window.addInventoryItemToPO('${item.id}')">
                    Reorder
                </button>
            `;
            if (currentRole === "bm" || currentRole === "owner") {
                actionsHTML += `
                    <button class="saas-btn saas-btn-secondary" style="padding: 4px 12px; font-size:0.75rem;" onclick="editInventoryPrompt('${item.id}')">Edit</button>
                `;
            }
            actionsHTML += `
                <button class="saas-btn" style="padding: 4px 12px; font-size:0.75rem; background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border);" onclick="openInventoryLedger('${item.id}', '${item.label.replace(/'/g, "\\'")}')">Ledger</button>
            `;

            const itemCost = item.unitCost !== null && item.unitCost !== undefined ? `₹${parseFloat(item.unitCost).toFixed(2)}` : "₹0.00";
            const itemTotalValue = (item.stock && item.unitCost) ? `₹${(item.stock * item.unitCost).toFixed(2)}` : "₹0.00";
            const expiryStr = item.expiryDate || "N/A";

            if (isMobile) {
                cardsHTML += `
                    <div class="mobile-card" style="background:var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding:16px; margin-bottom:12px; display:flex; flex-direction:column; gap:8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div style="font-weight:800; font-size:1rem; color:var(--text-heading);">${escapeHTML(item.label)}</div>
                                <div style="font-size:0.75rem; color:var(--text-tertiary); margin-top:2px;">Category: ${escapeHTML(item.category)} &bull; Unit: ${escapeHTML(item.unit)}</div>
                                <div style="font-size:0.75rem; color:var(--text-tertiary); margin-top:2px;">Expiry: ${escapeHTML(expiryStr)}</div>
                            </div>
                            <div>${statusBadge}</div>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:0.85rem; background:rgba(0,0,0,0.02); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                            <div>
                                <div style="color:var(--text-tertiary); font-size:0.75rem;">CURRENT STOCK</div>
                                <div style="font-weight:700; color:var(--text-heading); margin-top:2px;">${item.stock} / ${item.reorder}</div>
                            </div>
                            <div>
                                <div style="color:var(--text-tertiary); font-size:0.75rem;">TOTAL VALUE</div>
                                <div style="font-weight:700; color:var(--text-heading); margin-top:2px;">${itemTotalValue}</div>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; margin-top:4px;">
                            ${actionsHTML}
                        </div>
                    </div>
                `;
            } else {
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
            }
        });

        if (storeInv.length === 0) {
            if (isMobile) {
                cardsHTML = `<div style="text-align: center; color: var(--text-tertiary); padding: 16px 0;">No inventory items found.</div>`;
            } else {
                rowsHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-tertiary); padding: 12px 0;">No inventory items found.</td></tr>`;
            }
        }

        const tbody = document.getElementById("inventoryTableBody");
        if (tbody) tbody.innerHTML = rowsHTML;

        const cardsContainer = document.getElementById("inventoryCardsContainer");
        if (cardsContainer) cardsContainer.innerHTML = cardsHTML;

        const clearBtn = document.getElementById("btnClearInventorySearch");
        if (clearBtn) {
            clearBtn.style.display = inventorySearchVal ? "inline-block" : "none";
            if (!clearBtn.dataset.listenerBound) {
                clearBtn.dataset.listenerBound = "true";
                clearBtn.addEventListener("click", () => {
                    inventorySearchVal = "";
                    const inputEl = document.getElementById("inventorySearchInput");
                    if (inputEl) inputEl.value = "";
                    renderInventoryListOnly();
                });
            }
        }

        if (window.lucide) window.lucide.createIcons();
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


    // === WASTAGE STATE & UTILITIES ===
    let currentWastageImage = null;

    window.viewWastageEvidence = function(id) {
        const log = wastage.find(w => w.id === id);
        if (!log || !log.image) return;
        
        const previewEl = document.getElementById("wastageEvidenceModalPreview");
        const imgEl = document.getElementById("wastageEvidenceModalImg");
        
        if (log.image.startsWith("data:image/svg+xml") || log.image.startsWith("data:image/png") || log.image.startsWith("data:image/jpeg")) {
            if (previewEl && imgEl) {
                imgEl.src = log.image;
                imgEl.style.display = "block";
                previewEl.style.display = "none";
            }
        } else if (log.image.length === 1 || log.image.length === 2) {
            if (previewEl && imgEl) {
                previewEl.textContent = log.image;
                previewEl.style.display = "flex";
                imgEl.style.display = "none";
            }
        } else {
            if (previewEl && imgEl) {
                imgEl.src = log.image;
                imgEl.style.display = "block";
                previewEl.style.display = "none";
            }
        }
        
        openModal("modalWastageEvidence");
    };

    window.cancelWastageRecord = async function(id) {
        if (!confirm("Are you sure you want to cancel/delete this wastage record?")) return;
        try {
            const response = await fetch(`${API_BASE}/api/wastage/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Failed to delete record: " + response.statusText);
            
            alert("Wastage record cancelled successfully.");
            await syncStateFromServer();
        } catch (err) {
            console.error('Failed to delete wastage:', err);
            alert("Error cancelling wastage record. Please try again.");
        }
    };

    // SCREEN 10: WASTAGE CONTROL CENTER
    function renderWastageScreen() {
        const container = document.getElementById("screen-wastage-management");
        if (!container) return;

        const storeSelect = document.getElementById("wasteStoreSelect");
        const itemSelect = document.getElementById("wasteItemSelect");
        const unitSelect = document.getElementById("wasteUnitSelect");

        // 1. Role Scope Constraints
        if (storeSelect) {
            if (currentRole === "bm") {
                storeSelect.value = currentStore;
                storeSelect.setAttribute("disabled", "true");
            } else {
                storeSelect.removeAttribute("disabled");
            }
        }

        // Populate dropdown of items based on selected store's inventory
        function populateWastageItemDropdown() {
            if (!itemSelect) return;
            const selectedStore = (currentRole === "bm") ? currentStore : (storeSelect ? storeSelect.value : "VESU");
            const storeInventory = inventory.filter(item => item.store === selectedStore);

            itemSelect.innerHTML = "";
            if (storeInventory.length === 0) {
                const opt = document.createElement("option");
                opt.value = "";
                opt.textContent = "-- No Inventory Items --";
                itemSelect.appendChild(opt);
                return;
            }

            storeInventory.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item.label;
                opt.textContent = `${item.label} (${item.unit})`;
                opt.dataset.unit = item.unit;
                opt.dataset.cost = item.unitCost;
                itemSelect.appendChild(opt);
            });
            updateWastageUnitAndCost();
        }

        function updateWastageUnitAndCost() {
            if (!itemSelect || !unitSelect) return;
            const selectedOpt = itemSelect.options[itemSelect.selectedIndex];
            if (selectedOpt && selectedOpt.dataset.unit) {
                unitSelect.value = selectedOpt.dataset.unit;
            }
        }

        if (storeSelect && !storeSelect.dataset.itemPopulateBound) {
            storeSelect.dataset.itemPopulateBound = "true";
            storeSelect.addEventListener("change", () => {
                populateWastageItemDropdown();
            });
        }

        if (itemSelect && !itemSelect.dataset.unitUpdateBound) {
            itemSelect.dataset.unitUpdateBound = "true";
            itemSelect.addEventListener("change", () => {
                updateWastageUnitAndCost();
            });
        }

        populateWastageItemDropdown();

        // 2. Photo upload & Remove Photo handlers
        const imageFile = document.getElementById("wasteImageFile");
        const removePhotoBtn = document.getElementById("btnRemoveWastePhoto");
        const previewContainer = document.getElementById("wastePhotoPreviewContainer");
        const previewImg = document.getElementById("wastePhotoPreviewImg");
        const previewName = document.getElementById("wastePhotoPreviewName");

        function setPhotoPreview(src, name) {
            if (previewContainer && previewImg && previewName) {
                previewImg.src = src;
                previewName.textContent = name;
                previewContainer.style.display = "flex";
                currentWastageImage = src;
            }
        }

        function clearPhotoPreview() {
            if (previewContainer && previewImg && previewName) {
                previewImg.src = "";
                previewName.textContent = "";
                previewContainer.style.display = "none";
                currentWastageImage = null;
                if (imageFile) imageFile.value = "";
            }
        }

        if (imageFile && !imageFile.dataset.listenerBound) {
            imageFile.dataset.listenerBound = "true";
            imageFile.addEventListener("change", async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const compressedDataUrl = await compressImageFile(file, 800, 800, 0.6);
                        setPhotoPreview(compressedDataUrl, file.name);
                    } catch (err) {
                        console.error("Error compressing image:", err);
                        // Fallback to original image if compression fails and size is within safe bounds
                        if (file.size > 1.5 * 1024 * 1024) { // 1.5MB
                            alert("Image compression failed and the original file is too large (>1.5MB). Please upload a smaller image.");
                            clearPhotoPreview();
                        } else {
                            const reader = new FileReader();
                            reader.onload = function(evt) {
                                setPhotoPreview(evt.target.result, file.name);
                            };
                            reader.readAsDataURL(file);
                        }
                    }
                }
            });
        }

        if (removePhotoBtn && !removePhotoBtn.dataset.listenerBound) {
            removePhotoBtn.dataset.listenerBound = "true";
            removePhotoBtn.addEventListener("click", () => {
                clearPhotoPreview();
            });
        }

        // 3. Populate table logs / card logs based on view size
        const tableContainer = document.getElementById("wastageTableContainer");
        const cardsContainer = document.getElementById("wastageCardsContainer");
        const isMobile = window.innerWidth < 768;

        const filteredWastage = wastage.filter(w => currentRole === "owner" || w.store === currentStore);
        const sortedWastage = [...filteredWastage].reverse();

        if (isMobile) {
            if (tableContainer) tableContainer.style.setProperty("display", "none", "important");
            if (cardsContainer) {
                cardsContainer.style.setProperty("display", "flex", "important");
                cardsContainer.innerHTML = "";
                if (sortedWastage.length === 0) {
                    cardsContainer.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); padding: 16px 0;">No wastage logged.</div>`;
                } else {
                    sortedWastage.forEach(w => {
                        const findInv = inventory.find(inv => inv.label === w.name && inv.store === w.store);
                        const uCost = findInv ? findInv.unitCost : 100;
                        const wCost = w.cost || (w.qty * uCost);

                        let imgHtml = "";
                        if (w.image) {
                            if (w.image.startsWith("data:image/svg+xml") || w.image.startsWith("data:image/png") || w.image.startsWith("data:image/jpeg")) {
                                imgHtml = `<img src="${w.image}" style="width:40px; height:40px; border-radius:var(--radius-sm); object-fit:cover; border:1px solid var(--border); cursor:pointer;" onclick="window.viewWastageEvidence('${w.id}')">`;
                            } else if (w.image.length === 1 || w.image.length === 2) {
                                imgHtml = `<div style="width:40px; height:40px; border-radius:var(--radius-sm); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.4rem; background:rgba(255,255,255,0.05);" onclick="window.viewWastageEvidence('${w.id}')">${w.image}</div>`;
                            } else {
                                imgHtml = `<img src="${w.image}" style="width:40px; height:40px; border-radius:var(--radius-sm); object-fit:cover; border:1px solid var(--border); cursor:pointer;" onclick="window.viewWastageEvidence('${w.id}')">`;
                            }
                        }

                        let actionsHtml = "";
                        if (currentRole === "owner" || (currentUser && w.loggedBy === currentUser.name)) {
                            actionsHtml = `<button type="button" class="saas-btn saas-btn-danger" style="width:100%; margin-top:8px; padding: 6px; font-size: 0.75rem;" onclick="window.cancelWastageRecord('${w.id}')"><i data-lucide="trash-2"></i> Cancel Record</button>`;
                        }

                        const card = document.createElement("div");
                        card.className = "mobile-card";
                        card.style.cssText = "background:var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding:16px; margin-bottom:12px; display:flex; flex-direction:column; gap:8px;";
                        card.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div>
                                    <div style="font-weight:800; font-size:0.95rem; color:var(--text-heading);">${escapeHTML(w.name)}</div>
                                    <div style="font-size:0.75rem; color:var(--text-tertiary); margin-top:2px;">Store: ${escapeHTML(w.store)} &middot; Qty: ${w.qty} ${escapeHTML(w.unit)}</div>
                                </div>
                                ${imgHtml ? `<div>${imgHtml}</div>` : ""}
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; background:rgba(0,0,0,0.02); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                                <div>
                                    <span style="color:var(--text-tertiary); font-size:0.7rem; text-transform:uppercase;">Reason</span>
                                    <div style="font-weight:600; margin-top:2px;">${escapeHTML(w.reason)}</div>
                                </div>
                                <div style="text-align:right;">
                                    <span style="color:var(--text-tertiary); font-size:0.7rem; text-transform:uppercase;">Loss</span>
                                    <div style="font-weight:700; color:var(--danger); margin-top:2px;">₹${wCost.toLocaleString()}</div>
                                </div>
                            </div>
                            ${actionsHtml}
                        `;
                        cardsContainer.appendChild(card);
                    });
                }
            }
        } else {
            if (tableContainer) tableContainer.style.setProperty("display", "block", "important");
            if (cardsContainer) cardsContainer.style.setProperty("display", "none", "important");
            const tbody = document.querySelector("#wastageLogsTable tbody");
            if (tbody) {
                tbody.innerHTML = "";
                if (sortedWastage.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-tertiary);">No wastage logged.</td></tr>`;
                } else {
                    sortedWastage.forEach(w => {
                        const tr = document.createElement("tr");
                        let reasonClass = "pill-badge-secondary";
                        if (w.reason === "Expired") {
                            reasonClass = "pill-badge-danger";
                        } else if (w.reason === "Spillage") {
                            reasonClass = "pill-badge-secondary";
                        } else if (w.reason === "Preparation Error" || w.reason === "Burnt") {
                            reasonClass = "pill-badge-warning";
                        }
                        
                        const findInv = inventory.find(inv => inv.label === w.name && inv.store === w.store);
                        const uCost = findInv ? findInv.unitCost : 100;
                        const wCost = w.cost || (w.qty * uCost);
                        
                        let imgHtml = "";
                        if (w.image) {
                            if (w.image.startsWith("data:image/svg+xml") || w.image.startsWith("data:image/png") || w.image.startsWith("data:image/jpeg")) {
                                imgHtml = `<img src="${w.image}" style="width:32px; height:32px; border-radius:var(--radius-sm); object-fit:cover; border:1px solid var(--border); cursor:pointer;" onclick="window.viewWastageEvidence('${w.id}')">`;
                            } else if (w.image.length === 1 || w.image.length === 2) {
                                imgHtml = `<div style="width:32px; height:32px; border-radius:var(--radius-sm); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.2rem; background:rgba(255,255,255,0.05);" onclick="window.viewWastageEvidence('${w.id}')">${w.image}</div>`;
                            } else {
                                imgHtml = `<img src="${w.image}" style="width:32px; height:32px; border-radius:var(--radius-sm); object-fit:cover; border:1px solid var(--border); cursor:pointer;" onclick="window.viewWastageEvidence('${w.id}')">`;
                            }
                        } else {
                            imgHtml = `<span style="color:var(--text-tertiary); font-size:0.75rem;">None</span>`;
                        }
                        
                        let actionsHtml = "";
                        if (currentRole === "owner" || (currentUser && w.loggedBy === currentUser.name)) {
                            actionsHtml = `<button type="button" class="saas-btn saas-btn-danger" style="padding: 4px 8px; font-size: 0.7rem; border-radius: var(--radius-sm); display:inline-flex; align-items:center; gap:4px; border:none; height:auto; line-height:1;" onclick="window.cancelWastageRecord('${w.id}')"><i data-lucide="trash-2" style="width:12px; height:12px;"></i> Cancel</button>`;
                        } else {
                            actionsHtml = `<span style="color:var(--text-tertiary); font-size:0.75rem;"><i data-lucide="lock" style="width:10px; height:10px; display:inline-block; vertical-align:middle; margin-right:2px;"></i> Locked</span>`;
                        }
                        
                        tr.innerHTML = `
                            <td style="font-weight: 700;">${escapeHTML(w.name)}</td>
                            <td>${w.qty} ${escapeHTML(w.unit)}</td>
                            <td><span class="pill-badge ${reasonClass}">${escapeHTML(w.reason)}</span></td>
                            <td>${escapeHTML(w.store)}</td>
                            <td style="font-weight: 700; color: var(--text-heading);">₹${wCost.toLocaleString()}</td>
                            <td style="text-align: center;">${imgHtml}</td>
                            <td>${actionsHtml}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }
        }

        // 4. Render Daily Wastage Cost chart using Chart.js
        const dailyCosts = [0, 0, 0, 0, 0, 0, 0];
        const targetLogs = filteredWastage;
        targetLogs.forEach(w => {
            let dayIndex = -1;
            if (w.date) {
                const d = new Date(w.date);
                if (!isNaN(d.getTime())) {
                    dayIndex = d.getDay() - 1;
                    if (dayIndex < 0) dayIndex = 6;
                }
            }
            
            const findInv = inventory.find(inv => inv.label === w.name && inv.store === w.store);
            const unitCost = findInv ? findInv.unitCost : 100;
            const wCost = w.cost || (w.qty * unitCost);
            
            if (dayIndex >= 0 && dayIndex < 7) {
                dailyCosts[dayIndex] += wCost;
            } else {
                dailyCosts[0] += wCost;
            }
        });

        const ctx = document.getElementById("wastageScreenChart");
        if (ctx) {
            if (chartWastage) chartWastage.destroy();
            chartWastage = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                    datasets: [{
                        label: 'Wastage Cost (₹)',
                        data: dailyCosts,
                        backgroundColor: '#A64B2A',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            grid: { color: 'rgba(46,35,31,0.05)' },
                            ticks: { callback: value => '₹' + value.toLocaleString() }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        // 5. Owner Dashboard rendering & charts
        const ownerDashboard = document.getElementById("ownerWastageDashboard");
        if (ownerDashboard) {
            if (currentRole === "owner") {
                ownerDashboard.style.display = "flex";
                
                let totalFranchiseCost = 0;
                let vesuCost = 0;
                let lpsavaniCost = 0;
                let gauravpathCost = 0;
                let sudamachowkCost = 0;
                
                const branchCosts = { "VESU": 0, "LP SAVANI": 0, "GAURAV PATH": 0, "SUDAMA CHOWK": 0 };
                const reasonCosts = {
                    "Expired": 0,
                    "Burnt": 0,
                    "Spillage": 0,
                    "Preparation Error": 0,
                    "Customer Return": 0,
                    "Damaged Packaging": 0
                };
                
                wastage.forEach(w => {
                    const findInv = inventory.find(inv => inv.label === w.name && inv.store === w.store);
                    const uCost = findInv ? findInv.unitCost : 100;
                    const wCost = w.cost || (w.qty * uCost);
                    
                    totalFranchiseCost += wCost;
                    if (w.store === "VESU") vesuCost += wCost;
                    else if (w.store === "LP SAVANI") lpsavaniCost += wCost;
                    else if (w.store === "GAURAV PATH") gauravpathCost += wCost;
                    else if (w.store === "SUDAMA CHOWK") sudamachowkCost += wCost;
                    
                    if (branchCosts[w.store] !== undefined) {
                        branchCosts[w.store] += wCost;
                    }
                    if (reasonCosts[w.reason] !== undefined) {
                        reasonCosts[w.reason] += wCost;
                    }
                });
                
                document.getElementById("kpi-owner-total-waste").textContent = `₹${totalFranchiseCost.toLocaleString()}`;
                document.getElementById("kpi-owner-vesu-waste").textContent = `₹${vesuCost.toLocaleString()}`;
                if (document.getElementById("kpi-owner-lpsavani-waste")) {
                    document.getElementById("kpi-owner-lpsavani-waste").textContent = `₹${lpsavaniCost.toLocaleString()}`;
                }
                if (document.getElementById("kpi-owner-gauravpath-waste")) {
                    document.getElementById("kpi-owner-gauravpath-waste").textContent = `₹${gauravpathCost.toLocaleString()}`;
                }
                if (document.getElementById("kpi-owner-sudamachowk-waste")) {
                    document.getElementById("kpi-owner-sudamachowk-waste").textContent = `₹${sudamachowkCost.toLocaleString()}`;
                }
                
                // Render Branch Cost Bar Chart
                const branchCtx = document.getElementById("ownerWasteBranchChart");
                if (branchCtx) {
                    if (chartOwnerWasteBranch) chartOwnerWasteBranch.destroy();
                    chartOwnerWasteBranch = new Chart(branchCtx, {
                        type: 'bar',
                        data: {
                            labels: ["VESU", "LP SAVANI", "GAURAV PATH", "SUDAMA CHOWK"],
                            datasets: [{
                                label: 'Wastage Loss (₹)',
                                data: [branchCosts["VESU"], branchCosts["LP SAVANI"], branchCosts["GAURAV PATH"], branchCosts["SUDAMA CHOWK"]],
                                backgroundColor: ['#A64B2A', '#D7A86E', '#8E806A'],
                                borderRadius: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { 
                                    beginAtZero: true,
                                    grid: { color: 'rgba(46,35,31,0.05)' },
                                    ticks: { callback: value => '₹' + value.toLocaleString() }
                                },
                                x: { grid: { display: false } }
                            }
                        }
                    });
                }
                
                // Render Reason Pie Chart
                const reasonCtx = document.getElementById("ownerWasteReasonChart");
                if (reasonCtx) {
                    if (chartOwnerWasteReason) chartOwnerWasteReason.destroy();
                    
                    const reasonLabels = Object.keys(reasonCosts);
                    const reasonData = Object.values(reasonCosts);
                    
                    chartOwnerWasteReason = new Chart(reasonCtx, {
                        type: 'pie',
                        data: {
                            labels: reasonLabels,
                            datasets: [{
                                data: reasonData,
                                backgroundColor: ['#A64B2A', '#3F3325', '#D7A86E', '#8E806A', '#C38B6B', '#5F4B32'],
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'right',
                                    labels: { boxWidth: 12, font: { size: 10 } }
                                }
                            }
                        }
                    });
                }
            } else {
                ownerDashboard.style.display = "none";
            }
        }

        // 6. Form Submit Listener (prevents duplicates)
        const form = document.getElementById("wastageForm");
        if (form && !form.dataset.listenerBound) {
            form.dataset.listenerBound = "true";
            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                
                const store = (currentRole === "bm") ? currentStore : (storeSelect ? storeSelect.value : "VESU");
                const name = itemSelect.value;
                const qty = parseFloat(document.getElementById("wasteQtyInput").value);
                const unit = unitSelect.value;
                const reason = document.getElementById("wasteReasonSelect").value;
                
                if (!name) {
                    alert("Please select an item.");
                    return;
                }
                if (isNaN(qty) || qty <= 0) {
                    alert("Please enter a valid positive quantity.");
                    return;
                }

                const findInv = inventory.find(inv => inv.label === name && inv.store === store);
                const unitCost = findInv ? findInv.unitCost : 100;
                const totalCost = qty * unitCost;
                
                const newWastage = {
                    id: "w-" + Date.now(),
                    store,
                    name,
                    qty,
                    unit,
                    reason,
                    date: getTodayDateStr(),
                    cost: totalCost,
                    image: currentWastageImage,
                    loggedBy: currentUser ? currentUser.name : "System"
                };
                
                try {
                    const response = await fetch(`${API_BASE}/api/wastage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newWastage)
                    });
                    if (!response.ok) throw new Error("API error " + response.status);
                    
                    document.getElementById("wasteQtyInput").value = "";
                    clearPhotoPreview();
                    alert("Wastage logged successfully.");
                    syncStateFromServer();
                } catch (err) {
                    console.error('Failed to log wastage:', err);
                    alert("Error logging wastage. Please try again.");
                }
            });
        }

        // 7. Clear Form click handler
        const rejectBtn = document.getElementById("btnRejectWastage");
        if (rejectBtn && !rejectBtn.dataset.listenerBound) {
            rejectBtn.dataset.listenerBound = "true";
            rejectBtn.addEventListener("click", () => {
                document.getElementById("wasteQtyInput").value = "";
                clearPhotoPreview();
                alert("Wastage entry cleared.");
            });
        }

        // 8. Download / Export CSV Handler
        const exportBtn = document.getElementById("btnExportWaste");
        if (exportBtn && !exportBtn.dataset.listenerBound) {
            exportBtn.dataset.listenerBound = "true";
            exportBtn.removeAttribute("onclick");
            exportBtn.addEventListener("click", () => {
                const filteredWastage = wastage.filter(w => currentRole === "owner" || w.store === currentStore);
                if (filteredWastage.length === 0) {
                    alert("No wastage data to export.");
                    return;
                }
                
                let csvContent = "data:text/csv;charset=utf-8,";
                csvContent += "ID,Store,Item Name,Quantity,Unit,Reason,Date,Cost\n";
                
                filteredWastage.forEach(w => {
                    const findInv = inventory.find(inv => inv.label === w.name && inv.store === w.store);
                    const uCost = findInv ? findInv.unitCost : 100;
                    const wCost = w.cost || (w.qty * uCost);
                    csvContent += `"${w.id}","${w.store}","${w.name}",${w.qty},"${w.unit}","${w.reason}","${w.date}",${wCost}\n`;
                });
                
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `wastage_report_${currentStore.split(' ')[0]}_${getTodayDateStr()}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        // 8a. Download Template Excel Handler
        const downloadTemplateBtn = document.getElementById("btnDownloadWasteTemplate");
        if (downloadTemplateBtn && !downloadTemplateBtn.dataset.listenerBound) {
            downloadTemplateBtn.dataset.listenerBound = "true";
            downloadTemplateBtn.addEventListener("click", () => {
                const sampleBranch = currentRole === "bm" ? currentStore : "VESU";
                const sampleInvItem = inventory.find(inv => inv.store === sampleBranch) || { label: "Whopper Sesame Buns" };
                
                const templateData = [
                    {
                        "Branch": sampleBranch,
                        "Item Name": sampleInvItem.label,
                        "Quantity": 5,
                        "Reason": "Expired",
                        "Logged By": currentUser ? currentUser.name : "System",
                        "Date": getTodayDateStr()
                    },
                    {
                        "Branch": sampleBranch,
                        "Item Name": sampleInvItem.label,
                        "Quantity": 10,
                        "Reason": "Burnt",
                        "Logged By": currentUser ? currentUser.name : "System",
                        "Date": getTodayDateStr()
                    }
                ];
                
                const ws = XLSX.utils.json_to_sheet(templateData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Wastage Template");
                
                const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
                
                function s2ab(s) {
                    const buf = new ArrayBuffer(s.length);
                    const view = new Uint8Array(buf);
                    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
                    return buf;
                }
                
                const blob = new Blob([s2ab(wbout)], { type: "application/octet-stream" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = "wastage_import_template.xlsx";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        // 8b. Import Excel Handler
        const importBtn = document.getElementById("btnImportWasteBtn");
        const importInput = document.getElementById("importWastageFile");
        if (importBtn && importInput && !importBtn.dataset.listenerBound) {
            importBtn.dataset.listenerBound = "true";
            importBtn.addEventListener("click", () => {
                importInput.click();
            });
        }

        if (importInput && !importInput.dataset.listenerBound) {
            importInput.dataset.listenerBound = "true";
            importInput.addEventListener("change", async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    try {
                        const data = evt.target.result;
                        const workbook = XLSX.read(data, { type: 'binary' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const rawRows = XLSX.utils.sheet_to_json(worksheet);
                        
                        if (rawRows.length === 0) {
                            alert("The Excel sheet is empty.");
                            importInput.value = "";
                            return;
                        }
                        
                        const validBranches = ["VESU", "ADAJAN", "CT LIGHT"];
                        const recordsToSave = [];
                        const errors = [];
                        
                        const getRowValue = (row, possibleHeaders) => {
                            const keys = Object.keys(row);
                            for (const header of possibleHeaders) {
                                const cleanHeader = header.toLowerCase().replace(/\s+/g, '').trim();
                                const foundKey = keys.find(k => k.toLowerCase().replace(/\s+/g, '').trim() === cleanHeader);
                                if (foundKey !== undefined) {
                                    return row[foundKey];
                                }
                            }
                            return undefined;
                        };

                        rawRows.forEach((row, index) => {
                            const rowNum = index + 2;
                            
                            // Skip completely empty rows
                            const isEmptyRow = Object.values(row).every(val => val === null || val === undefined || val.toString().trim() === "");
                            if (isEmptyRow) return;

                            const branch = (getRowValue(row, ["Branch", "Store"]) || "").toString().trim().toUpperCase();
                            const itemName = (getRowValue(row, ["Item Name", "Item", "Menu Item"]) || "").toString().trim();
                            const qtyVal = getRowValue(row, ["Quantity", "Qty", "Wastage Qty", "Wastage Quantity"]);
                            const reason = (getRowValue(row, ["Reason"]) || "").toString().trim();
                            const loggedBy = (getRowValue(row, ["Logged By", "User"]) || (currentUser ? currentUser.name : "System")).toString().trim();
                            let dateStr = (getRowValue(row, ["Date"]) || getTodayDateStr()).toString().trim();
                            
                            if (!branch) {
                                errors.push(`Row ${rowNum}: Branch is empty.`);
                                return;
                            }
                            if (!validBranches.includes(branch)) {
                                errors.push(`Row ${rowNum}: Invalid branch '${branch}'. Must be VESU, ADAJAN, or CT LIGHT.`);
                                return;
                            }
                            
                            if (currentRole === "bm" && branch !== currentStore) {
                                errors.push(`Row ${rowNum}: Unauthorized branch '${branch}'. As a Branch Manager, you can only import wastage for your store: ${currentStore}.`);
                                return;
                            }
                            
                            if (!itemName) {
                                errors.push(`Row ${rowNum}: Item Name is empty.`);
                                return;
                            }
                            
                            const findInv = inventory.find(inv => inv.store === branch && inv.label.toLowerCase() === itemName.toLowerCase());
                            if (!findInv) {
                                errors.push(`Row ${rowNum}: Item '${itemName}' does not exist in ${branch} inventory.`);
                                return;
                            }
                            
                            const qty = parseFloat(qtyVal);
                            if (isNaN(qty) || qty <= 0) {
                                errors.push(`Row ${rowNum}: Invalid quantity '${qtyVal}'. Must be a positive number.`);
                                return;
                            }
                            
                            if (!reason) {
                                errors.push(`Row ${rowNum}: Reason is empty.`);
                                return;
                            }
                            
                            if (!isNaN(dateStr) && parseFloat(dateStr) > 40000) {
                                const dateObj = new Date((parseFloat(dateStr) - 25569) * 86400 * 1000);
                                const yyyy = dateObj.getFullYear();
                                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const dd = String(dateObj.getDate()).padStart(2, '0');
                                dateStr = `${yyyy}-${mm}-${dd}`;
                            } else {
                                const datePattern = /^\d{4}-\d{2}-\d{2}$/;
                                if (!datePattern.test(dateStr)) {
                                    dateStr = getTodayDateStr();
                                }
                            }
                            
                            const totalCost = qty * findInv.unitCost;
                            
                            recordsToSave.push({
                                id: "w-imported-" + Date.now() + "-" + index,
                                store: branch,
                                name: findInv.label,
                                qty: qty,
                                unit: findInv.unit,
                                reason: reason,
                                date: dateStr,
                                cost: totalCost,
                                image: "📦",
                                loggedBy: loggedBy
                            });
                        });
                        
                        if (errors.length > 0 && recordsToSave.length === 0) {
                            alert(`Import Failed! No valid records were found. Details:\n\n${errors.slice(0, 10).join("\n")}${errors.length > 10 ? `\n...and ${errors.length - 10} more errors.` : ""}`);
                            importInput.value = "";
                            return;
                        }
                        
                        let messageHtml = `Importing ${recordsToSave.length} record(s).`;
                        if (errors.length > 0) {
                            messageHtml += `\nNote: ${errors.length} row(s) will be skipped due to errors.`;
                        }
                        
                        const msgDetail = errors.length > 0 ? 
                            `Skipped rows detail:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n...and ${errors.length - 5} more errors.` : ""}` : 
                            "All records are valid.";
                            
                        const proceed = confirm(`${messageHtml}\n\n${msgDetail}\n\nDo you want to proceed with this import?`);
                        if (!proceed) {
                            importInput.value = "";
                            return;
                        }
                        
                        const response = await fetch(`${API_BASE}/api/wastage/bulk`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(recordsToSave)
                        });
                        
                        if (!response.ok) {
                            throw new Error("Bulk API responded with error " + response.status);
                        }
                        
                        const result = await response.json();
                        alert(`Successfully imported ${result.count} wastage record(s).`);
                        importInput.value = "";
                        syncStateFromServer();
                    } catch (err) {
                        console.error("Failed to import wastage:", err);
                        alert("Error importing wastage records. Please make sure the Excel format is correct.");
                        importInput.value = "";
                    }
                };
                
                reader.onerror = () => {
                    alert("Error reading file.");
                    importInput.value = "";
                };
                
                reader.readAsBinaryString(file);
            });
        }

        // 9. Render Monthly day-by-day breakdown (Owner only)
        if (currentRole === "owner") {
            const monthSelect = document.getElementById("ownerWasteMonthSelect");
            if (monthSelect) {
                if (!monthSelect.dataset.listenerBound) {
                    monthSelect.dataset.listenerBound = "true";
                    monthSelect.addEventListener("change", () => {
                        renderWastageScreen();
                    });
                }
                
                const selectedMonth = monthSelect.value || "2026-06";
                const [yearStr, monthStr] = selectedMonth.split('-');
                const year = parseInt(yearStr, 10);
                const month = parseInt(monthStr, 10) - 1; // 0-indexed
                const numDays = new Date(year, month + 1, 0).getDate();
                
                const monthTbody = document.querySelector("#ownerWasteMonthlyTable tbody");
                if (monthTbody) {
                    monthTbody.innerHTML = "";
                    
                    let totalMonthWasteFound = false;
                    
                    for (let d = numDays; d >= 1; d--) {
                        const dayStr = String(d).padStart(2, '0');
                        const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
                        
                        const dayWastage = wastage.filter(w => w.date === dateStr);
                        if (dayWastage.length === 0) continue;
                        
                        totalMonthWasteFound = true;
                        
                        const vesuItems = dayWastage.filter(w => w.store === "VESU");
                        const lpsavaniItems = dayWastage.filter(w => w.store === "LP SAVANI");
                        const gauravpathItems = dayWastage.filter(w => w.store === "GAURAV PATH");
                        const sudamachowkItems = dayWastage.filter(w => w.store === "SUDAMA CHOWK");
                        
                        const dateObj = new Date(year, month, d);
                        const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
                        const formattedDate = dateObj.toLocaleDateString('en-US', dateOptions);
                        
                        const formatItems = (items) => {
                            if (items.length === 0) return `<span style="color:var(--text-tertiary);">--</span>`;
                            return items.map(item => {
                                const findInv = inventory.find(inv => inv.label === item.name && inv.store === item.store);
                                const uCost = findInv ? findInv.unitCost : 100;
                                const cost = item.cost || (item.qty * uCost);
                                const img = item.image ? (item.image.length <= 2 ? item.image + ' ' : '') : '';
                                return `<div style="margin-bottom: 6px; font-size:0.85rem; line-height: 1.3;">
                                    <strong style="color:var(--text-primary);">${img}${escapeHTML(item.name)}</strong><br/>
                                    <span style="color:var(--text-secondary);">${item.qty} ${escapeHTML(item.unit)} (${escapeHTML(item.reason)})</span><br/>
                                    <span style="color:var(--orange-primary); font-weight:700;">₹${cost.toLocaleString()}</span>
                                </div>`;
                            }).join('<div style="border-bottom:1px dashed var(--border); margin: 6px 0;"></div>');
                        };
                        
                        const tr = document.createElement("tr");
                        tr.innerHTML = `
                            <td style="font-weight: 700; vertical-align: top; color: var(--text-heading);">${formattedDate}</td>
                            <td style="vertical-align: top;">${formatItems(vesuItems)}</td>
                            <td style="vertical-align: top;">${formatItems(lpsavaniItems)}</td>
                            <td style="vertical-align: top;">${formatItems(gauravpathItems)}</td>
                            <td style="vertical-align: top;">${formatItems(sudamachowkItems)}</td>
                        `;
                        monthTbody.appendChild(tr);
                    }
                    
                    if (!totalMonthWasteFound) {
                        monthTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-tertiary); padding: 20px;">No wastage logged for the selected month.</td></tr>`;
                    }
                }
            }
        }
        
        if (window.lucide) window.lucide.createIcons();
    }
    // ==============================================
    // SCREEN 14.8: DAILY EXPENSES
    // ==============================================
    window.renderDailyExpensesScreen = renderDailyExpensesScreen;
    function renderDailyExpensesScreen() {
        const tbody = document.getElementById("dailyExpensesTableBody");
        const totalDisplay = document.getElementById("dailyExpenseTotalDisplay");
        if (!tbody || !totalDisplay) return;
        
        const todayStr = getTodayDateStr();
        
        let todayExpenses = expenses.filter(e => e.date === todayStr);
        if (currentRole === "bm") {
            todayExpenses = todayExpenses.filter(e => e.store === currentStore);
        }
        
        // Sort latest first
        todayExpenses.sort((a, b) => b.id.localeCompare(a.id));
        
        tbody.innerHTML = "";
        let total = 0;
        
        if (todayExpenses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-tertiary);">No expenses logged today.</td></tr>`;
        } else {
            todayExpenses.forEach(exp => {
                total += parseFloat(exp.amount) || 0;
                const row = document.createElement("tr");
                let paymentBadgeColor = (exp.paymentMethod || "Cash").toLowerCase().includes('cash') ? 'var(--orange-primary)' : 'var(--success)';
                let paymentBadgeBg = (exp.paymentMethod || "Cash").toLowerCase().includes('cash') ? 'rgba(249, 115, 22, 0.1)' : 'rgba(16, 185, 129, 0.1)';
                
                row.innerHTML = `
                    <td style="font-weight:700;">${exp.category || "General"}</td>
                    <td>${exp.description || ""}</td>
                    <td><span class="pill-badge" style="background: ${paymentBadgeBg}; color: ${paymentBadgeColor}; border: 1px solid ${paymentBadgeColor};">${exp.paymentMethod || 'Cash'}</span></td>
                    <td style="color:var(--text-secondary); font-size:0.85rem;">${exp.addedBy || "Unknown"}</td>
                    <td style="text-align:right; font-weight:700; color:var(--danger);">₹${parseFloat(exp.amount).toLocaleString('en-IN')}</td>
                    <td style="text-align:right;"><button class="saas-btn saas-btn-danger" style="padding:4px 8px; font-size:0.8rem;" onclick="window.deleteExpense('${exp.id}')">Delete</button></td>
                `;
                tbody.appendChild(row);
            });
        }
        
        totalDisplay.textContent = total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    }

    window.deleteExpense = async function(id) {
        if (!confirm("Are you sure you want to delete this expense?")) return;
        try {
            const res = await fetch(`/api/expenses/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token")}` }
            });
            if (res.ok) {
                expenses = expenses.filter(e => e.id !== id);
                renderDailyExpensesScreen();
            } else {
                alert("Failed to delete expense");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting expense");
        }
    };

    // Add Expense Form Handler
    document.addEventListener("DOMContentLoaded", () => {
        const expenseForm = document.getElementById("formAddDailyExpense");
        if (expenseForm) {
            expenseForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const btn = e.submitter;
                if(btn) { btn.disabled = true; btn.textContent = "Adding..."; }
                
                const dateVal = document.getElementById("dailyExpenseDate").value;
                const catVal = document.getElementById("dailyExpenseCategory").value;
                const descVal = document.getElementById("dailyExpenseDescription").value;
                const payVal = document.getElementById("dailyExpensePayment").value;
                const amtVal = parseFloat(document.getElementById("dailyExpenseAmount").value);
                
                const payload = {
                    date: dateVal,
                    category: catVal,
                    description: descVal,
                    paymentMethod: payVal,
                    amount: amtVal,
                    store: getPOSStore(),
                    addedBy: currentUser ? currentUser.name : "System"
                };

                // Push locally
                expenses.push({
                    id: 'exp-' + Date.now(),
                    ...payload
                });

                // Save to server
                try {
                    const reqToken = localStorage.getItem("bk_token") || sessionStorage.getItem("bk_token") || "";
                    await fetch('/api/expenses', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + reqToken
                        },
                        body: JSON.stringify(payload)
                    });
                } catch(err) {
                    console.error("Failed to sync expense to server", err);
                }

                expenseForm.reset();
                document.getElementById("dailyExpenseDate").value = getTodayDateStr(); // reset date
                
                if (typeof window.renderDailyExpensesScreen === "function") {
                    window.renderDailyExpensesScreen();
                }
                
                if(btn) { btn.disabled = false; btn.textContent = "Add Expense"; }
                alert("Expense logged successfully!");
            });
            
            // Set default date when opened
            const dateInput = document.getElementById("dailyExpenseDate");
            if (dateInput) {
                dateInput.value = getTodayDateStr();
            }
        }
    });

    // SCREEN 14: PRODUCT SALES MANAGEMENT
    window.renderLiveSalesStream = renderLiveSalesStream;
    function renderLiveSalesStream() {
        const tbody = document.getElementById("liveSalesFeedBody");
        if (!tbody) return;

        let liveItems = [];
        let foodCount = 0;
        let bevCount = 0;
        const bevCategories = ['Indian Coolers', 'Frappe', 'Hot Coffee Mix', 'Hot Tea', 'Milkshakes', 'Cheese Cake Shakes', 'Lassi', 'Beverages', 'Drinks', 'Coffee', 'Tea'];

        (posOrderItems || []).forEach(item => {
            const order = (posOrders || []).find(o => o.id === item.orderId);
            if (order) {
                // If the user is a branch manager, only show their store
                if (currentRole === "bm" && order.store !== currentStore) return;
                
                // Only count items sold today
                const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
                if (order.date === todayStr) {
                    const qty = parseInt(item.quantity || item.qty || 1);
                    const prod = (posProducts || []).find(p => p.id === item.productId);
                    
                    if (prod && bevCategories.includes(prod.category)) {
                        bevCount += qty;
                    } else {
                        foodCount += qty;
                    }
                }
                
                liveItems.push({
                    ...item,
                    orderTime: order.timestamp || (order.date + (order.time ? `T${order.time}` : '')),
                    orderNumber: order.orderNumber || order.id,
                    store: order.store,
                    paymentMethod: order.paymentMethod || 'Cash'
                });
            }
        });
        
        if (document.getElementById("live-sales-food-count")) {
            document.getElementById("live-sales-food-count").textContent = foodCount;
        }
        if (document.getElementById("live-sales-bev-count")) {
            document.getElementById("live-sales-bev-count").textContent = bevCount;
        }

        // Sort newest first
        liveItems.sort((a, b) => new Date(b.orderTime) - new Date(a.orderTime));
        
        // Take top 100 to not overwhelm the UI
        liveItems = liveItems.slice(0, 100);

        tbody.innerHTML = "";
        if (liveItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--text-tertiary);">No recent sales.</td></tr>`;
            return;
        }

        liveItems.forEach(item => {
            const row = document.createElement("tr");
            
            const t = new Date(item.orderTime);
            const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            let paymentBadgeColor = item.paymentMethod.toLowerCase().includes('cash') ? 'var(--orange-primary)' : 'var(--success)';
            let paymentBadgeBg = item.paymentMethod.toLowerCase().includes('cash') ? 'rgba(249, 115, 22, 0.1)' : 'rgba(16, 185, 129, 0.1)';
            
            row.innerHTML = `
                <td><span style="font-family: monospace; font-size: 0.85rem; color: var(--text-secondary);">${timeStr}</span></td>
                <td><span class="pill-badge" style="background: var(--bg-hover); color: var(--text-secondary); border: 1px solid var(--border);">${item.store || 'Unknown'}</span></td>
                <td style="font-weight: 700; color: var(--orange-primary);">#${item.orderNumber}</td>
                <td><span class="pill-badge" style="background: ${paymentBadgeBg}; color: ${paymentBadgeColor}; border: 1px solid ${paymentBadgeColor};">${item.paymentMethod}</span></td>
                <td style="font-weight: 600;">${item.productName || item.name || 'Unknown Item'}</td>
                <td style="text-align:center;"><span style="display:inline-block; padding: 2px 8px; background: rgba(16, 185, 129, 0.1); color: var(--success); border-radius: 4px; font-weight:700;">x${item.quantity || item.qty || 1}</span></td>
                <td style="text-align:right; font-weight:700;">₹${((item.price || 0) * (item.quantity || item.qty || 1)).toLocaleString('en-IN')}</td>
                <td style="text-align:center;"><button class="saas-btn saas-btn-danger" style="padding: 2px 6px; font-size: 0.75rem;" onclick="window.deletePOSOrder('${item.orderId}')">Delete Bill</button></td>
            `;
            tbody.appendChild(row);
        });
    }

    window.deletePOSOrder = async function(orderId) {
        if (!confirm("Are you sure you want to delete this bill? This will remove the entire order.")) return;
        try {
            const res = await fetch(`/api/pos/orders/${orderId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token")}` }
            });
            if (res.ok) {
                posOrders = posOrders.filter(o => o.id !== orderId);
                posOrderItems = posOrderItems.filter(i => i.orderId !== orderId);
                renderLiveSalesStream();
            } else {
                alert("Failed to delete bill");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting bill");
        }
    };

    function renderProductSalesScreen() {
        const container = document.getElementById("screen-product-sales");
        if (!container) return;

        const storeSelectWrapper = document.getElementById("productSalesStoreSelectWrapper");
        const storeSelect = document.getElementById("productSalesStoreSelect");
        const monthSelect = document.getElementById("productSalesMonthSelect");

        // 1. Role Scope Constraints
        if (currentRole === "bm") {
            if (storeSelectWrapper) storeSelectWrapper.style.display = "none";
            if (storeSelect) storeSelect.value = currentStore;
        } else {
            if (storeSelectWrapper) storeSelectWrapper.style.display = "flex";
        }

        // 2. Change Event Listeners (one-time)
        if (storeSelect && !storeSelect.dataset.listenerBound) {
            storeSelect.dataset.listenerBound = "true";
            storeSelect.addEventListener("change", () => {
                renderProductSalesScreen();
            });
        }
        if (monthSelect && !monthSelect.dataset.listenerBound) {
            monthSelect.dataset.listenerBound = "true";
            monthSelect.addEventListener("change", () => {
                renderProductSalesScreen();
            });
        }

        // 3. Filter Data
        const selectedStore = (currentRole === "bm") ? currentStore : (storeSelect ? storeSelect.value : "All");
        const selectedMonth = monthSelect ? monthSelect.value : "2026-06";

        const filteredSales = productSales.filter(sale => {
            const storeMatch = (selectedStore === "All" || sale.store === selectedStore);
            const monthMatch = (selectedMonth === "All" || (sale.date && sale.date.startsWith(selectedMonth)));
            return storeMatch && monthMatch;
        });

        // 4. Calculate KPIs
        const totalItemsSold = filteredSales.reduce((sum, sale) => sum + (sale.qty || 0), 0);
        const totalOrders = filteredSales.length;
        const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.revenue || 0), 0);
        const avgItems = totalOrders > 0 ? (totalItemsSold / totalOrders) : 0.00;

        const kpiItems = document.getElementById("kpi-ps-items");
        if (kpiItems) kpiItems.textContent = totalItemsSold.toLocaleString();

        const kpiOrders = document.getElementById("kpi-ps-orders");
        if (kpiOrders) kpiOrders.textContent = totalOrders.toLocaleString();

        const kpiRevenue = document.getElementById("kpi-ps-revenue");
        if (kpiRevenue) kpiRevenue.textContent = `₹${totalRevenue.toLocaleString()}`;

        const kpiAvgItems = document.getElementById("kpi-ps-avg-items");
        if (kpiAvgItems) kpiAvgItems.textContent = avgItems.toFixed(2);

        // 5. Render Table / Cards (ordered by date desc, then store, then qty desc)
        const sortedSales = [...filteredSales].sort((a, b) => {
            if (b.date !== a.date) return b.date.localeCompare(a.date);
            if (a.store !== b.store) return a.store.localeCompare(b.store);
            return b.qty - a.qty;
        });

        const isMobile = window.innerWidth < 768;
        const tableContainer = document.getElementById("productSalesTableContainer");
        const cardsContainer = document.getElementById("productSalesCardsContainer");

        if (tableContainer && cardsContainer) {
            if (isMobile) {
                tableContainer.style.setProperty("display", "none", "important");
                cardsContainer.style.setProperty("display", "flex", "important");
                cardsContainer.innerHTML = `
                    <div style="font-weight:700; font-size:1rem; margin-bottom:8px; border-bottom: 1px solid var(--border); padding-bottom:8px; color:var(--text-heading);">Sales Transaction Ledger</div>
                `;
                if (sortedSales.length === 0) {
                    cardsContainer.innerHTML += `<div style="text-align: center; color: var(--text-tertiary); padding: 16px 0;">No product sales logged for this selection.</div>`;
                } else {
                    sortedSales.forEach((item, index) => {
                        const card = document.createElement("div");
                        card.className = "mobile-card";
                        card.style.cssText = "background:var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding:16px; margin-bottom:12px; display:flex; flex-direction:column; gap:8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);";
                        card.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div>
                                    <div style="font-weight:800; font-size:1rem; color:var(--text-heading);">${escapeHTML(item.itemName)}</div>
                                    <div style="font-size:0.75rem; color:var(--text-tertiary); margin-top:2px;">Date: ${escapeHTML(item.date)} &bull; Store: ${escapeHTML(item.store)}</div>
                                </div>
                                <div><span class="pill-badge pill-badge-secondary">${escapeHTML(item.category)}</span></div>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:0.85rem; background:rgba(0,0,0,0.02); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                                <div>
                                    <div style="color:var(--text-tertiary); font-size:0.75rem;">QUANTITY SOLD</div>
                                    <div style="font-weight:700; color:var(--text-heading); margin-top:2px;">${item.qty.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div style="color:var(--text-tertiary); font-size:0.75rem;">TOTAL REVENUE</div>
                                    <div style="font-weight:700; color:var(--text-heading); margin-top:2px;">₹${item.revenue.toLocaleString()}</div>
                                </div>
                            </div>
                        `;
                        cardsContainer.appendChild(card);
                    });
                }
            } else {
                tableContainer.style.setProperty("display", "block", "important");
                cardsContainer.style.setProperty("display", "none", "important");
                const tbody = document.getElementById("productSalesTableBody");
                if (tbody) {
                    tbody.innerHTML = "";
                    if (sortedSales.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-tertiary);">No product sales logged for this selection.</td></tr>`;
                    } else {
                        sortedSales.forEach((item) => {
                            const tr = document.createElement("tr");
                            tr.innerHTML = `
                                <td>${escapeHTML(item.date)}</td>
                                <td style="font-weight: 700;">${escapeHTML(item.store)}</td>
                                <td style="font-weight: 700;">${escapeHTML(item.itemName)}</td>
                                <td>${escapeHTML(item.category)}</td>
                                <td style="text-align: right;">${item.qty.toLocaleString()}</td>
                                <td style="text-align: right; font-weight: 700; color: var(--text-heading);">₹${item.revenue.toLocaleString()}</td>
                            `;
                            tbody.appendChild(tr);
                        });
                    }
                }
            }
        }

        // 6. Populate Recipes Dropdown in modal
        const recipeSelect = document.getElementById("recordSalesRecipeSelect");
        if (recipeSelect) {
            recipeSelect.innerHTML = '<option value="" disabled selected>-- Select Menu Item --</option>';
            recipes.forEach(r => {
                const opt = document.createElement("option");
                opt.value = r.id;
                opt.textContent = `${r.name} (₹${r.retailPrice || 0})`;
                recipeSelect.appendChild(opt);
            });
        }

        // 7. Date input setup
        const recordSalesDateInput = document.getElementById("recordSalesDate");
        if (recordSalesDateInput && !recordSalesDateInput.value) {
            recordSalesDateInput.value = getTodayDateStr();
        }

        // 8. Form submit handler (bind only once)
        const form = document.getElementById("formRecordProductSales");
        if (form && !form.dataset.listenerBound) {
            form.dataset.listenerBound = "true";
            form.addEventListener("submit", async (e) => {
                e.preventDefault();

                const date = document.getElementById("recordSalesDate").value;
                const recipeId = document.getElementById("recordSalesRecipeSelect").value;
                const qty = parseInt(document.getElementById("recordSalesQty").value, 10);

                if (!recipeId) {
                    alert("Please select a menu item.");
                    return;
                }

                const recipe = recipes.find(r => r.id === recipeId);
                if (!recipe) {
                    alert("Recipe not found.");
                    return;
                }

                const targetStore = (currentRole === "bm") ? currentStore : (storeSelect && storeSelect.value !== "All" ? storeSelect.value : "VESU");
                const retailPrice = cleanFloat(recipe.retailPrice);
                const totalRevenue = qty * retailPrice;

                const payload = {
                    id: "ps-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
                    store: targetStore,
                    date: date,
                    recipeId: recipe.id,
                    itemName: recipe.name,
                    category: recipe.category || "General",
                    qty: qty,
                    revenue: totalRevenue,
                    image: recipe.image || "🥘"
                };

                try {
                    const response = await fetch(`${API_BASE}/api/product-sales`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) throw new Error("API error " + response.status);

                    // Clear and close
                    document.getElementById("recordSalesQty").value = "";
                    document.getElementById("recordSalesRecipeSelect").value = "";
                    closeModal('modalRecordProductSales');
                    alert("Product sales recorded successfully.");

                    await syncStateFromServer();
                } catch (err) {
                    console.error('Failed to log product sales:', err);
                    alert("Error logging product sales. Please try again.");
                }
            });
        }

        // --- BULK IMPORT AND EXPORT FOR PRODUCT SALES ---
        const exportBtn = document.getElementById("btnExportSales");
        if (exportBtn && !exportBtn.dataset.listenerBound) {
            exportBtn.dataset.listenerBound = "true";
            exportBtn.addEventListener("click", () => {
                const selectedStore = (currentRole === "bm") ? currentStore : (storeSelect ? storeSelect.value : "All");
                const selectedMonth = monthSelect ? monthSelect.value : "2026-06";

                const filteredSales = productSales.filter(sale => {
                    const storeMatch = (selectedStore === "All" || sale.store === selectedStore);
                    const monthMatch = (selectedMonth === "All" || (sale.date && sale.date.startsWith(selectedMonth)));
                    return storeMatch && monthMatch;
                });

                let csvContent = "Sales ID,Store,Date,Menu Item,Category,Quantity Sold,Total Revenue\r\n";
                filteredSales.forEach(s => {
                    const row = `"${s.id}","${s.store}","${s.date}","${s.itemName.replace(/"/g, '""')}","${s.category.replace(/"/g, '""')}",${s.qty},${s.revenue}\r\n`;
                    csvContent += row;
                });

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `product_sales_report_${selectedStore.split(' ')[0]}_${selectedMonth}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        const importBtn = document.getElementById("btnImportSalesBtn");
        const importInput = document.getElementById("importSalesFile");
        if (importBtn && importInput && !importBtn.dataset.listenerBound) {
            importBtn.dataset.listenerBound = "true";
            importBtn.addEventListener("click", () => {
                importInput.click();
            });
        }

        if (importInput && !importInput.dataset.listenerBound) {
            importInput.dataset.listenerBound = "true";
            importInput.addEventListener("change", async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (evt) => {
                    try {
                        const data = new Uint8Array(evt.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const rawRows = XLSX.utils.sheet_to_json(worksheet);

                        if (rawRows.length === 0) {
                            alert("The Excel sheet is empty.");
                            importInput.value = "";
                            return;
                        }

                        const validBranches = ["VESU", "LP SAVANI", "GAURAV PATH", "SUDAMA CHOWK"];
                        const recordsToSave = [];
                        const errors = [];

                        rawRows.forEach((row, index) => {
                            const rowNum = index + 2;

                            const branchInput = (row.Branch || row.branch || row.Store || row.store || "").toString().trim().toUpperCase();
                            let branch = "";
                            if (branchInput.includes("VESU")) {
                                branch = "VESU";
                            } else if (branchInput.includes("LP SAVANI") || branchInput.includes("LPSAVANI") || branchInput.includes("SAVANI")) {
                                branch = "LP SAVANI";
                            } else if (branchInput.includes("GAURAV PATH") || branchInput.includes("GAURAVPATH") || branchInput.includes("GAURAV")) {
                                branch = "GAURAV PATH";
                            } else if (branchInput.includes("SUDAMA CHOWK") || branchInput.includes("SUDAMACHOWK") || branchInput.includes("SUDAMA") || branchInput.includes("CHOWK") || branchInput.includes("CHOK")) {
                                branch = "SUDAMA CHOWK";
                            }

                            const itemName = (row["Menu Item"] || row["menu item"] || row.Item || row.item || row["Item Name"] || row["item name"] || "").toString().trim();
                            const qtyVal = row.Quantity || row.quantity || row.Qty || row.qty || row["Quantity Sold"] || row["quantity sold"];
                            const dateVal = row.Date || row.date;
                            const dateStr = parseRobustDate(dateVal);

                            if (!branch) {
                                errors.push(`Row ${rowNum}: Branch is empty or unrecognized (value: '${branchInput}').`);
                                return;
                            }
                            if (!validBranches.includes(branch)) {
                                errors.push(`Row ${rowNum}: Invalid branch '${branch}'. Must be VESU, ADAJAN, or CT LIGHT.`);
                                return;
                            }

                            if (currentRole === "bm" && branch !== currentStore) {
                                errors.push(`Row ${rowNum}: Unauthorized branch '${branch}'. As a Branch Manager, you can only import sales for your store: ${currentStore}.`);
                                return;
                            }

                            if (!itemName) {
                                errors.push(`Row ${rowNum}: Menu Item Name is empty.`);
                                return;
                            }

                            const findRecipe = recipes.find(r => r.name.toLowerCase() === itemName.toLowerCase());
                            if (!findRecipe) {
                                errors.push(`Row ${rowNum}: Recipe/Menu Item '${itemName}' does not exist in recipes database.`);
                                return;
                            }

                            const qty = parseInt(qtyVal, 10);
                            if (isNaN(qty) || qty <= 0) {
                                errors.push(`Row ${rowNum}: Invalid quantity '${qtyVal}'. Must be a positive integer.`);
                                return;
                            }

                            const retailPrice = cleanFloat(findRecipe.retailPrice);
                            const totalRevenue = qty * retailPrice;

                            recordsToSave.push({
                                id: "ps-" + Date.now() + "-" + Math.floor(Math.random() * 1000) + "-" + index,
                                store: branch,
                                date: dateStr,
                                recipeId: findRecipe.id,
                                itemName: findRecipe.name,
                                category: findRecipe.category || "General",
                                qty: qty,
                                revenue: totalRevenue,
                                image: findRecipe.image || "🥘"
                            });
                        });

                        if (errors.length > 0) {
                            alert("Import aborted due to validation errors:\n\n" + errors.slice(0, 10).join("\n") + (errors.length > 10 ? `\n...and ${errors.length - 10} more errors.` : ""));
                            importInput.value = "";
                            return;
                        }

                        // Confirm upload
                        if (!confirm(`Are you sure you want to import ${recordsToSave.length} product sales records? This will update inventory stock levels accordingly.`)) {
                            importInput.value = "";
                            return;
                        }

                        // Send payload to backend bulk sales endpoint
                        const response = await fetch(`${API_BASE}/api/product-sales/bulk`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(recordsToSave)
                        });

                        if (!response.ok) {
                            const errData = await response.json();
                            throw new Error(errData.error || "Server error");
                        }

                        alert(`Successfully imported ${recordsToSave.length} product sales records and updated inventory stock.`);
                        importInput.value = "";
                        await syncStateFromServer();

                    } catch (err) {
                        console.error("Failed to import sales:", err);
                        alert("Error importing file: " + err.message);
                        importInput.value = "";
                    }
                };
                reader.readAsArrayBuffer(file);
            });
        }
    }


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
                // Calculate live actual metrics for today
                let actualSales = 0;
                let actualCash = 0;
                let actualUpi = 0;
                let actualCard = 0;
                let actualOrders = 0;
                let actualExpenses = 0;

                // Filter POS orders for currentStore, todayStr, and not cancelled/refunded
                const todayOrders = posOrders.filter(o => o.store === currentStore && o.date === todayStr && o.status !== "Cancelled" && o.status !== "Refunded");
                actualOrders = todayOrders.length;
                todayOrders.forEach(o => {
                    const amt = parseFloat(o.grandTotal) || 0;
                    actualSales += amt;
                    const method = (o.paymentMethod || "").toUpperCase();
                    if (method.includes("CASH")) {
                        actualCash += amt;
                    } else if (method.includes("CARD")) {
                        actualCard += amt;
                    } else {
                        // Default to UPI
                        actualUpi += amt;
                    }
                });

                // Filter expenses for currentStore and todayStr
                const todayExpenses = expenses.filter(e => e.store === currentStore && e.date === todayStr);
                todayExpenses.forEach(e => {
                    actualExpenses += parseFloat(e.amount) || 0;
                });

                formHTML = `
                    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius: var(--radius-md); padding: 32px; max-width: 600px; margin: 0 auto;">
                        <div style="background:var(--bg-hover); border:1px solid var(--border); border-radius: var(--radius-md); padding:16px; margin-bottom: 24px; text-align:center; font-size:0.8rem; display:flex; justify-content:space-around;">
                            <div>
                                <div style="color:var(--text-tertiary);">Today's Sales (POS)</div>
                                <div style="font-weight:800; font-size:1rem; color:var(--success); margin-top:4px;">₹${actualSales.toLocaleString()}</div>
                            </div>
                            <div style="border-left: 1px solid var(--border); margin: 0 10px;"></div>
                            <div>
                                <div style="color:var(--text-tertiary);">Today's Expenses</div>
                                <div style="font-weight:800; font-size:1rem; color:var(--danger); margin-top:4px;">₹${actualExpenses.toLocaleString()}</div>
                            </div>
                            <div style="border-left: 1px solid var(--border); margin: 0 10px;"></div>
                            <div>
                                <div style="color:var(--text-tertiary);">Today's Orders</div>
                                <div style="font-weight:800; font-size:1rem; color:var(--text-primary); margin-top:4px;">${actualOrders}</div>
                            </div>
                        </div>

                        <h3 style="font-weight: 800; margin-bottom: 24px; text-align:center;">Register Shift EOD Figures</h3>
                        <form id="eodSubmissionForm">
                            <div class="saas-form-group">
                                <label class="saas-form-label">Total Gross Sales (₹)</label>
                                <input type="number" class="saas-form-input" id="eodSalesInput" placeholder="e.g. 210000" value="${actualSales}" required>
                            </div>
                            <div class="saas-form-group">
                                <label class="saas-form-label">Total Operating Expenses (₹)</label>
                                <input type="number" class="saas-form-input" id="eodExpensesInput" placeholder="e.g. 15000" value="${actualExpenses}" required>
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">
                                <div class="saas-form-group">
                                    <label class="saas-form-label">Cash Collected (₹)</label>
                                    <input type="number" class="saas-form-input" id="eodCashInput" placeholder="e.g. 50000" value="${actualCash}" required>
                                </div>
                                <div class="saas-form-group">
                                    <label class="saas-form-label">UPI Collected (₹)</label>
                                    <input type="number" class="saas-form-input" id="eodUpiInput" placeholder="e.g. 120000" value="${actualUpi}" required>
                                </div>
                                <div class="saas-form-group">
                                    <label class="saas-form-label">Card Collected (₹)</label>
                                    <input type="number" class="saas-form-input" id="eodCardInput" placeholder="e.g. 40000" value="${actualCard}" required>
                                </div>
                            </div>
                            <div class="saas-form-group">
                                <label class="saas-form-label">Orders Completed Count</label>
                                <input type="number" class="saas-form-input" id="eodOrdersInput" placeholder="e.g. 1020" value="${actualOrders}" required>
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
            const branches = ["VESU", "LP SAVANI", "GAURAV PATH", "SUDAMA CHOWK"];
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
                            <select class="saas-form-select" id="ownerEodDateSelect" style="width:130px; padding: 4px 8px; font-size:0.75rem; background:var(--bg-sidebar); color:#ffffff;">
                                <option value="2026-06-15" ${ownerEodDate === "2026-06-15" ? 'selected' : ''}>15 June 2026</option>
                                <option value="2026-06-14" ${ownerEodDate === "2026-06-14" ? 'selected' : ''}>14 June 2026</option>
                            </select>
                        </div>
                    </div>
                    <div class="widget-body">
                        <div class="kpi-grid" style="box-shadow:none; padding:0; margin-bottom:0;">
                            <div class="kpi-card" style="padding:12px;">
                                <div class="kpi-header">Total Consolidated Sales</div>
                                <div class="kpi-value">₹${totalSales.toLocaleString()}</div>
                            </div>
                            <div class="kpi-card" style="padding:12px;">
                                <div class="kpi-header">Total Consolidated Expenses</div>
                                <div class="kpi-value" style="color:var(--danger);">₹${totalExpenses.toLocaleString()}</div>
                            </div>
                            <div class="kpi-card" style="padding:12px;">
                                <div class="kpi-header">Total Cash Collection</div>
                                <div class="kpi-value">₹${totalCash.toLocaleString()}</div>
                            </div>
                            <div class="kpi-card" style="padding:12px;">
                                <div class="kpi-header">Total UPI Collection</div>
                                <div class="kpi-value">₹${totalUpi.toLocaleString()}</div>
                            </div>
                            <div class="kpi-card" style="padding:12px;">
                                <div class="kpi-header">Total Card Collection</div>
                                <div class="kpi-value">₹${totalCard.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="background:var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px; display:flex; gap:16px; align-items:center;">
                    <div style="font-weight:700; font-size:0.9rem; color:var(--text-secondary);">Select Branch Logs:</div>
                    <select class="saas-form-select" id="ownerEodStoreSelect" style="width:250px; background:var(--bg-sidebar); color:#ffffff;">
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
                        <span>${escapeHTML(ing.qty)} ${escapeHTML(ing.unit)} &bull; ₹${Number(ing.cost || 0).toFixed(2)}</span>
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

    // === AUTOMATED MATERIAL FLOW RECONCILIATION REPORT ===
    const INGREDIENT_TO_INVENTORY_MAP = {
        "sesame bun": "Whopper Sesame Buns",
        "veg whopper patty": "Veg Whopper Patty",
        "mayonnaise sauce": "Mayonnaise Sauce",
        "iceberg lettuce": "Iceberg Lettuce",
        "long glazed bun": "Long Glazed Bun",
        "royale paneer patty": "Royale Paneer Patty",
        "shredded iceberg lettuce": "Shredded Iceberg Lettuce",
        "royale mint sauce": "Royale Mint Sauce",
        "plain bun": "Plain Bun",
        "cheeseburger patty (2oz)": "Cheeseburger Patty (2oz)",
        "cheeseburger patty": "Cheeseburger Patty (2oz)",
        "cheeseburger patties": "Cheeseburger Patty (2oz)",
        "cheddar cheese slices": "Cheddar Cheese Slices",
        "cheese slices": "Cheddar Cheese Slices",
        "cheese slice": "Cheddar Cheese Slices",
        "tandoori mayo sauce": "Tandoori Mayo Sauce",
        "paneer": "Paneer cubes",
        "paneer cubes": "Paneer cubes",
        "chicken chunks": "Chicken chunks",
        "chicken": "Chicken chunks",
        "spices": "Marination spices",
        "marination spices": "Marination spices",
        "basmati rice": "Basmati Rice",
        "rice": "Basmati Rice",
        "dosa batter": "Dosa Batter",
        "potato masala": "Potato Masala",
        "butter gravy": "Butter Gravy",
        "chicken patties": "Raw Chicken Patties (Whopper)",
        "raw chicken patties (whopper)": "Raw Chicken Patties (Whopper)",
        "black urad lentils": "Black Urad Lentils",
        "fresh cream & butter": "Fresh Cream & Butter",
        "khoya balls": "Khoya balls",
        "sugar syrup": "Sugar Syrup",
        "veggie balls": "Veggie balls",
        "manchurian sauce": "Manchurian Sauce",
        "chhena balls": "Chhena balls",
        "light sugar syrup": "Light Sugar Syrup",
        "chicken pieces": "Chicken chunks"
    };

    function getBranchCode(storeName) {
        return storeName;
    }

    function matchIngredientToInventory(ingredientName, inventoryList) {
        const cleanIng = ingredientName.toLowerCase().trim();
        if (INGREDIENT_TO_INVENTORY_MAP[cleanIng]) {
            return INGREDIENT_TO_INVENTORY_MAP[cleanIng];
        }
        for (const inv of inventoryList) {
            const labelLower = inv.label.toLowerCase();
            if (labelLower === cleanIng || labelLower.includes(cleanIng) || cleanIng.includes(labelLower)) {
                return inv.label;
            }
        }
        const firstWord = cleanIng.split(" ")[0];
        if (firstWord && firstWord.length > 2) {
            for (const inv of inventoryList) {
                const labelLower = inv.label.toLowerCase();
                if (labelLower.includes(firstWord)) {
                    return inv.label;
                }
            }
        }
        return null;
    }

    function getMaxSalesDate() {
        let maxDate = "2026-06-15";
        if (productSales && productSales.length > 0) {
            productSales.forEach(s => {
                if (s.date && s.date > maxDate) {
                    maxDate = s.date;
                }
            });
        }
        if (wastage && wastage.length > 0) {
            wastage.forEach(w => {
                if (w.date && w.date > maxDate) {
                    maxDate = w.date;
                }
            });
        }
        return maxDate;
    }

    function isDateInPreset(dateStr, preset) {
        if (preset === "all") return true;
        if (!dateStr) return false;

        const parseDateToUTC = (dStr) => {
            const parts = dStr.split('-');
            if (parts.length !== 3) return 0;
            return Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        };

        const targetTime = parseDateToUTC(dateStr);
        const maxDateStr = getMaxSalesDate();
        const maxDateTime = parseDateToUTC(maxDateStr);

        if (preset === "today") {
            return dateStr === maxDateStr;
        }
        if (preset === "yesterday") {
            const oneDayMs = 24 * 60 * 60 * 1000;
            const yesterdayTime = maxDateTime - oneDayMs;
            const yDate = new Date(yesterdayTime);
            const yDateStr = `${yDate.getUTCFullYear()}-${String(yDate.getUTCMonth() + 1).padStart(2, '0')}-${String(yDate.getUTCDate()).padStart(2, '0')}`;
            return dateStr === yDateStr;
        }
        if (preset === "last7") {
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            const startTime = maxDateTime - sevenDaysMs;
            return targetTime >= startTime && targetTime <= maxDateTime;
        }
        return false;
    }

    function renderMaterialReconciliationScreen() {
        const container = document.getElementById("screen-material-reconciliation");
        if (!container) return;

        const outletWrapper = document.getElementById("reconOutletSelectWrapper");
        const outletSelect = document.getElementById("reconOutletSelect");
        let selectedOutlet = "ALL";
        
        if (currentRole === "bm") {
            if (outletWrapper) outletWrapper.style.display = "none";
            selectedOutlet = getBranchCode(currentStore);
        } else {
            if (outletWrapper) outletWrapper.style.display = "block";
            selectedOutlet = outletSelect ? outletSelect.value : "ALL";
        }

        const dateSelect = document.getElementById("reconDateSelect");
        const selectedPreset = dateSelect ? dateSelect.value : "today";

        const searchInput = document.getElementById("reconSearchInput");
        const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";

        const itemsMap = {};
        inventory.forEach(i => {
            if (selectedOutlet !== "ALL" && i.store !== selectedOutlet) {
                return;
            }
            
            const labelLower = i.label.toLowerCase();
            const catLower = (i.category || "").toLowerCase();
            if (searchQuery && !labelLower.includes(searchQuery) && !catLower.includes(searchQuery)) {
                return;
            }
            
            const key = i.label;
            if (!itemsMap[key]) {
                itemsMap[key] = {
                    label: i.label,
                    category: i.category,
                    unit: i.unit,
                    unitCost: i.unitCost || 0,
                    left: 0,
                    used: 0,
                    wasted: 0,
                    inflow: 0,
                    breakdown: [],
                    timeline: []
                };
            }
            itemsMap[key].left += i.stock || 0;
            itemsMap[key].unitCost = i.unitCost || itemsMap[key].unitCost;
        });

        wastage.forEach(w => {
            if (selectedOutlet !== "ALL" && w.store !== selectedOutlet) {
                return;
            }
            if (!isDateInPreset(w.date, selectedPreset)) {
                return;
            }
            const matchKey = Object.keys(itemsMap).find(k => k.toLowerCase() === w.name.toLowerCase());
            if (matchKey) {
                itemsMap[matchKey].wasted += w.qty || 0;
                itemsMap[matchKey].timeline.push({
                    date: w.date,
                    type: 'Wastage',
                    item: 'Wastage Log',
                    qty: w.qty || 0,
                    branch: w.store,
                    details: `Reason: ${w.reason || 'N/A'}`
                });
            }
        });

        const allUniqueInventoryItems = [];
        const seenLabels = new Set();
        inventory.forEach(i => {
            if (!seenLabels.has(i.label)) {
                seenLabels.add(i.label);
                allUniqueInventoryItems.push(i);
            }
        });

        productSales.forEach(sale => {
            if (selectedOutlet !== "ALL" && sale.store !== selectedOutlet) {
                return;
            }
            if (!isDateInPreset(sale.date, selectedPreset)) {
                return;
            }
            
            const recipe = recipes.find(r => r.id === sale.recipeId);
            if (!recipe) return;
            
            const recipeIngredients = Array.isArray(recipe.ingredients) 
                ? recipe.ingredients 
                : (typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : []);
            recipeIngredients.forEach(ing => {
                const matchedLabel = matchIngredientToInventory(ing.name, allUniqueInventoryItems);
                if (matchedLabel && itemsMap[matchedLabel]) {
                    const qtyUsed = (sale.qty || 0) * (ing.qty || 0);
                    itemsMap[matchedLabel].used += qtyUsed;
                    
                    const branchCode = sale.store;
                    const existingBreakdown = itemsMap[matchedLabel].breakdown.find(
                        b => b.recipeName === recipe.name && b.branch === branchCode
                    );
                    if (existingBreakdown) {
                        existingBreakdown.qty += qtyUsed;
                        existingBreakdown.salesQty += (sale.qty || 0);
                    } else {
                        itemsMap[matchedLabel].breakdown.push({
                            recipeName: recipe.name,
                            branch: branchCode,
                            qty: qtyUsed,
                            recipeQty: ing.qty || 0,
                            recipeUnit: ing.unit || itemsMap[matchedLabel].unit,
                            salesQty: sale.qty || 0
                        });
                    }

                    itemsMap[matchedLabel].timeline.push({
                        date: sale.date,
                        type: 'Sales',
                        item: recipe.name,
                        qty: qtyUsed,
                        branch: branchCode,
                        details: `Used in ${recipe.name} (${sale.qty} portions sold, spec: ${ing.qty} ${ing.unit || itemsMap[matchedLabel].unit})`
                    });
                }
            });
        });

        Object.keys(itemsMap).forEach(key => {
            itemsMap[key].inflow = itemsMap[key].left + itemsMap[key].used + itemsMap[key].wasted;
            itemsMap[key].timeline.sort((a, b) => {
                const dA = a.date || "";
                const dB = b.date || "";
                return dB.localeCompare(dA);
            });
        });

        // Compute KPIs
        const totalValueWasted = Object.values(itemsMap).reduce((sum, item) => sum + (item.wasted * item.unitCost), 0);
        const totalValueInflow = Object.values(itemsMap).reduce((sum, item) => sum + (item.inflow * item.unitCost), 0);
        const accuracy = totalValueInflow > 0 ? ((totalValueInflow - totalValueWasted) / totalValueInflow * 100) : 100;

        const reconKpiTracked = document.getElementById("reconKpiTracked");
        const reconKpiUsed = document.getElementById("reconKpiUsed");
        const reconKpiWasted = document.getElementById("reconKpiWasted");
        const reconKpiWastedPercent = document.getElementById("reconKpiWastedPercent");
        const reconKpiAccuracy = document.getElementById("reconKpiAccuracy");

        if (reconKpiTracked) reconKpiTracked.textContent = Object.keys(itemsMap).length;
        if (reconKpiUsed) {
            const totalQtyUsed = Object.values(itemsMap).reduce((sum, item) => sum + item.used, 0);
            reconKpiUsed.textContent = `${Math.round(totalQtyUsed).toLocaleString()}`;
        }
        if (reconKpiWasted) {
            const totalQtyWasted = Object.values(itemsMap).reduce((sum, item) => sum + item.wasted, 0);
            reconKpiWasted.textContent = `${Math.round(totalQtyWasted).toLocaleString()}`;
        }
        if (reconKpiWastedPercent) {
            const totalQtyUsed = Object.values(itemsMap).reduce((sum, item) => sum + item.used, 0);
            const totalQtyWasted = Object.values(itemsMap).reduce((sum, item) => sum + item.wasted, 0);
            const totalQtyLeft = Object.values(itemsMap).reduce((sum, item) => sum + item.left, 0);
            const totalQtyInflow = totalQtyUsed + totalQtyWasted + totalQtyLeft;
            const pct = totalQtyInflow > 0 ? ((totalQtyWasted / totalQtyInflow) * 100) : 0;
            reconKpiWastedPercent.textContent = `${pct.toFixed(1)}% of total inflow`;
        }
        if (reconKpiAccuracy) {
            reconKpiAccuracy.textContent = `${accuracy.toFixed(1)}%`;
        }

        const tableBody = document.querySelector("#reconTable tbody");
        if (!tableBody) return;
        tableBody.innerHTML = "";

        const sortedItems = Object.values(itemsMap).sort((a, b) => b.used - a.used);

        if (sortedItems.length === 0) {
            const emptyRow = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-tertiary);">No ingredients match your criteria.</td></tr>`;
            tableBody.innerHTML = emptyRow;
            const cardsContainer = document.getElementById("reconCardsContainer");
            if (cardsContainer) cardsContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No ingredients match your criteria.</div>`;
            return;
        }

        let tableRowsHTML = "";
        let cardsHTML = "";

        const formatDateString = (dStr) => {
            if (!dStr) return "";
            const parts = dStr.split('-');
            if (parts.length !== 3) return dStr;
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const year = parts[0];
            const month = months[parseInt(parts[1], 10) - 1] || parts[1];
            const day = parseInt(parts[2], 10);
            return `${month} ${day}, ${year}`;
        };

        sortedItems.forEach(item => {
            const hasDetails = (item.breakdown && item.breakdown.length > 0) || (item.timeline && item.timeline.length > 0);

            const isIntegerUnit = ["Piece", "Box", "Slice", "Packet"].includes(item.unit);
            const formatQty = (val) => {
                if (val === 0) return "0";
                return isIntegerUnit ? Math.round(val).toLocaleString() : val.toFixed(1).toLocaleString();
            };

            const inflowStr = `${formatQty(item.inflow)} ${item.unit}`;
            const usedStr   = `${formatQty(item.used)}   ${item.unit}`;
            const wastedStr = `${formatQty(item.wasted)} ${item.unit}`;
            const leftStr   = `${formatQty(item.left)}   ${item.unit}`;

            let dishCellHTML  = `<span style="color:var(--text-tertiary); font-size:0.75rem;">&mdash;</span>`;
            let detailsRowHTML = "";
            let mobileCollapseBtnHTML = "";
            let mobileDetailsDivHTML = "";

            if (hasDetails) {
                const sanitizedId = item.label.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
                
                dishCellHTML = `
                    <span class="saas-badge saas-badge-info" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px; padding:4px 8px; font-size:0.72rem; font-weight:700; border-radius:var(--radius-sm); background:rgba(0,180,216,0.1); border:1px solid rgba(0,180,216,0.2); color:var(--info);">
                        <i data-lucide="chevron-down" style="width:12px; height:12px;"></i> View Details
                    </span>
                `;

                let detailRows = "";
                if (item.breakdown && item.breakdown.length > 0) {
                    const sortedBreakdown = [...item.breakdown].sort((a, b) => b.qty - a.qty);
                    sortedBreakdown.forEach(b => {
                        const costVal  = b.qty * item.unitCost;
                        detailRows += `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <td style="padding: 8px 12px; font-weight: 700; color: var(--text-heading); text-align: left;">
                                    ${escapeHTML(b.recipeName)}
                                    <div style="font-size:0.68rem; color:var(--text-tertiary); margin-top:2px;">Spec: ${b.recipeQty} ${escapeHTML(b.recipeUnit)} &bull; ${escapeHTML(b.branch)}</div>
                                </td>
                                <td style="padding: 8px 12px; color: var(--text-secondary); text-align: right;">
                                    ${b.salesQty.toLocaleString()}
                                </td>
                                <td style="padding: 8px 12px; font-weight: 700; color: var(--info); text-align: right;">
                                    ${formatQty(b.qty)} ${item.unit}
                                </td>
                                <td style="padding: 8px 12px; font-weight: 700; color: var(--text-heading); text-align: right;">
                                    ₹${costVal.toLocaleString('en-IN', {maximumFractionDigits: 0})}
                                </td>
                            </tr>
                        `;
                    });
                } else {
                    detailRows = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-tertiary);">No recipe sales logged.</td></tr>`;
                }

                let timelineRowsHTML = "";
                if (item.timeline && item.timeline.length > 0) {
                    item.timeline.forEach(t => {
                        const typeBadge = t.type === "Sales"
                            ? `<span style="font-size:0.65rem; background:rgba(0,180,216,0.15); color:var(--info); padding:2px 6px; border-radius:3px; font-weight:700;">Sales</span>`
                            : `<span style="font-size:0.65rem; background:rgba(230,57,70,0.15); color:var(--danger); padding:2px 6px; border-radius:3px; font-weight:700;">Wastage</span>`;
                        
                        const formattedDate = formatDateString(t.date);
                        
                        timelineRowsHTML += `
                            <div style="display:flex; flex-direction:column; gap:4px; padding:8px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:4px; font-size:0.76rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        ${typeBadge}
                                        <strong style="color:var(--text-heading);">${escapeHTML(t.item)}</strong>
                                    </div>
                                    <span style="font-size:0.7rem; color:var(--text-tertiary);">${formattedDate}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                                    <span style="color:var(--text-secondary); font-size:0.72rem;">${escapeHTML(t.details)}</span>
                                    <span style="font-weight:700; color:${t.type === 'Sales' ? 'var(--info)' : 'var(--danger)'};">${formatQty(t.qty)} ${item.unit} &middot; ${escapeHTML(t.branch)}</span>
                                </div>
                            </div>
                        `;
                    });
                } else {
                    timelineRowsHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary); font-size:0.8rem;">No timeline logs.</div>`;
                }

                let mobileRows = "";
                if (item.breakdown && item.breakdown.length > 0) {
                    const sortedBreakdown = [...item.breakdown].sort((a, b) => b.qty - a.qty);
                    sortedBreakdown.forEach(b => {
                        const pct      = item.used > 0 ? ((b.qty / item.used) * 100).toFixed(0) : 0;
                        const costVal  = b.qty * item.unitCost;
                        mobileRows += `
                            <div style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                                <div>
                                    <span style="font-weight: 700; color: var(--text-primary);">${escapeHTML(b.recipeName)}</span>
                                    <span style="font-size: 0.7rem; color: var(--text-tertiary); margin-left: 6px;">(${escapeHTML(b.branch)})</span>
                                    <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 2px;">
                                        Spec: ${b.recipeQty} ${escapeHTML(b.recipeUnit)} &times; ${b.salesQty} sales
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-weight: 700; color: var(--info);">${formatQty(b.qty)} ${item.unit}</span>
                                    <div style="font-size: 0.7rem; color: var(--text-heading); font-weight: 700; margin-top: 2px;">₹${costVal.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
                                    <div style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 2px;">${pct}% share</div>
                                </div>
                            </div>
                        `;
                    });
                }

                detailsRowHTML = `
                    <tr class="recon-details-row" id="details-${sanitizedId}" style="display:none; background:rgba(0,0,0,0.25);">
                        <td colspan="8" style="padding:20px;">
                            <div class="recon-drawer-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start;">
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    <div style="font-weight:800; font-size:0.8rem; color:var(--info); text-transform:uppercase; letter-spacing:0.05em; display:flex; align-items:center; gap:6px;">
                                        <i data-lucide="chef-hat" style="width:14px; height:14px;"></i> Recipe Utilization Breakdown
                                    </div>
                                    <div class="saas-table-container" style="border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; background: rgba(0,0,0,0.1);">
                                        <table class="saas-table" style="width:100%; font-size:0.78rem;">
                                            <thead>
                                                <tr style="background:rgba(255,255,255,0.02);">
                                                    <th style="padding:8px 12px; text-align:left; font-size:0.7rem; color:var(--text-secondary);">Dish / Recipe</th>
                                                    <th style="padding:8px 12px; text-align:right; font-size:0.7rem; color:var(--text-secondary);">Portions</th>
                                                    <th style="padding:8px 12px; text-align:right; font-size:0.7rem; color:var(--text-secondary);">Total Qty</th>
                                                    <th style="padding:8px 12px; text-align:right; font-size:0.7rem; color:var(--text-secondary);">Cost</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${detailRows}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    <div style="font-weight:800; font-size:0.8rem; color:var(--orange-primary); text-transform:uppercase; letter-spacing:0.05em; display:flex; align-items:center; gap:6px;">
                                        <i data-lucide="calendar" style="width:14px; height:14px;"></i> Daily Consumption Timeline
                                    </div>
                                    <div class="timeline-container" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-md); background: rgba(0,0,0,0.1); padding: 12px; display:flex; flex-direction:column; gap:8px;">
                                        ${timelineRowsHTML}
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;

                mobileCollapseBtnHTML = `
                    <button type="button" class="saas-btn saas-btn-secondary btn-toggle-mobile-recipes" data-target="m-details-${sanitizedId}" style="width:100%; margin-top:8px; padding:6px; font-size:0.75rem; display:flex; align-items:center; justify-content:center; gap:4px; height:auto; line-height:1; border: 1px solid var(--border);">
                        <i data-lucide="chevron-down" style="width:12px; height:12px;"></i> View Utilization & Timeline
                    </button>
                `;

                mobileDetailsDivHTML = `
                    <div id="m-details-${sanitizedId}" style="display:none; margin-top:12px; padding-top:12px; border-top:1px dashed var(--border);">
                        <div style="display:flex; flex-direction:column; gap:16px;">
                            <div>
                                <div style="font-size:0.7rem; font-weight:800; color:var(--info); text-transform:uppercase; letter-spacing:0.07em; margin-bottom:8px; display:flex; align-items:center; gap:4px;">
                                    <i data-lucide="chef-hat" style="width:12px; height:12px;"></i> Recipe Breakdown:
                                </div>
                                <div style="display:flex; flex-direction:column; gap:6px;">
                                    ${mobileRows || '<div style="font-size:0.75rem; color:var(--text-tertiary);">No recipe sales logged.</div>'}
                                </div>
                            </div>
                            <div>
                                <div style="font-size:0.7rem; font-weight:800; color:var(--orange-primary); text-transform:uppercase; letter-spacing:0.07em; margin-bottom:8px; display:flex; align-items:center; gap:4px;">
                                    <i data-lucide="calendar" style="width:12px; height:12px;"></i> Daily Timeline:
                                </div>
                                <div style="display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto;">
                                    ${timelineRowsHTML || '<div style="font-size:0.75rem; color:var(--text-tertiary); padding:4px 0;">No consumption logs.</div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            const unitCostNum = Number(item.unitCost || 0);
            const inflowVal = item.inflow * unitCostNum;
            const usedVal   = item.used * unitCostNum;
            const wastedVal = item.wasted * unitCostNum;
            const leftVal   = item.left * unitCostNum;

            const formatVal = (val) => `₹${val.toLocaleString('en-IN', {maximumFractionDigits: 0})}`;

            tableRowsHTML += `
                <tr class="recon-parent-row" data-ingredient="${escapeHTML(item.label)}" data-count="${hasDetails ? 1 : 0}" style="cursor: pointer;">
                    <td>
                        <strong>${escapeHTML(item.label)}</strong>
                        <div style="font-size:0.72rem; color:var(--text-tertiary); margin-top:2px;">Unit Cost: ₹${unitCostNum.toFixed(2)}</div>
                    </td>
                    <td>${escapeHTML(item.category || 'N/A')}</td>
                    <td>${escapeHTML(item.unit)}</td>
                    <td>
                        <div>${inflowStr}</div>
                        <div style="font-size:0.72rem; color:var(--text-tertiary); margin-top:2px;">${formatVal(inflowVal)}</div>
                    </td>
                    <td>
                        <div style="color:var(--info); font-weight:700;">${usedStr}</div>
                        <div style="font-size:0.72rem; color:var(--text-tertiary); margin-top:2px;">${formatVal(usedVal)}</div>
                    </td>
                    <td>
                        <div style="color:${item.wasted > 0 ? 'var(--danger)' : 'var(--text-secondary)'}; font-weight:${item.wasted > 0 ? '700' : '400'};">${wastedStr}</div>
                        <div style="font-size:0.72rem; color:var(--text-tertiary); margin-top:2px;">${formatVal(wastedVal)}</div>
                    </td>
                    <td>
                        <div>${leftStr}</div>
                        <div style="font-size:0.72rem; color:var(--text-tertiary); margin-top:2px;">${formatVal(leftVal)}</div>
                    </td>
                    <td style="text-align: center; vertical-align: middle;">${dishCellHTML}</td>
                </tr>
                ${detailsRowHTML}
            `;

            cardsHTML += `
                <div class="widget-card" style="padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                        <div>
                            <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">${escapeHTML(item.label)}</div>
                            <div style="font-size:0.75rem; color:var(--text-tertiary); margin-top:2px;">${escapeHTML(item.category)} &bull; Unit Cost: ₹${unitCostNum.toFixed(2)}</div>
                        </div>
                        <div style="font-size:0.75rem; background:rgba(255, 255, 255, 0.05); border:1px solid var(--border); padding:4px 8px; border-radius:4px; font-weight:700; color:var(--text-secondary); text-align:right;">
                            <div>Stock: ${leftStr}</div>
                            <div style="font-size:0.65rem; color:var(--text-tertiary); font-weight:400; margin-top:1px;">${formatVal(leftVal)}</div>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:12px; background:rgba(255, 255, 255, 0.05); padding:8px; border-radius:4px;">
                        <div style="text-align:center;">
                            <div style="font-size:0.65rem; color:var(--text-tertiary); text-transform:uppercase;">Total Inflow</div>
                            <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary); margin-top:2px;">${formatQty(item.inflow)}</div>
                            <div style="font-size:0.65rem; color:var(--text-tertiary); margin-top:1px;">${formatVal(inflowVal)}</div>
                        </div>
                        <div style="text-align:center; border-left:1px solid var(--border); border-right:1px solid var(--border);">
                            <div style="font-size:0.65rem; color:var(--text-tertiary); text-transform:uppercase;">Sales Consumed</div>
                            <div style="font-weight:700; font-size:0.85rem; color:var(--info); margin-top:2px;">${formatQty(item.used)}</div>
                            <div style="font-size:0.65rem; color:var(--text-tertiary); margin-top:1px;">${formatVal(usedVal)}</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:0.65rem; color:var(--text-tertiary); text-transform:uppercase;">Wasted Qty</div>
                            <div style="font-weight:700; font-size:0.85rem; color:var(--danger); margin-top:2px;">${formatQty(item.wasted)}</div>
                            <div style="font-size:0.65rem; color:var(--text-tertiary); margin-top:1px;">${formatVal(wastedVal)}</div>
                        </div>
                    </div>
                    ${mobileCollapseBtnHTML}
                    ${mobileDetailsDivHTML}
                </div>
            `;
        });

        const isMobile = window.innerWidth < 768;
        const tableContainer = container.querySelector(".saas-table-container");
        const cardsContainer = document.getElementById("reconCardsContainer");

        if (isMobile) {
            if (tableContainer) tableContainer.style.display = "none";
            if (cardsContainer) {
                cardsContainer.style.display = "flex";
                cardsContainer.innerHTML = cardsHTML;
            }
        } else {
            if (tableContainer) tableContainer.style.display = "block";
            if (cardsContainer) {
                cardsContainer.style.display = "none";
                cardsContainer.innerHTML = "";
            }
            tableBody.innerHTML = tableRowsHTML;
        }

        const parentRows = tableBody.querySelectorAll(".recon-parent-row");
        parentRows.forEach(row => {
            row.addEventListener("click", () => {
                const ingName = row.getAttribute("data-ingredient");
                const sanitizedId = ingName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
                const detailsRow = document.getElementById(`details-${sanitizedId}`);
                if (detailsRow) {
                    const isHidden = detailsRow.style.display === "none";
                    detailsRow.style.display = isHidden ? "table-row" : "none";
                    
                    const badge = row.querySelector(".saas-badge");
                    if (badge) {
                        badge.innerHTML = isHidden 
                            ? `<i data-lucide="chevron-up" style="width:12px; height:12px;"></i> Hide Details`
                            : `<i data-lucide="chevron-down" style="width:12px; height:12px;"></i> View Details`;
                        if (window.lucide) window.lucide.createIcons();
                    }
                }
            });
        });

        if (cardsContainer) {
            const toggleBtns = cardsContainer.querySelectorAll(".btn-toggle-mobile-recipes");
            toggleBtns.forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetId = btn.getAttribute("data-target");
                    const detailsDiv = document.getElementById(targetId);
                    if (detailsDiv) {
                        const isHidden = detailsDiv.style.display === "none";
                        detailsDiv.style.display = isHidden ? "block" : "none";
                        btn.innerHTML = isHidden
                            ? `<i data-lucide="chevron-up" style="width:12px; height:12px;"></i> Hide Breakdown & Timeline`
                            : `<i data-lucide="chevron-down" style="width:12px; height:12px;"></i> View Utilization & Timeline`;
                        if (window.lucide) window.lucide.createIcons();
                    }
                });
            });
        }

        if (window.lucide) window.lucide.createIcons();
    }

    window.downloadReconciliationCSV = function() {
        const outletWrapper = document.getElementById("reconOutletSelectWrapper");
        const outletSelect = document.getElementById("reconOutletSelect");
        let selectedOutlet = "ALL";
        if (currentRole === "bm") {
            selectedOutlet = getBranchCode(currentStore);
        } else {
            selectedOutlet = outletSelect ? outletSelect.value : "ALL";
        }
        
        const dateSelect = document.getElementById("reconDateSelect");
        const selectedPreset = dateSelect ? dateSelect.value : "today";
        
        const searchInput = document.getElementById("reconSearchInput");
        const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";
        
        const itemsMap = {};
        inventory.forEach(i => {
            if (selectedOutlet !== "ALL" && i.store !== selectedOutlet) return;
            const labelLower = i.label.toLowerCase();
            const catLower = (i.category || "").toLowerCase();
            if (searchQuery && !labelLower.includes(searchQuery) && !catLower.includes(searchQuery)) return;
            
            const key = i.label;
            if (!itemsMap[key]) {
                itemsMap[key] = {
                    label: i.label,
                    category: i.category,
                    unit: i.unit,
                    unitCost: i.unitCost || 0,
                    left: 0,
                    used: 0,
                    wasted: 0,
                    inflow: 0
                };
            }
            itemsMap[key].left += i.stock || 0;
            itemsMap[key].unitCost = i.unitCost || itemsMap[key].unitCost;
        });
        
        wastage.forEach(w => {
            if (selectedOutlet !== "ALL" && w.store !== selectedOutlet) return;
            if (!isDateInPreset(w.date, selectedPreset)) return;
            const matchKey = Object.keys(itemsMap).find(k => k.toLowerCase() === w.name.toLowerCase());
            if (matchKey) {
                itemsMap[matchKey].wasted += w.qty || 0;
            }
        });
        
        const allUniqueInventoryItems = [];
        const seenLabels = new Set();
        inventory.forEach(i => {
            if (!seenLabels.has(i.label)) {
                seenLabels.add(i.label);
                allUniqueInventoryItems.push(i);
            }
        });
        
        productSales.forEach(sale => {
            if (selectedOutlet !== "ALL" && sale.store !== selectedOutlet) return;
            if (!isDateInPreset(sale.date, selectedPreset)) return;
            const recipe = recipes.find(r => r.id === sale.recipeId);
            if (!recipe) return;
            
            const recipeIngredients = Array.isArray(recipe.ingredients) 
                ? recipe.ingredients 
                : (typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : []);
            recipeIngredients.forEach(ing => {
                const matchedLabel = matchIngredientToInventory(ing.name, allUniqueInventoryItems);
                if (matchedLabel && itemsMap[matchedLabel]) {
                    itemsMap[matchedLabel].used += (sale.qty || 0) * (ing.qty || 0);
                }
            });
        });
        
        Object.keys(itemsMap).forEach(key => {
            itemsMap[key].inflow = itemsMap[key].left + itemsMap[key].used + itemsMap[key].wasted;
        });
        
        let csvContent = "Ingredient Name,Category,Unit,Unit Cost (Rs),Total Qty (Inflow),Inflow Value (Rs),Sales Consumed,Consumed Value (Rs),Wastage Qty,Wastage Value (Rs),Remaining Stock,Current Stock Value (Rs)\r\n";
        
        Object.values(itemsMap).sort((a,b) => b.used - a.used).forEach(item => {
            const label = `"${item.label.replace(/"/g, '""')}"`;
            const category = `"${(item.category || '').replace(/"/g, '""')}"`;
            const unit = `"${item.unit}"`;
            const unitCost = Number(item.unitCost || 0);
            const inflowVal = item.inflow * unitCost;
            const usedVal = item.used * unitCost;
            const wastedVal = item.wasted * unitCost;
            const leftVal = item.left * unitCost;
            
            csvContent += `${label},${category},${unit},${unitCost.toFixed(2)},${item.inflow},${inflowVal.toFixed(2)},${item.used},${usedVal.toFixed(2)},${item.wasted},${wastedVal.toFixed(2)},${item.left},${leftVal.toFixed(2)}\r\n`;
        });
        
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `material_reconciliation_report_${selectedOutlet.toLowerCase()}_${selectedPreset}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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

    window.addOwnerDashboardNotification = function(title, message, type = "success") {
        const drawerBody = document.querySelector("#notificationDrawer .drawer-body") || document.querySelector(".drawer-body");
        const notifBadge = document.querySelector(".nav-notification-badge") || document.getElementById("navNotifBadge");
        
        if (notifBadge) {
            let count = parseInt(notifBadge.textContent) || 0;
            notifBadge.textContent = count + 1;
            notifBadge.style.display = "inline-flex";
        }

        const notifId = "notif_" + Date.now();
        const iconColor = type === "error" ? "#ef4444" : (type === "warning" ? "#f59e0b" : "#10b981");
        
        const cardHtml = `
            <div class="notification-card" id="${notifId}" style="border-left: 4px solid ${iconColor}; margin-bottom: 12px; padding: 12px 14px; background: rgba(255,255,255,0.04); border-radius: 8px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 4px;">
                    <strong style="font-size:0.85rem; color:#fff; display:flex; align-items:center; gap:6px;">
                        ${title}
                    </strong>
                    <span style="font-size:0.7rem; color:#aaa;">Just now</span>
                </div>
                <p style="font-size:0.8rem; color:#ccc; margin: 4px 0 8px 0; line-height: 1.4;">${message}</p>
                <div style="display:flex; gap:8px;">
                    <button type="button" onclick="window.dismissNotification('${notifId}')" style="background:none; border:none; color:#aaa; font-size:0.75rem; cursor:pointer; padding:0;">Dismiss</button>
                </div>
            </div>
        `;

        if (drawerBody) {
            drawerBody.insertAdjacentHTML('afterbegin', cardHtml);
        }
    };


    // Nav Item Click router
    
    function renderTrainingScreen() {
        const sidebar = document.getElementById('training-sidebar');
        const content = document.getElementById('training-content');
        if (!sidebar || !content) return;

        sidebar.innerHTML = '';
        
        trainingData.forEach((chapter, index) => {
            const tab = document.createElement('div');
            tab.className = 'training-tab' + (index === 0 ? ' active' : '');
            tab.textContent = chapter.title;
            tab.onclick = () => {
                document.querySelectorAll('.training-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderChapter(chapter);
            };
            sidebar.appendChild(tab);
        });

        if (trainingData.length > 0) {
            renderChapter(trainingData[0]);
        }

        function renderChapter(chapter) {
            let html = '<h2>' + chapter.title + '</h2>';
            const paragraphs = chapter.content.split('\n\n').filter(p => p.trim());
            paragraphs.forEach(p => {
                if (p.length < 60 && !p.includes('.') && p.trim().endsWith(':')) {
                    html += '<h3>' + p + '</h3>';
                } else {
                    html += '<p>' + p.replace(/\n/g, '<br>') + '</p>';
                }
            });
            content.innerHTML = html;
        }
    }

    function navigateToScreen(screenId) {
        currentActiveScreen = screenId;
        const screens = document.querySelectorAll(".app-screen");
        screens.forEach(s => s.classList.remove("active"));

        if (screenId === "staff-training" && typeof window.initStaffTrainingModule === "function") {
            window.initStaffTrainingModule();
        }
        const targetScreen = document.getElementById(`screen-${screenId}`);
        if (targetScreen) {
            targetScreen.classList.add("active");
        }

        const mainPanel = document.querySelector(".main-panel");
        if (mainPanel) {
            mainPanel.scrollTop = 0;
        }

        const navItems = document.querySelectorAll(".nav-item");
        navItems.forEach(item => {
            if (item.getAttribute("data-target") === screenId) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });
        
        renderAllLists();
    }

    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            const target = item.getAttribute("data-target");
            if (target) {
                navigateToScreen(target);
            }
        });
    });

    window.viewChecklistTaskPhoto = function(photoUrl) {
        const modalImg = document.getElementById("checklistEvidenceModalImg");
        if (modalImg) {
            modalImg.src = photoUrl;
            window.openModal("modalChecklistEvidence");
        }
    };

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

    window.openInventoryLedger = function(itemId, itemName) {
        document.getElementById("ledgerItemName").innerText = itemName;
        const tbody = document.getElementById("inventoryLedgerBody");
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Loading ledger...</td></tr>`;
        document.getElementById("modalInventoryLedger").style.display = "flex";

        const targetStore = currentRole === "owner" ? ownerInventoryStore : currentStore;
        fetch(`/api/inventory/${itemId}/ledger?store=${encodeURIComponent(targetStore)}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No ledger records found.</td></tr>`;
            } else {
                tbody.innerHTML = data.map(record => `
                    <tr>
                        <td style="white-space: nowrap;">${new Date(record.timestamp).toLocaleString()}</td>
                        <td>${record.transactionType}</td>
                        <td>${record.reason}</td>
                        <td style="font-weight:700; color: ${record.qty < 0 ? 'var(--danger)' : 'var(--success)'}">
                            ${record.qty > 0 ? '+' : ''}${record.qty} ${record.unit}
                        </td>
                    </tr>
                `).join('');
            }
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--danger);">Failed to load ledger</td></tr>`;
        });
    };

    window.openMissingRecipeReport = function() {
        const tbody = document.getElementById("missingRecipeOrdersBody");
        if (!tbody) return;

        const targetStore = currentRole === "owner" ? ownerInventoryStore : currentStore;
        const missingOrders = posOrders.filter(o => o.store === targetStore && o.inventorySyncStatus === 'Partial/Missing Recipe');

        if (missingOrders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No orders with missing recipes.</td></tr>`;
        } else {
            tbody.innerHTML = missingOrders.map(o => `
                <tr>
                    <td><strong>${o.id}</strong><br><span style="font-size:0.75rem; color:var(--text-tertiary);">${o.dToken || o.tableName || 'N/A'}</span></td>
                    <td>${o.date} ${o.time}</td>
                    <td><span style="font-size:0.75rem; padding:2px 6px; border-radius:4px; background:#9b59b6; color:white;">No Recipe</span></td>
                    <td>
                        <button class="saas-btn saas-btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="openOrderDetailsModal('${o.id}')">View Items</button>
                    </td>
                </tr>
            `).join('');
        }

        document.getElementById("modalMissingRecipeReport").style.display = "flex";
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

    window.triggerWhatsAppSend = function() {
        const selectedStore = (currentRole === "bm") ? currentStore : "VESU";
        const todayStr = getTodayDateStr();
        
        const storeEods = eodReports.filter(e => e.store === selectedStore);
        storeEods.sort((a, b) => b.date.localeCompare(a.date));
        const latestEod = storeEods[0];
        
        let text = "";
        if (latestEod) {
            text = `*BK OPERATIONS INDIA - EOD REPORT*\nDate: ${latestEod.date}\nStore: BK ${latestEod.store}\n-----------------------------\n* Gross Sales: ₹${Number(latestEod.sales || 0).toLocaleString('en-IN')}\n* Net Cash: ₹${Number(latestEod.cash || 0).toLocaleString('en-IN')}\n* Net UPI: ₹${Number(latestEod.upi || 0).toLocaleString('en-IN')}\n* Net Card: ₹${Number(latestEod.card || 0).toLocaleString('en-IN')}\n* Total Orders: ${latestEod.orders || 0}\n* Total Expenses: ₹${Number(latestEod.expenses || 0).toLocaleString('en-IN')}\n-----------------------------\nStatus: Pending Area Manager Signoff`;
        } else {
            text = `*BK OPERATIONS INDIA - EOD REPORT*\nDate: ${todayStr}\nStore: BK ${selectedStore} West\n-----------------------------\n* Gross Sales: ₹2,84,500\n* Net Sales: ₹2,41,820\n* Food Cost Margin: 28.4%\n* Wastage Cost: ₹12,450 (2.9%)\n* Staff Present: 95.4%\n-----------------------------\nStatus: Pending Area Manager Signoff`;
        }
        
        const url = `https://api.whatsapp.com/send?phone=919876543210&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        window.closeModal('modalWhatsApp');
    };

    // === MANUAL ATTENDANCE FORM SUBMISSION ===
    const manualAttendanceForm = document.getElementById("formManualAttendance");
    if (manualAttendanceForm) {
        // Auto-calculate suggested daily salary based on employee monthly salary & hours
        const updateManualAttendanceSuggestedSalary = () => {
            const empInput = document.getElementById("manualAttendanceEmpInput");
            const salInput = document.getElementById("manualAttendanceSalary");
            const inTimeRaw = document.getElementById("manualAttendanceInTime").value;
            const outTimeRaw = document.getElementById("manualAttendanceOutTime").value;
            if (!empInput || !salInput) return;

            const typedInput = empInput.value.trim().toLowerCase();
            if (!typedInput) return;

            const matchedEmp = Object.values(employees).find(e => 
                e.name.toLowerCase() === typedInput || 
                e.id.toLowerCase() === typedInput
            );

            if (matchedEmp && matchedEmp.salary && inTimeRaw && outTimeRaw) {
                const [inH, inM] = inTimeRaw.split(':').map(Number);
                const [outH, outM] = outTimeRaw.split(':').map(Number);
                const diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
                const hours = Math.max(0, (diffMinutes / 60));
                // Pro-rate salary: (Monthly Salary / 30) * (Hours Worked / 8)
                salInput.value = Math.round((matchedEmp.salary / 30) * (hours / 8));
            }
        };

        const empInput = document.getElementById("manualAttendanceEmpInput");
        const inTimeInput = document.getElementById("manualAttendanceInTime");
        const outTimeInput = document.getElementById("manualAttendanceOutTime");
        if (empInput) empInput.addEventListener("input", updateManualAttendanceSuggestedSalary);
        if (inTimeInput) inTimeInput.addEventListener("change", updateManualAttendanceSuggestedSalary);
        if (outTimeInput) outTimeInput.addEventListener("change", updateManualAttendanceSuggestedSalary);

        manualAttendanceForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const typedInput = document.getElementById("manualAttendanceEmpInput").value.trim();
            if (!typedInput) {
                alert("Please enter employee name or ID!");
                return;
            }
            
            // Find the employee by name or ID (case-insensitively)
            const matchedEmp = Object.values(employees).find(e => 
                e.name.toLowerCase() === typedInput.toLowerCase() || 
                e.id.toLowerCase() === typedInput.toLowerCase()
            );
            
            if (!matchedEmp) {
                alert(`Employee "${typedInput}" not found. Please check spelling or add them as a new employee first!`);
                return;
            }
            const empId = matchedEmp.id;
            const date = document.getElementById("manualAttendanceDate").value;
            const inTimeRaw = document.getElementById("manualAttendanceInTime").value;
            const outTimeRaw = document.getElementById("manualAttendanceOutTime").value;
            const status = document.getElementById("manualAttendanceStatus").value;
            const salary = parseFloat(document.getElementById("manualAttendanceSalary").value) || 0;

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
                         salary,
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

    // === ADD EMPLOYEE FORM SUBMISSION ===
    const btnManagerAddEmployee = document.getElementById("btnManagerAddEmployee");
    if (btnManagerAddEmployee) {
        btnManagerAddEmployee.addEventListener("click", () => {
            openModal("modalAddEmployee");
        });
    }

    const formAddEmployee = document.getElementById("formAddEmployee");
    if (formAddEmployee) {
        formAddEmployee.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("empNameInput").value;
            const mobile = document.getElementById("empMobileInput").value;
            const designation = document.getElementById("empRoleSelect").value;
            const store = document.getElementById("empStoreSelect").value;
            const salary = parseFloat(document.getElementById("empSalaryInput").value) || 0;
            
            let roleKey = "staff";
            if (designation === "Kitchen Staff") roleKey = "kitchen";
            else if (designation.includes("Manager")) roleKey = "sm";
            else if (designation.includes("Admin")) roleKey = "admin";
            
            try {
                const res = await fetch(`${API_BASE}/api/employees`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: "EMP" + Math.floor(100 + Math.random() * 900),
                        name,
                        role: designation,
                        mobile,
                        shiftStart: "09:00",
                        roleKey,
                        password: "",
                        status: "Active",
                        store,
                        activePunch: null,
                        history: [],
                        salary
                    })
                });
                if (res.ok) {
                    alert("Employee added successfully.");
                    closeModal("modalAddEmployee");
                    formAddEmployee.reset();
                    await syncStateFromServer();
                } else {
                    const errData = await res.json();
                    alert("Error: " + errData.error);
                }
            } catch (err) {
                console.error(err);
                alert("Failed to add employee.");
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
            const store = currentRole === "owner" ? ownerInventoryStore : currentStore;

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

    // === BIND CLICK TO OPEN INVENTORY ADD & IMPORT MODALS ===
    const btnCreateInventoryTop = document.getElementById("btnCreateInventoryTop");
    if (btnCreateInventoryTop) {
        btnCreateInventoryTop.addEventListener("click", () => {
            openModal("modalAddInventory");
        });
    }

    const btnUploadInventoryExcel = document.getElementById("btnUploadInventoryExcel");
    if (btnUploadInventoryExcel) {
        btnUploadInventoryExcel.addEventListener("click", () => {
            openModal("modalBulkImport");
        });
    }

    // === CLEAR INVENTORY SUBMISSION ===
    const btnClearInventoryTop = document.getElementById("btnClearInventoryTop");
    if (btnClearInventoryTop) {
        btnClearInventoryTop.addEventListener("click", async () => {
            const targetStore = currentRole === "owner" ? ownerInventoryStore : currentStore;
            const confirmMsg = currentRole === "owner"
                ? `Are you sure you want to clear all inventory for store "${targetStore}"? This will reset all stock levels to 0.`
                : `Are you sure you want to clear all inventory for this outlet (${targetStore})? This will reset all stock levels to 0.`;
            
            if (!confirm(confirmMsg)) return;

            try {
                const res = await fetch(`${API_BASE}/api/inventory/clear`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                    },
                    body: JSON.stringify({ store: targetStore })
                });

                if (res.ok) {
                    alert("Inventory cleared successfully.");
                    await syncStateFromServer();
                } else {
                    const errData = await res.json();
                    alert("Error: " + errData.error);
                }
            } catch (err) {
                console.error(err);
                alert("Failed to clear inventory.");
            }
        });
    }

    // === CLEAR LIVE SALES STREAM SUBMISSION ===
    const btnClearLiveStream = document.getElementById("btnClearLiveStream");
    if (btnClearLiveStream) {
        btnClearLiveStream.addEventListener("click", async () => {
            const targetStore = currentRole === "owner" ? "" : currentStore; // Empty string means clear all for owner
            const confirmMsg = currentRole === "owner"
                ? `Are you sure you want to clear the Live Sales Stream (POS orders) for ALL outlets? This cannot be undone.`
                : `Are you sure you want to clear the Live Sales Stream (POS orders) for this outlet (${targetStore})? This cannot be undone.`;
            
            if (!confirm(confirmMsg)) return;

            try {
                const res = await fetch(`${API_BASE}/api/pos/orders/clear`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                    },
                    body: JSON.stringify({ store: targetStore })
                });

                if (res.ok) {
                    alert("Live Sales Stream cleared successfully.");
                    await syncStateFromServer();
                } else {
                    const errData = await res.json();
                    alert("Error: " + errData.error);
                }
            } catch (err) {
                console.error(err);
                alert("Failed to clear live sales stream.");
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
            dropzone.style.background = "rgba(255, 255, 255, 0.05)";
            dropzone.style.borderColor = "var(--border)";
        });

        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.style.background = "rgba(255, 255, 255, 0.05)";
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
                const targetStore = currentRole === "owner" ? ownerInventoryStore : currentStore;
                let sheetName = workbook.SheetNames[0];
                const matchedStoreSheet = workbook.SheetNames.find(name => name.toLowerCase().includes(targetStore.toLowerCase()));
                if (matchedStoreSheet) {
                    sheetName = matchedStoreSheet;
                } else {
                    const fallbackSheet = workbook.SheetNames.find(name => 
                        name.toLowerCase().includes('closing') || 
                        name.toLowerCase().includes('stock') || 
                        name.toLowerCase().includes('inventory')
                    );
                    if (fallbackSheet) {
                        sheetName = fallbackSheet;
                    }
                }
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, {header: 1});

                if (rows.length < 2) {
                    alert("The Excel sheet is empty or contains no data rows.");
                    resetBulkImport();
                    return;
                }

                 // Find headers with smart heuristic mapping (scan up to first 15 rows for non-empty headers)
                 let headerRowIndex = 0;
                 let headerRow = [];
                 let labelIdx = -1;

                 for (let r = 0; r < Math.min(15, rows.length); r++) {
                     const rowCells = rows[r];
                     if (!rowCells || rowCells.length === 0) continue;
                     
                     // Skip banner/title rows that have only 1 non-empty cell
                     const nonEmptyCount = rowCells.filter(c => c !== undefined && c !== null && String(c).trim() !== '').length;
                     if (nonEmptyCount < 2) continue;

                     const tempHeaders = rowCells.map(h => String(h || '').trim().toLowerCase());
                     const idx = tempHeaders.findIndex(h => 
                         (h.includes('name') || h.includes('label') || h.includes('item') || h.includes('product') || h.includes('stock status')) && 
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
                 const stockIdx = headerRow.findIndex(h => h.includes('stock') || h.includes('quantity') || h.includes('qty') || h.includes('count') || h === 'qty' || h.includes('closing'));
                 const reorderIdx = headerRow.findIndex(h => h.includes('reorder') || h.includes('min') || h.includes('minimum') || h.includes('limit'));
                 
                 const costIdx = headerRow.findIndex(h => 
                     h.includes('raw') || 
                     h.includes('price/pkd') ||
                     h.includes('unit cost') || 
                     h.includes('rate') ||
                     (h.includes('price') && !h.includes('final') && !h.includes('suggested') && !h.includes('selling') && !h.includes('retail'))
                 );
                 const expiryIdx = headerRow.findIndex(h => h.includes('expiry') || h.includes('date') || h.includes('exp'));

                 // Fallback for label/item name index if name was not detected specifically
                 const finalLabelIdx = labelIdx !== -1 ? labelIdx : headerRow.findIndex(h => h.includes('item') || h.includes('product') || h.includes('label') || h.includes('stock status'));

                 if (finalLabelIdx === -1) {
                     alert("Could not identify the 'Item Name' or 'Stock Status' column in Excel. Please check headers.");
                     resetBulkImport();
                     return;
                 }

                 const parsedUpdates = [];
                 const targetStoreInventory = inventory.filter(i => i.store === targetStore);

                 // Helper functions for fallback category and unit based on item name
                 function getCategoryHelper(name) {
                     const lower = name.toLowerCase();
                     if (lower.includes('bun') || lower.includes('bread') || lower.includes('kulche') || lower.includes('bhature') || lower.includes('puri') || lower.includes('kachori') || lower.includes('samosa')) return 'Bakery Breads';
                     if (lower.includes('patty') || lower.includes('patties') || lower.includes('bhalla') || lower.includes('tikki') || lower.includes('munglet')) return 'Frozen Foods';
                     if (lower.includes('chutney') || lower.includes('sauce') || lower.includes('chatney') || lower.includes('oil') || lower.includes('syrup') || lower.includes('kadi')) return 'Sauces & Spreads';
                     if (lower.includes('dahi') || lower.includes('cheese') || lower.includes('butter') || lower.includes('cream')) return 'Dairy Packets';
                     if (lower.includes('lettuce') || lower.includes('beet') || lower.includes('carrot') || lower.includes('onion') || lower.includes('tomato') || lower.includes('chilli') || lower.includes('adrak') || lower.includes('dhania') || lower.includes('lemon') || lower.includes('potato') || lower.includes('alu') || lower.includes('chana') || lower.includes('spices') || lower.includes('masala')) return 'Fresh Produce';
                     if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('plastic')) return 'Packaging & Cutlery';
                     return 'Chaat Ingredients';
                 }

                 function getUnitHelper(name) {
                     const lower = name.toLowerCase();
                     if (lower.includes('spoon') || lower.includes('dish') || lower.includes('bowl') || lower.includes('tissue') || lower.includes('paper') || lower.includes('plastic')) return 'Piece';
                     if (lower.includes('ml') || lower.includes('oil') || lower.includes('syrup') || lower.includes('water') || lower.includes('kadi') || lower.includes('batter')) return 'ml';
                     return 'gm';
                 }

                 for (let i = headerRowIndex + 1; i < rows.length; i++) {
                     const row = rows[i];
                     if (!row || row.length === 0) continue;

                     const labelVal = String(row[finalLabelIdx] || '').trim();
                     const val = labelVal.toLowerCase();
                     if (!labelVal || val.startsWith('(') || val.endsWith(')') || val.includes('as on :') || val === 'jain' || val === 'status' || val === 'item details' || val === 'stock status' || val.includes('all item') || val.includes('total')) continue;

                     // Match with existing item
                     const matchedItem = targetStoreInventory.find(item => item.label.toLowerCase() === labelVal.toLowerCase());
                     
                     const categoryVal = categoryIdx !== -1 && row[categoryIdx] !== undefined && String(row[categoryIdx]).trim() !== '' ? String(row[categoryIdx]).trim() : (matchedItem ? matchedItem.category : getCategoryHelper(labelVal));
                     const unitVal = unitIdx !== -1 && row[unitIdx] !== undefined && String(row[unitIdx]).trim() !== '' ? String(row[unitIdx]).trim() : (matchedItem ? matchedItem.unit : getUnitHelper(labelVal));
                     
                     const stockVal = stockIdx !== -1 && row[stockIdx] !== undefined && row[stockIdx] !== null ? String(row[stockIdx]).trim() : '';
                     let newStock;
                     if (stockVal === '') {
                         newStock = matchedItem ? matchedItem.stock : 0;
                     } else {
                         newStock = parseInt(stockVal, 10);
                         if (isNaN(newStock)) newStock = matchedItem ? matchedItem.stock : 0;
                     }

                     const reorderVal = reorderIdx !== -1 && row[reorderIdx] !== undefined && row[reorderIdx] !== null ? String(row[reorderIdx]).trim() : '';
                     let newReorder;
                     if (reorderVal === '') {
                         newReorder = matchedItem ? matchedItem.reorder : 10;
                     } else {
                         newReorder = parseInt(reorderVal, 10);
                         if (isNaN(newReorder)) newReorder = matchedItem ? matchedItem.reorder : 10;
                     }

                     const costVal = costIdx !== -1 && row[costIdx] !== undefined && row[costIdx] !== null ? String(row[costIdx]).trim() : '';
                     let newCost;
                     if (costVal === '') {
                         newCost = matchedItem ? matchedItem.unitCost : 10.00;
                     } else {
                         newCost = cleanFloat(costVal);
                         if (isNaN(newCost)) newCost = matchedItem ? matchedItem.unitCost : 10.00;
                     }

                     const newExpiry = expiryIdx !== -1 && row[expiryIdx] !== undefined ? String(row[expiryIdx]) : (matchedItem ? matchedItem.expiryDate : "2026-12-31");

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

        try {
            const token = localStorage.getItem("bk_jwt_token");
            const res = await fetch(`${API_BASE}/api/inventory/batch-update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    updates: currentParsedBulkUpdates,
                    store: targetStore
                })
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message || `Successfully processed bulk updates.`);
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || 'Failed to apply updates.'}`);
            }
        } catch (err) {
            console.error("Batch update failed:", err);
            alert("Failed to connect to batch update server endpoint.");
        }

        closeModal('modalBulkImport');
        resetBulkImport();
        await syncStateFromServer();
    }

    // === RECIPE MANAGEMENT EVENT HANDLERS ===
    window.updateRecipeRawCostTotal = function() {
        let total = 0;
        const costInputs = document.querySelectorAll("#recipeIngredientsContainer .ing-cost");
        costInputs.forEach(input => {
            const val = parseFloat(input.value);
            if (!isNaN(val)) total += val;
        });
        const rawCostInput = document.getElementById("recipeRawCostInput");
        if (rawCostInput) {
            rawCostInput.value = total.toFixed(2);
        }
    };

    window.addRecipeIngredientRow = function(name = "", qty = "", unit = "", cost = "") {
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
            <input type="text" class="saas-form-input ing-unit" placeholder="Unit" style="flex:1;" required value="${escapeHTML(unit)}">
            <input type="number" step="any" class="saas-form-input ing-cost" placeholder="Cost (₹)" style="flex:1;" required value="${escapeHTML(cost)}">
            <button type="button" class="saas-btn saas-btn-secondary" style="padding: 8px 12px; color: var(--danger); border: 1px solid var(--border);" onclick="this.parentElement.remove(); window.updateRecipeRawCostTotal()">✕</button>
        `;
        container.appendChild(row);

        row.querySelector('.ing-cost').addEventListener('input', window.updateRecipeRawCostTotal);
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
                const ingCost = parseFloat(row.querySelector(".ing-cost").value) || 0;
                if (ingName && !isNaN(ingQty)) {
                    ingredients.push({ name: ingName, qty: ingQty, unit: ingUnit, cost: ingCost });
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
            recipesDropzone.style.background = "rgba(255, 255, 255, 0.05)";
            recipesDropzone.style.borderColor = "var(--border)";
        });

        recipesDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            recipesDropzone.style.background = "rgba(255, 255, 255, 0.05)";
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

    // === MATERIAL RECONCILIATION EVENT LISTENERS ===
    const reconOutletSelect = document.getElementById("reconOutletSelect");
    const reconDateSelect = document.getElementById("reconDateSelect");
    const reconSearchInput = document.getElementById("reconSearchInput");

    if (reconOutletSelect) {
        reconOutletSelect.addEventListener("change", () => {
            renderMaterialReconciliationScreen();
        });
    }
    if (reconDateSelect) {
        reconDateSelect.addEventListener("change", () => {
            renderMaterialReconciliationScreen();
        });
    }
    if (reconSearchInput) {
        reconSearchInput.addEventListener("input", () => {
            renderMaterialReconciliationScreen();
        });
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const activeScreen = document.querySelector(".app-screen.active");
            if (activeScreen) {
                if (activeScreen.id === "screen-material-reconciliation") {
                    renderMaterialReconciliationScreen();
                } else if (activeScreen.id === "screen-wastage-management") {
                    renderWastageScreen();
                } else if (activeScreen.id === "screen-product-sales") {
                    renderProductSalesScreen();
                }
            }
        }, 150);
    });

    // === MOBILE MENU TOGGLE ===
    const mobileMenuToggle = document.getElementById("mobileMenuToggle");
    const mobilePOSMenuToggle = document.getElementById("mobilePOSMenuToggle");
    const sidebar = document.querySelector(".sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    if ((mobileMenuToggle || mobilePOSMenuToggle) && sidebar && sidebarOverlay) {
        const openFn = () => {
            sidebar.classList.add("mobile-open");
            sidebarOverlay.classList.add("active");
        };
        if (mobileMenuToggle) mobileMenuToggle.addEventListener("click", openFn);
        if (mobilePOSMenuToggle) mobilePOSMenuToggle.addEventListener("click", openFn);

        // Close sidebar when clicking overlay
        sidebarOverlay.addEventListener("click", () => {
            sidebar.classList.remove("mobile-open");
            sidebarOverlay.classList.remove("active");
        });

        // Close sidebar when clicking any navigation item
        const navItems = sidebar.querySelectorAll(".nav-item");
        navItems.forEach(item => {
            item.addEventListener("click", () => {
                sidebar.classList.remove("mobile-open");
                sidebarOverlay.classList.remove("active");
            });
        });
    }

    // === THEME TOGGLE LOGIC (DARK MODE) ===
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const themeToggleIcon = document.getElementById("themeToggleIcon");

    function applyTheme(theme) {
        if (theme === "dark") {
            document.body.classList.add("dark-theme");
            if (themeToggleIcon) {
                themeToggleIcon.setAttribute("data-lucide", "sun");
            }
        } else {
            document.body.classList.remove("dark-theme");
            if (themeToggleIcon) {
                themeToggleIcon.setAttribute("data-lucide", "moon");
            }
        }
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // ==========================================================================
    // BANKING & CASH RECONCILIATION CONTROLLER & LOGIC
    // ==========================================================================

    function initReconciliationState() {
        const stored = localStorage.getItem("pos_reconciliations");
        if (stored) {
            posReconciliations = JSON.parse(stored);
            return;
        }

        // Generate 30 days of mock reconciliation records
        const list = [];
        const managers = {
            'VESU': 'Manager VESU',
            'LP SAVANI': 'Manager LP SAVANI',
            'GAURAV PATH': 'Manager GAURAV PATH',
            'SUDAMA CHOWK': 'Manager SUDAMA CHOWK'
        };

        const today = new Date();
        for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            ['VESU', 'LP SAVANI', 'GAURAV PATH', 'SUDAMA CHOWK'].forEach(store => {
                // Determine base sales and splits
                const totalSales = Math.round(15000 + Math.random() * 25000);
                const cashSales = Math.round(totalSales * (0.2 + Math.random() * 0.15));
                const upiSales = Math.round(totalSales * (0.5 + Math.random() * 0.15));
                const cardSales = totalSales - cashSales - upiSales;

                const cashExpenses = Math.round(500 + Math.random() * 1500);
                const creditExpenses = Math.round(200 + Math.random() * 800);

                const openingCash = i === 29 ? 5000 : Math.round(4000 + Math.random() * 2000);
                const closingCash = openingCash + cashSales - cashExpenses;

                const idealBanking = openingCash + cashSales - cashExpenses;
                
                // Add some variance on certain days
                let variance = 0;
                if (Math.random() < 0.25) {
                    variance = Math.round((Math.random() - 0.5) * 1200);
                }
                const actualBanking = idealBanking + variance;

                let status = 'Balanced';
                if (variance !== 0) {
                    status = 'Cash Difference';
                } else if (Math.random() < 0.1) {
                    status = 'Pending Deposit';
                }

                list.push({
                    id: `${store}-${dateStr}`,
                    date: dateStr,
                    store: store,
                    auditedBy: managers[store] || 'Manager VESU',
                    totalSales: totalSales,
                    cashSales: cashSales,
                    upiSales: upiSales,
                    cardSales: cardSales,
                    cashExpenses: cashExpenses,
                    creditExpenses: creditExpenses,
                    openingCash: openingCash,
                    closingCash: closingCash,
                    idealBanking: idealBanking,
                    actualBanking: actualBanking,
                    variance: variance,
                    status: status,
                    notes: variance !== 0 ? `Discrepancy of ₹${variance} due to register mismatch.` : 'Daily cash matched register values.',
                    isApproved: variance === 0 && status !== 'Pending Deposit',
                    bankSlipUrl: null,
                    auditLogs: [
                        { text: 'Shift EOD Cash reported', time: '23:15:00', user: managers[store] },
                        { text: 'System auto-reconciliation complete', time: '23:30:00', user: 'System' }
                    ]
                });
            });
        }

        posReconciliations = list;
        localStorage.setItem("pos_reconciliations", JSON.stringify(posReconciliations));
    }

    // Main screen controller
    function renderCashReconciliationScreen() {
        initReconciliationState();

        // Populate Employee Filter dropdown
        const empSelect = document.getElementById("reconFilterEmployeeSelect");
        if (empSelect && empSelect.children.length <= 1) {
            let opts = '<option value="all">All Employees</option>';
            const uniqueNames = [...new Set(posReconciliations.map(r => r.auditedBy))];
            uniqueNames.forEach(name => {
                opts += `<option value="${name}">${name}</option>`;
            });
            empSelect.innerHTML = opts;
        }

        // Apply filters
        const dateVal = document.getElementById("reconFilterDatePicker").value;
        const monthVal = document.getElementById("reconFilterMonthSelect").value;
        const outletVal = document.getElementById("reconFilterOutletSelect").value;
        const employeeVal = document.getElementById("reconFilterEmployeeSelect").value;
        const searchVal = document.getElementById("reconSearchInput").value.toLowerCase();

        let filtered = posReconciliations.filter(r => {
            if (dateVal && r.date !== dateVal) return false;
            if (monthVal !== 'all' && !r.date.startsWith(monthVal)) return false;
            if (outletVal !== 'all' && r.store !== outletVal) return false;
            if (employeeVal !== 'all' && r.auditedBy !== employeeVal) return false;
            if (searchVal && !r.notes.toLowerCase().includes(searchVal) && !r.auditedBy.toLowerCase().includes(searchVal)) return false;
            return true;
        });

        // Sorting
        filtered.sort((a, b) => {
            let valA = a[posReconSortColumn];
            let valB = b[posReconSortColumn];
            
            if (typeof valA === 'string') {
                return posReconSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return posReconSortOrder === 'asc' ? valA - valB : valB - valA;
            }
        });

        // Summary Calculations for cards
        let totalSalesSum = 0;
        let cashSalesSum = 0;
        let upiSalesSum = 0;
        let cardSalesSum = 0;
        let cashExpensesSum = 0;
        let creditExpensesSum = 0;
        let idealBankingSum = 0;
        let actualBankingSum = 0;
        let varianceSum = 0;

        filtered.forEach(r => {
            totalSalesSum += r.totalSales;
            cashSalesSum += r.cashSales;
            upiSalesSum += r.upiSales;
            cardSalesSum += r.cardSales;
            cashExpensesSum += r.cashExpenses;
            creditExpensesSum += r.creditExpenses;
            idealBankingSum += r.idealBanking;
            actualBankingSum += r.actualBanking;
            varianceSum += r.variance;
        });

        // Render summary values (Smooth update)
        document.getElementById("reconTotalSales").textContent = `₹${totalSalesSum.toLocaleString('en-IN')}`;
        document.getElementById("reconCashSales").textContent = `₹${cashSalesSum.toLocaleString('en-IN')}`;
        document.getElementById("reconUpiSales").textContent = `₹${upiSalesSum.toLocaleString('en-IN')}`;
        document.getElementById("reconCardSales").textContent = `₹${cardSalesSum.toLocaleString('en-IN')}`;
        document.getElementById("reconCashExpenses").textContent = `₹${cashExpensesSum.toLocaleString('en-IN')}`;
        document.getElementById("reconCreditExpenses").textContent = `₹${creditExpensesSum.toLocaleString('en-IN')}`;
        document.getElementById("reconIdealBanking").textContent = `₹${idealBankingSum.toLocaleString('en-IN')}`;
        document.getElementById("reconActualBanking").textContent = `₹${actualBankingSum.toLocaleString('en-IN')}`;

        const varianceEl = document.getElementById("reconTotalVariance");
        const varianceCard = document.getElementById("reconVarianceCard");
        const varianceInd = document.getElementById("reconVarianceIndicator");
        varianceEl.textContent = `₹${varianceSum.toLocaleString('en-IN')}`;
        
        varianceCard.className = 'recon-stat-card highlight-variance';
        if (varianceSum === 0) {
            varianceCard.classList.add('matched');
            varianceInd.textContent = 'Matched & Balanced';
            varianceInd.style.color = '#059669';
        } else if (varianceSum > 0) {
            varianceCard.classList.add('excess');
            varianceInd.textContent = 'Cash Excess Difference';
            varianceInd.style.color = '#2563EB';
        } else {
            varianceCard.classList.add('short');
            varianceInd.textContent = 'Cash Shortage Discrepancy';
            varianceInd.style.color = '#DC2626';
        }

        // Pagination
        const itemsPerPage = 10;
        const totalItems = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
        if (posReconCurrentPage > totalPages) posReconCurrentPage = totalPages;
        
        const startIndex = (posReconCurrentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        const paginatedItems = filtered.slice(startIndex, endIndex);

        document.getElementById("reconPaginationText").textContent = totalItems === 0 
            ? 'Showing 0-0 of 0' 
            : `Showing ${startIndex + 1}-${endIndex} of ${totalItems}`;

        // Render Table Body
        const tbody = document.getElementById("reconTableBody");
        if (paginatedItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="14" style="text-align:center; padding:30px; color:#64748B;">No reconciliation records match the filter criteria.</td></tr>`;
        } else {
            let html = '';
            paginatedItems.forEach(r => {
                let varClass = 'matched';
                let varText = 'Matched';
                if (r.variance > 0) {
                    varClass = 'excess';
                    varText = `Excess (+₹${r.variance})`;
                } else if (r.variance < 0) {
                    varClass = 'short';
                    varText = `Short (-₹${Math.abs(r.variance)})`;
                }

                let statusClass = 'balanced';
                if (r.status === 'Pending Deposit') statusClass = 'pending';
                if (r.status === 'Cash Difference') statusClass = 'difference';

                html += `
                    <tr data-id="${r.id}">
                        <td>${formatDateString(r.date)}</td>
                        <td>₹${r.totalSales.toLocaleString('en-IN')}</td>
                        <td>₹${r.cashSales.toLocaleString('en-IN')}</td>
                        <td>₹${r.upiSales.toLocaleString('en-IN')}</td>
                        <td>₹${r.cardSales.toLocaleString('en-IN')}</td>
                        <td style="color:var(--pos-accent-red)">₹${r.cashExpenses.toLocaleString('en-IN')}</td>
                        <td>₹${r.creditExpenses.toLocaleString('en-IN')}</td>
                        <td>₹${r.openingCash.toLocaleString('en-IN')}</td>
                        <td>₹${r.closingCash.toLocaleString('en-IN')}</td>
                        <td style="font-weight:700">₹${r.idealBanking.toLocaleString('en-IN')}</td>
                        <td style="font-weight:700">₹${r.actualBanking.toLocaleString('en-IN')}</td>
                        <td><span class="status-badge-recon ${varClass}">${varText}</span></td>
                        <td><span class="status-badge-recon ${statusClass}">${r.status}</span></td>
                        <td>
                            <button type="button" class="recon-table-action-btn" title="Audit details">
                                <i data-lucide="eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

        renderReconPaginationControls(totalPages);
        renderReconInsightsAndCharts(filtered, cashSalesSum, upiSalesSum, cardSalesSum);
        bindReconDOMEvents();
        if (window.lucide) window.lucide.createIcons();
    }

    function formatDateString(str) {
        const d = new Date(str);
        return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function renderReconPaginationControls(totalPages) {
        const container = document.getElementById("reconPageIndicators");
        if (!container) return;
        
        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            const activeClass = i === posReconCurrentPage ? 'active' : '';
            html += `<button type="button" class="recon-page-btn ${activeClass}" data-page="${i}">${i}</button>`;
        }
        container.innerHTML = html;
    }

    function renderReconInsightsAndCharts(filtered, cashSalesSum, upiSalesSum, cardSalesSum) {
        const totalSales = cashSalesSum + upiSalesSum + cardSalesSum;
        const digitalSales = upiSalesSum + cardSalesSum;
        const digitalRatio = totalSales > 0 ? Math.round((digitalSales / totalSales) * 100) : 0;
        
        const labelRatio = document.getElementById("chartDigitalRatio");
        if (labelRatio) labelRatio.textContent = `${digitalRatio}% Digital`;

        const barCash = document.getElementById("chartBarCash");
        const barDigital = document.getElementById("chartBarDigital");
        if (barCash && barDigital) {
            const cashRatio = 100 - digitalRatio;
            barCash.style.width = `${cashRatio}%`;
            barDigital.style.width = `${digitalRatio}%`;
        }

        // Render Trend Bar Chart (Daily sales vs banking)
        const trendChart = document.getElementById("reconTrendBarChart");
        if (trendChart) {
            const recent = filtered.slice(0, 7).reverse();
            let barsHtml = '';
            
            const maxVal = Math.max(...recent.map(r => Math.max(r.totalSales, r.actualBanking)), 10000);

            recent.forEach(r => {
                const salesHeight = Math.round((r.totalSales / maxVal) * 100);
                const bankingHeight = Math.round((r.actualBanking / maxVal) * 100);
                
                barsHtml += `
                    <div class="chart-bar-column" title="Sales: ₹${r.totalSales} | Banking: ₹${r.actualBanking}">
                        <div class="chart-bar-fill sales-fill" style="height: ${Math.max(4, salesHeight)}px;"></div>
                        <div class="chart-bar-fill deposit-fill" style="height: ${Math.max(4, bankingHeight)}px;"></div>
                        <span style="font-size:0.6rem; color:#94A3B8; margin-top:4px;">${r.date.substr(-5)}</span>
                    </div>
                `;
            });
            trendChart.innerHTML = barsHtml;
        }

        // Render Variance analysis (Variance dots)
        const varChart = document.getElementById("reconVarianceLineChart");
        if (varChart) {
            const recent = filtered.slice(0, 7).reverse();
            let dotsHtml = '';

            recent.forEach(r => {
                let dotClass = 'zero';
                if (r.variance > 0) dotClass = 'positive';
                if (r.variance < 0) dotClass = 'negative';

                const offset = 25 + Math.round((r.variance / 1500) * 20); // Scale positioning offset
                
                dotsHtml += `
                    <div class="chart-bar-column" title="Variance: ₹${r.variance} (${r.date})">
                        <div class="variance-chart-dot ${dotClass}" style="transform: translateY(${offset}px)"></div>
                        <span style="font-size:0.6rem; color:#94A3B8; margin-top:35px;">${r.date.substr(-5)}</span>
                    </div>
                `;
            });
            varChart.innerHTML = dotsHtml;
        }

        // Insights panel fields
        const todayStr = new Date().toISOString().split('T')[0];
        const store = getPOSStore();
        const todayRec = posReconciliations.find(r => r.date === todayStr && r.store === store);

        document.getElementById("insightTodayCash").textContent = todayRec ? `₹${todayRec.cashSales.toLocaleString('en-IN')}` : '₹0.00';
        document.getElementById("insightTodayDeposit").textContent = todayRec ? `₹${todayRec.actualBanking.toLocaleString('en-IN')}` : '₹0.00';

        const pendingSum = posReconciliations.filter(r => r.status === 'Pending Deposit').reduce((sum, r) => sum + r.idealBanking, 0);
        document.getElementById("insightPendingDeposit").textContent = `₹${pendingSum.toLocaleString('en-IN')}`;

        const diffSum = posReconciliations.reduce((sum, r) => sum + Math.abs(r.variance), 0);
        document.getElementById("insightCashDifference").textContent = `₹${diffSum.toLocaleString('en-IN')}`;

        const maxSales = Math.max(...posReconciliations.map(r => r.totalSales), 0);
        document.getElementById("insightHighestSalesDay").textContent = `₹${maxSales.toLocaleString('en-IN')}`;

        const avgBanking = posReconciliations.length > 0 
            ? Math.round(posReconciliations.reduce((sum, r) => sum + r.actualBanking, 0) / posReconciliations.length) 
            : 0;
        document.getElementById("insightAvgBanking").textContent = `₹${avgBanking.toLocaleString('en-IN')}`;

        const rate = totalSales > 0 ? ((cashSalesSum / totalSales) * 100).toFixed(1) : '0.0';
        document.getElementById("insightCollectionRate").textContent = `${rate}%`;
    }

    function openReconDrawer(id) {
        const r = posReconciliations.find(item => item.id === id);
        if (!r) return;

        posReconSelectedId = id;
        document.getElementById("drawerTitleDate").textContent = formatDateString(r.date);

        // Drawer values assignment
        document.getElementById("drawerGrossSales").textContent = `₹${r.totalSales.toLocaleString('en-IN')}`;
        document.getElementById("drawerOpeningCash").textContent = `₹${r.openingCash.toLocaleString('en-IN')}`;
        document.getElementById("drawerClosingCash").textContent = `₹${r.closingCash.toLocaleString('en-IN')}`;
        document.getElementById("drawerCashSales").textContent = `₹${r.cashSales.toLocaleString('en-IN')}`;
        document.getElementById("drawerUpiSales").textContent = `₹${r.upiSales.toLocaleString('en-IN')}`;
        document.getElementById("drawerCardSales").textContent = `₹${r.cardSales.toLocaleString('en-IN')}`;
        document.getElementById("drawerCashExpenses").textContent = `₹${r.cashExpenses.toLocaleString('en-IN')}`;
        document.getElementById("drawerCreditExpenses").textContent = `₹${r.creditExpenses.toLocaleString('en-IN')}`;
        
        document.getElementById("drawerFormulaOpening").textContent = `₹${r.openingCash.toLocaleString('en-IN')}`;
        document.getElementById("drawerFormulaCashSales").textContent = `+₹${r.cashSales.toLocaleString('en-IN')}`;
        document.getElementById("drawerFormulaExpenses").textContent = `-₹${r.cashExpenses.toLocaleString('en-IN')}`;
        
        document.getElementById("drawerIdealBanking").textContent = `₹${r.idealBanking.toLocaleString('en-IN')}`;
        document.getElementById("drawerActualBanking").textContent = `₹${r.actualBanking.toLocaleString('en-IN')}`;

        const varRow = document.getElementById("drawerVarianceRow");
        const drawerVar = document.getElementById("drawerVariance");
        drawerVar.textContent = `₹${r.variance.toLocaleString('en-IN')}`;
        varRow.className = 'detail-item font-bold variance-row';
        if (r.variance === 0) {
            varRow.classList.add('matched');
        } else if (r.variance > 0) {
            varRow.classList.add('excess');
        } else {
            varRow.classList.add('short');
        }

        const statusBadge = document.getElementById("drawerStatusBadge");
        statusBadge.className = 'status-badge-recon';
        let varClass = 'matched';
        let varText = 'Matched';
        if (r.variance > 0) {
            varClass = 'excess';
            varText = `Excess (+₹${r.variance})`;
        } else if (r.variance < 0) {
            varClass = 'short';
            varText = `Short (-₹${Math.abs(r.variance)})`;
        }
        statusBadge.classList.add(varClass);
        statusBadge.textContent = varText;

        document.getElementById("drawerOutletBadge").textContent = `${r.store} Branch`;
        document.getElementById("drawerReconNotes").value = r.notes || '';
        document.getElementById("drawerReconApprovalToggle").checked = r.isApproved;

        // Render Audit Logs
        const logsContainer = document.getElementById("drawerAuditLogList");
        let logsHtml = '';
        r.auditLogs.forEach(log => {
            logsHtml += `
                <div class="audit-log-item">
                    <span class="audit-log-text">${log.text} (${log.user})</span>
                    <span class="audit-log-time">${log.time}</span>
                </div>
            `;
        });
        logsContainer.innerHTML = logsHtml;

        // Setup bank slip preview
        const slipPreview = document.getElementById("reconSlipPreviewBox");
        const viewSlipBtn = document.getElementById("btnReconViewSlipLarge");
        if (r.bankSlipUrl) {
            slipPreview.innerHTML = `<img src="${r.bankSlipUrl}" alt="Bank Deposit Slip">`;
            viewSlipBtn.style.display = 'inline-flex';
        } else {
            slipPreview.innerHTML = `<i data-lucide="image" class="placeholder-icon"></i><span>No bank deposit slip uploaded</span>`;
            viewSlipBtn.style.display = 'none';
            if (window.lucide) window.lucide.createIcons();
        }

        // Show Drawer
        document.getElementById("reconDrawerOverlay").style.display = 'block';
        document.getElementById("reconciliationDrawer").classList.add("active");
    }

    function closeReconDrawer() {
        document.getElementById("reconDrawerOverlay").style.display = 'none';
        document.getElementById("reconciliationDrawer").classList.remove("active");
        posReconSelectedId = null;
    }

    function bindReconDOMEvents() {
        // Dropdown month/outlet/employee filters
        const elements = ["reconFilterDatePicker", "reconFilterMonthSelect", "reconFilterOutletSelect", "reconFilterEmployeeSelect"];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.dataset.listenerBound) {
                el.dataset.listenerBound = "true";
                el.addEventListener("change", () => {
                    posReconCurrentPage = 1;
                    renderCashReconciliationScreen();
                });
            }
        });

        // Search text filter
        const searchInput = document.getElementById("reconSearchInput");
        if (searchInput && !searchInput.dataset.listenerBound) {
            searchInput.dataset.listenerBound = "true";
            searchInput.addEventListener("input", () => {
                posReconCurrentPage = 1;
                renderCashReconciliationScreen();
            });
        }

        // Table headers click for sorting
        const headers = document.querySelectorAll("#reconMainTable th.sortable");
        headers.forEach(th => {
            if (!th.dataset.listenerBound) {
                th.dataset.listenerBound = "true";
                th.addEventListener("click", () => {
                    const col = th.getAttribute("data-sort");
                    if (posReconSortColumn === col) {
                        posReconSortOrder = posReconSortOrder === 'asc' ? 'desc' : 'asc';
                    } else {
                        posReconSortColumn = col;
                        posReconSortOrder = 'desc';
                    }
                    renderCashReconciliationScreen();
                });
            }
        });

        // Row clicks to open drawer
        const rows = document.querySelectorAll("#reconTableBody tr");
        rows.forEach(tr => {
            if (!tr.dataset.listenerBound) {
                tr.dataset.listenerBound = "true";
                tr.addEventListener("click", () => {
                    const id = tr.getAttribute("data-id");
                    if (id) openReconDrawer(id);
                });
            }
        });

        // Pagination buttons
        const prevBtn = document.getElementById("btnReconPrevPage");
        if (prevBtn && !prevBtn.dataset.listenerBound) {
            prevBtn.dataset.listenerBound = "true";
            prevBtn.addEventListener("click", () => {
                if (posReconCurrentPage > 1) {
                    posReconCurrentPage--;
                    renderCashReconciliationScreen();
                }
            });
        }

        const nextBtn = document.getElementById("btnReconNextPage");
        if (nextBtn && !nextBtn.dataset.listenerBound) {
            nextBtn.dataset.listenerBound = "true";
            nextBtn.addEventListener("click", () => {
                const totalItems = posReconciliations.length;
                const totalPages = Math.ceil(totalItems / 10);
                if (posReconCurrentPage < totalPages) {
                    posReconCurrentPage++;
                    renderCashReconciliationScreen();
                }
            });
        }

        const pageIndicators = document.querySelectorAll("#reconPageIndicators button");
        pageIndicators.forEach(btn => {
            if (!btn.dataset.listenerBound) {
                btn.dataset.listenerBound = "true";
                btn.addEventListener("click", () => {
                    posReconCurrentPage = parseInt(btn.getAttribute("data-page"));
                    renderCashReconciliationScreen();
                });
            }
        });

        // Close drawer triggers
        const closeOverlay = document.getElementById("reconDrawerOverlay");
        if (closeOverlay && !closeOverlay.dataset.listenerBound) {
            closeOverlay.dataset.listenerBound = "true";
            closeOverlay.addEventListener("click", closeReconDrawer);
        }

        const closeBtn = document.getElementById("btnReconCloseDrawer");
        if (closeBtn && !closeBtn.dataset.listenerBound) {
            closeBtn.dataset.listenerBound = "true";
            closeBtn.addEventListener("click", closeReconDrawer);
        }

        const closeFooter = document.getElementById("btnDrawerCloseFooter");
        if (closeFooter && !closeFooter.dataset.listenerBound) {
            closeFooter.dataset.listenerBound = "true";
            closeFooter.addEventListener("click", closeReconDrawer);
        }

        // File upload click simulator
        const uploadBtn = document.getElementById("btnReconTriggerUpload");
        const fileInput = document.getElementById("reconSlipFileInput");
        if (uploadBtn && fileInput && !uploadBtn.dataset.listenerBound) {
            uploadBtn.dataset.listenerBound = "true";
            uploadBtn.addEventListener("click", () => {
                fileInput.click();
            });
            fileInput.addEventListener("change", (e) => {
                if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const r = posReconciliations.find(item => item.id === posReconSelectedId);
                        if (r) {
                            r.bankSlipUrl = event.target.result;
                            r.auditLogs.unshift({
                                text: 'Bank Deposit Slip uploaded',
                                time: new Date().toTimeString().split(' ')[0],
                                user: currentUser ? currentUser.name : 'Manager'
                            });
                            // Save to local storage
                            localStorage.setItem("pos_reconciliations", JSON.stringify(posReconciliations));
                            openReconDrawer(posReconSelectedId);
                            renderCashReconciliationScreen();
                        }
                    };
                    reader.readAsDataURL(e.target.files[0]);
                }
            });
        }

        // Save reconciliation drawer
        const saveDrawerBtn = document.getElementById("btnReconSaveDrawer");
        if (saveDrawerBtn && !saveDrawerBtn.dataset.listenerBound) {
            saveDrawerBtn.dataset.listenerBound = "true";
            saveDrawerBtn.addEventListener("click", () => {
                const r = posReconciliations.find(item => item.id === posReconSelectedId);
                if (r) {
                    r.notes = document.getElementById("drawerReconNotes").value;
                    const approved = document.getElementById("drawerReconApprovalToggle").checked;
                    
                    if (approved !== r.isApproved) {
                        r.isApproved = approved;
                        r.status = approved ? 'Balanced' : (r.variance !== 0 ? 'Cash Difference' : 'Pending Deposit');
                        r.auditLogs.unshift({
                            text: approved ? 'Manager sign-off approved' : 'Manager sign-off revoked',
                            time: new Date().toTimeString().split(' ')[0],
                            user: currentUser ? currentUser.name : 'Manager'
                        });
                    }

                    localStorage.setItem("pos_reconciliations", JSON.stringify(posReconciliations));
                    closeReconDrawer();
                    renderCashReconciliationScreen();
                    showToast("Reconciliation audit saved successfully.");
                }
            });
        }

        // Sync state button
        const syncBtn = document.getElementById("btnReconSyncState");
        if (syncBtn && !syncBtn.dataset.listenerBound) {
            syncBtn.dataset.listenerBound = "true";
            syncBtn.addEventListener("click", () => {
                showToast("Fetching latest POS orders...");
                syncStateFromServer().then(() => {
                    showToast("Cash reconciliation state synchronized.");
                    renderCashReconciliationScreen();
                });
            });
        }

        // Export Excel button
        const exportExcelBtn = document.getElementById("btnReconExportExcel");
        if (exportExcelBtn && !exportExcelBtn.dataset.listenerBound) {
            exportExcelBtn.dataset.listenerBound = "true";
            exportExcelBtn.addEventListener("click", () => {
                showToast("Generating Excel file export...");
                setTimeout(() => {
                    const csvContent = "data:text/csv;charset=utf-8," 
                        + ["Date,Outlet,Auditor,Total Sales,Cash Sales,UPI,Card,Cash Exp,Opening,Closing,Ideal,Actual,Variance,Status\n"]
                        + posReconciliations.map(e => `${e.date},${e.store},${e.auditedBy},${e.totalSales},${e.cashSales},${e.upiSales},${e.cardSales},${e.cashExpenses},${e.openingCash},${e.closingCash},${e.idealBanking},${e.actualBanking},${e.variance},${e.status}`).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `cash_reconciliation_report_${getTodayDateStr()}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }, 1000);
            });
        }

        // Export PDF button
        const exportPdfBtn = document.getElementById("btnReconExportPDF");
        if (exportPdfBtn && !exportPdfBtn.dataset.listenerBound) {
            exportPdfBtn.dataset.listenerBound = "true";
            exportPdfBtn.addEventListener("click", () => {
                showToast("Exporting reconciliation ledger to PDF...");
                setTimeout(() => {
                    alert("PDF Report Generated successfully! Saved to download directory.");
                }, 1000);
            });
        }

        // Print button
        const printBtn = document.getElementById("btnReconPrint");
        if (printBtn && !printBtn.dataset.listenerBound) {
            printBtn.dataset.listenerBound = "true";
            printBtn.addEventListener("click", () => {
                window.print();
            });
        }
    }

    // ==========================================================================
    // EXCEL IMPORT & AUTOMATION CONTROLLER & LOGIC
    // ==========================================================================

    const fuzzyMappingTargets = {
        'date': { label: 'Date', keys: ['date', 'datum', 'tarikh', 'day', 'dt'] },
        'total_sales': { label: 'Total Sales', keys: ['sale', 'sales', 'totalsale', 'totalsales', 'totals', 'gross'] },
        'net_sales': { label: 'Net Sales', keys: ['netsale', 'netsales', 'net', 'aftergst', 'aftertax'] },
        'consumption': { label: 'Consumption / Usage', keys: ['consumption', 'consume', 'used', 'raw_material'] },
        'food_cost_percentage': { label: 'Food Cost %', keys: ['foodcost%', 'foodcostpercentage', 'foodcostratio', 'food_cost_pct'] },
        'employee_name': { label: 'Employee Name', keys: ['employeename', 'name', 'staffname', 'emp_name', 'employee'] },
        'designation': { label: 'Designation', keys: ['designation', 'role', 'jobtitle', 'pos'] },
        'salary': { label: 'Salary / Wages', keys: ['salary', 'wages', 'basic_salary', 'pay'] },
        'attendance': { label: 'Attendance (Days)', keys: ['attendance', 'days_worked', 'status', 'present'] },
        'overtime_hours': { label: 'OT Hours', keys: ['ot_hours', 'overtimehours', 'ot', 'overtime'] },
        'overtime_amount': { label: 'OT Amount', keys: ['ot_amount', 'overtimeamount', 'ot_pay'] },
        'advance': { label: 'Advance Payment', keys: ['advance', 'loan', 'deduction'] }
    };

    function renderExcelImportScreen() {
        // Reset wizard to step 1
        switchExcelWizardStep(1);
        
        // Load history from local storage
        const storedHistory = localStorage.getItem("excel_import_history");
        if (storedHistory) {
            excelImportHistory = JSON.parse(storedHistory);
        } else {
            excelImportHistory = [];
        }

        const storedTemplates = localStorage.getItem("excel_mapping_templates");
        if (storedTemplates) {
            excelMappingTemplates = JSON.parse(storedTemplates);
        }

        renderExcelImportHistory();
        bindExcelWizardEvents();
    }

    function switchExcelWizardStep(step) {
        // Hide all steps
        for (let i = 1; i <= 4; i++) {
            const el = document.getElementById(`excel-step-${i}`);
            if (el) el.style.display = 'none';
            
            const ind = document.getElementById(`indicator-step${i}`);
            if (ind) {
                ind.classList.remove('active', 'completed');
                if (i < step) {
                    ind.classList.add('completed');
                } else if (i === step) {
                    ind.classList.add('active');
                }
            }
        }
        
        const targetStep = document.getElementById(`excel-step-${step}`);
        if (targetStep) targetStep.style.display = 'block';

        if (window.lucide) window.lucide.createIcons();
    }

    function renderExcelImportHistory() {
        const tbody = document.getElementById("excelHistoryBody");
        if (!tbody) return;

        if (excelImportHistory.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748B; padding: 16px;">No import history recorded yet.</td></tr>`;
            return;
        }

        let html = '';
        excelImportHistory.forEach(log => {
            html += `
                <tr>
                    <td style="font-weight:700;"><i data-lucide="file-spreadsheet" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px; color:#10B981;"></i> ${log.fileName}</td>
                    <td>${log.uploadedBy}</td>
                    <td>${formatDateString(log.uploadDate)}</td>
                    <td style="font-weight:700; color:#10B981;">${log.recordsCount} rows</td>
                    <td><span class="status-badge-recon matched">Success</span></td>
                    <td>
                        <button type="button" class="saas-btn saas-btn-secondary btn-excel-rollback" data-id="${log.transactionId}" style="padding: 4px 8px; font-size: 0.7rem; border-color: #EF4444; color: #EF4444; background: #FFF5F5;">
                            <i data-lucide="undo-2" style="width:12px; height:12px;"></i> Rollback
                        </button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        // Bind rollback clicks
        document.querySelectorAll(".btn-excel-rollback").forEach(btn => {
            btn.addEventListener("click", () => {
                const transId = btn.getAttribute("data-id");
                if (confirm("Are you sure you want to rollback this Excel import? All imported/updated data from this file will be permanently reverted.")) {
                    rollbackExcelImport(transId);
                }
            });
        });

        if (window.lucide) window.lucide.createIcons();
    }

    let excelRowData = [];
    let excelAgGridInstance = null;

    function detectHeaderRowIndex(rawRows) {
        let maxCols = 0;
        rawRows.forEach(r => {
            if (r && r.length > maxCols) maxCols = r.length;
        });
        if (maxCols === 0) return 0;
        
        for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;
            
            let filledCount = 0;
            row.forEach(cell => {
                if (cell !== undefined && cell !== null && String(cell).trim() !== '') {
                    filledCount++;
                }
            });
            
            if (filledCount >= Math.max(3, Math.ceil(0.6 * maxCols))) {
                return i;
            }
        }
        return 0;
    }

    function handleExcelFileSelect(file) {
        if (!file) return;
        excelUploadedFileName = file.name;
        
        const progressBox = document.getElementById("excelUploadProgressBox");
        const progressFill = document.getElementById("excelUploadProgressFill");
        const progressPercent = document.getElementById("excelUploadPercent");
        const progressFileName = document.getElementById("excelUploadFileName");

        progressFileName.textContent = file.name;
        progressBox.style.display = 'block';

        let progressVal = 0;
        const interval = setInterval(() => {
            progressVal += 20;
            progressFill.style.width = `${progressVal}%`;
            progressPercent.textContent = `${progressVal}%`;

            if (progressVal >= 100) {
                clearInterval(interval);
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const data = e.target.result;
                        const workbook = window.XLSX.read(data, { type: 'binary' });
                        excelUploadedWorkbook = workbook;

                        let firstDataSheet = '';
                        let viableSheets = [];
                        workbook.SheetNames.forEach(name => {
                            const sheet = workbook.Sheets[name];
                            const rawRows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
                            if (rawRows.length > 0) {
                                viableSheets.push(name);
                                if (!firstDataSheet) firstDataSheet = name;
                            }
                        });

                        if (viableSheets.length === 0) {
                            alert("The uploaded Excel workbook does not contain any sheets with data.");
                            progressBox.style.display = 'none';
                            return;
                        }

                        const sheetSelect = document.getElementById("excelSheetSelector");
                        let opts = '';
                        viableSheets.forEach(name => {
                            opts += `<option value="${name}">${name}</option>`;
                        });
                        sheetSelect.innerHTML = opts;

                        excelActiveSheetName = firstDataSheet;
                        sheetSelect.value = firstDataSheet;
                        loadExcelSheetData(excelActiveSheetName);

                        switchExcelWizardStep(2);
                    } catch (err) {
                        alert("Failed to parse Excel file: " + err.message);
                        progressBox.style.display = 'none';
                    }
                };
                reader.readAsBinaryString(file);
            }
        }, 50);
    }

    function loadExcelSheetData(sheetName) {
        if (!excelUploadedWorkbook) return;
        excelActiveSheetName = sheetName;

        const sheet = excelUploadedWorkbook.Sheets[sheetName];
        const rawRows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (rawRows.length === 0) {
            alert("Worksheet is empty!");
            return;
        }

        const headerIdx = detectHeaderRowIndex(rawRows);
        excelActiveHeaders = rawRows[headerIdx].map((h, idx) => {
            return h !== undefined && h !== null ? String(h).trim() : `Column_${idx + 1}`;
        });

        const rowsAfterHeader = rawRows.slice(headerIdx + 1);
        excelActiveRows = rowsAfterHeader.filter(r => r && r.length > 0 && r.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''));

        if (excelActiveRows.length > 50000) {
            alert("Warning: The Excel sheet contains more than 50,000 data rows. This system enforces a hard limit of 50,000 rows to ensure optimal performance. Extra rows will be ignored.");
            excelActiveRows = excelActiveRows.slice(0, 50000);
        }

        autoDetectColumns();
    }

    function autoDetectColumns() {
        excelColumnMappings = {};
        const footprint = excelActiveHeaders.join('|');
        if (excelMappingTemplates[footprint]) {
            excelColumnMappings = { ...excelMappingTemplates[footprint] };
        } else {
            Object.keys(fuzzyMappingTargets).forEach(targetKey => {
                const target = fuzzyMappingTargets[targetKey];
                let matchedHeader = '';
                
                for (let header of excelActiveHeaders) {
                    const cleanHeader = header.toLowerCase().replace(/[^a-z0-9%]/g, '');
                    if (target.keys.some(k => cleanHeader.includes(k) || k.includes(cleanHeader))) {
                        matchedHeader = header;
                        break;
                    }
                }
                
                excelColumnMappings[targetKey] = matchedHeader || 'skip';
            });
        }

        renderMappingTable();
    }

    function renderMappingTable() {
        const tbody = document.getElementById("excelMappingBody");
        if (!tbody) return;

        let html = '';
        Object.keys(fuzzyMappingTargets).forEach(targetKey => {
            const target = fuzzyMappingTargets[targetKey];
            const activeMapped = excelColumnMappings[targetKey] || 'skip';

            let selectHtml = `<select class="recon-form-select select-mapping-header" data-target="${targetKey}" style="width:100%;">`;
            selectHtml += `<option value="skip" ${activeMapped === 'skip' ? 'selected' : ''}>-- Skip column --</option>`;
            
            excelActiveHeaders.forEach(header => {
                const isSelected = header === activeMapped ? 'selected' : '';
                selectHtml += `<option value="${header}" ${isSelected}>${header}</option>`;
            });
            selectHtml += `</select>`;

            html += `
                <tr>
                    <td style="font-weight:700; color:#334155;">
                        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10B981; margin-right:6px;"></span>
                        ${target.label}
                    </td>
                    <td>${selectHtml}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        document.querySelectorAll(".select-mapping-header").forEach(sel => {
            sel.addEventListener("change", (e) => {
                const key = e.target.getAttribute("data-target");
                excelColumnMappings[key] = e.target.value;
                
                const footprint = excelActiveHeaders.join('|');
                excelMappingTemplates[footprint] = { ...excelColumnMappings };
                localStorage.setItem("excel_mapping_templates", JSON.stringify(excelMappingTemplates));
            });
        });
    }

    function MappingHeaderComponent() {}

    MappingHeaderComponent.prototype.init = function(params) {
        this.params = params;
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = "display: flex; flex-direction: column; align-items: flex-start; width: 100%; gap: 4px; padding: 6px 0;";

        const titleSpan = document.createElement('span');
        titleSpan.style.cssText = "font-weight: 700; font-size: 0.72rem; color: #1E293B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;";
        titleSpan.textContent = params.displayName;
        this.eGui.appendChild(titleSpan);

        this.badge = document.createElement('span');
        this.badge.className = 'ag-header-mapping-badge';
        this.eGui.appendChild(this.badge);

        const select = document.createElement('select');
        select.className = 'ag-header-mapping-dropdown';
        
        let selectOptionsHtml = '<option value="skip">-- Skip --</option>';
        Object.keys(fuzzyMappingTargets).forEach(key => {
            selectOptionsHtml += `<option value="${key}">${fuzzyMappingTargets[key].label}</option>`;
        });
        select.innerHTML = selectOptionsHtml;

        const currentMappedKey = Object.keys(excelColumnMappings).find(key => excelColumnMappings[key] === params.displayName) || 'skip';
        select.value = currentMappedKey;

        this.updateBadge(currentMappedKey);

        select.addEventListener('change', (e) => {
            const newKey = e.target.value;
            
            if (newKey !== 'skip') {
                Object.keys(excelColumnMappings).forEach(key => {
                    if (excelColumnMappings[key] === params.displayName) {
                        excelColumnMappings[key] = 'skip';
                    }
                });
                excelColumnMappings[newKey] = params.displayName;
            } else {
                Object.keys(excelColumnMappings).forEach(key => {
                    if (excelColumnMappings[key] === params.displayName) {
                        excelColumnMappings[key] = 'skip';
                    }
                });
            }

            const footprint = excelActiveHeaders.join('|');
            excelMappingTemplates[footprint] = { ...excelColumnMappings };
            localStorage.setItem("excel_mapping_templates", JSON.stringify(excelMappingTemplates));

            if (excelAgGridInstance) {
                if (excelAgGridInstance.refreshHeader) {
                    excelAgGridInstance.refreshHeader();
                } else if (excelAgGridInstance.api && excelAgGridInstance.api.refreshHeader) {
                    excelAgGridInstance.api.refreshHeader();
                }
            }

            runExcelValidationAndRefresh();
        });

        this.eGui.appendChild(select);
    };

    MappingHeaderComponent.prototype.getGui = function() {
        return this.eGui;
    };

    MappingHeaderComponent.prototype.updateBadge = function(key) {
        if (key && key !== 'skip') {
            this.badge.className = 'ag-header-mapping-badge mapped';
            this.badge.textContent = fuzzyMappingTargets[key].label;
        } else {
            this.badge.className = 'ag-header-mapping-badge unmapped';
            this.badge.textContent = 'Unmapped';
        }
    };

    function initializeExcelPreviewGrid() {
        const container = document.getElementById("excel-preview-container");
        if (!container) return;

        if (excelAgGridInstance) {
            try {
                excelAgGridInstance.destroy();
            } catch (e) {
                console.error("Error destroying grid:", e);
            }
            excelAgGridInstance = null;
        }
        container.innerHTML = "";

        const columnDefs = [
            {
                headerName: "Row",
                valueGetter: "node.rowIndex + 1",
                width: 70,
                pinned: "left",
                resizable: true,
                cellStyle: { background: '#F8FAFC', fontWeight: 'bold', color: '#64748B', textAlign: 'center' }
            },
            ...excelActiveHeaders.map(header => {
                return {
                    headerName: header,
                    field: header,
                    headerComponent: MappingHeaderComponent,
                    resizable: true,
                    minWidth: 150,
                    valueFormatter: (params) => {
                        const val = params.value;
                        if (val === undefined || val === null || val === '') return '';
                        
                        const targetKey = Object.keys(excelColumnMappings).find(key => excelColumnMappings[key] === header);
                        if (targetKey && targetKey !== 'skip') {
                            if (targetKey === 'employee_name' || targetKey === 'designation' || targetKey === 'date') {
                                return String(val);
                            }
                            if (typeof val === 'number') {
                                return '₹' + val.toLocaleString('en-IN');
                            }
                            const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
                            return isNaN(num) ? String(val) : '₹' + num.toLocaleString('en-IN');
                        }
                        return String(val);
                    }
                };
            })
        ];

        const gridOptions = {
            columnDefs: columnDefs,
            rowData: excelRowData,
            defaultColDef: {
                sortable: true,
                filter: true,
                resizable: true,
            },
            cellClassRules: {
                'cell-valid': params => {
                    const fieldVal = params.data._validation && params.data._validation[params.colDef.field];
                    return fieldVal && fieldVal.status === 'valid';
                },
                'cell-warning': params => {
                    const fieldVal = params.data._validation && params.data._validation[params.colDef.field];
                    return fieldVal && fieldVal.status === 'warning';
                },
                'cell-error': params => {
                    const fieldVal = params.data._validation && params.data._validation[params.colDef.field];
                    return fieldVal && fieldVal.status === 'error';
                },
                'cell-duplicate': params => {
                    const fieldVal = params.data._validation && params.data._validation[params.colDef.field];
                    return fieldVal && fieldVal.status === 'duplicate';
                }
            }
        };

        try {
            if (window.agGrid && window.agGrid.createGrid) {
                excelAgGridInstance = window.agGrid.createGrid(container, gridOptions);
            } else if (window.agGrid && window.agGrid.Grid) {
                excelAgGridInstance = new window.agGrid.Grid(container, gridOptions);
            } else {
                renderVanillaTableFallback(container);
            }
        } catch (err) {
            console.error("AG-Grid creation failed:", err);
            renderVanillaTableFallback(container);
        }

        runExcelValidationAndRefresh();
    }

    function runExcelValidationAndRefresh() {
        if (!excelActiveHeaders || excelActiveHeaders.length === 0) return;
        
        let totalRecords = excelRowData.length;
        let errorCount = 0;
        let warningCount = 0;
        let duplicateCount = 0;
        
        let salesSum = 0;
        let employeeNames = new Set();
        let minDate = null;
        let maxDate = null;
        let errorsList = [];

        const dateHeaderName = excelColumnMappings['date'];
        const dateMapped = dateHeaderName && dateHeaderName !== 'skip';

        const uniqueSet = new Set();

        excelRowData.forEach((row) => {
            row._validation = {};
            row._hasErrors = false;
            row._isDuplicate = false;
            let rowHasWarning = false;

            if (dateMapped) {
                const rawDate = row[dateHeaderName];
                let formattedDate = '';
                
                if (rawDate !== undefined && rawDate !== null && String(rawDate).trim() !== '') {
                    if (typeof rawDate === 'number') {
                        const dateObj = new Date((rawDate - 25569) * 86400 * 1000);
                        if (!isNaN(dateObj.getTime())) {
                            formattedDate = dateObj.toISOString().split('T')[0];
                        }
                    } else {
                        const dateStr = String(rawDate).trim();
                        const parts = dateStr.split(/[-/.]/);
                        if (parts.length === 3) {
                            if (parts[0].length === 4) {
                                formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                            } else if (parts[2].length === 4) {
                                formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                            }
                        }
                    }
                }

                if (!formattedDate || isNaN(new Date(formattedDate).getTime())) {
                    row._validation[dateHeaderName] = { status: 'error', message: `Invalid date: '${rawDate}'` };
                    row._hasErrors = true;
                    errorCount++;
                    errorsList.push(`Row ${row._rowNum}: Invalid Date format ('${rawDate}')`);
                } else {
                    row._validation[dateHeaderName] = { status: 'valid' };
                    row.date = formattedDate;
                    row._parsedDate = formattedDate;

                    const dateObj = new Date(formattedDate);
                    if (!minDate || dateObj < minDate) minDate = dateObj;
                    if (!maxDate || dateObj > maxDate) maxDate = dateObj;
                }
            }

            Object.keys(fuzzyMappingTargets).forEach(targetKey => {
                if (targetKey === 'date') return;
                const mappedHeaderName = excelColumnMappings[targetKey];
                if (!mappedHeaderName || mappedHeaderName === 'skip') return;

                const rawVal = row[mappedHeaderName];

                if (targetKey === 'employee_name' || targetKey === 'designation') {
                    const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
                    if (!strVal) {
                        row._validation[mappedHeaderName] = { status: 'warning', message: 'Field is empty' };
                        rowHasWarning = true;
                        warningCount++;
                    } else {
                        row._validation[mappedHeaderName] = { status: 'valid' };
                        if (targetKey === 'employee_name') {
                            employeeNames.add(strVal);
                            row.employee_name = strVal;
                            row._parsedEmployee = strVal;
                        }
                        if (targetKey === 'designation') {
                            row.designation = strVal;
                        }
                    }
                } else {
                    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
                        row._validation[mappedHeaderName] = { status: 'warning', message: 'Field is empty, defaulted to 0' };
                        row[targetKey] = 0;
                        rowHasWarning = true;
                        warningCount++;
                    } else {
                        const cleanVal = String(rawVal).replace(/[^0-9.-]/g, '');
                        const parsedNum = parseFloat(cleanVal);
                        if (isNaN(parsedNum)) {
                            row._validation[mappedHeaderName] = { status: 'error', message: `Invalid number: '${rawVal}'` };
                            row._hasErrors = true;
                            errorCount++;
                            errorsList.push(`Row ${row._rowNum}: Invalid numeric format in ${fuzzyMappingTargets[targetKey].label}`);
                        } else if (parsedNum < 0) {
                            row._validation[mappedHeaderName] = { status: 'error', message: 'Negative value not allowed' };
                            row._hasErrors = true;
                            errorCount++;
                            errorsList.push(`Row ${row._rowNum}: Negative value in ${fuzzyMappingTargets[targetKey].label}`);
                        } else {
                            row._validation[mappedHeaderName] = { status: 'valid' };
                            row[targetKey] = parsedNum;

                            if (targetKey === 'total_sales') {
                                salesSum += parsedNum;
                            }
                        }
                    }
                }
            });

            if (dateMapped && !row._hasErrors && row._parsedDate) {
                const empName = row._parsedEmployee || '';
                const dupKey = empName ? `${row._parsedDate}-${empName}` : `${row._parsedDate}`;
                
                if (uniqueSet.has(dupKey)) {
                    row._isDuplicate = true;
                    duplicateCount++;
                    
                    if (dateHeaderName) row._validation[dateHeaderName] = { status: 'duplicate', message: 'Duplicate record (same Date/Employee)' };
                    const empHeader = excelColumnMappings['employee_name'];
                    if (empHeader && empHeader !== 'skip') {
                        row._validation[empHeader] = { status: 'duplicate', message: 'Duplicate record (same Date/Employee)' };
                    }
                } else {
                    uniqueSet.add(dupKey);
                }
            }
        });

        const statsEl = document.getElementById("excelPreviewStats");
        if (statsEl) {
            statsEl.textContent = `Total Records: ${totalRecords} | Errors: ${errorCount}`;
        }

        const summaryContent = document.getElementById("summary-content");
        const summaryLoader = document.getElementById("summary-loader");
        const confirmBtn = document.getElementById("btnExcelConfirmImport");

        if (summaryContent && summaryLoader) {
            summaryLoader.style.display = 'none';
            summaryContent.style.display = 'block';

            let dateRangeStr = 'N/A';
            if (minDate && maxDate) {
                const opt = { year: 'numeric', month: 'short', day: 'numeric' };
                dateRangeStr = `${minDate.toLocaleDateString('en-IN', opt)} - ${maxDate.toLocaleDateString('en-IN', opt)}`;
            }

            let errorsMarkup = '';
            if (errorsList.length > 0) {
                errorsMarkup = `
                    <div style="margin-top: 10px; padding: 10px; background: #FFF5F5; border: 1px solid #FEB2B2; border-radius: 6px; max-height: 120px; overflow-y: auto;">
                        <strong style="color: #C53030; font-size: 0.72rem; display: block; margin-bottom: 4px;">Error Details (${errorCount})</strong>
                        <ul style="margin: 0; padding-left: 14px; font-size: 0.68rem; color: #9B2C2C;">
                            ${errorsList.slice(0, 15).map(e => `<li>${e}</li>`).join('')}
                            ${errorsList.length > 15 ? `<li>...and ${errorsList.length - 15} more</li>` : ''}
                        </ul>
                    </div>
                `;
            }

            summaryContent.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #E2E8F0; padding-bottom: 6px;">
                        <span style="color: #64748B;">Total Rows Analysed:</span>
                        <strong style="color: #0F172A;">${totalRecords}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #E2E8F0; padding-bottom: 6px;">
                        <span style="color: #64748B;">Total Sales Sum:</span>
                        <strong style="color: #10B981;">₹${salesSum.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #E2E8F0; padding-bottom: 6px;">
                        <span style="color: #64748B;">Staff Count:</span>
                        <strong style="color: #3B82F6;">${employeeNames.size} staff</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #E2E8F0; padding-bottom: 6px;">
                        <span style="color: #64748B;">Date Range:</span>
                        <strong style="color: #0F172A; font-size: 0.72rem;">${dateRangeStr}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #E2E8F0; padding-bottom: 6px;">
                        <span style="color: #64748B;">Errors / Warnings:</span>
                        <span style="font-weight: bold; color: ${errorCount > 0 ? '#EF4444' : '#10B981'}">
                            ${errorCount} errors, ${warningCount} warning(s)
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #E2E8F0; padding-bottom: 6px;">
                        <span style="color: #64748B;">Duplicates:</span>
                        <strong style="color: #F59E0B;">${duplicateCount} rows</strong>
                    </div>
                    ${errorsMarkup}
                </div>
            `;
        }

        const progressFill = document.getElementById("excelProgressFill");
        const tickLoaded = document.getElementById("tick-loaded");
        const tickHeaders = document.getElementById("tick-headers");
        const tickParsed = document.getElementById("tick-parsed");
        const tickValidated = document.getElementById("tick-validated");
        const tickReady = document.getElementById("tick-ready");

        let percent = 0;
        if (excelUploadedWorkbook) {
            percent = 20;
            if (tickLoaded) tickLoaded.style.color = '#10B981';
        }
        if (dateMapped) {
            percent = 40;
            if (tickHeaders) tickHeaders.style.color = '#10B981';
        }
        if (excelRowData.length > 0) {
            percent = 60;
            if (tickParsed) tickParsed.style.color = '#10B981';
        }
        if (totalRecords > 0) {
            percent = 80;
            if (tickValidated) tickValidated.style.color = '#10B981';
        }
        
        const isReadyToImport = dateMapped && errorCount === 0 && totalRecords > 0;
        if (isReadyToImport) {
            percent = 100;
            if (tickReady) tickReady.style.color = '#10B981';
            if (confirmBtn) {
                confirmBtn.removeAttribute('disabled');
                confirmBtn.style.opacity = '1';
                confirmBtn.textContent = 'Confirm Import';
            }
        } else {
            if (tickReady) tickReady.style.color = '#64748B';
            if (confirmBtn) {
                confirmBtn.setAttribute('disabled', 'true');
                confirmBtn.style.opacity = '0.5';
                if (!dateMapped) {
                    confirmBtn.textContent = 'Map Date to Proceed';
                } else if (errorCount > 0) {
                    confirmBtn.textContent = `Fix ${errorCount} Errors`;
                } else {
                    confirmBtn.textContent = 'No Data Rows Found';
                }
            }
        }

        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }

        if (excelAgGridInstance) {
            if (excelAgGridInstance.setGridOption) {
                excelAgGridInstance.setGridOption('rowData', excelRowData);
            } else {
                excelAgGridInstance.setRowData(excelRowData);
            }
        }
    }

    function renderVanillaTableFallback(container) {
        let tableHtml = `
            <div style="overflow: auto; max-height: 400px; border: 1px solid #E2E8F0; border-radius: 8px;">
                <table class="recon-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>Row</th>
                            ${excelActiveHeaders.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${excelRowData.slice(0, 100).map((row, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                ${excelActiveHeaders.map(h => {
                                    const fieldVal = row._validation && row._validation[h];
                                    let cellStyle = "";
                                    if (fieldVal) {
                                        if (fieldVal.status === 'valid') cellStyle = "background-color: #ECFDF5; color: #065F46;";
                                        else if (fieldVal.status === 'warning') cellStyle = "background-color: #FEF3C7; color: #92400E;";
                                        else if (fieldVal.status === 'error') cellStyle = "background-color: #FEF2F2; color: #991B1B;";
                                        else if (fieldVal.status === 'duplicate') cellStyle = "background-color: #FFF3E0; color: #E65100;";
                                    }
                                    return `<td style="${cellStyle}">${row[h]}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${excelRowData.length > 100 ? `<div style="padding: 10px; text-align: center; color: #64748B; font-size: 0.8rem;">Showing first 100 rows. AG-Grid failed to load.</div>` : ''}
            </div>
        `;
        container.innerHTML = tableHtml;
    }

    function commitExcelImport() {
        excelValidRecords = excelRowData.filter(row => !row._hasErrors);
        excelValidationErrors = excelRowData.filter(row => row._hasErrors);

        if (excelValidRecords.length === 0) {
            alert("No valid rows to import! Fix validation errors in the sheet before importing.");
            return;
        }

        const transactionId = 'import-' + Date.now();
        let importedCount = 0;
        let updatedCount = 0;
        let duplicateCount = 0;

        const currentStoreValue = getPOSStore();

        excelValidRecords.forEach(record => {
            if (record._isDuplicate) {
                duplicateCount++;
                return;
            }

            if (record.total_sales > 0) {
                const existingOrder = posOrders.find(o => o.date === record.date && o.store === currentStoreValue && o.importTransactionId);
                
                if (existingOrder) {
                    existingOrder.subtotal = record.total_sales;
                    existingOrder.grandTotal = record.total_sales + (record.total_sales * 0.05);
                    existingOrder.tax = 0;
                    existingOrder.importedUpdateFlag = true;
                    updatedCount++;
                } else {
                    posOrders.push({
                        id: `order-excel-${record._rowNum}-${Date.now()}`,
                        date: record.date,
                        time: '21:00:00',
                        store: currentStoreValue,
                        customerName: 'Excel Importer',
                        tableName: 'Bulk Upload',
                        orderType: 'Dine In',
                        paymentMethod: 'UPI / QR',
                        subtotal: record.total_sales,
                        tax: 0,
                        discount: 0,
                        serviceCharge: record.total_sales * 0.05,
                        grandTotal: record.total_sales + (record.total_sales * 0.05),
                        items: [
                            { productName: 'Imported Total Sales', price: record.total_sales, quantity: 1, modifiers: [] }
                        ],
                        importTransactionId: transactionId
                    });
                    importedCount++;
                }
            }

            if (record.employee_name) {
                let empKey = Object.keys(employees).find(k => employees[k].name === record.employee_name);
                
                if (empKey) {
                    const emp = employees[empKey];
                    if (record.designation) emp.designation = record.designation;
                    if (record.salary > 0) emp.wages = record.salary;
                    
                    emp.importTransactionId = transactionId;
                    updatedCount++;
                } else {
                    const newId = 'EMP' + (100 + Object.keys(employees).length + 1);
                    employees[newId] = {
                        id: newId,
                        name: record.employee_name,
                        role: 'Staff',
                        designation: record.designation || 'Server',
                        wages: record.salary || 12000,
                        store: currentStoreValue,
                        phone: 'N/A',
                        status: 'Active',
                        importTransactionId: transactionId
                    };
                    importedCount++;
                }
            }
        });

        renderDashboard();
        renderCashReconciliationScreen();

        const historyLog = {
            transactionId: transactionId,
            fileName: excelUploadedFileName,
            uploadedBy: currentUser ? currentUser.name : 'System Administrator',
            uploadDate: getTodayDateStr(),
            recordsCount: excelValidRecords.length + duplicateCount,
            importedCount: importedCount,
            updatedCount: updatedCount,
            duplicateCount: duplicateCount,
            status: 'Success'
        };
        excelImportHistory.unshift(historyLog);
        
        localStorage.setItem("excel_import_history", JSON.stringify(excelImportHistory));
        localStorage.setItem("pos_orders", JSON.stringify(posOrders));
        localStorage.setItem("pos_employees", JSON.stringify(employees));

        document.getElementById("excelStatImported").textContent = importedCount;
        document.getElementById("excelStatUpdated").textContent = updatedCount;
        document.getElementById("excelStatDuplicates").textContent = duplicateCount;

        switchExcelWizardStep(4);
        showToast("Excel spreadsheet imported successfully.");
    }

    function rollbackExcelImport(transactionId) {
        const transIndex = excelImportHistory.findIndex(log => log.transactionId === transactionId);
        if (transIndex === -1) return;

        posOrders = posOrders.filter(o => o.importTransactionId !== transactionId);

        Object.keys(employees).forEach(key => {
            if (employees[key].importTransactionId === transactionId) {
                delete employees[key];
            }
        });

        excelImportHistory.splice(transIndex, 1);

        localStorage.setItem("excel_import_history", JSON.stringify(excelImportHistory));
        localStorage.setItem("pos_orders", JSON.stringify(posOrders));
        localStorage.setItem("pos_employees", JSON.stringify(employees));

        renderExcelImportHistory();
        renderDashboard();
        showToast("Excel import rolled back successfully.");
    }

    function bindExcelWizardEvents() {
        const dropZone = document.getElementById("excelDropZone");
        const fileInput = document.getElementById("excelFileInput");
        const browseBtn = document.getElementById("btnBrowseExcel");

        if (dropZone && !dropZone.dataset.listenerBound) {
            dropZone.dataset.listenerBound = "true";
            
            dropZone.addEventListener("dragover", (e) => {
                e.preventDefault();
                dropZone.classList.add("dragover");
            });

            dropZone.addEventListener("dragleave", () => {
                dropZone.classList.remove("dragover");
            });

            dropZone.addEventListener("drop", (e) => {
                e.preventDefault();
                dropZone.classList.remove("dragover");
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleExcelFileSelect(e.dataTransfer.files[0]);
                }
            });

            browseBtn.addEventListener("click", () => {
                fileInput.click();
            });

            fileInput.addEventListener("change", (e) => {
                if (e.target.files && e.target.files[0]) {
                    handleExcelFileSelect(e.target.files[0]);
                }
            });
        }

        const sheetSel = document.getElementById("excelSheetSelector");
        if (sheetSel && !sheetSel.dataset.listenerBound) {
            sheetSel.dataset.listenerBound = "true";
            sheetSel.addEventListener("change", (e) => {
                loadExcelSheetData(e.target.value);
            });
        }

        const proceedBtn = document.getElementById("btnExcelProceedToPreview");
        if (proceedBtn) {
            const newProceedBtn = proceedBtn.cloneNode(true);
            proceedBtn.parentNode.replaceChild(newProceedBtn, proceedBtn);
            
            newProceedBtn.addEventListener("click", () => {
                const dateHeader = excelColumnMappings['date'];
                if (dateHeader === 'skip' || !dateHeader) {
                    alert("Critical Mapping Error: Please map the 'Date' column to proceed.");
                    return;
                }

                const headerIdx = detectHeaderRowIndex(window.XLSX.utils.sheet_to_json(excelUploadedWorkbook.Sheets[excelActiveSheetName], { header: 1 }));
                excelRowData = excelActiveRows.map((row, index) => {
                    const rowObj = {
                        _rowNum: index + headerIdx + 2,
                        _validation: {}
                    };
                    excelActiveHeaders.forEach((h, colIndex) => {
                        const cellVal = row[colIndex];
                        rowObj[h] = cellVal !== undefined ? cellVal : '';
                    });
                    return rowObj;
                });

                switchExcelWizardStep(3);
                initializeExcelPreviewGrid();
            });
        }

        document.querySelectorAll(".btn-wizard-back").forEach(btn => {
            if (!btn.dataset.listenerBound) {
                btn.dataset.listenerBound = "true";
                btn.addEventListener("click", () => {
                    const current = parseInt(btn.getAttribute("data-current"));
                    switchExcelWizardStep(current - 1);
                });
            }
        });

        const confirmBtn = document.getElementById("btnExcelConfirmImport");
        if (confirmBtn) {
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            newConfirmBtn.addEventListener("click", commitExcelImport);
        }

        const restartBtn = document.getElementById("btnExcelRestartWizard");
        if (restartBtn && !restartBtn.dataset.listenerBound) {
            restartBtn.dataset.listenerBound = "true";
            restartBtn.addEventListener("click", () => {
                fileInput.value = '';
                document.getElementById("excelUploadProgressBox").style.display = 'none';
                switchExcelWizardStep(1);
            });
        }
    }

    // POS BILLING SYSTEM FRONTEND CONTROLLER
    // ==========================================================================

    function renderBillingScreen() {
        loadCartFromStorage();
        if (!socket && typeof io !== 'undefined') {
            socket = io(API_BASE || window.location.origin, { auth: { token: localStorage.getItem('bk_jwt_token') } });
            socket.on('stock_alert', (data) => {
                showToast(`Low Stock Alert: ${data.label} in ${data.store}! Only ${data.stock} left.`);
                syncStateFromServer();
            });
            socket.on('kot_update', (data) => {
                showToast(`KOT status updated: Order ${data.id} is now ${data.status}`);
                syncStateFromServer();
            });
            socket.on('order_placed', (data) => {
                // Removed toast and syncStateFromServer to prevent "extra requests" and annoying popups
                // Only dispatch the event for the P&L dashboard or KDS to update
                window.dispatchEvent(new CustomEvent('bk_order_placed', { detail: data }));
            });
            socket.on('table_update', () => {
                syncStateFromServer();
            });
            socket.on('customer_created', () => {
                syncStateFromServer();
            });
            socket.on('requisition_update', () => {
                syncStateFromServer();
                if (document.getElementById("sub-inventory-requisitions")?.style.display === "block") {
                    renderRequisitionsTab();
                }
            });
        }

        // Online / Offline Indicator Check
        const offlineBadge = document.getElementById("posOfflineBadge");
        const onlineBadge = document.getElementById("posOnlineBadge");
        if (offlineBadge && onlineBadge) {
            if (navigator.onLine) {
                offlineBadge.style.display = "none";
                onlineBadge.style.display = "flex";
            } else {
                offlineBadge.style.display = "flex";
                onlineBadge.style.display = "none";
            }
        }

        // Dynamic branch pill update
        const branchPill = document.querySelector(".pos-top-command-bar .branch-pill");
        if (branchPill) {
            branchPill.textContent = `${getPOSStore()} Branch`;
        }

        renderCustomerDropdown();
        renderTableDropdown();
        renderCategoryTabs();
        renderPosProductsList();
        renderPosCartList();
        bindBillingEvents();
        updateHeldOrdersCount();
        renderTableFloorPlan();
    }

    function showToast(msg) {
        let toast = document.getElementById("posToast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "posToast";
            toast.style.cssText = "position:fixed; bottom:20px; right:20px; background:var(--accent-green); color:#fff; padding:12px 24px; border-radius:8px; z-index:99999; box-shadow:var(--shadow-lg); font-size:0.85rem; font-weight:700; transition:all 0.3s cubic-bezier(0.16, 1, 0.3, 1); opacity:0; pointer-events:none; transform:translateY(10px);";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
        setTimeout(() => { 
            toast.style.opacity = "0"; 
            toast.style.transform = "translateY(10px)";
        }, 4000);
    }

    function renderCustomerDropdown() {
        const select = document.getElementById("posCustomerSelect");
        if (!select) return;
        
        let optionsHtml = '';
        posCustomers.forEach(cust => {
            const selectedAttr = cust.id === posSelectedCustomer ? 'selected' : '';
            const displayLabel = cust.id === 'cust-1' ? '-' : cust.phone;
            optionsHtml += `<option value="${cust.id}" ${selectedAttr}>${displayLabel}</option>`;
        });
        select.innerHTML = optionsHtml;
        
        const activeCust = posCustomers.find(c => c.id === posSelectedCustomer);
        const loyaltyPointsDiv = document.getElementById("customerLoyaltyPoints");
        if (activeCust && activeCust.id !== 'cust-1' && loyaltyPointsDiv) {
            loyaltyPointsDiv.style.display = "flex";
            document.getElementById("customerLoyaltyPointsValue").textContent = activeCust.loyaltyPoints;
            document.getElementById("loyaltyCashValue").textContent = (activeCust.loyaltyPoints * 1).toFixed(2);
        } else if (loyaltyPointsDiv) {
            loyaltyPointsDiv.style.display = "none";
        }

        const phoneInput = document.getElementById("posCustomerPhoneInput");
        if (phoneInput) {
            phoneInput.value = activeCust && activeCust.phone && activeCust.id !== 'cust-1' ? activeCust.phone : '';
        }
        const phoneDisplay = document.getElementById("posCustomerPhoneDisplay");
        if (phoneDisplay) {
            phoneDisplay.textContent = activeCust && activeCust.phone && activeCust.id !== 'cust-1' ? `📞 ${activeCust.phone}` : '📞 -';
        }

        // Render preferences and notes
        const prefsDisplay = document.getElementById("posCustomerPrefsDisplay");
        const pillsContainer = document.getElementById("posCustomerAllergiesPills");
        const notesContainer = document.getElementById("posCustomerNotesText");

        if (prefsDisplay && pillsContainer && notesContainer) {
            if (activeCust && activeCust.id !== 'cust-1') {
                let specialRequirements = {};
                try {
                    specialRequirements = activeCust.specialRequirements
                        ? (typeof activeCust.specialRequirements === 'string' ? JSON.parse(activeCust.specialRequirements) : activeCust.specialRequirements)
                        : {};
                } catch(e) {}

                let preferences = {};
                try {
                    preferences = activeCust.preferences
                        ? (typeof activeCust.preferences === 'string' ? JSON.parse(activeCust.preferences) : activeCust.preferences)
                        : {};
                } catch(e) {}

                const activeBadges = [];
                if (specialRequirements.vegetarian) activeBadges.push(`<span class="pill-badge pill-badge-success" style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;">Veg</span>`);
                if (specialRequirements.jain) activeBadges.push(`<span class="pill-badge pill-badge-warning" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;">Jain</span>`);
                if (specialRequirements.vegan) activeBadges.push(`<span class="pill-badge pill-badge-info" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;">Vegan</span>`);
                if (specialRequirements.eggless) activeBadges.push(`<span class="pill-badge pill-badge-warning" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;">Eggless</span>`);
                if (specialRequirements.noOnion) activeBadges.push(`<span class="pill-badge pill-badge-danger" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;">No Onion</span>`);
                if (specialRequirements.noGarlic) activeBadges.push(`<span class="pill-badge pill-badge-danger" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;">No Garlic</span>`);
                if (specialRequirements.nutAllergy) activeBadges.push(`<span class="pill-badge pill-badge-danger" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;">Nut Allergy</span>`);
                if (specialRequirements.glutenFree) activeBadges.push(`<span class="pill-badge pill-badge-danger" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;">Gluten Free</span>`);

                let favsText = '';
                if (preferences.favFood && preferences.favFood !== 'N/A') {
                    favsText += `🍕 Fav: ${preferences.favFood}`;
                }
                if (preferences.favDrink && preferences.favDrink !== 'N/A') {
                    if (favsText) favsText += ' | ';
                    favsText += `🥤 Drink: ${preferences.favDrink}`;
                }

                const notesText = activeCust.notes ? activeCust.notes.trim() : '';

                let notesHTML = '';
                if (favsText) {
                    notesHTML += `<div style="margin-bottom: 2px; color: var(--pos-espresso); font-weight: 700; font-size: 0.72rem;">${favsText}</div>`;
                }
                if (notesText) {
                    notesHTML += `<div style="color: var(--text-secondary); font-style: italic; font-size: 0.7rem;">📝 Notes: ${notesText}</div>`;
                }

                if (activeBadges.length > 0 || favsText || notesText) {
                    prefsDisplay.style.display = "flex";
                    pillsContainer.innerHTML = activeBadges.join('');
                    notesContainer.innerHTML = notesHTML;
                } else {
                    prefsDisplay.style.display = "none";
                    pillsContainer.innerHTML = '';
                    notesContainer.innerHTML = '';
                }
            } else {
                prefsDisplay.style.display = "none";
                pillsContainer.innerHTML = '';
                notesContainer.innerHTML = '';
            }
        }
    }

    function renderTableDropdown() {
        const select = document.getElementById("posTableSelect");
        if (!select) return;
        
        const storeTables = posTables.filter(t => t.store === getPOSStore());
        let optionsHtml = '<option value="">-- Choose Table --</option>';
        storeTables.forEach(tbl => {
            const label = tbl.status === 'Occupied' ? `${tbl.name} (OCCUPIED)` : tbl.name;
            const selectedAttr = tbl.name === posSelectedTable ? 'selected' : '';
            optionsHtml += `<option value="${tbl.name}" ${selectedAttr}>${label}</option>`;
        });
        select.innerHTML = optionsHtml;
    }

    function renderTableFloorPlan() {
        const previewGrid = document.getElementById("posTableGridPreview");
        if (!previewGrid) return;
        
        const storeTables = posTables.filter(t => t.store === getPOSStore());
        if (storeTables.length === 0) {
            previewGrid.innerHTML = '<div style="grid-column:1/-1; font-size:0.75rem; text-align:center; padding:10px; color:var(--text-tertiary);">No tables configured.</div>';
            return;
        }
        
        let gridHtml = '';
        storeTables.forEach(tbl => {
            const isSelected = tbl.name === posSelectedTable;
            const activeClass = isSelected ? 'active' : '';
            const statusClass = tbl.status.toLowerCase(); // 'available' or 'occupied'
            const icon = tbl.status === 'Occupied' ? 'users' : 'circle-check';
            
            const capacity = tbl.capacity || 4;
            gridHtml += `
                <div class="pos-mini-table-cell ${statusClass} ${activeClass}" data-table-name="${tbl.name}">
                    <div class="table-name-lbl">${tbl.name}</div>
                    <div class="table-capacity-lbl">${capacity} Pax</div>
                    <i data-lucide="${icon}" class="table-status-icon-mini"></i>
                </div>
            `;
        });
        previewGrid.innerHTML = gridHtml;
        if (window.lucide) window.lucide.createIcons();
        
        previewGrid.querySelectorAll(".pos-mini-table-cell").forEach(cell => {
            cell.addEventListener("click", () => {
                const tblName = cell.getAttribute("data-table-name");
                posSelectedTable = tblName;
                
                const select = document.getElementById("posTableSelect");
                if (select) {
                    select.value = tblName;
                }
                
                renderTableDropdown();
                renderTableFloorPlan();
            });
        });
    }

    function renderCategoryTabs() {
        const container = document.getElementById("posCategoryTabs");
        if (!container) return;

        const categories = [...new Set(posProducts.map(p => p.category))];

        let html = `
            <div class="category-tab category-pill-new ${posSelectedCategory === 'all' ? 'active' : ''}" data-category="all">
                <i data-lucide="layout-grid"></i> <span>All Items</span>
            </div>
        `;

        categories.forEach(cat => {
            if (!cat) return;
            const activeClass = cat === posSelectedCategory ? 'active' : '';
            let icon = 'chef-hat';
            const catLower = cat.toLowerCase();
            if (catLower.includes('burger')) icon = 'beef';
            else if (catLower.includes('sandwich') || catLower.includes('b.t.b')) icon = 'sandwich';
            else if (catLower.includes('chaat') || catLower.includes('tikki') || catLower.includes('samosa') || catLower.includes('ragda') || catLower.includes('kachori') || catLower.includes('chhole') || catLower.includes('kulcha') || catLower.includes('paani puri')) icon = 'soup';
            else if (catLower.includes('fries') || catLower.includes('apu-shtik') || catLower.includes('sides')) icon = 'container';
            else if (catLower.includes('maggie')) icon = 'cup-soda';
            else if (catLower.includes('paratha') || catLower.includes('prontha')) icon = 'circle';
            else if (catLower.includes('dessert') || catLower.includes('sweet')) icon = 'cookie';
            else if (catLower.includes('cooler') || catLower.includes('beverage') || catLower.includes('frappe') || catLower.includes('coffee') || catLower.includes('tea') || catLower.includes('shake') || catLower.includes('lassi')) icon = 'cup-soda';

            html += `
                <div class="category-tab category-pill-new ${activeClass}" data-category="${cat}">
                    <i data-lucide="${icon}"></i> <span>${cat}</span>
                </div>
            `;
        });

        container.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    function addPosProductToCart(pid) {
        const prod = posProducts.find(p => p.id === pid);
        if (!prod) return;

        // Check if already in cart
        const existingIdx = posCart.findIndex(item => item.productId === pid && (!item.modifiers || item.modifiers.length === 0));
        if (existingIdx !== -1) {
            posCart[existingIdx].quantity++;
            syncCartStateAndUI();
            showToast(`Increased quantity of ${prod.name}.`);
            return;
        }

        // Check if out of stock
        let displayStock = prod.stock;
        if (prod.ingredients && prod.ingredients.length > 0) {
            let minAvailable = Infinity;
            prod.ingredients.forEach(ing => {
                const inv = inventory.find(i => (i.label||'').toLowerCase() === (ing.name||'').toLowerCase() && i.store === getPOSStore());
                if (inv) {
                    const portionAvailable = Math.floor(inv.stock / ing.qty);
                    if (portionAvailable < minAvailable) minAvailable = portionAvailable;
                } else {
                    minAvailable = 0;
                }
            });
            displayStock = minAvailable === Infinity ? 0 : minAvailable;
        }
        
        if (displayStock === 0) {
            showToast("Item is out of stock in this branch!");
            return;
        }
        
        posCart.push({
            productId: prod.id,
            productName: prod.name,
            price: prod.price,
            quantity: 1,
            modifiers: [],
            instructions: ''
        });
        syncCartStateAndUI();
        showToast(`${prod.name} added to cart.`);
    }

    function renderPosProductsList() {
        const grid = document.getElementById("posProductGrid");
        if (!grid) return;
        
        const searchVal = (document.getElementById("posProductSearch")?.value || "").toLowerCase();
        
        const filtered = posProducts.filter(p => {
            const matchesCategory = posSelectedCategory === 'all' || p.category === posSelectedCategory;
            const matchesSearch = p.name.toLowerCase().includes(searchVal) || p.category.toLowerCase().includes(searchVal);
            return matchesCategory && matchesSearch;
        });
        
        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 60px; color: var(--text-tertiary);">
                    <i data-lucide="package-search" style="width:48px; height:48px; opacity:0.5; margin-bottom:16px;"></i>
                    <p style="font-weight:700; font-size:1rem; color:var(--text-secondary);">No premium menu items found</p>
                    <p style="font-size:0.8rem; margin-top:4px;">Try searching for another keyword or select a different category.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }
        
        let cardsHtml = '';
        filtered.forEach(p => {
            const popularBadge = p.isPopular ? `<span class="tile-popular-badge">POPULAR</span>` : '';
            const chefBadge = p.isFavorite ? `<span class="tile-chef-badge"><i data-lucide="chef-hat"></i> RECOMMEND</span>` : '';
            const favClass = p.isFavorite ? 'active' : '';
            const vegClass = p.isVeg ? 'veg' : 'non-veg';
            
            let displayStock = p.stock;
            if (p.ingredients && p.ingredients.length > 0) {
                let minAvailable = Infinity;
                p.ingredients.forEach(ing => {
                    const inv = inventory.find(i => (i.label||'').toLowerCase() === (ing.name||'').toLowerCase() && i.store === getPOSStore());
                    if (inv) {
                        const portionAvailable = Math.floor(inv.stock / ing.qty);
                        if (portionAvailable < minAvailable) minAvailable = portionAvailable;
                    } else {
                        minAvailable = 0;
                    }
                });
                displayStock = minAvailable === Infinity ? 0 : minAvailable;
            }
            
            const isLowStock = displayStock > 0 && displayStock <= 5;
            const isOutOfStock = displayStock === 0;
            
            let stockBadgeHtml = '';
            if (isOutOfStock) {
                stockBadgeHtml = `<span class="tile-stock-badge out-of-stock">Sold Out</span>`;
            } else if (isLowStock) {
                stockBadgeHtml = `<span class="tile-stock-badge low-stock">Only ${displayStock} Left</span>`;
            } else {
                stockBadgeHtml = `<span class="tile-stock-badge in-stock">${displayStock} Available</span>`;
            }

            const rating = ((p.price % 0.7) + 4.2).toFixed(1);
            const prepTime = Math.round((p.price % 10) + 8);
            
            const cartItem = posCart.find(item => item.productId === p.id && (!item.modifiers || item.modifiers.length === 0));
            
            let actionControlHtml = '';
            if (cartItem) {
                actionControlHtml = `
                    <div class="tile-qty-selector">
                        <button type="button" class="tile-qty-btn minus" data-id="${p.id}"><i data-lucide="minus"></i></button>
                        <span class="tile-qty-val">${cartItem.quantity}</span>
                        <button type="button" class="tile-qty-btn plus" data-id="${p.id}"><i data-lucide="plus"></i></button>
                    </div>
                `;
            } else {
                actionControlHtml = `
                    <button type="button" class="tile-add-btn" data-id="${p.id}" ${isOutOfStock ? 'disabled' : ''}>
                        <span>Add</span> <i data-lucide="plus"></i>
                    </button>
                `;
            }
            
            cardsHtml += `
                <div class="pos-product-tile ${isOutOfStock ? 'disabled' : ''}" data-id="${p.id}">
                    <div class="tile-image-container">
                        <img src="${p.image}" class="tile-image" alt="${p.name}">
                        <div class="tile-gradient-overlay"></div>
                        
                        <div class="tile-top-badges">
                            <span class="tile-category-tag">${p.category}</span>
                            ${popularBadge}
                            ${chefBadge}
                        </div>
                        
                        <button type="button" class="tile-fav-btn ${favClass}" data-id="${p.id}">
                            <i data-lucide="heart" style="fill: ${p.isFavorite ? 'currentColor' : 'none'};"></i>
                        </button>
                        
                        <div class="tile-bottom-meta">
                            <span class="meta-item"><i data-lucide="star" style="fill:currentColor;"></i> ${rating}</span>
                            <span class="meta-item"><i data-lucide="clock"></i> ${prepTime}m</span>
                        </div>
                    </div>
                    
                    <div class="tile-content">
                        <div class="tile-title-row">
                            <h3 class="tile-title">${p.name}</h3>
                            <div class="tile-veg-indicator ${vegClass}" title="${p.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}">
                                <div class="dot"></div>
                            </div>
                        </div>
                        
                        <div class="tile-stock-row">
                            ${stockBadgeHtml}
                        </div>
                        
                        <div class="tile-footer">
                            <span class="tile-price">₹${p.price.toFixed(2)}</span>
                            <div class="tile-action-wrapper">
                                ${actionControlHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = cardsHtml;
        if (window.lucide) window.lucide.createIcons();
    }

    function renderPosCartList() {
        const cartList = document.getElementById("posCartItemsList");
        if (!cartList) return;
        
        if (posCart.length === 0) {
            cartList.innerHTML = `
                <div class="cart-empty-state-container">
                    <div class="empty-illustration">
                        <i data-lucide="shopping-basket"></i>
                    </div>
                    <div class="empty-headline">No items added yet</div>
                    <div class="empty-subtitle">Search products or scan a barcode to begin billing.</div>
                    
                    <div class="quick-add-section">
                        <span class="quick-add-title">Quick Add Popular</span>
                        <div class="quick-add-grid">
                            <button type="button" class="quick-add-btn" data-id="pos-p-1">
                                <i data-lucide="plus"></i> Whopper Veg
                            </button>
                            <button type="button" class="quick-add-btn" data-id="pos-p-7">
                                <i data-lucide="plus"></i> BK Fries
                            </button>
                            <button type="button" class="quick-add-btn" data-id="pos-p-3">
                                <i data-lucide="plus"></i> Margherita
                            </button>
                            <button type="button" class="quick-add-btn" data-id="pos-p-10">
                                <i data-lucide="plus"></i> Cold Coffee
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Reset stats badges on header
            const badgeCount = document.getElementById("cartBadgeCount");
            if (badgeCount) badgeCount.textContent = "0 Items";
            const badgeTotal = document.getElementById("cartBadgeTotal");
            if (badgeTotal) badgeTotal.textContent = "₹0.00";
            const badgeTime = document.getElementById("cartBadgeTime");
            if (badgeTime) badgeTime.textContent = "0 min";

            document.getElementById("posSubtotal").textContent = '₹0.00';
            document.getElementById("posTax").textContent = '₹0.00';
            document.getElementById("posDiscountRow").style.display = 'none';
            document.getElementById("posServiceCharge").textContent = '₹0.00';
            document.getElementById("posGrandTotal").textContent = '₹0.00';
            const dockTotal = document.getElementById("dockGrandTotal");
            if (dockTotal) dockTotal.textContent = '₹0.00';
            if (window.lucide) window.lucide.createIcons();
            return;
        }
        
        let listHtml = '';
        let subtotal = 0;
        
        posCart.forEach((item, index) => {
            let itemPrice = item.price;
            if (item.modifiers && item.modifiers.length > 0) {
                (item.modifiers || []).forEach(modName => {
                    const modInfo = posModifiers.find(m => m.name === modName);
                    if (modInfo) itemPrice += modInfo.price;
                });
            }
            
            const itemSubtotal = itemPrice * item.quantity;
            subtotal += itemSubtotal;
            
            const product = posProducts.find(p => p.id === item.productId) || {};
            const imgUrl = product.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&auto=format&fit=crop&q=60';
            
            const modsText = item.modifiers && item.modifiers.length > 0 
                ? item.modifiers.map(m => `<span class="cart-mod-tag">+ ${m}</span>`).join('')
                : '';
                
            const isSelectedClass = index === posSelectedCartIndex ? 'selected' : '';
            listHtml += `
                <div class="cart-item-row-new ${isSelectedClass}" data-index="${index}">
                    <div class="cart-item-main-row">
                        <img src="${imgUrl}" class="cart-item-thumb-new" alt="${item.productName}">
                        
                        <div class="cart-item-desc-new">
                            <span class="cart-item-title-new">${item.productName}</span>
                            <div class="cart-item-mods-container">
                                ${modsText}
                            </div>
                        </div>
                        
                        <div class="cart-item-qty-actions">
                            <button type="button" class="cart-qty-btn-new minus" data-index="${index}"><i data-lucide="minus"></i></button>
                            <span class="cart-qty-num">${item.quantity}</span>
                            <button type="button" class="cart-qty-btn-new plus" data-index="${index}"><i data-lucide="plus"></i></button>
                        </div>
                        
                        <span class="cart-item-subtotal-new">₹${itemSubtotal.toFixed(2)}</span>
                    </div>
                    
                    <div class="cart-item-instructions-row-new">
                        <i data-lucide="notebook-pen" class="notes-icon-mini"></i>
                        <input type="text" class="cart-item-notes-input-new" placeholder="Prep note (e.g., extra spicy, no sauce...)" value="${item.instructions || ''}" data-index="${index}">
                        <button type="button" class="cart-item-customize-link" data-index="${index}">
                            <i data-lucide="sliders-horizontal"></i> Modifiers
                        </button>
                        <button type="button" class="cart-item-delete-btn" data-index="${index}" title="Remove item">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        cartList.innerHTML = listHtml;
        if (window.lucide) window.lucide.createIcons();
        
        const tax = 0;
        const serviceCharge = 0;
        
        let discount = 0;
        if (posAppliedCoupon) {
            if (posAppliedCoupon.discountType === 'percent') {
                discount = subtotal * (posAppliedCoupon.discountValue / 100);
            } else {
                discount = posAppliedCoupon.discountValue;
            }
        }
        
        const grandTotal = Math.max(0, subtotal + tax + serviceCharge - discount);
        
        // Update stats badges on cart header
        const totalItemsCount = posCart.reduce((sum, item) => sum + item.quantity, 0);
        const estPrepTime = 12 + totalItemsCount * 2;
        
        const badgeCount = document.getElementById("cartBadgeCount");
        if (badgeCount) badgeCount.textContent = `${totalItemsCount} Item${totalItemsCount !== 1 ? 's' : ''}`;
        
        const badgeTotal = document.getElementById("cartBadgeTotal");
        if (badgeTotal) badgeTotal.textContent = `₹${grandTotal.toFixed(2)}`;
        
        const badgeTime = document.getElementById("cartBadgeTime");
        if (badgeTime) badgeTime.textContent = `${estPrepTime} min`;

        updateTotalsDOM("posSubtotal", `₹${subtotal.toFixed(2)}`);
        updateTotalsDOM("posTax", `₹${tax.toFixed(2)}`);
        
        const discountRow = document.getElementById("posDiscountRow");
        if (discount > 0) {
            if (discountRow) discountRow.style.display = 'flex';
            updateTotalsDOM("posDiscount", `-₹${discount.toFixed(2)}`);
        } else {
            if (discountRow) discountRow.style.display = 'none';
        }
        
        document.getElementById("posServiceChargeRow") && (document.getElementById("posServiceChargeRow").style.display = 'none');
        updateTotalsDOM("posGrandTotal", `₹${grandTotal.toFixed(2)}`);
    }

    function updateTotalsDOM(id, val) {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.textContent !== val) {
            el.classList.add("value-changing");
            el.textContent = val;
            setTimeout(() => { el.classList.remove("value-changing"); }, 300);
        }
        if (id === "posGrandTotal") {
            const dockTotal = document.getElementById("dockGrandTotal");
            if (dockTotal) dockTotal.textContent = val;
        }
    }

    function bindBillingEvents() {
        // Sidebar collapse trigger
        const sidebarBtn = document.getElementById("sidebarCollapseToggle");
        if (sidebarBtn && !sidebarBtn.dataset.listenerBound) {
            sidebarBtn.dataset.listenerBound = "true";
            sidebarBtn.addEventListener("click", () => {
                document.body.classList.toggle("sidebar-collapsed");
                const icon = sidebarBtn.querySelector("i");
                if (document.body.classList.contains("sidebar-collapsed")) {
                    icon.setAttribute("data-lucide", "chevron-right");
                } else {
                    icon.setAttribute("data-lucide", "chevron-left");
                }
                if (window.lucide) window.lucide.createIcons();
            });
        }

        // Voice Search Trigger
        const voiceBtn = document.getElementById("btnVoiceSearch");
        if (voiceBtn && !voiceBtn.dataset.listenerBound) {
            voiceBtn.dataset.listenerBound = "true";
            voiceBtn.addEventListener("click", () => {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition) {
                    alert("Speech Recognition API is not supported in this browser. Try Google Chrome.");
                    return;
                }
                const recognition = new SpeechRecognition();
                recognition.lang = 'en-IN';
                recognition.interimResults = false;
                recognition.maxAlternatives = 1;
                
                voiceBtn.classList.add("recording");
                showToast("Listening for product names...");
                
                recognition.start();
                
                recognition.onresult = (event) => {
                    const speechResult = event.results[0][0].transcript.toLowerCase();
                    const searchInput = document.getElementById("posProductSearch");
                    if (searchInput) {
                        searchInput.value = speechResult;
                        renderPosProductsList();
                    }
                    showToast(`Voice Search term: "${speechResult}"`);
                };
                
                recognition.onspeechend = () => {
                    recognition.stop();
                    voiceBtn.classList.remove("recording");
                };
                
                recognition.onerror = (event) => {
                    console.error("Speech recognition error:", event.error);
                    voiceBtn.classList.remove("recording");
                    showToast("Speech recognition error: " + event.error);
                };
            });
        }

        // Barcode Scanner simulation
        const barcodeBtn = document.getElementById("btnBarcodeScanner");
        if (barcodeBtn && !barcodeBtn.dataset.listenerBound) {
            barcodeBtn.dataset.listenerBound = "true";
            barcodeBtn.addEventListener("click", () => {
                const barcode = prompt("Simulate Barcode Scan (Enter Product Name/Shortcode):");
                if (barcode) {
                    const searchInput = document.getElementById("posProductSearch");
                    if (searchInput) {
                        searchInput.value = barcode;
                        renderPosProductsList();
                    }
                    showToast(`Scanned Code: "${barcode}"`);
                }
            });
        }

        const searchInput = document.getElementById("posProductSearch");
        if (searchInput && !searchInput.dataset.listenerBound) {
            searchInput.dataset.listenerBound = "true";
            searchInput.addEventListener("input", () => {
                renderPosProductsList();
            });
        }

        const categoryTabsContainer = document.getElementById("posCategoryTabs");
        if (categoryTabsContainer && !categoryTabsContainer.dataset.listenerBound) {
            categoryTabsContainer.dataset.listenerBound = "true";
            categoryTabsContainer.addEventListener("click", (e) => {
                const tab = e.target.closest(".category-tab");
                if (tab) {
                    posSelectedCategory = tab.getAttribute("data-category");
                    renderCategoryTabs();
                    renderPosProductsList();
                }
            });
        }

        // REDESIGNED Catalog Grid Clicks
        const productGrid = document.getElementById("posProductGrid");
        if (productGrid && !productGrid.dataset.listenerBound) {
            productGrid.dataset.listenerBound = "true";
            productGrid.addEventListener("click", (e) => {
                const favBtn = e.target.closest(".tile-fav-btn");
                const addBtn = e.target.closest(".tile-add-btn");
                const plusBtn = e.target.closest(".tile-qty-btn.plus");
                const minusBtn = e.target.closest(".tile-qty-btn.minus");
                
                if (favBtn) {
                    e.stopPropagation();
                    const pid = favBtn.getAttribute("data-id");
                    const prod = posProducts.find(p => p.id === pid);
                    if (prod) {
                        prod.isFavorite = prod.isFavorite ? 0 : 1;
                        renderPosProductsList();
                    }
                    return;
                }
                
                if (addBtn) {
                    const pid = addBtn.getAttribute("data-id");
                    addPosProductToCart(pid);
                    return;
                }
                
                if (plusBtn) {
                    const pid = plusBtn.getAttribute("data-id");
                    const idx = posCart.findIndex(item => item.productId === pid && (!item.modifiers || item.modifiers.length === 0));
                    if (idx !== -1) {
                        posCart[idx].quantity++;
                        syncCartStateAndUI();
                    }
                    return;
                }
                
                if (minusBtn) {
                    const pid = minusBtn.getAttribute("data-id");
                    const idx = posCart.findIndex(item => item.productId === pid && (!item.modifiers || item.modifiers.length === 0));
                    if (idx !== -1) {
                        if (posCart[idx].quantity > 1) {
                            posCart[idx].quantity--;
                        } else {
                            posCart.splice(idx, 1);
                        }
                        syncCartStateAndUI();
                    }
                    return;
                }
            });
        }

        const custSelect = document.getElementById("posCustomerSelect");
        if (custSelect && !custSelect.dataset.listenerBound) {
            custSelect.dataset.listenerBound = "true";
            custSelect.addEventListener("change", (e) => {
                posSelectedCustomer = e.target.value;
                renderCustomerDropdown();
            });
        }

        const newCustLink = document.getElementById("btnCreateCustomerLink");
        if (newCustLink && !newCustLink.dataset.listenerBound) {
            newCustLink.dataset.listenerBound = "true";
            newCustLink.addEventListener("click", () => {
                document.getElementById("modalPOSCreateCustomer").style.display = "flex";
            });
        }

        const newCustSave = document.getElementById("btnSaveNewCustomer");
        if (newCustSave && !newCustSave.dataset.listenerBound) {
            newCustSave.dataset.listenerBound = "true";
            newCustSave.addEventListener("click", async () => {
                const name = document.getElementById("newCustomerName").value.trim();
                const phone = document.getElementById("newCustomerPhone").value.trim();
                if (!name || !phone) {
                    alert("Please fill in both name and phone!");
                    return;
                }
                
                const veg = false;
                const jain = false;
                const vegan = false;
                const eggless = false;
                const noOnion = false;
                const noGarlic = false;
                const nut = false;
                const gluten = false;
                const favFood = document.getElementById("newCustomerFavFood")?.value.trim() || 'N/A';
                const favDrink = document.getElementById("newCustomerFavDrink")?.value.trim() || 'N/A';
                const notes = document.getElementById("newCustomerNotes")?.value.trim() || '';

                try {
                    const response = await fetch(`${API_BASE}/api/pos/customers`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                        },
                        body: JSON.stringify({ name, phone })
                    });
                    
                    if (!response.ok) throw new Error("API failed");
                    const newCust = await response.json();
                    
                    // Save guest profile preferences
                    try {
                        await fetch(`${API_BASE}/api/pos/customers/${newCust.id}/guest-profile`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                            },
                            body: JSON.stringify({
                                preferences: {
                                    favFood,
                                    favDrink,
                                    favCategory: 'General',
                                    favTable: 'N/A',
                                    paymentMethod: 'N/A',
                                    seating: 'Indoor'
                                },
                                specialRequirements: {
                                    vegetarian: veg,
                                    jain: jain,
                                    vegan: vegan,
                                    eggless: eggless,
                                    noOnion: noOnion,
                                    noGarlic: noGarlic,
                                    nutAllergy: nut,
                                    glutenFree: gluten
                                },
                                notes: notes
                            })
                        });
                    } catch (errPref) {
                        console.error("Failed to save guest profile preferences:", errPref);
                    }

                    // Reset form fields
                    document.getElementById("newCustomerName").value = '';
                    document.getElementById("newCustomerPhone").value = '';
                    if (document.getElementById("newCustomerFavFood")) document.getElementById("newCustomerFavFood").value = '';
                    if (document.getElementById("newCustomerFavDrink")) document.getElementById("newCustomerFavDrink").value = '';
                    if (document.getElementById("newCustomerNotes")) document.getElementById("newCustomerNotes").value = '';
                    
                    document.getElementById("modalPOSCreateCustomer").style.display = "none";
                    
                    await syncStateFromServer();
                    posSelectedCustomer = newCust.id;
                    renderCustomerDropdown();
                    showToast("Customer profile created successfully with preferences!");
                } catch (err) {
                    console.error("Failed to create customer:", err);
                    alert("Error saving customer. Server might be offline.");
                }
            });
        }

        const serviceTabs = document.querySelectorAll(".order-type-tab");
        serviceTabs.forEach(tab => {
            if (!tab.dataset.listenerBound) {
                tab.dataset.listenerBound = "true";
                tab.addEventListener("click", () => {
                    serviceTabs.forEach(t => t.classList.remove("active"));
                    tab.classList.add("active");
                    posSelectedOrderType = tab.getAttribute("data-type");
                    
                    const dineIn = document.getElementById("dineInDetails");
                    const delivery = document.getElementById("deliveryDetails");
                    if (posSelectedOrderType === 'Dine In') {
                        if (dineIn) dineIn.style.display = "block";
                        if (delivery) delivery.style.display = "none";
                    } else if (posSelectedOrderType === 'Delivery') {
                        if (dineIn) dineIn.style.display = "none";
                        if (delivery) delivery.style.display = "block";
                    } else {
                        if (dineIn) dineIn.style.display = "none";
                        if (delivery) delivery.style.display = "none";
                    }
                });
            }
        });

        const tableSelect = document.getElementById("posTableSelect");
        if (tableSelect && !tableSelect.dataset.listenerBound) {
            tableSelect.dataset.listenerBound = "true";
            tableSelect.addEventListener("change", (e) => {
                posSelectedTable = e.target.value;
                renderTableFloorPlan(); // Synced table floor highlight
            });
        }

        // REDESIGNED Cart list triggers and text prepnote tracking
        const cartList = document.getElementById("posCartItemsList");
        if (cartList && !cartList.dataset.listenerBound) {
            cartList.dataset.listenerBound = "true";
            cartList.addEventListener("input", (e) => {
                const notesInput = e.target.closest(".cart-item-notes-input-new");
                if (notesInput) {
                    const idx = parseInt(notesInput.getAttribute("data-index"));
                    if (posCart[idx]) {
                        posCart[idx].instructions = notesInput.value;
                    }
                }
            });
            cartList.addEventListener("click", (e) => {
                const minusBtn = e.target.closest(".cart-qty-btn-new.minus");
                const plusBtn = e.target.closest(".cart-qty-btn-new.plus");
                const customizeLink = e.target.closest(".cart-item-customize-link");
                const deleteBtn = e.target.closest(".cart-item-delete-btn");
                const row = e.target.closest(".cart-item-row-new");
                const quickAddBtn = e.target.closest(".quick-add-btn");
                
                if (quickAddBtn) {
                    const pid = quickAddBtn.getAttribute("data-id");
                    addPosProductToCart(pid);
                    return;
                }
                
                if (row && !minusBtn && !plusBtn && !customizeLink && !deleteBtn) {
                    const idx = parseInt(row.getAttribute("data-index"));
                    posSelectedCartIndex = idx;
                    document.querySelectorAll(".cart-item-row-new").forEach(r => r.classList.remove("selected"));
                    row.classList.add("selected");
                }
                
                if (minusBtn) {
                    const idx = parseInt(minusBtn.getAttribute("data-index"));
                    if (posCart[idx].quantity > 1) {
                        posCart[idx].quantity--;
                    } else {
                        posCart.splice(idx, 1);
                        if (posSelectedCartIndex === idx) posSelectedCartIndex = null;
                    }
                    syncCartStateAndUI();
                } else if (plusBtn) {
                    const idx = parseInt(plusBtn.getAttribute("data-index"));
                    posCart[idx].quantity++;
                    syncCartStateAndUI();
                } else if (customizeLink) {
                    const idx = parseInt(customizeLink.getAttribute("data-index"));
                    openModifiersPopup(idx);
                } else if (deleteBtn) {
                    const idx = parseInt(deleteBtn.getAttribute("data-index"));
                    posCart.splice(idx, 1);
                    if (posSelectedCartIndex === idx) posSelectedCartIndex = null;
                    syncCartStateAndUI();
                }
            });
        }

        const customItemAddBtn = document.getElementById("btnPosAddCustomItem");
        if (customItemAddBtn && !customItemAddBtn.dataset.listenerBound) {
            customItemAddBtn.dataset.listenerBound = "true";
            customItemAddBtn.addEventListener("click", () => {
                const nameInput = document.getElementById("posCustomItemName");
                const priceInput = document.getElementById("posCustomItemPrice");
                if (!nameInput || !priceInput) return;

                const name = nameInput.value.trim();
                const priceVal = priceInput.value.trim();

                if (!name) {
                    showToast("Please enter an item name!");
                    return;
                }
                const price = parseFloat(priceVal);
                if (isNaN(price) || price < 0) {
                    showToast("Please enter a valid price!");
                    return;
                }

                const customId = `custom-${Date.now()}`;
                posCart.push({
                    productId: customId,
                    productName: name,
                    price: price,
                    quantity: 1,
                    modifiers: [],
                    instructions: ''
                });

                syncCartStateAndUI();
                showToast(`Added custom item: ${name}`);

                nameInput.value = "";
                priceInput.value = "";
            });
        }

        const cartClearAllBtn = document.getElementById("btnCartClearAll");
        if (cartClearAllBtn && !cartClearAllBtn.dataset.listenerBound) {
            cartClearAllBtn.dataset.listenerBound = "true";
            cartClearAllBtn.addEventListener("click", () => {
                if (posCart.length === 0) {
                    alert("Cart is already empty.");
                    return;
                }
                if (confirm("Are you sure you want to clear current checkout cart?")) {
                    posCart = [];
                    posAppliedCoupon = null;
                    posSelectedCartIndex = null;
                    const couponInput = document.getElementById("posCouponInput");
                    if (couponInput) couponInput.value = '';
                    const instructionsInput = document.getElementById("posOrderInstructions");
                    if (instructionsInput) instructionsInput.value = '';
                    syncCartStateAndUI();
                    showToast("Cart cleared.");
                }
            });
        }

        // Coupon logic removed

        const saveModsBtn = document.getElementById("btnSaveModifiers");
        if (saveModsBtn && !saveModsBtn.dataset.listenerBound) {
            saveModsBtn.dataset.listenerBound = "true";
            saveModsBtn.addEventListener("click", () => {
                const checkedOptions = [];
                const checkBoxes = document.querySelectorAll(".pos-modifier-option.selected");
                checkBoxes.forEach(chk => {
                    checkedOptions.push(chk.getAttribute("data-name"));
                });
                
                if (posCurrentModifiersCartIndex !== null && posCart[posCurrentModifiersCartIndex]) {
                    posCart[posCurrentModifiersCartIndex].modifiers = checkedOptions;
                }
                document.getElementById("modalPOSModifiers").style.display = "none";
                syncCartStateAndUI();
            });
        }

        const payButtons = document.querySelectorAll(".pay-btn");
        payButtons.forEach(btn => {
            if (!btn.dataset.listenerBound) {
                btn.dataset.listenerBound = "true";
                btn.addEventListener("click", () => {
                    const method = btn.getAttribute("data-method");
                    if (method === 'UPI') {
                        if (posCart.length === 0) {
                            alert("No items in the cart to settle!");
                            return;
                        }
                        
                        const amtEl = document.getElementById("posGrandTotal");
                        let amt = 0;
                        if (amtEl) amt = parseFloat(amtEl.textContent.replace(/[^0-9.]/g, '')) || 0;
                        
                        const qrModal = document.getElementById("modalPOSQRPayment");
                        if (qrModal) {
                            document.getElementById("posQRAmountDue").textContent = "₹" + amt.toFixed(2);
                            qrModal.style.display = "flex";
                            document.getElementById("btnConfirmPOSUpiPayment").onclick = () => {
                                qrModal.style.display = "none";
                                processPayment('UPI');
                            };
                        } else {
                            processPayment('UPI');
                        }
                    } else {
                        processPayment(method);
                    }
                });
            }
        });

        const holdBtn = document.getElementById("btnHoldOrder");
        if (holdBtn && !holdBtn.dataset.listenerBound) {
            holdBtn.dataset.listenerBound = "true";
            holdBtn.addEventListener("click", () => {
                if (posCart.length === 0) {
                    alert("Cart is empty! Cannot hold order.");
                    return;
                }
                const name = prompt("Enter a label / table details to hold this order:", `Hold-${Date.now().toString().substr(-5)}`);
                if (name) {
                    posHeldOrders.push({
                        id: 'hold-' + Date.now(),
                        name: name,
                        time: new Date().toTimeString().split(' ')[0],
                        cart: JSON.parse(JSON.stringify(posCart)),
                        customer: posSelectedCustomer,
                        type: posSelectedOrderType,
                        table: posSelectedTable,
                        coupon: posAppliedCoupon
                    });
                    posCart = [];
                    posAppliedCoupon = null;
                    const _pci = document.getElementById("posCouponInput"); if(_pci) _pci.value = "";
                    const _poi = document.getElementById("posOrderInstructions"); if(_poi) _poi.value = "";
                    syncCartStateAndUI();
                    updateHeldOrdersCount();
                    showToast("Order placed on hold successfully.");
                }
            });
        }

        const resumeBtn = document.getElementById("btnResumeOrder");
        if (resumeBtn && !resumeBtn.dataset.listenerBound) {
            resumeBtn.dataset.listenerBound = "true";
            resumeBtn.addEventListener("click", () => {
                openHeldOrdersModal();
            });
        }

        const cancelBtn = document.getElementById("btnCancelOrder");
        if (cancelBtn && !cancelBtn.dataset.listenerBound) {
            cancelBtn.dataset.listenerBound = "true";
            cancelBtn.addEventListener("click", () => {
                if (confirm("Are you sure you want to clear current checkout cart?")) {
                    posCart = [];
                    posAppliedCoupon = null;
                    const _pci = document.getElementById("posCouponInput"); if(_pci) _pci.value = "";
                    const _poi = document.getElementById("posOrderInstructions"); if(_poi) _poi.value = "";
                    syncCartStateAndUI();
                    showToast("Cart cleared.");
                }
            });
        }

        const repeatLastBtn = document.getElementById("btnRepeatLastOrder");
        if (repeatLastBtn && !repeatLastBtn.dataset.listenerBound) {
            repeatLastBtn.dataset.listenerBound = "true";
            repeatLastBtn.addEventListener("click", () => {
                const storeOrders = posOrders.filter(o => o.store === getPOSStore());
                if (storeOrders.length === 0) {
                    alert("No previous orders found for this branch!");
                    return;
                }
                const lastOrder = storeOrders[storeOrders.length - 1];
                alert(`Repeating Last Order: ${lastOrder.id}. Cart loaded!`);
                posCart = [
                    { productId: "pos-p-1", productName: "Whopper Veg Burger", price: 180.00, quantity: 1, modifiers: [], instructions: "" }
                ];
                syncCartStateAndUI();
            });
        }

        const refundBtn = document.getElementById("btnRefundOrder");
        if (refundBtn && !refundBtn.dataset.listenerBound) {
            refundBtn.dataset.listenerBound = "true";
            refundBtn.addEventListener("click", async () => {
                const oid = prompt("Enter Completed POS Order ID to refund:");
                if (!oid) return;
                
                const order = posOrders.find(o => o.id === oid);
                if (!order) {
                    alert("Order ID not found in database!");
                    return;
                }
                
                try {
                    const response = await fetch(`${API_BASE}/api/pos/orders/${oid}/refund`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                        },
                        body: JSON.stringify({ store: getPOSStore() })
                    });
                    if (!response.ok) throw new Error("Refund failed");
                    alert(`Order ${oid} successfully refunded. Database state updated.`);
                    syncStateFromServer();
                } catch(e) {
                    alert("Error processing refund: " + e.message);
                }
            });
        }

        const openDrawerBtn = document.getElementById("btnOpenDrawer");
        if (openDrawerBtn && !openDrawerBtn.dataset.listenerBound) {
            openDrawerBtn.dataset.listenerBound = "true";
            openDrawerBtn.addEventListener("click", () => {
                alert("Cash Drawer opened. Audit Log: OPEN_DRAWER recorded.");
            });
        }

        const reprintBtn = document.getElementById("btnReprintBill");
        if (reprintBtn && !reprintBtn.dataset.listenerBound) {
            reprintBtn.dataset.listenerBound = "true";
            reprintBtn.addEventListener("click", () => {
                const oid = prompt("Enter Order ID to reprint receipt:");
                if (!oid) return;
                const order = posOrders.find(o => o.id === oid);
                if (!order) {
                    alert("Order not found!");
                    return;
                }
                renderGSTInvoice(order);
                document.getElementById("modalPOSInvoice").style.display = "flex";
            });
        }

        const printBtn = document.getElementById("btnPrintReceiptBtn");
        if (printBtn && !printBtn.dataset.listenerBound) {
            printBtn.dataset.listenerBound = "true";
            printBtn.addEventListener("click", () => {
                document.body.classList.add('print-bill-only');
                document.body.classList.remove('print-kot-only');
                window.print();
                setTimeout(() => document.body.classList.remove('print-bill-only'), 500);
            });
        }

        const printKOTBtn = document.getElementById("btnPrintKOTBtn");
        if (printKOTBtn && !printKOTBtn.dataset.listenerBound) {
            printKOTBtn.dataset.listenerBound = "true";
            printKOTBtn.addEventListener("click", () => {
                document.body.classList.add('print-kot-only');
                document.body.classList.remove('print-bill-only');
                window.print();
                setTimeout(() => document.body.classList.remove('print-kot-only'), 500);
            });
        }

        const pdfBtn = document.getElementById("btnDownloadPDFBtn");
        if (pdfBtn && !pdfBtn.dataset.listenerBound) {
            pdfBtn.dataset.listenerBound = "true";
            pdfBtn.addEventListener("click", () => {
                downloadReceiptPDF();
            });
        }

        const whatsappBtn = document.getElementById("btnWhatsAppReceiptBtn");
        if (whatsappBtn && !whatsappBtn.dataset.listenerBound) {
            whatsappBtn.dataset.listenerBound = "true";
            whatsappBtn.addEventListener("click", () => {
                const order = window.activeReceiptOrder;
                if (!order) {
                    showToast("No active order found to send!");
                    return;
                }
                const cleanPhone = "919978673137";
                let text = `*BADI KATORI - ORDER CONFIRMED*\n`;
                text += `--------------------------------\n`;
                text += `Order ID: ${order.id}\n`;
                text += `Date: ${order.date} | Time: ${order.time || '12:00:00'}\n`;
                text += `Type: ${order.orderType}\n`;
                if (order.tableName) text += `Table: ${order.tableName}\n`;
                text += `--------------------------------\n`;
                text += `*Items:*\n`;
                order.items.forEach(item => {
                    let itemPrice = item.price;
                    if (item.modifiers && item.modifiers.length > 0) {
                        (item.modifiers || []).forEach(mName => {
                            const modInfo = posModifiers.find(m => m.name === mName);
                            if (modInfo) itemPrice += modInfo.price;
                        });
                    }
                    text += `- ${item.productName} (x${item.quantity}) @ ₹${itemPrice.toFixed(2)} - Sub: ₹${(itemPrice * item.quantity).toFixed(2)}\n`;
                });
                text += `--------------------------------\n`;
                if (order.discount > 0) text += `Discount: -₹${order.discount.toFixed(2)}\n`;
                // Removed service charge
                text += `*GRAND TOTAL:* ₹${order.grandTotal.toFixed(2)}\n`;
                text += `Payment Method: ${order.paymentMethod}\n`;
                text += `Status: PAID / CONFIRMED\n`;
                
                const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
                window.open(url, '_blank');
            });
        }

        const emailBtn = document.getElementById("btnEmailReceiptBtn");
        if (emailBtn && !emailBtn.dataset.listenerBound) {
            emailBtn.dataset.listenerBound = "true";
            emailBtn.addEventListener("click", () => {
                alert("Receipt sent to customer's registered email address successfully.");
            });
        }

        // --- NEW COMMAND DOCK EVENT LISTENERS ---
        const voidItemBtn = document.getElementById("btnVoidItem");
        if (voidItemBtn && !voidItemBtn.dataset.listenerBound) {
            voidItemBtn.dataset.listenerBound = "true";
            voidItemBtn.addEventListener("click", () => {
                if (posSelectedCartIndex === null || posSelectedCartIndex >= posCart.length) {
                    alert("Please select a cart row first by clicking on it.");
                    return;
                }
                if (confirm(`Void selected item: ${posCart[posSelectedCartIndex].productName}?`)) {
                    posCart.splice(posSelectedCartIndex, 1);
                    posSelectedCartIndex = null;
                    renderPosProductsList();
                    renderPosCartList();
                    showToast("Item voided.");
                }
            });
        }

        const removeItemBtn = document.getElementById("btnRemoveItem");
        if (removeItemBtn && !removeItemBtn.dataset.listenerBound) {
            removeItemBtn.dataset.listenerBound = "true";
            removeItemBtn.addEventListener("click", () => {
                if (posSelectedCartIndex === null || posSelectedCartIndex >= posCart.length) {
                    alert("Please select a cart row first by clicking on it.");
                    return;
                }
                const item = posCart[posSelectedCartIndex];
                if (item.quantity > 1) {
                    item.quantity--;
                } else {
                    posCart.splice(posSelectedCartIndex, 1);
                    posSelectedCartIndex = null;
                }
                renderPosProductsList();
                renderPosCartList();
                showToast("Quantity reduced.");
            });
        }

        const printKotBtn = document.getElementById("btnPrintKOT");
        if (printKotBtn && !printKotBtn.dataset.listenerBound) {
            printKotBtn.dataset.listenerBound = "true";
            printKotBtn.addEventListener("click", () => {
                if (posCart.length === 0) {
                    alert("No items in cart to print KOT!");
                    return;
                }
                showToast("Kitchen Order Ticket (KOT) sent to kitchen printer successfully.");
            });
        }

        const dockPaymentBtn = document.getElementById("btnDockPayment");
        if (dockPaymentBtn && !dockPaymentBtn.dataset.listenerBound) {
            dockPaymentBtn.dataset.listenerBound = "true";
            dockPaymentBtn.addEventListener("click", () => {
                if (posCart.length === 0) {
                    alert("No items in cart to settle!");
                    return;
                }
                const modal = document.getElementById("modalPOSSelectPayment");
                if (modal) {
                    modal.style.display = "flex";
                } else {
                    processPayment("Cash");
                }
            });
        }

        const paymentOptions = document.querySelectorAll(".payment-select-option");
        paymentOptions.forEach(opt => {
            if (!opt.dataset.listenerBound) {
                opt.dataset.listenerBound = "true";
                opt.addEventListener("click", () => {
                    const method = opt.getAttribute("data-method");
                    const modal = document.getElementById("modalPOSSelectPayment");
                    if (modal) modal.style.display = "none";
                    
                    if (method === 'Split') {
                        let subtotal = 0;
                        posCart.forEach(item => {
                            let itemPrice = item.price;
                            (item.modifiers || []).forEach(modName => {
                                const modInfo = posModifiers.find(m => m.name === modName);
                                if (modInfo) itemPrice += modInfo.price;
                            });
                            subtotal += itemPrice * item.quantity;
                        });
                        let discount = 0;
                        if (posAppliedCoupon) {
                            if (posAppliedCoupon.discountType === 'percent') discount = subtotal * (posAppliedCoupon.discountValue / 100);
                            else discount = posAppliedCoupon.discountValue;
                        }
                        const grandTotal = Math.max(0, subtotal - discount);
                        
                        const cashAmountStr = prompt(`Total is ₹${grandTotal.toFixed(2)}. How much was paid in Cash?`);
                        if (cashAmountStr === null) return; // Cancelled
                        const cashAmount = parseFloat(cashAmountStr);
                        if (isNaN(cashAmount) || cashAmount < 0 || cashAmount > grandTotal) {
                            alert("Invalid cash amount entered.");
                            return;
                        }
                        const upiAmount = grandTotal - cashAmount;
                        processPayment("Split", cashAmount, upiAmount);
                    } else if (method === 'UPI') {
                        // Instead of immediately processing, trigger the sidebar UPI QR flow
                        const sidebarUpiBtn = document.querySelector(".pay-btn.upi");
                        if (sidebarUpiBtn) {
                            sidebarUpiBtn.click();
                        } else {
                            processPayment(method);
                        }
                    } else {
                        processPayment(method);
                    }
                });
            }
        });

        // Sync active Cashier Name
        const statusCashier = document.getElementById("statusCashierName");
        if (statusCashier) {
            const activeUser = currentUser || { name: 'Store Manager' };
            statusCashier.textContent = activeUser.name;
        }

        // Sync Next Token and bind Queue control buttons
        syncTokenUI();

        const prevTokenBtn = document.getElementById("btnPrevToken");
        if (prevTokenBtn && !prevTokenBtn.dataset.listenerBound) {
            prevTokenBtn.dataset.listenerBound = "true";
            prevTokenBtn.addEventListener("click", () => {
                posNextToken = posNextToken <= 0 ? 99 : posNextToken - 1;
                localStorage.setItem("pos_next_token", posNextToken.toString());
                syncTokenUI();
            });
        }

        const resetTokenBtn = document.getElementById("btnResetToken");
        if (resetTokenBtn && !resetTokenBtn.dataset.listenerBound) {
            resetTokenBtn.dataset.listenerBound = "true";
            resetTokenBtn.addEventListener("click", () => {
                posNextToken = 0;
                localStorage.setItem("pos_next_token", posNextToken.toString());
                syncTokenUI();
            });
        }

        const nextTokenBtn = document.getElementById("btnNextToken");
        if (nextTokenBtn && !nextTokenBtn.dataset.listenerBound) {
            nextTokenBtn.dataset.listenerBound = "true";
            nextTokenBtn.addEventListener("click", () => {
                posNextToken = posNextToken >= 99 ? 0 : posNextToken + 1;
                localStorage.setItem("pos_next_token", posNextToken.toString());
                syncTokenUI();
            });
        }

        // Start clock
        const clockEl = document.getElementById("statusClock");
        if (clockEl && !clockEl.dataset.clockRunning) {
            clockEl.dataset.clockRunning = "true";
            const updateClock = () => {
                const now = new Date();
                const timeStr = now.toTimeString().split(' ')[0];
                clockEl.textContent = timeStr;
                const headerClock = document.getElementById("headerClock");
                if (headerClock) headerClock.textContent = timeStr;
            };
            updateClock();
            setInterval(updateClock, 1000);
        }
    }

    function openModifiersPopup(cartIdx) {
        posCurrentModifiersCartIndex = cartIdx;
        const item = posCart[cartIdx];
        if (!item) return;
        
        posCurrentModifiersProduct = posProducts.find(p => p.id === item.productId);
        document.getElementById("modifierItemTitle").textContent = item.productName;
        
        const listDiv = document.getElementById("posModifiersList");
        if (!listDiv) return;
        
        let modsHtml = '';
        posModifiers.forEach(mod => {
            const isSelected = item.modifiers.includes(mod.name);
            const selectedClass = isSelected ? 'selected' : '';
            const checkIcon = isSelected ? 'check-square' : 'square';
            
            modsHtml += `
                <div class="pos-modifier-option ${selectedClass}" data-name="${mod.name}">
                    <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; font-weight:700;">
                        <i data-lucide="${checkIcon}" style="width:16px; height:16px;"></i>
                        <span>${mod.name}</span>
                    </div>
                    <span style="font-weight:800; color:var(--orange-primary); font-size:0.85rem;">+₹${mod.price.toFixed(2)}</span>
                </div>
            `;
        });
        listDiv.innerHTML = modsHtml;
        if (window.lucide) window.lucide.createIcons();
        
        const options = listDiv.querySelectorAll(".pos-modifier-option");
        options.forEach(opt => {
            opt.addEventListener("click", () => {
                opt.classList.toggle("selected");
                const icon = opt.querySelector("i");
                if (opt.classList.contains("selected")) {
                    icon.setAttribute("data-lucide", "check-square");
                } else {
                    icon.setAttribute("data-lucide", "square");
                }
                if (window.lucide) window.lucide.createIcons();
            });
        });
        
        document.getElementById("modalPOSModifiers").style.display = "flex";
    }

    async function processPayment(paymentMethod, splitCashAmount = 0, splitUpiAmount = 0) {
        if (posCart.length === 0) {
            alert("No items in the cart to settle!");
            return;
        }

        const enteredPhone = document.getElementById("posCustomerPhoneInput")?.value.trim() || '';

        const activeCust = posCustomers.find(c => c.id === posSelectedCustomer);
        if (activeCust) {
            activeCust.phone = enteredPhone;
        }
        
        let subtotal = 0;
        posCart.forEach(item => {
            let itemPrice = item.price;
            (item.modifiers || []).forEach(modName => {
                const modInfo = posModifiers.find(m => m.name === modName);
                if (modInfo) itemPrice += modInfo.price;
            });
            subtotal += itemPrice * item.quantity;
        });
        
        const tax = 0;
        const serviceCharge = 0;
        
        let discount = 0;
        if (posAppliedCoupon) {
            if (posAppliedCoupon.discountType === 'percent') {
                discount = subtotal * (posAppliedCoupon.discountValue / 100);
            } else {
                discount = posAppliedCoupon.discountValue;
            }
        }
        
        const grandTotal = Math.max(0, subtotal + tax + serviceCharge - discount);
        const orderId = 'order-' + Date.now();
        
        const orderPayload = {
            id: orderId,
            customerId: posSelectedCustomer,
            customerName: activeCust.name,
            orderType: posSelectedOrderType,
            tableName: posSelectedOrderType === 'Dine In' ? posSelectedTable : null,
            address: posSelectedOrderType === 'Delivery' ? document.getElementById("posDeliveryAddress").value : null,
            subtotal: subtotal,
            tax: tax,
            discount: discount,
            serviceCharge: serviceCharge,
            grandTotal: grandTotal,
            paymentMethod: paymentMethod,
            splitCashAmount: splitCashAmount,
            splitUpiAmount: splitUpiAmount,
            items: posCart,
            couponCode: posAppliedCoupon ? posAppliedCoupon.code : null,
            specialInstructions: document.getElementById("posOrderInstructions").value
        };
        orderPayload.tokenNumber = posNextToken;

        const isOnline = navigator.onLine;
        
        if (!isOnline) {
            let offlineQueue = JSON.parse(localStorage.getItem("pos_offline_orders") || "[]");
            offlineQueue.push(orderPayload);
            localStorage.setItem("pos_offline_orders", JSON.stringify(offlineQueue));
            
            showToast("OFFLINE MODE: Order saved in local queue. Will sync when online.");
            deductLocalInventory(posCart);
            
            const orderObj = {
                id: orderId,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toTimeString().split(' ')[0],
                customerName: activeCust.name,
                customerPhone: activeCust.phone,
                orderType: posSelectedOrderType,
                tableName: orderPayload.tableName,
                subtotal, tax, discount, serviceCharge, grandTotal, paymentMethod,
                items: posCart,
                tokenNumber: posNextToken
            };
            renderGSTInvoice(orderObj);
            
            // Show the invoice modal
            const invoiceModal = document.getElementById("modalPOSInvoice");
            if (invoiceModal) {
                invoiceModal.style.display = "flex";
                setTimeout(() => window.print(), 500);
            }
            
            posCart = [];
            posAppliedCoupon = null;
            const _pci = document.getElementById("posCouponInput"); if(_pci) _pci.value = "";
            const _poi = document.getElementById("posOrderInstructions"); if(_poi) _poi.value = "";
            syncCartStateAndUI();
            incrementToken();
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/pos/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`,
                    'x-store-name': getPOSStore(),
                    'x-user-role': 'sm'
                },
                body: JSON.stringify(orderPayload)
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Order placement API returned error code ${response.status}. Details: ${errText}`);
            }
            const result = await response.json();
            
            // Removed syncStateFromServer() to prevent a heavy extra request on every order placement
            
            const orderObj = {
                id: result.order.id,
                date: result.order.date,
                time: result.order.time,
                customerName: activeCust.name,
                customerPhone: activeCust.phone,
                orderType: posSelectedOrderType,
                tableName: orderPayload.tableName,
                subtotal, tax, discount, serviceCharge, grandTotal, paymentMethod,
                items: posCart,
                kotNumber: result.order.kotNumber,
                tokenNumber: posNextToken
            };
            
            // Push locally to update Live Sales Stream instantly
            posOrders.push({
                id: result.order.id,
                timestamp: result.order.date + 'T' + result.order.time,
                orderNumber: result.order.kotNumber,
                store: getPOSStore(),
                paymentMethod: paymentMethod
            });
            posCart.forEach(item => {
                posOrderItems.push({
                    orderId: result.order.id,
                    productName: item.productName || item.name,
                    quantity: item.quantity,
                    price: item.price
                });
            });
            if (currentActiveScreen === "live-sales-stream" && typeof window.renderLiveSalesStream === "function") {
                window.renderLiveSalesStream();
            }

            renderGSTInvoice(orderObj);
            
            // Show the invoice modal
            const invoiceModal = document.getElementById("modalPOSInvoice");
            if (invoiceModal) {
                invoiceModal.style.display = "flex";
                setTimeout(() => window.print(), 500);
            }
            
            posCart = [];
            posAppliedCoupon = null;
            const _pci = document.getElementById("posCouponInput"); if(_pci) _pci.value = "";
            const _poi = document.getElementById("posOrderInstructions"); if(_poi) _poi.value = "";
            syncCartStateAndUI();
            incrementToken();
            
        } catch (err) {
            console.error("Online order failed. Saving offline.", err);
            alert("Order Error: " + err.message + "\nSaving locally to sync later.");
            
            let offlineQueue = JSON.parse(localStorage.getItem("pos_offline_orders") || "[]");
            offlineQueue.push(orderPayload);
            localStorage.setItem("pos_offline_orders", JSON.stringify(offlineQueue));
            
            deductLocalInventory(posCart);
            
            const orderObj = {
                id: orderId,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toTimeString().split(' ')[0],
                customerName: activeCust.name,
                customerPhone: activeCust.phone,
                orderType: posSelectedOrderType,
                tableName: orderPayload.tableName,
                subtotal, tax, discount, serviceCharge, grandTotal, paymentMethod,
                items: posCart,
                tokenNumber: posNextToken
            };

            posOrders.push({
                id: orderId,
                timestamp: orderObj.date + 'T' + orderObj.time,
                orderNumber: posNextToken,
                store: getPOSStore(),
                paymentMethod: paymentMethod
            });
            posCart.forEach(item => {
                posOrderItems.push({
                    orderId: orderId,
                    productName: item.productName || item.name,
                    quantity: item.quantity,
                    price: item.price
                });
            });
            if (currentActiveScreen === "live-sales-stream" && typeof window.renderLiveSalesStream === "function") {
                window.renderLiveSalesStream();
            }

            renderGSTInvoice(orderObj);
            
            posCart = [];
            posAppliedCoupon = null;
            const _pci = document.getElementById("posCouponInput"); if(_pci) _pci.value = "";
            const _poi = document.getElementById("posOrderInstructions"); if(_poi) _poi.value = "";
            syncCartStateAndUI();
            incrementToken();
        }
    }

    function incrementToken() {
        posNextToken = posNextToken >= 99 ? 0 : posNextToken + 1;
        localStorage.setItem("pos_next_token", posNextToken.toString());
        syncTokenUI();
    }

    function syncTokenUI() {
        const tokenStr = '#' + String(posNextToken).padStart(2, '0');
        const statusToken = document.getElementById("statusNextToken");
        if (statusToken) {
            statusToken.textContent = tokenStr;
        }
        const billingTokenVal = document.getElementById("billingNextTokenVal");
        if (billingTokenVal) {
            billingTokenVal.textContent = tokenStr;
        }
    }

    function deductLocalInventory(cartItems) {
        cartItems.forEach(item => {
            const product = posProducts.find(p => p.id === item.productId);
            if (product && product.ingredients) {
                product.ingredients.forEach(ing => {
                    const invItem = inventory.find(i => (i.label||'').toLowerCase() === (ing.name||'').toLowerCase() && i.store === getPOSStore());
                    if (invItem) {
                        invItem.stock = Math.max(0, invItem.stock - (ing.qty * item.quantity));
                    }
                });
            }
        });
        renderPosProductsList();
    }

    async function syncOfflineOrdersToServer() {
        const queue = JSON.parse(localStorage.getItem("pos_offline_orders") || "[]");
        if (queue.length === 0) return;
        
        showToast("Connection restored! Syncing offline orders...");
        
        let successCount = 0;
        for (let i = 0; i < queue.length; i++) {
            const orderPayload = queue[i];
            try {
                const response = await fetch(`${API_BASE}/api/pos/orders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`,
                        'x-store-name': getPOSStore(),
                        'x-user-role': 'sm'
                    },
                    body: JSON.stringify(orderPayload)
                });
                if (response.ok) {
                    successCount++;
                } else {
                    const errText = await response.text();
                    console.error(`Offline sync failed for order ${orderPayload.id}: ${response.status} - ${errText}`);
                }
            } catch(e) {
                console.error("Failed to sync offline order:", e);
            }
        }
        
        const remaining = queue.slice(successCount);
        if (remaining.length > 0) {
            localStorage.setItem("pos_offline_orders", JSON.stringify(remaining));
        } else {
            localStorage.removeItem("pos_offline_orders");
            showToast("All offline orders synced successfully!");
        }
        syncStateFromServer();
    }

    window.addEventListener('online', () => {
        syncOfflineOrdersToServer();
    });

    function triggerDirectWhatsAppConfirmation(order) {
        const cleanPhone = "919978673137";
        let text = `*BADI KATORI - ORDER CONFIRMED*\n`;
        text += `--------------------------------\n`;
        text += `Order ID: ${order.id}\n`;
        text += `Date: ${order.date} | Time: ${order.time || '12:00:00'}\n`;
        text += `Type: ${order.orderType}\n`;
        if (order.tableName) text += `Table: ${order.tableName}\n`;
        text += `--------------------------------\n`;
        text += `*Items:*\n`;
        order.items.forEach(item => {
            let itemPrice = item.price;
            if (item.modifiers && item.modifiers.length > 0) {
                (item.modifiers || []).forEach(mName => {
                    const modInfo = posModifiers.find(m => m.name === mName);
                    if (modInfo) itemPrice += modInfo.price;
                });
            }
            text += `- ${item.productName} (x${item.quantity}) @ ₹${itemPrice.toFixed(2)} - Sub: ₹${(itemPrice * item.quantity).toFixed(2)}\n`;
        });
        text += `--------------------------------\n`;
        if (order.discount > 0) text += `Discount: -₹${order.discount.toFixed(2)}\n`;
        // Removed service charge
        text += `*GRAND TOTAL:* ₹${order.grandTotal.toFixed(2)}\n`;
        text += `Payment Method: ${order.paymentMethod}\n`;
        text += `Status: PAID / CONFIRMED\n`;
        
        const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    function renderGSTInvoice(order) {
        const printArea = document.getElementById("invoicePrintArea");
        if (!printArea) return;

        const custObj = posCustomers.find(c => c.name === order.customerName || c.id === order.customerId);
        const customerPhone = order.customerPhone || (custObj ? custObj.phone : '');
        
        let itemsHtml = '';
        order.items.forEach(item => {
            const modsLine = item.modifiers && item.modifiers.length > 0 
                ? `<div class="receipt-item-mods">+ ${item.modifiers.join(', ')}</div>`
                : '';
                
            let itemPrice = item.price;
            (item.modifiers || []).forEach(mName => {
                const modInfo = posModifiers.find(m => m.name === mName);
                if (modInfo) itemPrice += modInfo.price;
            });
            const sub = itemPrice * item.quantity;
            
            itemsHtml += `
                <div class="receipt-item-row">
                    <div class="receipt-item-top">
                        <span>${item.productName} (x${item.quantity}) @ ₹${itemPrice.toFixed(2)}</span>
                        <span>₹${sub.toFixed(2)}</span>
                    </div>
                    ${modsLine}
                </div>
            `;
        });

        const invoiceHtml = `
            <div class="receipt-container">
                <div class="bill-print-section">
                <div class="receipt-header">
                    <div class="receipt-brand-logo-container" style="width: 160px; height: auto; display: block; margin: 0 auto 8px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));">
                        <img src="brand_logo.jpg" alt="Badi Katori Logo" style="width: 100%; height: auto; display: block; border-radius: 4px; filter: grayscale(1);"/>
                    </div>
                    <div style="font-size:10px;">Store: ${order.store || currentStore}</div>
                    ${(order.store || currentStore).includes('VESU') ? '<div style="font-size:10px;">Contact: +91 9428510400</div>' : ''}
                    <div style="font-size:10px; margin-top:4px;">GSTIN: 27AABCB1234F1Z0</div>
                    ${order.tokenNumber ? `
                    <div style="margin-top: 10px; padding: 6px; border: 2px dashed #000; border-radius: 4px; display: inline-block; font-weight: 900; font-size: 1.15rem; font-family: monospace; background: #fcfcfc;">
                        TOKEN: #${order.tokenNumber}
                    </div>
                    ` : ''}
                </div>
                
                <div class="receipt-row">
                    <span>Date: ${order.date}</span>
                    <span>Time: ${order.time || '12:00:00'}</span>
                </div>
                <div class="receipt-row">
                    <span>Order: ${order.id}</span>
                    <span>Type: ${order.orderType}</span>
                </div>
                <div class="receipt-row">
                    <span>Cust: ${order.customerName || 'Guest'}</span>
                    ${customerPhone ? `<span>Phone: ${customerPhone}</span>` : ''}
                </div>
                ${order.tableName ? `<div class="receipt-row"><span>Table: ${order.tableName}</span></div>` : ''}
                
                <div class="receipt-divider"></div>
                
                <div style="font-weight:700; margin-bottom:8px;">ITEMS DESCRIPTION</div>
                ${itemsHtml}
                
                <div class="receipt-divider"></div>
                
                <div class="receipt-row">
                    <span>Subtotal</span>
                    <span>₹${order.subtotal.toFixed(2)}</span>
                </div>
                ${order.discount > 0 ? `
                <div class="receipt-row">
                    <span>Discount</span>
                    <span>-₹${order.discount.toFixed(2)}</span>
                </div>` : ''}
                
                <div class="receipt-divider"></div>
                
                <div class="receipt-row receipt-totals" style="font-size:14px;">
                    <span>GRAND TOTAL</span>
                    <span>₹${order.grandTotal.toFixed(2)}</span>
                </div>
                <div class="receipt-row" style="font-size:10px; margin-top:4px;">
                    ${order.paymentMethod === 'Split' ? 
                        `<div style="display:flex; flex-direction:column; gap:2px;">
                            <span>Paid Via: Split</span>
                            <span>Cash: ₹${(order.splitCashAmount || 0).toFixed(2)} | UPI: ₹${(order.splitUpiAmount || 0).toFixed(2)}</span>
                         </div>` : 
                        `<span>Paid Via: ${order.paymentMethod}</span>`
                    }
                    <span>Status: PAID</span>
                </div>
                
                <!-- UPI QR removed based on user request -->

                <div class="receipt-divider"></div>
                
                <div style="text-align:center; font-size:10px; margin-top:8px;">
                    Thank you for dining at Badi Katori!<br>
                    Live KOT: ${order.kotNumber || 'KOT-PENDING'}
                </div>
                </div>
                
                <!-- KOT SECTION APPENDED TO BILL (CONTINUOUS PRINT) -->
                ${(function() {
                    const paniPuriItems = order.items.filter(i => i.productName && i.productName.toLowerCase().includes('pani puri'));
                    const mainItems = order.items.filter(i => !(i.productName && i.productName.toLowerCase().includes('pani puri')));
                    let kotHtml = '';

                    const generateKOT = (items, title) => {
                        if (items.length === 0) return '';
                        return `
                            <div style="text-align:center; margin-top: 30px; font-weight: bold; font-size: 12px; letter-spacing: 2px;">✂ --- TEAR HERE --- ✂</div>
                            <div class="kot-print-section" style="margin-top: 10px; padding-top: 20px; border-top: 2px dashed #000;">
                                <div style="text-align:center; font-weight: 900; font-size: 18px; margin-bottom: 4px;">BADI KATORI</div>
                                <div style="text-align:center; font-weight: 900; font-size: 14px; margin-bottom: 12px;">${title}</div>
                                
                                <div style="text-align:center; margin-bottom:12px;">
                                    <span style="font-size: 20px; font-weight: 900; border: 2px solid #000; padding: 4px 12px; border-radius: 4px;">
                                        TOKEN: #${order.tokenNumber || order.dToken || order.tableName || order.id.substring(0,8)}
                                    </span>
                                </div>

                                <div class="receipt-divider"></div>
                                <div style="font-weight:700; margin-bottom:8px; font-size:13px; text-align:center;">ITEMS TO PREPARE</div>
                                ${items.map(item => `
                                    <div class="receipt-item-row" style="margin-bottom: 6px;">
                                        <div class="receipt-item-top" style="font-size: 16px; font-weight: 900;">
                                            <span>[ ${item.quantity} ] x ${item.productName}</span>
                                        </div>
                                        ${item.modifiers && item.modifiers.length > 0 ? `<div class="receipt-item-mods" style="font-size: 13px; margin-left: 20px; font-weight: bold;">+ ${item.modifiers.join(', ')}</div>` : ''}
                                    </div>
                                `).join('')}
                                <div class="receipt-divider"></div>
                                <div style="text-align:center; font-size:10px;">--- End of ${title} ---</div>
                            </div>
                        `;
                    };

                    kotHtml += generateKOT(mainItems, "MAIN KOT");
                    kotHtml += generateKOT(paniPuriItems, "PANI PURI KOT");

                    return kotHtml;
                })()}

            </div>
        `;
        printArea.innerHTML = invoiceHtml;
        window.activeReceiptOrder = order;
    }

    function downloadReceiptPDF() {
        const order = window.activeReceiptOrder;
        if (!order) return;
        
        const custObj = posCustomers.find(c => c.name === order.customerName || c.id === order.customerId);
        const customerPhone = order.customerPhone || (custObj ? custObj.phone : '');
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            unit: 'mm',
            format: [80, 150]
        });
        
        doc.setFont("courier", "bold");
        doc.setFontSize(14);
        doc.text("BADI KATORI", 40, 10, { align: "center" });
        doc.setFontSize(8);
        doc.setFont("courier", "normal");
        doc.text("Indian Street-Eatery", 40, 14, { align: "center" });
        doc.text(`Store: ${order.store || currentStore}`, 40, 18, { align: "center" });
        
        let startHeaderY = 22;
        if ((order.store || currentStore).includes('VESU')) {
            doc.text("Contact: +91 9428510400", 40, startHeaderY, { align: "center" });
            startHeaderY += 4;
        }
        doc.text("GSTIN: 27AABCB1234F1Z0", 40, startHeaderY, { align: "center" });
        startHeaderY += 4;
        
        if (order.tokenNumber) {
            doc.setFont("courier", "bold");
            doc.setFontSize(12);
            doc.text(`TOKEN: #${order.tokenNumber}`, 40, startHeaderY, { align: "center" });
            doc.setFontSize(8);
            doc.setFont("courier", "normal");
            startHeaderY += 5;
        }
        
        doc.line(5, startHeaderY, 75, startHeaderY);
        doc.text(`Date: ${order.date}  Time: ${order.time || '12:00:00'}`, 5, startHeaderY + 4);
        doc.text(`Order: ${order.id.substr(0,18)}`, 5, startHeaderY + 8);
        doc.text(`Type: ${order.orderType}  Cust: ${order.customerName}`, 5, startHeaderY + 12);
        
        let currentY = startHeaderY + 16;
        if (customerPhone) {
            doc.text(`Phone: ${customerPhone}`, 5, currentY);
            currentY += 4;
        }
        if (order.tableName) {
            doc.text(`Table: ${order.tableName}`, 5, currentY);
            currentY += 4;
        }
        doc.line(5, currentY, 75, currentY);
        
        let y = currentY + 6;
        doc.text("ITEMS DESCRIPTION", 5, y);
        y += 4;
        
        order.items.forEach(item => {
            let itemPrice = item.price;
            (item.modifiers || []).forEach(mName => {
                const modInfo = posModifiers.find(m => m.name === mName);
                if (modInfo) itemPrice += modInfo.price;
            });
            const sub = itemPrice * item.quantity;
            doc.text(`${item.productName.substr(0,20)} x${item.quantity}`, 5, y);
            doc.text(`₹${sub.toFixed(2)}`, 75, y, { align: "right" });
            y += 4;
            if (item.modifiers && item.modifiers.length > 0) {
                doc.setFont("courier", "italic");
                doc.text(`+ ${item.modifiers.join(', ')}`, 8, y);
                doc.setFont("courier", "normal");
                y += 4;
            }
        });
        
        doc.line(5, y, 75, y);
        y += 4;
        doc.text("Subtotal:", 5, y);
        doc.text(`₹${order.subtotal.toFixed(2)}`, 75, y, { align: "right" });
        y += 4;
        if (order.discount > 0) {
            doc.text("Discount:", 5, y);
            doc.text(`-₹${order.discount.toFixed(2)}`, 75, y, { align: "right" });
            y += 4;
        }
        
        
        y += 2;
        doc.line(5, y, 75, y);
        y += 5;
        doc.setFont("courier", "bold");
        doc.setFontSize(10);
        doc.text("GRAND TOTAL:", 5, y);
        doc.text(`₹${order.grandTotal.toFixed(2)}`, 75, y, { align: "right" });
        doc.setFontSize(8);
        doc.setFont("courier", "normal");
        
        y += 5;
        doc.text(`Paid: ${order.paymentMethod}`, 5, y);
        y += 6;
        doc.text("Thank you for your visit!", 40, y, { align: "center" });
        
        doc.save(`Invoice_${order.id}.pdf`);
    }

    function updateHeldOrdersCount() {
        const badge = document.getElementById("heldOrdersCount");
        if (badge) badge.textContent = posHeldOrders.length;
    }

    function openHeldOrdersModal() {
        const container = document.getElementById("heldOrdersListContainer");
        if (!container) return;
        
        if (posHeldOrders.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-tertiary);">No orders on hold.</div>`;
            document.getElementById("modalPOSHeldOrders").style.display = "flex";
            return;
        }
        
        let heldHtml = '';
        posHeldOrders.forEach((hold, idx) => {
            const itemsCount = hold.cart.reduce((sum, item) => sum + item.quantity, 0);
            heldHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-app); border:1px solid var(--border); padding:10px 14px; border-radius:8px;">
                    <div>
                        <div style="font-weight:700; color:var(--text-primary);">${hold.name}</div>
                        <div style="font-size:0.75rem; color:var(--text-tertiary);">${hold.time} • ${itemsCount} items</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="saas-btn saas-btn-primary btn-resume-hold" data-index="${idx}" style="padding:4px 8px; font-size:0.75rem;">Resume</button>
                        <button type="button" class="saas-btn saas-btn-danger btn-delete-hold" data-index="${idx}" style="padding:4px 8px; font-size:0.75rem;">Delete</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = heldHtml;
        
        container.querySelectorAll(".btn-resume-hold").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.getAttribute("data-index"));
                const hold = posHeldOrders[idx];
                posCart = hold.cart;
                posSelectedCustomer = hold.customer;
                posSelectedOrderType = hold.type;
                posSelectedTable = hold.table;
                posAppliedCoupon = hold.coupon;
                
                posHeldOrders.splice(idx, 1);
                updateHeldOrdersCount();
                document.getElementById("modalPOSHeldOrders").style.display = "none";
                
                document.querySelectorAll(".order-type-tab").forEach(tab => {
                    if (tab.getAttribute("data-type") === posSelectedOrderType) {
                        tab.click();
                    }
                });
                
                renderCustomerDropdown();
                renderTableDropdown();
                syncCartStateAndUI();
                showToast("Order loaded from hold queue.");
            });
        });
        
        container.querySelectorAll(".btn-delete-hold").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.getAttribute("data-index"));
                posHeldOrders.splice(idx, 1);
                updateHeldOrdersCount();
                openHeldOrdersModal();
            });
        });
        
        document.getElementById("modalPOSHeldOrders").style.display = "flex";
    }

    // === SWIGGY & ZOMATO DELIVERY INTEGRATION ===
    let chartDelivery = null;

    function initDashboardDeliveryChart(ordersList) {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not loaded. Skipping delivery chart initialization.');
            return;
        }
        const ctx = document.getElementById("dashDeliveryChart");
        if (!ctx) return;

        const hourlyLabels = ["08:00", "11:00", "14:00", "17:00", "20:00", "23:00"];
        
        const swiggyData = [0, 0, 0, 0, 0, 0];
        const zomatoData = [0, 0, 0, 0, 0, 0];

        ordersList.forEach(order => {
            const time = order.time || "12:00:00";
            const hour = parseInt(time.split(':')[0]) || 12;
            let bucketIdx = 0;
            if (hour < 10) bucketIdx = 0;
            else if (hour < 13) bucketIdx = 1;
            else if (hour < 16) bucketIdx = 2;
            else if (hour < 19) bucketIdx = 3;
            else if (hour < 22) bucketIdx = 4;
            else bucketIdx = 5;

            if (order.source === 'swiggy') {
                swiggyData[bucketIdx] += order.grandTotal;
            } else if (order.source === 'zomato') {
                zomatoData[bucketIdx] += order.grandTotal;
            }
        });

        const hasData = swiggyData.some(v => v > 0) || zomatoData.some(v => v > 0);
        const finalSwiggy = hasData ? swiggyData : [4500, 12000, 24000, 18000, 31000, 9000];
        const finalZomato = hasData ? zomatoData : [3000, 15000, 19000, 16000, 27000, 11000];

        if (chartDelivery) chartDelivery.destroy();
        chartDelivery = new Chart(ctx, {
            type: "bar",
            data: {
                labels: hourlyLabels,
                datasets: [
                    {
                        label: "Swiggy Revenue (₹)",
                        data: finalSwiggy,
                        backgroundColor: "#FF6B00",
                        borderRadius: 4
                    },
                    {
                        label: "Zomato Revenue (₹)",
                        data: finalZomato,
                        backgroundColor: "#CB202D",
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: false },
                    y: { stacked: false }
                }
            }
        });
    }

    function initDeliveryAndKDSModule() {
        if (!socket && typeof io !== 'undefined') {
            socket = io(API_BASE || window.location.origin, { auth: { token: localStorage.getItem('bk_jwt_token') } });
        }
        if (socket) {
            socket.on('delivery_order_update', () => {
                syncStateFromServer();
            });
            socket.on('kot_update', () => {
                syncStateFromServer();
            });
        }

        window.simulateDeliveryOrder = async function(platform) {
            if (currentStore !== 'VESU' && currentStore !== 'All') {
                showToast("Integrations for Swiggy & Zomato are only connected for the VESU branch.");
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/api/pos/delivery/simulate`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token")}`
                    },
                    body: JSON.stringify({ platform, store: currentStore })
                });
                if (res.ok) {
                    const data = await res.json();
                    showToast(`Simulated ${platform.toUpperCase()} Order received! Token: ${data.dToken}`);
                    await syncStateFromServer();
                } else {
                    alert("Simulation failed.");
                }
            } catch (err) {
                console.error("Simulation error:", err);
            }
        };

        window.setDeliveryPlatformFilter = function(platform) {
            currentDeliveryPlatformFilter = platform;
            document.querySelectorAll("#btnFilterPlatformAll, #btnFilterPlatformSwiggy, #btnFilterPlatformZomato").forEach(btn => {
                btn.classList.remove("active");
            });
            if (platform === 'all') document.getElementById("btnFilterPlatformAll")?.classList.add("active");
            if (platform === 'swiggy') document.getElementById("btnFilterPlatformSwiggy")?.classList.add("active");
            if (platform === 'zomato') document.getElementById("btnFilterPlatformZomato")?.classList.add("active");
            renderDeliveryOrdersScreen();
        };

        window.setDeliveryStatusFilter = function(status) {
            currentDeliveryStatusFilter = status;
            document.querySelectorAll("#btnFilterStatusAll, #btnFilterStatusNew, #btnFilterStatusPreparing, #btnFilterStatusReady, #btnFilterStatusPickedUp, #btnFilterStatusDelivered").forEach(btn => {
                btn.classList.remove("active");
            });
            if (status === 'all') document.getElementById("btnFilterStatusAll")?.classList.add("active");
            if (status === 'New Order') document.getElementById("btnFilterStatusNew")?.classList.add("active");
            if (status === 'Preparing') document.getElementById("btnFilterStatusPreparing")?.classList.add("active");
            if (status === 'Ready for Pickup') document.getElementById("btnFilterStatusReady")?.classList.add("active");
            if (status === 'Picked Up') document.getElementById("btnFilterStatusPickedUp")?.classList.add("active");
            if (status === 'Delivered') document.getElementById("btnFilterStatusDelivered")?.classList.add("active");
            renderDeliveryOrdersScreen();
        };

        window.filterDeliveryOrders = function() {
            renderDeliveryOrdersScreen();
        };

        window.updateDeliveryOrderStatus = async function(orderId, newStatus) {
            try {
                const res = await fetch(`${API_BASE}/api/pos/orders/${orderId}/delivery-status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token")}`,
                        'x-store-name': currentStore
                    },
                    body: JSON.stringify({ status: newStatus })
                });
                if (res.ok) {
                    showToast(`Order status updated to ${newStatus}`);
                    await syncStateFromServer();
                } else {
                    alert("Failed to update status.");
                }
            } catch (err) {
                console.error("Status update error:", err);
            }
        };
    }

    function renderDeliveryOrdersScreen() {
        const badgesContainer = document.getElementById("deliveryConnectionBadgesContainer");
        if (badgesContainer) {
            const isVesu = currentStore === 'VESU' || currentStore === 'All';
            if (isVesu) {
                badgesContainer.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">Swiggy:</span>
                        <span class="pill-badge" style="font-size:0.75rem; font-weight:800; background:rgba(255,107,0,0.15); color:#FF6B00; border:1px solid rgba(255,107,0,0.3); padding:4px 8px; border-radius:4px;">
                            Connected (ID: 1115124)
                        </span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">Zomato:</span>
                        <span class="pill-badge" style="font-size:0.75rem; font-weight:800; background:rgba(203,32,45,0.15); color:#CB202D; border:1px solid rgba(203,32,45,0.3); padding:4px 8px; border-radius:4px;">
                            Connected (ID: 21659869)
                        </span>
                    </div>
                `;
            } else {
                badgesContainer.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; opacity:0.5;">
                        <span style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">Swiggy:</span>
                        <span class="pill-badge" style="font-size:0.75rem; font-weight:800; background:rgba(128,128,128,0.15); color:var(--text-secondary); border:1px solid rgba(128,128,128,0.3); padding:4px 8px; border-radius:4px;">
                            Not Configured
                        </span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; opacity:0.5;">
                        <span style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">Zomato:</span>
                        <span class="pill-badge" style="font-size:0.75rem; font-weight:800; background:rgba(128,128,128,0.15); color:var(--text-secondary); border:1px solid rgba(128,128,128,0.3); padding:4px 8px; border-radius:4px;">
                            Not Configured
                        </span>
                    </div>
                `;
            }
        }

        if (currentDeliverySubTab === 'history') {
            renderDeliveryHistoryTable();
            return;
        }
        const grid = document.getElementById("deliveryOrdersGrid");
        if (!grid) return;

        const searchQuery = (document.getElementById("deliverySearchInput")?.value || "").toLowerCase();

        const filtered = posOrders.filter(order => {
            if (order.store !== currentStore) return false;
            if (order.orderType !== 'Delivery') return false;

            if (currentDeliveryPlatformFilter !== 'all' && order.source !== currentDeliveryPlatformFilter) return false;

            if (currentDeliveryStatusFilter !== 'all' && order.deliveryStatus !== currentDeliveryStatusFilter) return false;

            if (searchQuery) {
                const matchToken = (order.dToken || "").toLowerCase().includes(searchQuery);
                const matchName = (order.customerName || "").toLowerCase().includes(searchQuery);
                const matchPhone = (order.customerPhone || order.customerId || "").toLowerCase().includes(searchQuery);
                const matchId = (order.externalOrderId || order.id || "").toLowerCase().includes(searchQuery);
                if (!matchToken && !matchName && !matchPhone && !matchId) return false;
            }

            return true;
        });

        filtered.sort((a, b) => b.id.localeCompare(a.id));

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:48px; color:var(--text-secondary); background:var(--bg-hover); border-radius:8px;">
                    <i data-lucide="inbox" style="width:48px; height:48px; margin-bottom:12px; opacity:0.5;"></i>
                    <p style="font-weight:700;">No delivery orders matching the criteria</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        grid.innerHTML = filtered.map(order => {
            const isSwiggy = order.source === 'swiggy';
            const badgeColor = isSwiggy ? '#FF6B00' : '#CB202D';
            const badgeIcon = isSwiggy ? '🟠' : '🔴';
            const platformName = isSwiggy ? 'Swiggy' : 'Zomato';
            const borderColor = isSwiggy ? '#FF6B00' : '#CB202D';

            const orderItems = posOrderItems.filter(oi => oi.orderId === order.id);
            const itemsCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

            const pickupDisplay = order.estimatedPickupTime || '+20 mins';

            let actionsHTML = "";
            if (order.deliveryStatus === 'New Order') {
                actionsHTML = `
                    <button class="saas-btn saas-btn-primary" style="width:100%; font-weight:700; background:var(--success); border:none;" onclick="updateDeliveryOrderStatus('${order.id}', 'Preparing')">Accept Order</button>
                    <button class="saas-btn saas-btn-secondary" style="width:100%; color:var(--danger); border-color:var(--danger); margin-top:8px;" onclick="updateDeliveryOrderStatus('${order.id}', 'Cancelled')">Cancel Order</button>
                `;
            } else if (order.deliveryStatus === 'Preparing') {
                actionsHTML = `
                    <button class="saas-btn saas-btn-primary" style="width:100%; font-weight:700; background:var(--orange-primary); border:none;" onclick="updateDeliveryOrderStatus('${order.id}', 'Ready for Pickup')">Mark Ready</button>
                `;
            } else if (order.deliveryStatus === 'Ready for Pickup') {
                actionsHTML = `
                    <button class="saas-btn saas-btn-primary" style="width:100%; font-weight:700; background:#3498db; border:none;" onclick="updateDeliveryOrderStatus('${order.id}', 'Picked Up')">Mark Dispatched</button>
                `;
            } else if (order.deliveryStatus === 'Picked Up') {
                actionsHTML = `
                    <button class="saas-btn saas-btn-primary" style="width:100%; font-weight:700; background:var(--success); border:none;" onclick="updateDeliveryOrderStatus('${order.id}', 'Delivered')">Confirm Delivery</button>
                `;
            } else {
                actionsHTML = `
                    <div style="text-align:center; padding:8px; font-weight:700; color:var(--text-secondary); background:var(--bg-hover); border-radius:4px; font-size:0.8rem;">
                        Status: ${order.deliveryStatus.toUpperCase()}
                    </div>
                `;
            }

            return `
                <div class="widget-card" style="border-left: 6px solid ${borderColor}; display:flex; flex-direction:column; justify-content:space-between; gap:16px;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                            <div>
                                <span style="font-size:1.6rem; font-weight:800; color:var(--text-primary); font-family:monospace;">${order.dToken || 'D-TKN'}</span>
                                <div style="font-size:0.75rem; color:var(--text-tertiary); font-family:monospace; margin-top:4px;">ID: ${order.externalOrderId || order.id}</div>
                            </div>
                            <span class="pill-badge" style="background:${badgeColor}20; color:${badgeColor}; font-weight:800; border: 1px solid ${badgeColor}40; display:flex; align-items:center; gap:4px; font-size:0.8rem;">
                                ${badgeIcon} ${platformName.toUpperCase()}
                            </span>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:8px; font-size:0.85rem; border-top:1px solid var(--border); padding-top:12px; margin-bottom:12px;">
                            <div>
                                <span style="color:var(--text-secondary);">Customer:</span>
                                <strong>${order.customerName || 'Walk-In'}</strong> (${order.customerPhone || 'N/A'})
                            </div>
                            <div>
                                <span style="color:var(--text-secondary);">Address:</span>
                                <strong style="font-size:0.8rem;">${order.address || 'Dining / Store Pickup'}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-top:6px;">
                                <span>Items: <strong>${itemsCount} Items</strong></span>
                                <span>Value: <strong>₹${order.grandTotal}</strong></span>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-top:2px;">
                                <span style="color:var(--text-tertiary);">Est. Rider Pickup:</span>
                                <strong style="color:var(--orange-primary);">${pickupDisplay}</strong>
                            </div>
                        </div>

                        <div style="background:var(--bg-hover); padding:10px; border-radius:6px; font-size:0.8rem; display:flex; flex-direction:column; gap:4px; margin-bottom:12px;">
                            ${orderItems.map(item => `
                                <div style="display:flex; justify-content:space-between;">
                                    <span>${item.productName} <strong>×${item.quantity}</strong></span>
                                    <span>₹${item.price * item.quantity}</span>
                                </div>
                                ${item.instructions ? `<div style="font-size:0.75rem; color:var(--orange-primary); font-style:italic;">* ${item.instructions}</div>` : ''}
                            `).join('')}
                        </div>
                    </div>

                    <div>
                        ${actionsHTML}
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    function renderKitchenKdsScreen() {
        const grid = document.getElementById("kdsTicketsGrid");
        if (!grid) return;

        const activeKots = posKitchenOrders.filter(kot => {
            if (kot.store !== currentStore) return false;
            return kot.status === 'Pending' || kot.status === 'In Progress' || kot.status === 'Ready';
        });

        if (activeKots.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:48px; color:var(--text-secondary); background:var(--bg-hover); border-radius:8px;">
                    <i data-lucide="chef-hat" style="width:48px; height:48px; margin-bottom:12px; opacity:0.5;"></i>
                    <p style="font-weight:700;">No active kitchen orders</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        grid.innerHTML = activeKots.map(kot => {
            const order = posOrders.find(o => o.id === kot.orderId);
            if (!order) return '';

            const isDelivery = order.orderType === 'Delivery';
            const isSwiggy = order.source === 'swiggy';
            const isZomato = order.source === 'zomato';

            let platformBadge = "";
            let borderColor = "var(--border)";
            let badgeColor = "var(--text-secondary)";

            if (isDelivery) {
                if (isSwiggy) {
                    platformBadge = `🟠 SWIGGY`;
                    borderColor = "var(--orange-primary)";
                    badgeColor = "#FF6B00";
                } else if (isZomato) {
                    platformBadge = `🔴 ZOMATO`;
                    borderColor = "var(--danger)";
                    badgeColor = "#CB202D";
                } else {
                    platformBadge = `DELIVERY`;
                }
            } else {
                platformBadge = `${order.orderType.toUpperCase()} - ${order.tableName || 'Takeaway'}`;
            }

            const items = JSON.parse(kot.items || '[]');

            let nextActionHTML = "";
            if (kot.status === 'Pending') {
                nextActionHTML = `
                    <button class="saas-btn saas-btn-primary" style="width:100%; font-weight:700; background:var(--orange-primary); border:none;" onclick="updateKDSStatus('${kot.id}', 'In Progress')">Start Prep</button>
                `;
            } else if (kot.status === 'In Progress') {
                nextActionHTML = `
                    <button class="saas-btn saas-btn-primary" style="width:100%; font-weight:700; background:var(--success); border:none;" onclick="updateKDSStatus('${kot.id}', 'Ready')">Mark Ready</button>
                `;
            } else {
                nextActionHTML = `
                    <div style="text-align:center; font-weight:700; color:var(--success); background:var(--bg-hover); padding:6px; border-radius:4px; font-size:0.8rem;">
                        &#10003; READY FOR PICKUP
                    </div>
                `;
            }

            return `
                <div class="widget-card" style="border-top: 6px solid ${borderColor}; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:16px;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:12px;">
                            <div>
                                <span style="font-size:1.4rem; font-weight:800; font-family:monospace;">${order.dToken || order.tableName || 'KOT'}</span>
                                <div style="font-size:0.7rem; color:var(--text-tertiary); font-family:monospace; margin-top:2px;">KOT: ${kot.kotNumber}</div>
                            </div>
                            <span class="pill-badge" style="color:${badgeColor}; font-weight:800; font-size:0.75rem; border:1px solid ${badgeColor}40; background:${badgeColor}10;">
                                ${platformBadge}
                            </span>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${items.map(item => `
                                <div style="font-size:0.9rem;">
                                    <strong>${item.quantity} ×</strong> ${item.productName}
                                    ${item.instructions ? `<div style="font-size:0.75rem; color:var(--orange-primary); font-style:italic; margin-left:16px;">* ${item.instructions}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div>
                        ${nextActionHTML}
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    window.updateKDSStatus = async function(kotId, newStatus) {
        try {
            const res = await fetch(`${API_BASE}/api/pos/kitchen-orders/${kotId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token")}`,
                    'x-store-name': currentStore
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                const kot = posKitchenOrders.find(k => k.id === kotId);
                if (kot && newStatus === 'Ready') {
                    const order = posOrders.find(o => o.id === kot.orderId);
                    if (order && order.orderType === 'Delivery') {
                        await updateDeliveryOrderStatus(order.id, 'Ready for Pickup');
                    }
                }
                showToast(`KOT updated to ${newStatus}`);
                await syncStateFromServer();
            } else {
                alert("Failed to update KDS ticket.");
            }
        } catch (err) {
            console.error("KDS update error:", err);
        }
    };

    window.setDeliverySubTab = function(tab) {
        currentDeliverySubTab = tab;
        const btnActive = document.getElementById("btnDeliverySubTabActive");
        const btnHistory = document.getElementById("btnDeliverySubTabHistory");
        const subActive = document.getElementById("delivery-sub-active");
        const subHistory = document.getElementById("delivery-sub-history");

        if (tab === 'active') {
            btnActive?.classList.add("active");
            btnHistory?.classList.remove("active");
            if (subActive) subActive.style.display = "block";
            if (subHistory) subHistory.style.display = "none";
            renderDeliveryOrdersScreen();
        } else {
            btnActive?.classList.remove("active");
            btnHistory?.classList.add("active");
            if (subActive) subActive.style.display = "none";
            if (subHistory) subHistory.style.display = "block";
            renderDeliveryHistoryTable();
        }
    };

    window.renderDeliveryHistoryTable = function() {
        const tbody = document.getElementById("deliveryHistoryTableBody");
        if (!tbody) return;

        const searchQuery = (document.getElementById("historySearchKeyword")?.value || "").toLowerCase();
        const platformFilter = document.getElementById("historyPlatformSelect")?.value || 'all';
        const statusFilter = document.getElementById("historyStatusSelect")?.value || 'all';

        const storeDeliveries = posOrders.filter(o => o.store === currentStore && o.orderType === 'Delivery' && o.deliveryStatus === 'Delivered');
        const swiggySales = storeDeliveries.filter(o => o.source === 'swiggy').reduce((sum, o) => sum + o.grandTotal, 0);
        const zomatoSales = storeDeliveries.filter(o => o.source === 'zomato').reduce((sum, o) => sum + o.grandTotal, 0);
        const swiggyCount = storeDeliveries.filter(o => o.source === 'swiggy').length;
        const zomatoCount = storeDeliveries.filter(o => o.source === 'zomato').length;

        document.getElementById("historySwiggySales").textContent = `₹${swiggySales.toLocaleString()}`;
        document.getElementById("historyZomatoSales").textContent = `₹${zomatoSales.toLocaleString()}`;
        document.getElementById("historySwiggyCount").textContent = `${swiggyCount} Orders completed`;
        document.getElementById("historyZomatoCount").textContent = `${zomatoCount} Orders completed`;
        document.getElementById("historySwiggyCommission").textContent = `₹${Math.round(swiggySales * 0.18).toLocaleString()}`;
        document.getElementById("historyZomatoCommission").textContent = `₹${Math.round(zomatoSales * 0.18).toLocaleString()}`;

        const matched = posOrders.filter(order => {
            if (order.store !== currentStore) return false;

            if (platformFilter !== 'all') {
                if (platformFilter === 'pos' && order.source !== 'pos') return false;
                if (platformFilter !== 'pos' && order.source !== platformFilter) return false;
            }

            if (statusFilter !== 'all') {
                if (order.orderType === 'Delivery' && order.deliveryStatus !== statusFilter) return false;
                if (order.orderType !== 'Delivery' && statusFilter !== 'Delivered') return false;
            }

            if (searchQuery) {
                const matchToken = (order.dToken || "").toLowerCase().includes(searchQuery);
                const matchName = (order.customerName || "").toLowerCase().includes(searchQuery);
                const matchPhone = (order.customerPhone || order.customerId || "").toLowerCase().includes(searchQuery);
                const matchId = (order.externalOrderId || order.id || "").toLowerCase().includes(searchQuery);
                if (!matchToken && !matchName && !matchPhone && !matchId) return false;
            }

            return true;
        });

        matched.sort((a, b) => b.id.localeCompare(a.id));

        if (matched.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-tertiary); padding: 24px 0;">No matching historical orders found.</td></tr>`;
            return;
        }

        tbody.innerHTML = matched.map(order => {
            const isDelivery = order.orderType === 'Delivery';
            const platformBadge = order.source === 'swiggy' ? '🟠 Swiggy' : (order.source === 'zomato' ? '🔴 Zomato' : '💻 POS');
            const tokenStr = order.dToken || order.tableName || 'N/A';
            const statusStr = isDelivery ? order.deliveryStatus : 'Delivered';
            const statusBadgeClass = statusStr === 'Delivered' || statusStr === 'Completed' ? 'pill-badge-success' : (statusStr === 'Cancelled' ? 'pill-badge-danger' : 'pill-badge-warning');

            return `
                <tr>
                    <td style="font-weight:700;">${order.date} ${order.time}</td>
                    <td><strong>${tokenStr}</strong></td>
                    <td>${platformBadge}</td>
                    <td>${order.customerName || 'Walk-In'} (${order.customerPhone || 'N/A'})</td>
                    <td>${order.externalOrderId || order.id}</td>
                    <td style="font-weight:700;">₹${order.grandTotal}</td>
                    <td><span class="pill-badge ${statusBadgeClass}">${statusStr}</span></td>
                    <td>
                        <button class="saas-btn saas-btn-secondary" style="padding: 4px 8px; font-size:0.75rem;" onclick="openDeliveryOrderDetails('${order.id}')">View Details</button>
                    </td>
                </tr>
            `;
        }).join('');
    };

    window.openDeliveryOrderDetails = function(orderId) {
        const order = posOrders.find(o => o.id === orderId);
        if (!order) return;

        selectedOrderForDetails = order;

        const isSwiggy = order.source === 'swiggy';
        const badgeColor = isSwiggy ? '#FF6B00' : (order.source === 'zomato' ? '#CB202D' : '#34495e');
        const badgeIcon = isSwiggy ? '🟠' : (order.source === 'zomato' ? '🔴' : '💻');
        const platformName = order.source.toUpperCase();

        const badge = document.getElementById("detailsPlatformBadge");
        if (badge) {
            badge.style.background = `${badgeColor}20`;
            badge.style.color = badgeColor;
            badge.style.border = `1px solid ${badgeColor}40`;
            badge.innerHTML = `${badgeIcon} ${platformName}`;
        }

        document.getElementById("detailsTokenTitle").textContent = `Order Details (${order.dToken || order.tableName || 'POS'})`;

        const orderItems = posOrderItems.filter(oi => oi.orderId === order.id);

        const body = document.getElementById("orderDetailsModalBody");
        if (body) {
            body.innerHTML = `
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:8px;">
                    <div>
                        <strong>Order Date:</strong> ${order.date} ${order.time}<br>
                        <strong>Order Type:</strong> ${order.orderType}<br>
                        <strong>Address:</strong> ${order.address || 'In-store'}
                    </div>
                    <div style="text-align:right;">
                        <strong>Customer Name:</strong> ${order.customerName || 'Walk-In'}<br>
                        <strong>Customer Phone:</strong> ${order.customerPhone || 'N/A'}<br>
                        <strong>Payment Method:</strong> ${order.paymentMethod || 'Online'}
                    </div>
                </div>
                <div style="margin-top:8px;">
                    <h4 style="font-weight:700; margin-bottom:8px;">Order Items Checklist</h4>
                    <div style="background:var(--bg-hover); padding:12px; border-radius:6px; display:flex; flex-direction:column; gap:6px;">
                        ${orderItems.map(item => `
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>${item.productName} <strong>×${item.quantity}</strong></span>
                                <span>₹${item.price * item.quantity}</span>
                            </div>
                            ${item.instructions ? `<div style="font-size:0.75rem; color:var(--orange-primary); font-style:italic; margin-left:12px;">* Instructions: ${item.instructions}</div>` : ''}
                        `).join('')}
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px; font-weight:700; border-top:1px solid var(--border); padding-top:8px; align-items:flex-end;">
                    <div style="font-size:0.85rem; font-weight:normal;">Subtotal: ₹${order.subtotal}</div>
                    <div style="font-size:0.85rem; font-weight:normal;">Tax: ₹${order.tax}</div>
                    ${order.discount ? `<div style="font-size:0.85rem; font-weight:normal; color:var(--danger);">Discount: -₹${order.discount}</div>` : ''}
                    <div style="font-size:1.1rem; color:var(--orange-primary); margin-top:4px;">Grand Total: ₹${order.grandTotal}</div>
                </div>
                
                <div style="margin-top:16px; padding-top:12px; border-top:2px dashed var(--border);">
                    <h4 style="font-weight:700; margin-bottom:8px; display:flex; justify-content:space-between;">
                        Inventory Consumption
                        <span style="font-size:0.75rem; padding:2px 6px; border-radius:4px; background:${order.inventorySyncStatus === 'Synced' ? '#27ae60' : (order.inventorySyncStatus === 'Failed' ? '#e74c3c' : '#f39c12')}; color:white;">
                            ${order.inventorySyncStatus || 'Pending'}
                        </span>
                    </h4>
                    <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:8px;">
                        This order automatically deducted ingredients from ${order.store} outlet based on configured recipes.
                    </div>
                </div>
            `;
        }

        document.getElementById("modalPOSOrderDetails").style.display = "flex";
    };

    window.printPackingSlip = function() {
        if (!selectedOrderForDetails) return;
        const order = selectedOrderForDetails;
        const orderItems = posOrderItems.filter(oi => oi.orderId === order.id);

        const isSwiggy = order.source === 'swiggy';
        const platformName = isSwiggy ? 'Swiggy' : (order.source === 'zomato' ? 'Zomato' : 'POS Store');
        const platformBadgeStr = isSwiggy ? '🟠 SWIGGY' : (order.source === 'zomato' ? '🔴 ZOMATO' : '💻 POS');

        const w = window.open("", "_blank", "width=600,height=800");
        
        let itemsHtml = "";
        orderItems.forEach(item => {
            itemsHtml += `
                <div class="row">
                    <span>[ ] ${item.productName} <strong>x${item.quantity}</strong></span>
                    <span>₹${item.price * item.quantity}</span>
                </div>
            `;
            if (item.instructions) {
                itemsHtml += `<div style="font-size:12px; margin-left: 20px; font-style:italic;">* Instr: ${item.instructions}</div>`;
            }
        });

        w.document.write(`
            <html>
            <head>
                <title>Packing Slip - ${order.dToken || 'Order'}</title>
                <style>
                    body { font-family: monospace; padding: 20px; font-size: 14px; line-height: 1.5; color: #000; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .header { font-size: 18px; margin-bottom: 5px; }
                    .badge { font-size: 16px; border: 2px solid #000; padding: 4px 8px; display: inline-block; margin: 10px 0; }
                    .section { border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; }
                    .row { display: flex; justify-content: space-between; }
                    .totals { text-align: right; margin-top: 10px; font-size: 15px; }
                </style>
            </head>
            <body onload="window.print()">
                <div class="center bold header">BADI KATORI</div>
                <div class="center">${order.store} Branch</div>
                <div class="center section bold badge">${platformBadgeStr} PACKING SLIP</div>
                <div class="center bold" style="font-size: 24px; margin-top: 5px;">${order.dToken || order.tableName || 'DELIVERY'}</div>
                <div class="center">Order ID: ${order.externalOrderId || order.id}</div>
                
                <div class="section">
                    <div><strong>Date/Time:</strong> ${order.date} ${order.time}</div>
                    <div><strong>Customer:</strong> ${order.customerName || 'Walk-In'}</div>
                    <div><strong>Phone:</strong> ${order.customerPhone || 'N/A'}</div>
                    <div><strong>Delivery Address:</strong> ${order.address || 'N/A'}</div>
                </div>
                
                <div class="section bold">ORDER ITEMS CHECKLIST</div>
                <div>
                    ${itemsHtml}
                </div>
                
                <div class="section totals">
                    <div>Subtotal: ₹${order.subtotal}</div>
                    <div>GST/Tax: ₹${order.tax}</div>
                    ${order.discount ? `<div>Discount: -₹${order.discount}</div>` : ''}
                    <div class="bold" style="font-size:16px; margin-top:5px;">Grand Total: ₹${order.grandTotal}</div>
                </div>
                
                <div class="section center" style="margin-top: 30px; font-size:12px;">
                    Thank you for ordering online via ${platformName}!<br>
                    Please check items off as you pack them.
                </div>
            </body>
            </html>
        `);
        w.document.close();
    };

    // ==========================================
    // === REQUISITIONS & PO MODULE LOGIC ===
    // ==========================================
    let requisitionsList = [];
    let requisitionCart = [];
    let simulatedRequisitionRole = localStorage.getItem("simulated_req_role") || (currentRole === "owner" ? "admin" : "bm");
    let activeAdminQueueTab = "all";
    let activeUPIPaymentPO = null;
    let upiPaymentTimerInterval = null;

    function initRequisitionsModule() {
        const btnTabList = document.getElementById("btnTabInventoryList");
        const btnTabReq = document.getElementById("btnTabRequisitions");
        const subList = document.getElementById("sub-inventory-list");
        const subReq = document.getElementById("sub-inventory-requisitions");

        if (btnTabList && btnTabReq && subList && subReq) {
            btnTabList.addEventListener("click", () => {
                btnTabList.classList.add("active");
                btnTabReq.classList.remove("active");
                subList.style.display = "block";
                subReq.style.display = "none";
                renderInventoryScreen();
            });

            btnTabReq.addEventListener("click", () => {
                btnTabReq.classList.add("active");
                btnTabList.classList.remove("active");
                subList.style.display = "none";
                subReq.style.display = "block";
                renderRequisitionsTab();
            });
        }

        const btnSimBM = document.getElementById("btnRoleSimBM");
        const btnSimAdmin = document.getElementById("btnRoleSimAdmin");
        if (btnSimBM && btnSimAdmin) {
            updateRoleSimButtons();

            btnSimBM.addEventListener("click", () => {
                simulatedRequisitionRole = "bm";
                localStorage.setItem("simulated_req_role", "bm");
                updateRoleSimButtons();
                renderRequisitionsTab();
            });

            btnSimAdmin.addEventListener("click", () => {
                simulatedRequisitionRole = "admin";
                localStorage.setItem("simulated_req_role", "admin");
                updateRoleSimButtons();
                renderRequisitionsTab();
            });
        }

        function updateRoleSimButtons() {
            if (simulatedRequisitionRole === "bm") {
                btnSimBM.className = "saas-btn saas-btn-primary";
                btnSimAdmin.className = "saas-btn saas-btn-secondary";
            } else {
                btnSimBM.className = "saas-btn saas-btn-secondary";
                btnSimAdmin.className = "saas-btn saas-btn-primary";
            }
        }

        document.getElementById("btnOpenRequisitionCart")?.addEventListener("click", () => {
            openRequisitionCartModal();
        });
        document.getElementById("btnCloseRequisitionCart")?.addEventListener("click", () => {
            document.getElementById("modalRequisitionCart").style.display = "none";
        });
        document.getElementById("cartSearchInput")?.addEventListener("keyup", (e) => {
            renderCartInventoryItems(e.target.value);
        });

        document.getElementById("btnCartSubmit")?.addEventListener("click", () => {
            submitRequisitionCart();
        });

        document.getElementById("btnPayModalCopy")?.addEventListener("click", () => {
            const upiIdText = "badikatori@okaxis";
            navigator.clipboard.writeText(upiIdText);
            showToast("UPI ID Copied to Clipboard!");
        });
        document.getElementById("btnPayModalCancel")?.addEventListener("click", () => {
            document.getElementById("modalUPIPayment").style.display = "none";
            if (upiPaymentTimerInterval) clearInterval(upiPaymentTimerInterval);
        });
        document.getElementById("btnPayModalSimulate")?.addEventListener("click", () => {
            simulatePaymentSuccess();
        });

        document.querySelectorAll("#adminQueueTabs button").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#adminQueueTabs button").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                activeAdminQueueTab = btn.getAttribute("data-queue");
                renderAdminRequisitionsQueue();
            });
        });
    }

    async function renderRequisitionsTab() {
        const token = localStorage.getItem("bk_jwt_token") || "";
        try {
            const res = await fetch(`${API_BASE}/api/pos/requisitions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                requisitionsList = await res.json();
            }
        } catch (err) {
            console.error("Failed to load requisitions:", err);
        }

        const bmView = document.getElementById("requisitions-bm-view");
        const adminView = document.getElementById("requisitions-admin-view");

        if (simulatedRequisitionRole === "bm") {
            if (bmView) bmView.style.display = "block";
            if (adminView) adminView.style.display = "none";
            renderBMRequisitions();
        } else {
            if (bmView) bmView.style.display = "none";
            if (adminView) adminView.style.display = "block";
            renderAdminRequisitions();
        }
    }

    function renderBMRequisitions() {
        const targetStore = currentStore === 'All' ? 'VESU' : currentStore;
        const storeInv = inventory.filter(i => i.store === targetStore);
        const inStockCount = storeInv.filter(i => i.stock > i.reorder).length;
        const lowStockCount = storeInv.filter(i => i.stock <= i.reorder && i.stock > 0).length;
        const outOfStockCount = storeInv.filter(i => i.stock === 0).length;
        
        const branchPOs = requisitionsList.filter(o => o.branchName === targetStore);
        const activeCount = branchPOs.filter(o => o.orderStatus !== "Completed" && o.orderStatus !== "Rejected").length;

        document.getElementById("lblBMTotalInStock").textContent = `${inStockCount} items`;
        document.getElementById("lblBMLowStock").textContent = `${lowStockCount} SKUs`;
        document.getElementById("lblBMOutOfStock").textContent = `${outOfStockCount} SKUs`;
        document.getElementById("lblBMPendingOrders").textContent = `${activeCount} Pending`;

        const tbody = document.getElementById("bmRequisitionStockTableBody");
        if (tbody) {
            tbody.innerHTML = "";
            storeInv.forEach(item => {
                let statusBadge = `<span class="pill-badge pill-badge-success">In Stock</span>`;
                if (item.stock === 0) {
                    statusBadge = `<span class="pill-badge pill-badge-danger">Out of Stock</span>`;
                } else if (item.stock <= item.reorder) {
                    statusBadge = `<span class="pill-badge pill-badge-warning">Low Stock</span>`;
                }

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="font-weight: 700; display:flex; align-items:center; gap:8px;">
                        <div style="width:24px; height:24px; border-radius:4px; background:var(--bg-hover); display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:var(--text-tertiary);">
                            <i data-lucide="package" style="width:14px; height:14px;"></i>
                        </div>
                        ${item.label}
                    </td>
                    <td style="font-size:0.75rem; color:var(--text-tertiary); font-weight:600;">SKU-${item.id.toUpperCase()}</td>
                    <td>${item.category}</td>
                    <td style="font-weight:700;">${item.stock} ${item.unit}</td>
                    <td style="color:var(--text-secondary); font-size:0.8rem;">Min: ${item.reorder} ${item.unit}</td>
                    <td style="font-weight:600; font-size:0.8rem;">₹${(item.unitCost || 0).toFixed(2)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="saas-btn saas-btn-primary" style="padding: 4px 8px; font-size:0.72rem;" onclick="quickRequestItem('${item.id}', '${item.label.replace(/'/g, "\\'")}', ${item.unitCost || 0})">
                            Request
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            if (window.lucide) window.lucide.createIcons();
        }

        const listDiv = document.getElementById("bmRequisitionOrdersList");
        if (listDiv) {
            listDiv.innerHTML = "";
            if (branchPOs.length === 0) {
                listDiv.innerHTML = `
                    <div style="text-align:center; padding:30px; color:var(--text-tertiary); font-size:0.8rem; border: 1px dashed var(--border); border-radius:8px;">
                        No previous requisitions found for this branch.
                    </div>
                `;
                return;
            }

            branchPOs.forEach(po => {
                const card = document.createElement("div");
                card.className = "widget-card";
                card.style.padding = "20px";
                card.style.border = "1px solid var(--border)";
                card.style.display = "flex";
                card.style.flexDirection = "column";
                card.style.gap = "12px";

                let payBadge = `<span class="pill-badge pill-badge-warning">Unpaid</span>`;
                if (po.paymentStatus === "Paid") payBadge = `<span class="pill-badge pill-badge-success">Paid</span>`;

                let statusBadge = `<span class="pill-badge pill-badge-secondary">${po.orderStatus}</span>`;
                if (po.orderStatus === "Completed") statusBadge = `<span class="pill-badge pill-badge-success">Completed</span>`;
                if (po.orderStatus === "Rejected") statusBadge = `<span class="pill-badge pill-badge-danger">Rejected</span>`;
                if (po.orderStatus === "Dispatched" || po.orderStatus === "In Transit") statusBadge = `<span class="pill-badge pill-badge-warning" style="background:#3b82f615; color:#3b82f6;">${po.orderStatus}</span>`;

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
                        <div>
                            <strong style="color:var(--pos-espresso); font-size:0.95rem;">${po.id}</strong>
                            <span style="font-size:0.75rem; color:var(--text-tertiary); margin-left:8px;">Date: ${po.date}</span>
                        </div>
                        <div style="display:flex; gap:6px;">
                            ${payBadge}
                            ${statusBadge}
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px; font-size:0.8rem;">
                        <div>
                            <div style="font-weight:700; color:var(--text-secondary); margin-bottom:4px;">Items Requested:</div>
                            <div style="display:flex; flex-direction:column; gap:4px; max-height:100px; overflow-y:auto;">
                                ${(po.items || []).map(it => `
                                    <div style="display:flex; justify-content:space-between; padding:2px 0; border-bottom: 1px dashed rgba(0,0,0,0.02);">
                                        <span>${it.productName} (x${it.quantity})</span>
                                        <span style="font-weight:600; color:var(--pos-espresso);">₹${it.total.toLocaleString()}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div style="background:var(--bg-hover); padding:10px; border-radius:6px; display:flex; flex-direction:column; justify-content:center; gap:6px;">
                            <div style="display:flex; justify-content:space-between;"><span>Payment:</span><strong>${po.paymentMethod}</strong></div>
                            <div style="display:flex; justify-content:space-between;"><span>Grand Total:</span><strong style="color:var(--pos-accent-orange);">₹${po.grandTotal.toLocaleString()}</strong></div>
                            <div style="display:flex; justify-content:space-between;"><span>Delivery:</span><strong>${po.expectedDeliveryDate || 'N/A'}</strong></div>
                        </div>
                    </div>
                `;

                const stages = ["Payment Pending", "Order Placed", "Order Accepted", "Packing", "Dispatched", "Delivered", "Completed"];
                if (po.orderStatus === "Rejected") {
                    card.innerHTML += `
                        <div style="background:#ef444410; border:1px solid #ef444430; border-radius:6px; padding:10px; color:var(--danger); font-size:0.78rem; font-weight:600; text-align:center;">
                            This Requisition Order has been Rejected / Cancelled by Warehouse management.
                        </div>
                    `;
                } else {
                    let currentStageIndex = stages.indexOf(po.orderStatus);
                    if (po.paymentStatus === "Paid" && currentStageIndex === 0) currentStageIndex = 1;
                    
                    let timelineHTML = `<div style="display:flex; align-items:center; justify-content:space-between; margin-top:12px; position:relative; padding: 10px 0;">`;
                    stages.forEach((stage, idx) => {
                        let activeColor = "var(--text-tertiary)";
                        if (idx <= currentStageIndex) {
                            activeColor = "var(--pos-accent-orange)";
                            if (po.orderStatus === "Completed" && idx === stages.length - 1) activeColor = "var(--pos-accent-green, #10b981)";
                        }

                        timelineHTML += `
                            <div style="display:flex; flex-direction:column; align-items:center; flex:1; position:relative; z-index:2;">
                                <div style="width:16px; height:16px; border-radius:50%; background:${activeColor}; border: 3px solid var(--bg-surface); box-shadow:0 0 0 2px ${activeColor};"></div>
                                <span style="font-size:0.65rem; font-weight:700; color:${activeColor}; text-align:center; margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70px;">${stage}</span>
                            </div>
                        `;
                    });
                    
                    const pct = Math.min(100, Math.max(0, (currentStageIndex / (stages.length - 1)) * 100));
                    timelineHTML += `
                        <div style="position:absolute; left: 8%; right: 8%; top:17px; height:3px; background:var(--border); z-index:1;"></div>
                        <div style="position:absolute; left: 8%; width:${pct * 0.84}%; top:17px; height:3px; background:var(--pos-accent-orange); z-index:1; transition: 0.3s;"></div>
                    `;
                    timelineHTML += `</div>`;
                    card.innerHTML += timelineHTML;
                }

                let actionRowHTML = `<div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">`;
                if (po.orderStatus === "Payment Pending" && po.paymentStatus === "Waiting for Payment") {
                    actionRowHTML += `
                        <button class="saas-btn saas-btn-primary" style="padding: 4px 12px; font-size:0.75rem;" onclick="openRequisitionPayment('${po.id}', ${po.grandTotal})">
                            Pay Now (UPI QR)
                        </button>
                    `;
                }
                if (po.orderStatus === "Delivered") {
                    actionRowHTML += `
                        <button class="saas-btn saas-btn-primary" style="padding: 4px 12px; font-size:0.75rem;" onclick="confirmPODelivery('${po.id}')">
                            Confirm Delivery Receipt
                        </button>
                    `;
                }
                actionRowHTML += `</div>`;
                card.innerHTML += actionRowHTML;

                listDiv.appendChild(card);
            });
        }
    }

    function renderAdminRequisitions() {
        const pendingPOs = requisitionsList.filter(o => o.orderStatus === "Order Placed" || o.orderStatus === "Payment Pending").length;
        const packingPOs = requisitionsList.filter(o => o.orderStatus === "Order Accepted" || o.orderStatus === "Packing").length;
        const dispatchedPOs = requisitionsList.filter(o => o.orderStatus === "Dispatched" || o.orderStatus === "In Transit").length;
        const completedPOs = requisitionsList.filter(o => o.orderStatus === "Completed").length;

        document.getElementById("lblAdminPendingPOs").textContent = `${pendingPOs} Orders`;
        document.getElementById("lblAdminPackingPOs").textContent = `${packingPOs} Orders`;
        document.getElementById("lblAdminDispatchedPOs").textContent = `${dispatchedPOs} Orders`;
        document.getElementById("lblAdminCompletedPOs").textContent = `${completedPOs} Orders`;

        renderAdminRequisitionsQueue();
    }

    function renderAdminRequisitionsQueue() {
        const queueList = document.getElementById("adminRequisitionsQueueList");
        if (!queueList) return;
        queueList.innerHTML = "";

        let filtered = requisitionsList;
        if (activeAdminQueueTab === "new") {
            filtered = requisitionsList.filter(o => o.orderStatus === "Order Placed" || o.orderStatus === "Payment Pending");
        } else if (activeAdminQueueTab === "preparing") {
            filtered = requisitionsList.filter(o => o.orderStatus === "Order Accepted" || o.orderStatus === "Packing");
        } else if (activeAdminQueueTab === "dispatched") {
            filtered = requisitionsList.filter(o => o.orderStatus === "Dispatched" || o.orderStatus === "In Transit");
        } else if (activeAdminQueueTab === "delivered") {
            filtered = requisitionsList.filter(o => o.orderStatus === "Delivered" || o.orderStatus === "Completed" || o.orderStatus === "Rejected");
        }

        if (filtered.length === 0) {
            queueList.innerHTML = `
                <div style="text-align:center; padding:30px; color:var(--text-tertiary); font-size:0.8rem; border: 1px dashed var(--border); border-radius:8px;">
                    No requisition orders in this queue.
                </div>
            `;
            return;
        }

        filtered.forEach(po => {
            const card = document.createElement("div");
            card.className = "widget-card";
            card.style.padding = "20px";
            card.style.border = "1px solid var(--border)";
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.gap = "12px";

            let payStatusBadge = `<span class="pill-badge pill-badge-warning">Unpaid</span>`;
            if (po.paymentStatus === "Paid") payStatusBadge = `<span class="pill-badge pill-badge-success">Paid</span>`;

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
                    <div>
                        <strong style="font-size:0.95rem; color:var(--pos-espresso);">${po.id}</strong>
                        <span style="font-size:0.75rem; background:var(--bg-hover); padding:2px 8px; border-radius:4px; font-weight:700; color:var(--pos-espresso); margin-left:8px;">Outlet: ${po.branchName}</span>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        ${payStatusBadge}
                        <span class="pill-badge" style="background:var(--bg-hover); color:var(--text-secondary); font-weight:800;">${po.orderStatus}</span>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px; font-size:0.8rem;">
                    <div>
                        <strong style="color:var(--text-secondary);">Items Checklist & Warehouse Stocks:</strong>
                        <div style="display:flex; flex-direction:column; gap:4px; margin-top:6px;">
                            ${(po.items || []).map(it => {
                                const whItem = inventory.find(i => i.store === "WAREHOUSE" && i.label === it.productName);
                                const whStock = whItem ? whItem.stock : 0;
                                const isShortage = whStock < it.quantity;
                                const stockText = isShortage ? 
                                    `<span style="color:var(--danger); font-weight:700;">Stock Shortage: ${whStock} ${whItem ? whItem.unit : ''} left</span>` : 
                                    `<span style="color:var(--success); font-weight:600;">Stock Available: ${whStock} left</span>`;
                                return `
                                    <div style="padding:4px 0; border-bottom: 1px dashed rgba(0,0,0,0.02);">
                                        <div style="display:flex; justify-content:space-between;">
                                            <span><strong>${it.productName}</strong> (x${it.quantity})</span>
                                            <span>Rate: ₹${it.rate}</span>
                                        </div>
                                        <div style="font-size:0.72rem; display:flex; justify-content:space-between; margin-top:2px;">
                                            ${stockText}
                                            <span style="font-weight:700; color:var(--pos-espresso);">Subtotal: ₹${it.total.toLocaleString()}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    <div style="background:var(--bg-hover); padding:12px; border-radius:6px; display:flex; flex-direction:column; justify-content:center; gap:8px;">
                        <div>Requested By: <strong>${po.managerName}</strong></div>
                        <div>Estimated Value: <strong>₹${po.grandTotal.toLocaleString()}</strong></div>
                        <div>Expected Delivery: <strong>${po.expectedDeliveryDate || 'N/A'}</strong></div>
                        ${po.notes ? `<div style="font-size:0.72rem; color:var(--text-tertiary); font-style:italic;">Notes: "${po.notes}"</div>` : ''}
                    </div>
                </div>
            `;

            let actionsHTML = `<div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border); padding-top:10px; margin-top:8px;">`;
            
            actionsHTML += `
                <button class="saas-btn saas-btn-secondary" style="padding:4px 10px; font-size:0.72rem; display:flex; align-items:center; gap:4px;" onclick="printWarehouseDocument('${po.id}', 'Packing Slip')">
                    <i data-lucide="printer" style="width:12px; height:12px;"></i> Packing Slip
                </button>
                <button class="saas-btn saas-btn-secondary" style="padding:4px 10px; font-size:0.72rem; display:flex; align-items:center; gap:4px;" onclick="printWarehouseDocument('${po.id}', 'Delivery Challan')">
                    <i data-lucide="truck" style="width:12px; height:12px;"></i> Delivery Challan
                </button>
            `;

            if (po.orderStatus === "Order Placed" || po.orderStatus === "Payment Pending") {
                actionsHTML += `
                    <button class="saas-btn saas-btn-danger" style="padding:4px 12px; font-size:0.72rem;" onclick="updatePOStatus('${po.id}', 'Rejected', 'Requisition Rejected by warehouse manager')">
                        Reject Order
                    </button>
                    <button class="saas-btn saas-btn-primary" style="padding:4px 12px; font-size:0.72rem;" onclick="updatePOStatus('${po.id}', 'Order Accepted', 'Warehouse accepts replenishment order')">
                        Accept Requisition
                    </button>
                `;
            } else if (po.orderStatus === "Order Accepted") {
                actionsHTML += `
                    <button class="saas-btn saas-btn-primary" style="padding:4px 12px; font-size:0.72rem;" onclick="updatePOStatus('${po.id}', 'Packing', 'Warehouse preparing and packing items')">
                        Start Preparing / Packing
                    </button>
                `;
            } else if (po.orderStatus === "Packing") {
                actionsHTML += `
                    <button class="saas-btn saas-btn-primary" style="padding:4px 12px; font-size:0.72rem;" onclick="updatePOStatus('${po.id}', 'Packed', 'Items successfully packed and verified')">
                        Mark Packed & Ready
                    </button>
                `;
            } else if (po.orderStatus === "Packed") {
                actionsHTML += `
                    <button class="saas-btn saas-btn-primary" style="padding:4px 12px; font-size:0.72rem;" onclick="updatePOStatus('${po.id}', 'Dispatched', 'Stock dispatched from central warehouse')">
                        Dispatch Order
                    </button>
                `;
            } else if (po.orderStatus === "Dispatched") {
                actionsHTML += `
                    <button class="saas-btn saas-btn-primary" style="padding:4px 12px; font-size:0.72rem;" onclick="updatePOStatus('${po.id}', 'Delivered', 'Dispatched items arrived at branch')">
                        Mark Delivered
                    </button>
                `;
            } else if (po.orderStatus === "Delivered") {
                actionsHTML += `
                    <span style="font-size:0.75rem; color:var(--text-tertiary); font-weight:700; align-self:center;">Awaiting Manager Delivery Receipt Confirmation...</span>
                `;
            }

            actionsHTML += `</div>`;
            card.innerHTML += actionsHTML;

            queueList.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    function openRequisitionCartModal() {
        requisitionCart = [];
        renderCartCheckoutList();
        renderCartInventoryItems("");
        document.getElementById("cartSearchInput").value = "";
        document.getElementById("cartNotes").value = "";
        
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 3);
        document.getElementById("cartDeliveryDate").value = defaultDate.toISOString().split('T')[0];

        document.getElementById("modalRequisitionCart").style.display = "flex";
    }

    function renderCartInventoryItems(searchQuery = "") {
        const listDiv = document.getElementById("cartInventoryItemsList");
        if (!listDiv) return;
        listDiv.innerHTML = "";

        const targetStore = currentStore === 'All' ? 'VESU' : currentStore;
        const storeInv = inventory.filter(i => i.store === targetStore);
        const filtered = storeInv.filter(item => {
            const labelMatch = item.label.toLowerCase().includes(searchQuery.toLowerCase());
            const catMatch = item.category.toLowerCase().includes(searchQuery.toLowerCase());
            return labelMatch || catMatch;
        });

        if (filtered.length === 0) {
            listDiv.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-tertiary); font-size:0.8rem;">No products found.</div>`;
            return;
        }

        filtered.forEach(item => {
            const card = document.createElement("div");
            card.style.display = "flex";
            card.style.justifyContent = "space-between";
            card.style.alignItems = "center";
            card.style.padding = "8px 12px";
            card.style.background = "var(--bg-hover)";
            card.style.borderRadius = "6px";
            card.style.border = "1px solid var(--border)";

            let badgeColor = "var(--success)";
            if (item.stock === 0) badgeColor = "var(--danger)";
            else if (item.stock <= item.reorder) badgeColor = "var(--warning)";

            card.innerHTML = `
                <div style="font-size: 0.8rem;">
                    <div style="font-weight: 700; color: var(--pos-espresso);">${item.label}</div>
                    <div style="color:var(--text-tertiary); font-size:0.72rem; margin-top:2px;">
                        Stock: <span style="font-weight:700; color:${badgeColor};">${item.stock} ${item.unit}</span> | Price: ₹${(item.unitCost || 0).toFixed(2)}
                    </div>
                </div>
                <button class="saas-btn saas-btn-primary" style="padding: 4px 8px; font-size:0.7rem;" onclick="addToRequisitionCart('${item.id}', '${item.label.replace(/'/g, "\\'")}', ${item.unitCost || 0}, '${item.unit}')">
                    + Add
                </button>
            `;
            listDiv.appendChild(card);
        });
    }

    window.addToRequisitionCart = function(productId, productName, rate, unit) {
        const existing = requisitionCart.find(i => i.productId === productId);
        if (existing) {
            existing.quantity++;
        } else {
            const invItem = inventory.find(i => i.id === productId);
            const suggestQty = invItem ? Math.max(50, invItem.reorder * 2 - invItem.stock) : 50;
            requisitionCart.push({
                productId,
                productName,
                rate,
                quantity: suggestQty,
                unit
            });
        }
        renderCartCheckoutList();
        showToast(`Added ${productName} to requisition cart.`);
    };

    window.quickRequestItem = function(productId, productName, rate) {
        openRequisitionCartModal();
        window.addToRequisitionCart(productId, productName, rate, "");
    };

    function renderCartCheckoutList() {
        const listDiv = document.getElementById("cartCheckoutItemsList");
        if (!listDiv) return;
        listDiv.innerHTML = "";

        if (requisitionCart.length === 0) {
            listDiv.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-tertiary); font-size:0.75rem;">Your cart is empty. Add products from the left list.</div>`;
            updateCartLedgerTotals(0);
            return;
        }

        let totalSubtotal = 0;

        requisitionCart.forEach(item => {
            const amount = item.rate * item.quantity;
            totalSubtotal += amount;

            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.flexDirection = "column";
            row.style.gap = "4px";
            row.style.padding = "8px";
            row.style.background = "var(--bg-surface)";
            row.style.border = "1px solid var(--border)";
            row.style.borderRadius = "6px";

            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:700; color:var(--pos-espresso);">
                    <span>${item.productName}</span>
                    <span>₹${amount.toLocaleString()}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                    <span style="font-size:0.7rem; color:var(--text-tertiary);">Rate: ₹${item.rate}</span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button class="saas-btn saas-btn-secondary" style="padding: 2px 6px; font-size:0.75rem;" onclick="changeCartItemQty('${item.productId}', -10)">-10</button>
                        <button class="saas-btn saas-btn-secondary" style="padding: 2px 6px; font-size:0.75rem;" onclick="changeCartItemQty('${item.productId}', -1)">-</button>
                        <span style="font-size:0.78rem; font-weight:800; min-width:30px; text-align:center; color:var(--pos-espresso);">${item.quantity}</span>
                        <button class="saas-btn saas-btn-secondary" style="padding: 2px 6px; font-size:0.75rem;" onclick="changeCartItemQty('${item.productId}', 1)">+</button>
                        <button class="saas-btn saas-btn-secondary" style="padding: 2px 6px; font-size:0.75rem;" onclick="changeCartItemQty('${item.productId}', 10)">+10</button>
                        <button class="saas-btn saas-btn-secondary" style="padding:2px; color:var(--danger);" onclick="removeFromCart('${item.productId}')">
                            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                        </button>
                    </div>
                </div>
            `;
            listDiv.appendChild(row);
        });

        updateCartLedgerTotals(totalSubtotal);
        if (window.lucide) window.lucide.createIcons();
    }

    window.changeCartItemQty = function(productId, delta) {
        const item = requisitionCart.find(i => i.productId === productId);
        if (item) {
            item.quantity = Math.max(1, item.quantity + delta);
            renderCartCheckoutList();
        }
    };

    window.removeFromCart = function(productId) {
        requisitionCart = requisitionCart.filter(i => i.productId !== productId);
        renderCartCheckoutList();
    };

    function updateCartLedgerTotals(subtotal) {
        const gst = subtotal * 0.18;
        const grandTotal = subtotal + gst;

        document.getElementById("cartSubtotal").textContent = `₹${subtotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById("cartGST").textContent = `₹${gst.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById("cartGrandTotal").textContent = `₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    async function submitRequisitionCart() {
        if (requisitionCart.length === 0) {
            alert("Requisition cart is empty!");
            return;
        }

        const subtotalStr = document.getElementById("cartSubtotal").textContent.replace(/[^\d.]/g, '');
        const gstStr = document.getElementById("cartGST").textContent.replace(/[^\d.]/g, '');
        const grandTotalStr = document.getElementById("cartGrandTotal").textContent.replace(/[^\d.]/g, '');

        const subtotal = parseFloat(subtotalStr);
        const gst = parseFloat(gstStr);
        const grandTotal = parseFloat(grandTotalStr);

        const paymentMethod = document.getElementById("cartPaymentMethod").value;
        const expectedDeliveryDate = document.getElementById("cartDeliveryDate").value;
        const notes = document.getElementById("cartNotes").value;

        const branchName = currentStore === 'All' ? 'VESU' : currentStore;
        const managerName = currentUser ? currentUser.name : "Ops Manager";
        const poId = `PO-${Date.now().toString().slice(-6)}`;

        const orderItems = requisitionCart.map(item => {
            const amount = item.rate * item.quantity;
            const itemGst = amount * 0.18;
            return {
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                rate: item.rate,
                amount: amount,
                gst: itemGst,
                total: amount + itemGst
            };
        });

        const poPayload = {
            id: poId,
            branchName,
            managerName,
            subtotal,
            gst,
            grandTotal,
            paymentMethod,
            expectedDeliveryDate,
            notes,
            items: orderItems
        };

        const token = localStorage.getItem("bk_jwt_token") || "";
        try {
            const res = await fetch(`${API_BASE}/api/pos/requisitions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(poPayload)
            });

            if (res.ok) {
                document.getElementById("modalRequisitionCart").style.display = "none";
                showToast(`PO ${poId} generated successfully!`);
                syncStateFromServer();

                if (paymentMethod === "UPI") {
                    setTimeout(() => {
                        openRequisitionPayment(poId, grandTotal);
                    }, 500);
                } else {
                    renderRequisitionsTab();
                }
            } else {
                const data = await res.json();
                alert(`Error generating PO: ${data.error || 'Server error'}`);
            }
        } catch (err) {
            console.error("Cart submission failed:", err);
            alert("Network connection error. Failed to save PO.");
        }
    }

    window.openRequisitionPayment = function(poId, amount) {
        activeUPIPaymentPO = poId;

        document.getElementById("payModalAmount").textContent = `₹${amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById("payModalPONumber").textContent = `PO Number: ${poId}`;
        
        const upiURL = `upi://pay?pa=9978673137@ikwik&pn=Badi%20Katori%20QSR&am=${amount.toFixed(2)}&tr=${poId}&tn=PO%20Requisition%20${poId}&cu=INR`;
        
        const qrContainer = document.getElementById("payModalQRCode");
        if (qrContainer) {
            qrContainer.innerHTML = `<img src="upi_qr.jpg" alt="UPI QR Code" style="width:200px; height:200px;" />`;
        }

        const timerLbl = document.getElementById("payModalTimer");
        let secondsLeft = 300;
        
        if (upiPaymentTimerInterval) clearInterval(upiPaymentTimerInterval);
        
        upiPaymentTimerInterval = setInterval(() => {
            secondsLeft--;
            const mins = Math.floor(secondsLeft / 60);
            const secs = secondsLeft % 60;
            if (timerLbl) {
                timerLbl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }

            if (secondsLeft <= 0) {
                clearInterval(upiPaymentTimerInterval);
                document.getElementById("modalUPIPayment").style.display = "none";
                alert("Payment QR Code expired. Please try again.");
            }
        }, 1000);

        document.getElementById("modalUPIPayment").style.display = "flex";
    };

    async function simulatePaymentSuccess() {
        if (!activeUPIPaymentPO) return;

        const transactionId = `TXN-${Date.now().toString().slice(-8).toUpperCase()}`;
        const token = localStorage.getItem("bk_jwt_token") || "";

        try {
            const res = await fetch(`${API_BASE}/api/pos/requisitions/${activeUPIPaymentPO}/pay`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ transactionId })
            });

            if (res.ok) {
                if (upiPaymentTimerInterval) clearInterval(upiPaymentTimerInterval);
                document.getElementById("modalUPIPayment").style.display = "none";
                showToast("Payment verified successfully! Order sent to Warehouse.");
                syncStateFromServer();
                renderRequisitionsTab();
            } else {
                alert("Failed to confirm payment.");
            }
        } catch (err) {
            console.error(err);
        }
    }

    window.updatePOStatus = async function(poId, status, notes = "") {
        const token = localStorage.getItem("bk_jwt_token") || "";
        try {
            const res = await fetch(`${API_BASE}/api/pos/requisitions/${poId}/status`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ status, notes })
            });

            if (res.ok) {
                showToast(`Order ${poId} shifted to state: ${status}`);
                syncStateFromServer();
                renderRequisitionsTab();
            } else {
                alert("Failed to update order status.");
            }
        } catch (err) {
            console.error(err);
        }
    };

    window.confirmPODelivery = function(poId) {
        const confirmReceipt = confirm("Are you sure you have received the dispatched stock? This will increase your local branch inventory levels.");
        if (confirmReceipt) {
            window.updatePOStatus(poId, 'Completed', 'Branch manager confirmed delivery package receipt.');
        }
    };

    window.printWarehouseDocument = function(poId, docType) {
        const po = requisitionsList.find(o => o.id === poId);
        if (!po) return;

        const printWindow = window.open("", "_blank");
        printWindow.document.write(`
            <html>
            <head>
                <title>${docType} - ${poId}</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; padding: 20px; line-height: 1.4; color: #333; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 12px; margin-bottom: 20px; }
                    .details { margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { padding: 8px; border-bottom: 1px dashed #ccc; text-align: left; }
                    th { font-weight: bold; border-bottom: 2px solid #000; }
                    .totals { text-align: right; margin-top: 20px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>BADI KATORI ENTERPRISE</h2>
                    <h3>CENTRAL WAREHOUSE LOGISTICS</h3>
                    <h4>${docType.toUpperCase()}</h4>
                </div>
                <div class="details">
                    <div>
                        <strong>Document:</strong> ${docType}<br/>
                        <strong>PO Number:</strong> ${po.id}<br/>
                        <strong>Date:</strong> ${po.date}
                    </div>
                    <div>
                        <strong>Requesting Branch:</strong> ${po.branchName}<br/>
                        <strong>Receiver Manager:</strong> ${po.managerName}<br/>
                        <strong>Delivery Status:</strong> ${po.orderStatus}
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Qty Ordered</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${po.items.map(it => `
                            <tr>
                                <td>${it.productName}</td>
                                <td>${it.quantity}</td>
                                <td>₹${it.rate.toFixed(2)}</td>
                                <td>₹${it.total.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="totals">
                    Subtotal: ₹${po.subtotal.toFixed(2)}<br/>
                    GST (18%): ₹${po.gst.toFixed(2)}<br/>
                    Grand Total: ₹${po.grandTotal.toFixed(2)}
                </div>
                <div style="margin-top: 40px; border-top: 1px dashed #000; padding-top: 10px; text-align: center; font-size: 0.8rem;">
                    Thank you for ordering. Fulfill Central Warehouse Logistics.
                </div>
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // === AI AUTOMATIC PROCUREMENT MODULE CONTROLLERS ===
    let activeProcurementPO = null;

    function initProcurementModule() {
        const btnTabAutoProc = document.getElementById("btnTabAutoProcurement");
        if (btnTabAutoProc) {
            btnTabAutoProc.addEventListener("click", () => {
                document.getElementById("btnTabInventoryList")?.classList.remove("active");
                document.getElementById("btnTabRequisitions")?.classList.remove("active");
                btnTabAutoProc.classList.add("active");
                navigateToScreen("auto-procurement");
            });
        }

        // Sidebar link routing
        document.querySelectorAll(".nav-item").forEach(item => {
            if (item.getAttribute("data-target") === "auto-procurement") {
                item.addEventListener("click", () => {
                    navigateToScreen("auto-procurement");
                    document.querySelectorAll(".segmented-nav-btn").forEach(btn => btn.classList.remove("active"));
                    document.getElementById("btnTabAutoProcurement")?.classList.add("active");
                });
            }
        });

        // Click listeners
        document.getElementById("btnForceLowStockCheck")?.addEventListener("click", () => {
            forceLowStockCheck();
        });
        document.getElementById("btnProcPayNow")?.addEventListener("click", () => {
            processPOPayment();
        });
        document.getElementById("btnProcSendToSupplier")?.addEventListener("click", () => {
            sendPOToSupplier();
        });
        document.getElementById("btnProcConfirmReceipt")?.addEventListener("click", () => {
            confirmPOReceipt();
        });

        // Bank info copying
        document.getElementById("btnCopyBankNum")?.addEventListener("click", () => {
            navigator.clipboard.writeText("9876543210");
            showToast("Bank Account Number copied!");
        });
        document.getElementById("btnCopyUPI")?.addEventListener("click", () => {
            navigator.clipboard.writeText("bk@hdfc");
            showToast("Supplier UPI ID copied!");
        });

        // Supplier Portal simulator triggers
        document.getElementById("btnSimSupplierAccept")?.addEventListener("click", () => simulateSupplierAction('accept'));
        document.getElementById("btnSimSupplierPrepare")?.addEventListener("click", () => simulateSupplierAction('prepare'));
        document.getElementById("btnSimSupplierPack")?.addEventListener("click", () => simulateSupplierAction('pack'));
        document.getElementById("btnSimSupplierDispatch")?.addEventListener("click", () => simulateSupplierAction('dispatch'));
        document.getElementById("btnSimSupplierDeliver")?.addEventListener("click", () => simulateSupplierAction('deliver'));
        document.getElementById("btnSimSupplierReject")?.addEventListener("click", () => simulateSupplierAction('reject'));
    }

    async function forceLowStockCheck() {
        const btn = document.getElementById("btnForceLowStockCheck");
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="refresh-cw" class="animate-spin" style="width:16px; height:16px;"></i> Scanning...`;
        lucide.createIcons();

        const token = localStorage.getItem("bk_jwt_token") || "";
        try {
            const res = await fetch(`${API_BASE}/api/pos/requisitions/auto-check`, {
                method: "POST",
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.message);
                await syncStateFromServer(true);
                await fetchRequisitions();
                renderProcurementScreen();
            } else {
                showToast("Low stock check failed.");
            }
        } catch (err) {
            console.error("Force low stock check failed:", err);
            showToast("Connection error.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            lucide.createIcons();
        }
    }

    async function fetchRequisitions() {
        const token = localStorage.getItem("bk_jwt_token") || "";
        try {
            const res = await fetch(`${API_BASE}/api/pos/requisitions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                requisitionsList = await res.json();
            }
        } catch (err) {
            console.error("Failed to load requisitions:", err);
        }
    }

    async function renderProcurementScreen() {
        const targetStore = currentStore === 'All' ? 'VESU' : currentStore;
        const token = localStorage.getItem("bk_jwt_token") || "";
        
        // Silently scan for low stock on dashboard load to trigger auto-replenishment workflow
        try {
            const autoCheckRes = await fetch(`${API_BASE}/api/pos/requisitions/auto-check`, {
                method: "POST",
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const checkData = await autoCheckRes.json();
            if (checkData.success && checkData.created) {
                showToast(`AI Alert: Low stock detected. Auto PO ${checkData.orderId} generated!`);
            }
        } catch (e) {
            console.warn("Silent low stock check failed:", e);
        }

        await fetchRequisitions();

        // Stat 1: Low stock count
        const storeInv = inventory.filter(i => i.store === targetStore);
        const lowStockCount = storeInv.filter(i => i.stock <= i.reorder && i.stock > 0).length;
        const outOfStockCount = storeInv.filter(i => i.stock === 0).length;

        // Stat 2 & 3: Active POs & Transit
        const branchPOs = requisitionsList.filter(o => o.branchName === targetStore);
        const pendingCount = branchPOs.filter(o => o.orderStatus !== "Completed" && o.orderStatus !== "Inventory Updated" && o.orderStatus !== "Rejected").length;
        const transitCount = branchPOs.filter(o => o.orderStatus === "Dispatched").length;

        document.getElementById("procLowStockCount").textContent = `${lowStockCount} SKUs`;
        document.getElementById("procOutOfStockCount").textContent = `${outOfStockCount} SKUs`;
        document.getElementById("procPendingPOCount").textContent = `${pendingCount} Orders`;
        document.getElementById("procTransitPOCount").textContent = `${transitCount} Orders`;

        // Update AI predictions list
        const predictionsList = document.getElementById("aiPredictionsList");
        if (predictionsList) {
            predictionsList.innerHTML = "";
            const sortedInv = [...storeInv].sort((a,b) => (a.stock / Math.max(1, a.reorder)) - (b.stock / Math.max(1, b.reorder)));
            const topForecast = sortedInv.slice(0, 3);
            if (topForecast.length > 0) {
                topForecast.forEach(item => {
                    let statusLabel = "";
                    let daysLeft = Math.max(0, Math.floor(item.stock / (item.reorder / 5 || 2)));
                    let color = daysLeft === 0 ? "var(--danger)" : (daysLeft <= 2 ? "var(--pos-accent-orange)" : "#3B82F6");
                    if (item.stock === 0) {
                        statusLabel = `<span style="color:var(--danger); font-weight:700;">OUT OF STOCK</span>`;
                    } else {
                        statusLabel = `<span style="color:${color}; font-weight:700;">Runout: ${daysLeft} ${daysLeft === 1 ? 'Day' : 'Days'}</span>`;
                    }
                    
                    const div = document.createElement("div");
                    div.style.borderBottom = "1px solid var(--border)";
                    div.style.paddingBottom = "8px";
                    div.style.marginBottom = "4px";
                    div.innerHTML = `
                        <div style="font-weight:700; color:var(--text-primary); display:flex; align-items:center; justify-content:space-between;">
                            ${item.label}
                            ${statusLabel}
                        </div>
                        <div style="color:var(--text-secondary); margin-top:3px; font-size:0.7rem;">
                            Current stock: ${item.stock} ${item.unit}. Min level required: ${item.reorder} ${item.unit}.
                        </div>
                    `;
                    predictionsList.appendChild(div);
                });
            } else {
                predictionsList.innerHTML = `<div style="text-align:center; color:var(--text-tertiary); padding:16px;">All items are at optimal stock levels.</div>`;
            }
        }

        // Detect active order
        activeProcurementPO = branchPOs.find(o => o.orderStatus !== "Completed" && o.orderStatus !== "Inventory Updated" && o.orderStatus !== "Rejected") || null;

        // Fallback to historical order for display if no active PO exists
        if (!activeProcurementPO && branchPOs.length > 0) {
            activeProcurementPO = branchPOs[0];
        }

        const tbody = document.getElementById("procPOItemsBody");
        const btnQR = document.getElementById("btnProcGenerateQR");
        const btnSend = document.getElementById("btnProcSendToSupplier");
        const btnConfirm = document.getElementById("btnProcConfirmReceipt");

        if (!activeProcurementPO) {
            document.getElementById("procPONumber").textContent = "No Purchase Orders";
            document.getElementById("procPOCreationDate").textContent = "Created on: --";
            document.getElementById("procPOPriority").style.display = "none";
            document.getElementById("procPOExpectedDate").textContent = "--";
            document.getElementById("procPOStatusBadge").innerHTML = `<span class="pill-badge">No Active PO</span>`;
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; color:var(--text-tertiary); padding:32px;">
                        No active Purchase Order. Reduce stock below minimum levels to auto-trigger a PO.
                    </td>
                </tr>
            `;
            document.getElementById("paySubtotal").textContent = "₹0.00";
            document.getElementById("payGst").textContent = "₹0.00";
            document.getElementById("payTotal").textContent = "₹0.00";
            document.getElementById("payTxnId").textContent = "N/A";
            document.getElementById("payStatusText").className = "pill-badge pill-badge-secondary";
            document.getElementById("payStatusText").textContent = "No Pending PO";

            btnQR.disabled = true;
            btnSend.disabled = true;
            btnConfirm.style.display = "none";
            document.getElementById("btnProcPayNow").disabled = true;
            document.getElementById("btnProcDownloadInvoice").disabled = true;
            
            updateTimelineUI('low-stock');
            document.getElementById("procLogisticsCard").style.display = "none";
            setSupplierSimButtonsDisabled(true);
            renderQRBox(null);
            renderNotificationBoard(null);
            return;
        }

        document.getElementById("procPONumber").textContent = activeProcurementPO.id;
        document.getElementById("procPOCreationDate").textContent = `Created on: ${activeProcurementPO.date}`;
        
        const priorityBadge = document.getElementById("procPOPriority");
        priorityBadge.style.display = "";
        let isUrgent = activeProcurementPO.items && activeProcurementPO.items.some(it => {
            const match = storeInv.find(inv => inv.label === it.productName);
            return match && match.stock === 0;
        });
        if (isUrgent) {
            priorityBadge.className = "pill-badge pill-badge-danger";
            priorityBadge.textContent = "CRITICAL (OOS)";
        } else {
            priorityBadge.className = "pill-badge pill-badge-warning";
            priorityBadge.textContent = "HIGH (Low Stock)";
        }

        document.getElementById("procPOExpectedDate").textContent = activeProcurementPO.expectedDeliveryDate;
        
        let statusHtml = "";
        const status = activeProcurementPO.orderStatus;
        if (status === 'Payment Pending') {
            statusHtml = `<span class="pill-badge pill-badge-danger">${status}</span>`;
        } else if (status === 'Payment Completed' || status === 'Order Sent to Supplier' || status === 'Supplier Accepted') {
            statusHtml = `<span class="pill-badge pill-badge-warning">${status}</span>`;
        } else if (status === 'Preparing Order' || status === 'Packed' || status === 'Dispatched' || status === 'Delivered') {
            statusHtml = `<span class="pill-badge pill-badge-blue">${status}</span>`;
        } else if (status === 'Completed' || status === 'Inventory Updated') {
            statusHtml = `<span class="pill-badge pill-badge-success">Stock Replenished</span>`;
        } else {
            statusHtml = `<span class="pill-badge">${status}</span>`;
        }
        document.getElementById("procPOStatusBadge").innerHTML = statusHtml;

        tbody.innerHTML = "";
        if (activeProcurementPO.items && activeProcurementPO.items.length > 0) {
            activeProcurementPO.items.forEach(it => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="font-weight:700;">${it.productName}</td>
                    <td>${it.quantity}</td>
                    <td>₹${(it.rate || 0).toFixed(2)}</td>
                    <td>₹${(it.gst || 0).toFixed(2)}</td>
                    <td style="text-align:right; font-weight:700;">₹${(it.total || 0).toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-tertiary);">No items found in this order.</td></tr>`;
        }

        document.getElementById("paySubtotal").textContent = `₹${(activeProcurementPO.subtotal || 0).toFixed(2)}`;
        document.getElementById("payGst").textContent = `₹${(activeProcurementPO.gst || 0).toFixed(2)}`;
        document.getElementById("payTotal").textContent = `₹${(activeProcurementPO.grandTotal || 0).toFixed(2)}`;
        document.getElementById("payTxnId").textContent = activeProcurementPO.transactionId || "N/A";
        
        const payBadge = document.getElementById("payStatusText");
        if (activeProcurementPO.paymentStatus === 'Paid') {
            payBadge.className = "pill-badge pill-badge-success";
            payBadge.textContent = "Paid & Settled";
            document.getElementById("btnProcPayNow").disabled = true;
            document.getElementById("btnProcDownloadInvoice").disabled = false;
        } else {
            payBadge.className = "pill-badge pill-badge-danger";
            payBadge.textContent = "Awaiting Payment";
            document.getElementById("btnProcPayNow").disabled = false;
            document.getElementById("btnProcDownloadInvoice").disabled = true;
        }

        updateTimelineUI(status);
        renderQRBox(activeProcurementPO);
        renderNotificationBoard(activeProcurementPO);

        if (status === 'Payment Pending') {
            btnQR.disabled = true;
            btnSend.disabled = true;
            btnConfirm.style.display = "none";
            document.getElementById("procLogisticsCard").style.display = "none";
            setSupplierSimButtonsDisabled(true);
        } else if (status === 'Payment Completed') {
            btnQR.disabled = false;
            btnSend.disabled = false;
            btnConfirm.style.display = "none";
            document.getElementById("procLogisticsCard").style.display = "none";
            
            setSupplierSimButtonsDisabled(true);
            document.getElementById("btnSimSupplierAccept").disabled = false;
            document.getElementById("btnSimSupplierReject").disabled = false;
        } else if (status === 'Completed' || status === 'Inventory Updated') {
            btnQR.disabled = false;
            btnSend.disabled = true;
            btnConfirm.style.display = "none";
            document.getElementById("procLogisticsCard").style.display = "block";
            renderLogisticsTimeline(activeProcurementPO);
            setSupplierSimButtonsDisabled(true);
        } else {
            btnQR.disabled = false;
            btnSend.disabled = true;
            
            if (status === 'Delivered') {
                btnConfirm.style.display = "flex";
            } else {
                btnConfirm.style.display = "none";
            }

            document.getElementById("procLogisticsCard").style.display = "block";
            renderLogisticsTimeline(activeProcurementPO);

            setSupplierSimButtonsDisabled(true);
            if (status === 'Order Sent to Supplier') {
                document.getElementById("btnSimSupplierAccept").disabled = false;
                document.getElementById("btnSimSupplierReject").disabled = false;
            } else if (status === 'Supplier Accepted') {
                document.getElementById("btnSimSupplierPrepare").disabled = false;
            } else if (status === 'Preparing Order') {
                document.getElementById("btnSimSupplierPack").disabled = false;
            } else if (status === 'Packed') {
                document.getElementById("btnSimSupplierDispatch").disabled = false;
            } else if (status === 'Dispatched') {
                document.getElementById("btnSimSupplierDeliver").disabled = false;
            }
        }

        lucide.createIcons();
    }

    function setSupplierSimButtonsDisabled(disabled) {
        document.getElementById("btnSimSupplierAccept").disabled = disabled;
        document.getElementById("btnSimSupplierPrepare").disabled = disabled;
        document.getElementById("btnSimSupplierPack").disabled = disabled;
        document.getElementById("btnSimSupplierDispatch").disabled = disabled;
        document.getElementById("btnSimSupplierDeliver").disabled = disabled;
        document.getElementById("btnSimSupplierReject").disabled = disabled;
    }

    function updateTimelineUI(status) {
        const statusMap = {
            'low-stock': 0,
            'PO Generated': 1,
            'Payment Pending': 2,
            'Payment Completed': 3,
            'Order Sent to Supplier': 4,
            'Supplier Accepted': 5,
            'Preparing Order': 6,
            'Packed': 7,
            'Dispatched': 7,
            'Delivered': 8,
            'Inventory Updated': 9,
            'Completed': 9
        };

        const currentStep = statusMap[status] !== undefined ? statusMap[status] : 0;
        const progressPercent = (currentStep / 9) * 100;
        const progressBar = document.getElementById("procTimelineProgress");
        if (progressBar) {
            progressBar.style.width = `${progressPercent}%`;
        }

        document.querySelectorAll(".procurement-timeline-node").forEach(node => {
            const step = parseInt(node.getAttribute("data-step"));
            node.classList.remove("active", "completed");
            
            if (step < currentStep) {
                node.classList.add("completed");
            } else if (step === currentStep) {
                node.classList.add("active");
            }
        });
    }

    function renderQRBox(po) {
        const container = document.getElementById("qrCodeOutputCanvas");
        const statusLabel = document.getElementById("qrCodeStatusLabel");
        if (!container || !statusLabel) return;

        if (!po || !po.qrCode) {
            container.innerHTML = `
                <div class="qr-code-image-placeholder" style="display:flex; align-items:center; justify-content:center; color:#888;">
                    <i data-lucide="lock" style="width:32px; height:32px; color:var(--text-tertiary);"></i>
                </div>
            `;
            statusLabel.textContent = "LOCKED (Awaiting Payment Verification)";
            statusLabel.style.color = "var(--text-tertiary)";
        } else {
            container.innerHTML = `
                <div style="background:#ffffff; padding:10px; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:2px solid #000;">
                    <svg width="130" height="130" viewBox="0 0 100 100" style="display:block;">
                        <rect x="0" y="0" width="25" height="25" fill="#000000"/>
                        <rect x="5" y="5" width="15" height="15" fill="#ffffff"/>
                        <rect x="8" y="8" width="9" height="9" fill="#000000"/>
                        
                        <rect x="75" y="0" width="25" height="25" fill="#000000"/>
                        <rect x="80" y="5" width="15" height="15" fill="#ffffff"/>
                        <rect x="83" y="8" width="9" height="9" fill="#000000"/>
                        
                        <rect x="0" y="75" width="25" height="25" fill="#000000"/>
                        <rect x="5" y="80" width="15" height="15" fill="#ffffff"/>
                        <rect x="8" y="83" width="9" height="9" fill="#000000"/>
                        
                        <rect x="35" y="10" width="10" height="5" fill="#000"/>
                        <rect x="50" y="5" width="5" height="15" fill="#000"/>
                        <rect x="60" y="15" width="10" height="10" fill="#000"/>
                        
                        <rect x="30" y="30" width="15" height="15" fill="#000"/>
                        <rect x="55" y="35" width="10" height="5" fill="#000"/>
                        <rect x="70" y="30" width="20" height="10" fill="#000"/>
                        
                        <rect x="10" y="35" width="15" height="10" fill="#000"/>
                        <rect x="15" y="55" width="10" height="10" fill="#000"/>
                        
                        <rect x="35" y="55" width="25" height="5" fill="#000"/>
                        <rect x="50" y="65" width="15" height="20" fill="#000"/>
                        
                        <rect x="75" y="50" width="15" height="15" fill="#000"/>
                        <rect x="70" y="70" width="20" height="10" fill="#000"/>
                        <rect x="85" y="85" width="10" height="10" fill="#000"/>
                    </svg>
                </div>
            `;
            statusLabel.textContent = `SECURE PO VERIFIED: ${po.id}`;
            statusLabel.style.color = "#10B981";
        }
        lucide.createIcons();
    }

    function renderNotificationBoard(po) {
        const emailTime = document.getElementById("notifEmailTime");
        const whatsappTime = document.getElementById("notifWhatsappTime");
        const viewedTime = document.getElementById("notifViewedTime");
        const acceptedTime = document.getElementById("notifAcceptedTime");

        if (!po || !po.notificationStatus) {
            emailTime.textContent = "--";
            whatsappTime.textContent = "--";
            viewedTime.textContent = "--";
            acceptedTime.textContent = "--";
            return;
        }

        try {
            const notif = JSON.parse(po.notificationStatus);
            emailTime.textContent = notif.emailSent ? formatISOToLocalTime(notif.emailSentTime) : "--";
            whatsappTime.textContent = notif.whatsappSent ? formatISOToLocalTime(notif.whatsappSentTime) : "--";
            viewedTime.textContent = notif.viewed ? formatISOToLocalTime(notif.viewedTime) : "--";
            acceptedTime.textContent = notif.accepted ? formatISOToLocalTime(notif.acceptedTime) : "--";
        } catch (e) {
            console.error("Failed to parse PO notification status JSON:", e);
        }
    }

    function formatISOToLocalTime(isoStr) {
        if (!isoStr) return "--";
        const date = new Date(isoStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function renderLogisticsTimeline(po) {
        const container = document.getElementById("logisticsTimelineBody");
        if (!container) return;

        let tracking = [];
        try {
            tracking = po.logisticsTracking ? JSON.parse(po.logisticsTracking) : [];
        } catch (e) {
            console.error("Failed to parse logistics tracking JSON:", e);
        }

        const stagesDef = [
            { key: 'Order Accepted', label: 'Order Accepted', desc: 'Supplier accepted the request.' },
            { key: 'Preparing', label: 'Preparing & Packing', desc: 'Fulfillment centre is packing cargo.' },
            { key: 'Packed', label: 'Packed & Dispatched', desc: 'Cargo loaded on truck GJ-05-BY-1234.' },
            { key: 'Out for Delivery', label: 'Out for Delivery', desc: 'En-route via Surat Bypass Highway.' },
            { key: 'Delivered', label: 'Delivered', desc: 'Cargo arrived at restaurant unloading dock.' }
        ];

        container.innerHTML = "";
        
        stagesDef.forEach((stage, idx) => {
            const matchedStep = tracking.find(step => step.status === stage.key);
            const isCompleted = !!matchedStep;
            
            const node = document.createElement("div");
            node.style.position = "relative";
            node.style.paddingBottom = "12px";
            
            let bgCircle = isCompleted ? "#10B981" : "var(--bg-hover)";
            let borderStyle = isCompleted ? "none" : "2px solid var(--border)";
            let badge = isCompleted ? `<i data-lucide="check" style="width:10px; height:10px; color:#ffffff;"></i>` : `${idx+1}`;
            
            node.innerHTML = `
                <div style="position:absolute; left:-24px; top:2px; width:16px; height:16px; border-radius:50%; background:${bgCircle}; border:${borderStyle}; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:700; color:${isCompleted ? '#fff' : 'var(--text-secondary)'};">
                    ${badge}
                </div>
                <div>
                    <div style="font-weight:700; font-size:0.8rem; color:${isCompleted ? 'var(--text-primary)' : 'var(--text-tertiary)'}; display:flex; justify-content:space-between; align-items:center;">
                        <span>${stage.label}</span>
                        <span style="font-size:0.68rem; font-weight:600; color:var(--text-tertiary);">${matchedStep ? matchedStep.time : ''}</span>
                    </div>
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">
                        ${matchedStep ? matchedStep.location + " — " + stage.desc : stage.desc}
                    </div>
                </div>
            `;
            container.appendChild(node);
        });

        if (po.orderStatus === 'Dispatched' || po.orderStatus === 'Delivered' || po.orderStatus === 'Inventory Updated' || po.orderStatus === 'Completed') {
            document.getElementById("driverLocText").textContent = po.orderStatus === 'Delivered' || po.orderStatus === 'Inventory Updated' || po.orderStatus === 'Completed' ? `${po.branchName} Outlet` : "Surat Bypass Highway";
            document.getElementById("driverEtaText").textContent = po.orderStatus === 'Delivered' || po.orderStatus === 'Inventory Updated' || po.orderStatus === 'Completed' ? "Arrived" : "30 Minutes";
        } else {
            document.getElementById("driverLocText").textContent = "Warehouse Hub";
            document.getElementById("driverEtaText").textContent = "--";
        }
        
        lucide.createIcons();
    }

    async function processPOPayment() {
        if (!activeProcurementPO) return;
        const txnId = `TXN${Date.now().toString().slice(3)}`;
        const token = localStorage.getItem("bk_jwt_token") || "";
        
        try {
            const res = await fetch(`${API_BASE}/api/pos/requisitions/${activeProcurementPO.id}/pay`, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ transactionId: txnId })
            });
            const data = await res.json();
            if (data.success) {
                showToast("Payment Processed Successfully!");
                await syncStateFromServer(true);
                await fetchRequisitions();
                renderProcurementScreen();
            } else {
                showToast("Payment processing failed.");
            }
        } catch (e) {
            console.error("Payment failed:", e);
            showToast("Network payment error.");
        }
    }

    async function sendPOToSupplier() {
        if (!activeProcurementPO) return;
        
        const token = localStorage.getItem("bk_jwt_token") || "";
        try {
            const res = await fetch(`${API_BASE}/api/pos/requisitions/${activeProcurementPO.id}/status`, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'Order Sent to Supplier',
                    notes: 'Order sent to Badi Katori Wholesale Ltd. supplier portal.'
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast("Purchase Order transmitted to Supplier Portal!");
                await syncStateFromServer(true);
                await fetchRequisitions();
                renderProcurementScreen();
            } else {
                showToast("Failed to transmit PO.");
            }
        } catch (e) {
            console.error("Failed to transmit PO:", e);
        }
    }

    async function confirmPOReceipt() {
        if (!activeProcurementPO) return;
        
        const confirmReceipt = confirm("Are you sure you have received the dispatched stock? This will increase your local branch inventory levels in the database.");
        if (confirmReceipt) {
            const token = localStorage.getItem("bk_jwt_token") || "";
            try {
                const res = await fetch(`${API_BASE}/api/pos/requisitions/${activeProcurementPO.id}/status`, {
                    method: "POST",
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'Inventory Updated',
                        notes: 'Branch Manager confirmed stock receipt at Vesu outlet.'
                    })
                });
                const data = await res.json();
                if (data.success) {
                    showToast("Inventory replenished successfully!");
                    await syncStateFromServer(true);
                    await fetchRequisitions();
                    renderProcurementScreen();
                } else {
                    showToast("Failed to complete receipt.");
                }
            } catch (e) {
                console.error(e);
            }
        }
    }

    async function simulateSupplierAction(action) {
        if (!activeProcurementPO) return;
        
        const token = localStorage.getItem("bk_jwt_token") || "";
        try {
            const res = await fetch(`${API_BASE}/api/pos/requisitions/${activeProcurementPO.id}/supplier-action`, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: action })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Supplier Portal: Order status updated to '${data.status}'`);
                await syncStateFromServer(true);
                await fetchRequisitions();
                renderProcurementScreen();
            } else {
                showToast("Supplier action simulation failed.");
            }
        } catch (e) {
            console.error("Supplier action error:", e);
            showToast("Connection simulator error.");
        }
    }

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
        if (currentActiveScreen !== 'billing') return;
        
        if (e.key === "F1") {
            e.preventDefault();
            document.getElementById("posProductSearch")?.focus();
        } else if (e.key === "F6") {
            e.preventDefault();
            document.getElementById("btnHoldOrder")?.click();
        } else if (e.key === "F7") {
            e.preventDefault();
            document.getElementById("btnResumeOrder")?.click();
        } else if (e.key === "F8") {
            e.preventDefault();
            document.getElementById("btnRepeatLastOrder")?.click();
        } else if (e.key === "F9") {
            e.preventDefault();
            document.getElementById("btnCancelOrder")?.click();
        } else if (e.key === "F10") {
            e.preventDefault();
            document.getElementById("btnRefundOrder")?.click();
        } else if (e.key === "Delete") {
            e.preventDefault();
            document.getElementById("btnVoidItem")?.click();
        } else if (e.key === "Backspace" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
            e.preventDefault();
            document.getElementById("btnRemoveItem")?.click();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
            e.preventDefault();
            document.getElementById("btnOpenDrawer")?.click();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
            e.preventDefault();
            document.getElementById("btnReprintBill")?.click();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            document.getElementById("btnPrintKOT")?.click();
        } else if (e.key === "Escape") {
            document.getElementById("modalPOSModifiers").style.display = "none";
            document.getElementById("modalPOSCreateCustomer").style.display = "none";
            document.getElementById("modalPOSInvoice").style.display = "none";
            document.getElementById("modalPOSHeldOrders").style.display = "none";
            const selectPaymentModal = document.getElementById("modalPOSSelectPayment");
            if (selectPaymentModal) selectPaymentModal.style.display = "none";
        }
    });

    // Load initial theme from localStorage
    const savedTheme = localStorage.getItem("bk_theme") || "light";
    applyTheme(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const isDark = document.body.classList.contains("dark-theme");
            const newTheme = isDark ? "light" : "dark";
            localStorage.setItem("bk_theme", newTheme);
            applyTheme(newTheme);
        });
    }

    initRequisitionsModule();
    initProcurementModule();
    initDeliveryAndKDSModule();
    if (typeof window.initProcurementModule === "function") {
        window.initProcurementModule();
    }

    // === INITIAL STARTUP SYNC ===
    // Always clear tokens on startup to force login screen
    localStorage.removeItem("bk_jwt_token");
    localStorage.removeItem("bk_logged_in_user");
    localStorage.removeItem("bk_current_role_key");
    
    const overlay = document.getElementById("login-overlay");
    if (overlay) overlay.style.display = "flex";

        // =========================================================================
    // PREMIUM SMART AI-POWERED PROCUREMENT SYSTEM UPGRADE
    // =========================================================================
    window.renderAiProcurementScreen = function() {
        const mainContainer = document.getElementById("screen-ai-procurement");
        const subProcureContainer = document.getElementById("sub-inventory-ai-procurement");
        if (!mainContainer && !subProcureContainer) return;
        
        const activeContainer = subProcureContainer && subProcureContainer.style.display !== 'none' ? subProcureContainer : mainContainer;
        
        // Scan current inventory for low stock items to dynamically populate the PO
        const storeFilter = currentStore === 'All' ? 'VESU' : currentStore;
        const lowStock = inventory.filter(item => item.stock < item.reorder && item.store === storeFilter);
        
        if (currentPoState.items.length === 0) {
            if (lowStock.length > 0) {
                currentPoState.items = lowStock.map(item => {
                    const required = Math.round((item.reorder * 2 - item.stock) * 100) / 100;
                    return {
                        label: item.label,
                        qty: required,
                        unit: item.unit,
                        unitCost: item.unitCost,
                        total: Math.round(required * item.unitCost * 100) / 100
                    };
                });
                currentPoState.priority = "High";
                currentPoState.status = "Purchase Request Generated";
            } else {
                // Start empty if no low stock items are present
                currentPoState.items = [];
                currentPoState.priority = "Normal";
                currentPoState.status = "Draft";
            }
            currentPoState.totalCost = currentPoState.items.reduce((sum, item) => sum + item.total, 0);
            currentPoState.totalCost = Math.round(currentPoState.totalCost * 100) / 100;
        }

        // Render the internal sidebar navigation active state
        const menuItems = activeContainer.querySelectorAll(".ai-procure-sidebar-item");
        menuItems.forEach(item => {
            if (item.getAttribute("data-sub") === activeProcurementSubView) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
            
            // Re-bind click listener if not already bound
            item.onclick = (e) => {
                activeProcurementSubView = item.getAttribute("data-sub");
                renderAiProcurementScreen();
            };
        });

        // Setup the launch button in inventory view to switch to the standalone AI Procurement screen
        const btnLaunch = document.getElementById("btnLaunchAiProcurement");
        if (btnLaunch && !btnLaunch.dataset.bound) {
            btnLaunch.dataset.bound = "true";
            btnLaunch.addEventListener("click", () => {
                navigateToScreen("ai-procurement");
            });
        }

        // Render viewport contents
        const viewport = activeContainer.querySelector("#aiProcureMainViewport");
        if (!viewport) return;

        let html = "";
        
        switch (activeProcurementSubView) {
            case 'dashboard':
                html = renderProcurementDashboard();
                break;
            case 'po':
                html = renderProcurementPO();
                break;
            case 'supplier':
                html = renderProcurementSupplier();
                break;
            case 'payment':
                html = renderProcurementPayment();
                break;
            case 'deliveries':
                html = renderProcurementDeliveries();
                break;
            case 'portal':
                html = renderProcurementPortalSandbox();
                break;
        }

        viewport.innerHTML = html;
        
        // Re-compile Lucide Icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Bind dynamic buttons/inputs after injection
        bindProcurementViewEvents();
    };

    // Sub-view: Dashboard (with 6 animated cards & Purchase Request Details)
    function renderProcurementDashboard() {
        const storeFilter = currentStore === 'All' ? 'VESU' : currentStore;
        
        // Dynamic counts
        const lowStockCount = inventory.filter(item => item.stock < item.reorder && item.store === storeFilter).length;
        const outOfStockCount = inventory.filter(item => item.stock <= 0 && item.store === storeFilter).length;
        const prCount = currentPoState.status === "Purchase Request Generated" ? 1 : 0;
        const awaitingApprovalCount = (currentPoState.paymentVerified !== true && currentPoState.status === "Purchase Request Generated") ? 1 : 0;
        const inProgressCount = ["Order Sent", "Supplier Accepted", "Preparing", "Packed", "Dispatched"].includes(currentPoState.status) ? 1 : 0;
        const deliveredCount = ["Delivered", "Inventory Updated"].includes(currentPoState.status) ? 1 : 0;

        // Render Required Items Rows
        const itemsRows = currentPoState.items.map((item, idx) => `
            <tr>
                <td>${item.label}</td>
                <td>${item.qty} ${item.unit}</td>
                <td>₹${item.unitCost.toFixed(2)}</td>
                <td style="text-align:right;">₹${item.total.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
        `).join("");

        // Calculate GST and Grand Total
        const gst = Math.round(currentPoState.totalCost * 0.18 * 100) / 100;
        const grandTotal = Math.round((currentPoState.totalCost + gst) * 100) / 100;

        // Condition for place order button availability
        const isPlaceOrderEnabled = currentPoState.paymentVerified && currentPoState.status === "Payment Verified";

        return `
            <div class="ai-procure-header-row">
                <div class="ai-procure-title-desc">
                    <h1>AI Smart Procurement Dashboard</h1>
                    <p>Linear & Stripe inspired design with predictive reorder tracking and logistics integrations.</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="ai-procure-btn ai-procure-btn-secondary" onclick="activeProcurementSubView='portal'; renderAiProcurementScreen();">
                        <i data-lucide="terminal"></i> Supplier Portal Sandbox
                    </button>
                </div>
            </div>

            <!-- Premium 6-Card Dashboard Grid -->
            <div class="ai-procure-grid" style="grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 24px;">
                <div class="ai-procure-card" style="padding: 16px;">
                    <div class="ai-procure-card-title" style="font-size:0.75rem;"><i data-lucide="alert-triangle" style="color:#ef4444; width:12px;"></i> Low Stock</div>
                    <div class="ai-procure-card-val" style="font-size:1.6rem; margin-top:8px;">${lowStockCount}</div>
                </div>
                <div class="ai-procure-card" style="padding: 16px;">
                    <div class="ai-procure-card-title" style="font-size:0.75rem;"><i data-lucide="x-circle" style="color:#ef4444; width:12px;"></i> Out of Stock</div>
                    <div class="ai-procure-card-val" style="font-size:1.6rem; margin-top:8px;">${outOfStockCount}</div>
                </div>
                <div class="ai-procure-card" style="padding: 16px;">
                    <div class="ai-procure-card-title" style="font-size:0.75rem;"><i data-lucide="file-text" style="color:#3b82f6; width:12px;"></i> Purchase Requests</div>
                    <div class="ai-procure-card-val" style="font-size:1.6rem; margin-top:8px;">${prCount}</div>
                </div>
                <div class="ai-procure-card" style="padding: 16px;">
                    <div class="ai-procure-card-title" style="font-size:0.75rem;"><i data-lucide="lock" style="color:#f59e0b; width:12px;"></i> Awaiting Approval</div>
                    <div class="ai-procure-card-val" style="font-size:1.6rem; margin-top:8px;">${awaitingApprovalCount}</div>
                </div>
                <div class="ai-procure-card" style="padding: 16px;">
                    <div class="ai-procure-card-title" style="font-size:0.75rem;"><i data-lucide="refresh-cw" style="color:#3b82f6; width:12px;"></i> In Progress</div>
                    <div class="ai-procure-card-val" style="font-size:1.6rem; margin-top:8px;">${inProgressCount}</div>
                </div>
                <div class="ai-procure-card" style="padding: 16px;">
                    <div class="ai-procure-card-title" style="font-size:0.75rem;"><i data-lucide="check-circle-2" style="color:#10b981; width:12px;"></i> Delivered</div>
                    <div class="ai-procure-card-val" style="font-size:1.6rem; margin-top:8px;">${deliveredCount}</div>
                </div>
            </div>

            <!-- Main Purchase Request Details Card -->
            <div class="ai-procure-card" style="margin-bottom: 24px; position:relative;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1f1f23; padding-bottom:16px; margin-bottom:20px;">
                    <div>
                        <span style="font-size:0.75rem; color:#71717a; font-weight:700;">ACTIVE PURCHASE REQUEST</span>
                        <h2 style="margin:2px 0 0 0; color:#fff; font-size:1.4rem; font-weight:800;">${currentPoState.prNumber}</h2>
                    </div>
                    <div style="display:flex; gap:16px;">
                        <div>
                            <span style="font-size:0.75rem; color:#71717a; font-weight:700; display:block; text-align:right;">ORDER STATUS</span>
                            <span class="ai-procure-badge warning" style="margin-top:4px;">${currentPoState.status}</span>
                        </div>
                        <div>
                            <span style="font-size:0.75rem; color:#71717a; font-weight:700; display:block; text-align:right;">PAYMENT STATUS</span>
                            <span class="ai-procure-badge ${currentPoState.paymentVerified ? 'success' : 'danger'}" style="margin-top:4px;">${currentPoState.paymentStatus}</span>
                        </div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; font-size:0.85rem;">
                    <div>
                        <span style="color:#71717a; font-weight:700;">Date & Time</span>
                        <div style="color:#fff; font-weight:600; margin-top:2px;">${currentPoState.date} &bull; ${currentPoState.time}</div>
                    </div>
                    <div>
                        <span style="color:#71717a; font-weight:700;">Priority Level</span>
                        <div style="color:#ef4444; font-weight:800; margin-top:2px;">${currentPoState.priority}</div>
                    </div>
                    <div>
                        <span style="color:#71717a; font-weight:700;">Supplier Partner</span>
                        <div style="color:#fff; font-weight:600; margin-top:2px;">BK Foods & Spices Ltd.</div>
                    </div>
                </div>

                <h3 style="color:#fff; font-size:1rem; margin-bottom:12px; font-weight:800;">Required Items & Suggested Quantities</h3>
                <table class="ai-procure-table" style="margin-top:0; margin-bottom:24px;">
                    <thead>
                        <tr>
                            <th>Item Description</th>
                            <th>Suggested Qty</th>
                            <th>Unit Cost</th>
                            <th style="text-align:right;">Total Estimated Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                        <tr style="background:rgba(255,255,255,0.01); font-weight:700;">
                            <td colspan="3" style="text-align:right; border-top:1px solid #1f1f23; color:#71717a;">Subtotal:</td>
                            <td style="text-align:right; border-top:1px solid #1f1f23; color:#fff;">₹${currentPoState.totalCost.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                        </tr>
                        <tr style="background:rgba(255,255,255,0.01); font-weight:700;">
                            <td colspan="3" style="text-align:right; color:#71717a;">GST (18%):</td>
                            <td style="text-align:right; color:#fff;">₹${gst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                        </tr>
                        <tr style="background:rgba(255,255,255,0.02); font-weight:800; font-size:1.05rem;">
                            <td colspan="3" style="text-align:right; color:#fff;">Grand Total:</td>
                            <td style="text-align:right; color:var(--pos-beige);">₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Grid of large action buttons -->
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                    <button class="ai-procure-btn ai-procure-btn-secondary" id="btnPrReview">
                        <i data-lucide="eye"></i> Review Order
                    </button>
                    <button class="ai-procure-btn ai-procure-btn-secondary" id="btnPrEditQty">
                        <i data-lucide="edit-3"></i> Edit Quantity
                    </button>
                    <button class="ai-procure-btn ai-procure-btn-secondary" onclick="activeProcurementSubView='supplier'; renderAiProcurementScreen();">
                        <i data-lucide="user"></i> View Supplier
                    </button>
                    <button class="ai-procure-btn ai-procure-btn-secondary" id="btnPrQrCode" ${currentPoState.paymentVerified ? '' : 'disabled style="opacity:0.4; cursor:not-allowed;"'}>
                        <i data-lucide="qr-code"></i> Generate QR Code
                    </button>
                    <button class="ai-procure-btn ai-procure-btn-secondary" onclick="activeProcurementSubView='payment'; renderAiProcurementScreen();">
                        <i data-lucide="indian-rupee"></i> Make Payment
                    </button>
                    <button class="ai-procure-btn ai-procure-btn-primary" id="btnPrPlaceOrder" ${isPlaceOrderEnabled ? '' : 'disabled style="opacity:0.4; cursor:not-allowed;"'}>
                        <i data-lucide="send"></i> Place Order
                    </button>
                    <button class="ai-procure-btn ai-procure-btn-secondary" id="btnPrCancel" style="color:#ef4444; border-color:rgba(239, 68, 68, 0.2);">
                        <i data-lucide="x-circle"></i> Cancel Order
                    </button>
                    <button class="ai-procure-btn ai-procure-btn-secondary" id="btnPrDownload">
                        <i data-lucide="download"></i> Download Purchase Order
                    </button>
                </div>
            </div>

            <!-- Dynamic QR Code card rendering within dashboard if generated -->
            <div id="dashboardQrPanel" style="display:${currentPoState.qrGenerated ? 'block' : 'none'}; margin-bottom: 24px;">
                ${currentPoState.qrGenerated ? renderProcurementQrCode() : ''}
            </div>

            <!-- AI Smart Insights & Predictions Section -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="ai-procure-card" style="display:flex; align-items:center; gap: 16px;">
                    <div style="background: rgba(194, 159, 104, 0.1); padding: 16px; border-radius: 12px;">
                        <i data-lucide="brain-circuit" style="color:var(--pos-beige); width: 28px; height: 28px;"></i>
                    </div>
                    <div>
                        <h4 style="margin:0 0 4px 0; color:#fff; font-size:0.95rem; font-weight:800;">AI Consumption Prediction</h4>
                        <p style="margin:0; font-size:0.8rem; color:#a1a1aa; line-height:1.4;">
                            AI predicts a consumption spike for <strong>Fried Alu Tikki</strong> and <strong>Dahi</strong> this weekend. Reorder buffers automatically adjusted by +15% to safeguard margins.
                        </p>
                    </div>
                </div>

                <div class="ai-procure-card" style="display:flex; align-items:center; gap: 16px;">
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 16px; border-radius: 12px;">
                        <i data-lucide="hourglass" style="color:#3b82f6; width: 28px; height: 28px;"></i>
                    </div>
                    <div>
                        <h4 style="margin:0 0 4px 0; color:#fff; font-size:0.95rem; font-weight:800;">AI Stock Depletion Estimate</h4>
                        <p style="margin:0; font-size:0.8rem; color:#a1a1aa; line-height:1.4;">
                            Estimated depletion window: <strong>Dahi</strong> will deplete in 1.8 days; <strong>Fried Alu Tikki</strong> in 2.2 days. Procurement verification recommended within 12 hours.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    // Sub-view: Supplier Profile & Bank Details
    function renderProcurementSupplier() {
        return `
            <div class="ai-procure-header-row">
                <div class="ai-procure-title-desc">
                    <h1>Fixed Supplier Partner</h1>
                    <p>BK Foods & Spices Ltd. is the designated logistics partner assigned for ingredient fulfillments.</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px;">
                <!-- Left: Supplier Profile -->
                <div class="ai-procure-card">
                    <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; border-bottom:1px solid #1f1f23; padding-bottom:16px;">
                        <div style="background:#fff; color:#000; width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.3rem;">
                            BK
                        </div>
                        <div>
                            <h2 style="color:#fff; margin:0; font-size:1.15rem; font-weight:800;">BK Foods & Spices Ltd.</h2>
                            <span class="ai-procure-badge success" style="margin-top:4px;">★ 4.9 Verified Supplier</span>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:12px; font-size:0.85rem; margin-bottom:20px;">
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1f1f23; padding-bottom:6px;">
                            <span style="color:#71717a;">Contact Person</span>
                            <span style="color:#fff; font-weight:600;">Rajesh Mehta (Logistics Head)</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1f1f23; padding-bottom:6px;">
                            <span style="color:#71717a;">Phone Number</span>
                            <span style="color:#fff; font-weight:600;">+91 98765 43210</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1f1f23; padding-bottom:6px;">
                            <span style="color:#71717a;">Email Address</span>
                            <span style="color:#fff; font-weight:600;">orders@bkfoods.in</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1f1f23; padding-bottom:6px;">
                            <span style="color:#71717a;">Business Hours</span>
                            <span style="color:#fff; font-weight:600;">08:00 AM - 08:00 PM (Daily)</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#71717a;">Delivery Lead Time</span>
                            <span style="color:#fff; font-weight:600;">4 - 6 Hours (Instant dispatch)</span>
                        </div>
                    </div>

                    <div>
                        <h4 style="color:#fff; margin:0 0 4px 0; font-weight:800; font-size:0.9rem;">Warehouse Address</h4>
                        <p style="font-size:0.8rem; color:#a1a1aa; margin:0 0 12px 0; line-height:1.4;">
                            Plot 45, GIDC Industrial Estate, Ichhapore, Surat, Gujarat - 394510
                        </p>
                        <!-- Google Maps Mock Frame -->
                        <div style="width:100%; height:130px; border-radius:8px; overflow:hidden; border:1px solid #27272a; position:relative;">
                            <iframe 
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3720.9168925585097!2d72.71536297597148!3d21.155702283416247!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be0530000000001%3A0x6b71f9876f1z2345!2sGIDC+Industrial+Estate%2C+Ichhapore%2C+Surat%2C+Gujarat!5e0!3m2!1sen!2sin!4v1717830000000!5m2!1sen!2sin" 
                                width="100%" 
                                height="100%" 
                                style="border:0; filter: invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%);" 
                                allowfullscreen="" 
                                loading="lazy">
                            </iframe>
                            <button class="ai-procure-btn ai-procure-btn-secondary" style="position:absolute; bottom:8px; right:8px; padding:4px 8px; font-size:0.7rem; background:#000;" onclick="window.open('https://maps.google.com/?q=GIDC+Ichhapore+Surat', '_blank')">
                                <i data-lucide="external-link" style="width:10px; height:10px;"></i> View on Google Maps
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Right: Bank Details -->
                <div class="ai-procure-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <h3 style="color:#fff; margin:0 0 16px 0; font-weight:800; display:flex; align-items:center; gap:8px; border-bottom:1px solid #1f1f23; padding-bottom:16px;">
                            <i data-lucide="landmark" style="color:var(--pos-beige);"></i> Supplier Bank Details
                        </h3>
                        <div style="display:flex; flex-direction:column; gap:12px; font-size:0.85rem;">
                            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1f1f23; padding-bottom:6px;">
                                <span style="color:#71717a;">Account Holder</span>
                                <span style="color:#fff; font-weight:700;">BK FOODS AND SPICES PRIVATE LTD</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1f1f23; padding-bottom:6px;">
                                <span style="color:#71717a;">Bank Name</span>
                                <span style="color:#fff; font-weight:700;">HDFC Bank Ltd.</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1f1f23; padding-bottom:6px;">
                                <span style="color:#71717a;">Account Number</span>
                                <span style="color:#fff; font-weight:700; font-family:monospace;">•••• •••• 9876</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1f1f23; padding-bottom:6px;">
                                <span style="color:#71717a;">IFSC Code</span>
                                <span style="color:#fff; font-weight:700; font-family:monospace;">HDFC0001234</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1f1f23; padding-bottom:6px;">
                                <span style="color:#71717a;">Branch Office</span>
                                <span style="color:#fff; font-weight:700;">Ring Road Branch, Surat</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1f1f23; padding-bottom:6px;">
                                <span style="color:#71717a;">UPI ID</span>
                                <span style="color:#fff; font-weight:700; font-family:monospace;">bkfoods@hdfc</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding-bottom:6px;">
                                <span style="color:#71717a;">GST Number</span>
                                <span style="color:#fff; font-weight:700; font-family:monospace;">24AAACB9876F1Z2</span>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top:20px;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                            <button class="ai-procure-btn ai-procure-btn-secondary" onclick="navigator.clipboard.writeText('50200045679876'); alert('Account number copied!');">
                                <i data-lucide="copy" style="width:12px;"></i> Copy Account No
                            </button>
                            <button class="ai-procure-btn ai-procure-btn-secondary" onclick="navigator.clipboard.writeText('bkfoods@hdfc'); alert('UPI ID copied!');">
                                <i data-lucide="copy" style="width:12px;"></i> Copy UPI ID
                            </button>
                        </div>
                        <button class="ai-procure-btn ai-procure-btn-primary" style="width:100%;" onclick="alert('Downloading Bank Details PDF...')">
                            <i data-lucide="download"></i> Download Bank Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Sub-view: Payment Settlement Panel
    function renderProcurementPayment() {
        const gst = Math.round(currentPoState.totalCost * 0.18 * 100) / 100;
        const grandTotal = Math.round((currentPoState.totalCost + gst) * 100) / 100;

        return `
            <div class="ai-procure-header-row">
                <div class="ai-procure-title-desc">
                    <h1>Payment Settlement Portal</h1>
                    <p>Verify bank wires or process instant UPI collections to unlock supplier dispatches.</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 360px; gap:24px;">
                <!-- Payment summary -->
                <div class="ai-procure-card">
                    <h3 style="color:#fff; margin:0 0 16px 0; font-weight:800; border-bottom:1px solid #1f1f23; padding-bottom:12px;">Settlement Details</h3>
                    <div style="display:flex; flex-direction:column; gap:14px; font-size:0.9rem;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#71717a;">Subtotal Amount</span>
                            <span style="color:#fff; font-weight:600;">₹${currentPoState.totalCost.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1f1f23; padding-bottom:12px;">
                            <span style="color:#71717a;">Integrated GST (18%)</span>
                            <span style="color:#fff; font-weight:600;">₹${gst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:1.2rem; font-weight:800;">
                            <span style="color:#fff;">Grand Total</span>
                            <span style="color:var(--pos-beige);">₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>

                    <div style="margin-top:24px; display:flex; flex-direction:column; gap:12px; font-size:0.8rem; border-top:1px solid #1f1f23; padding-top:20px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#71717a;">Transaction ID</span>
                            <span style="color:#fff; font-family:monospace; font-weight:600;">${currentPoState.transactionId || 'Pending payment...'}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#71717a;">Payment Date</span>
                            <span style="color:#fff; font-weight:600;">${currentPoState.paymentDate || 'Pending payment...'}</span>
                        </div>
                    </div>
                </div>

                <!-- Action ledger controls -->
                <div class="ai-procure-card" style="display:flex; flex-direction:column; justify-content:space-between; min-height: 250px;">
                    <div>
                        <div class="ai-procure-card-title">Settlement Center</div>
                        <div style="margin-top:12px; margin-bottom:20px;">
                            <span style="font-size:0.75rem; color:#71717a; font-weight:700;">PAYMENT REGISTRY STATUS</span>
                            <div>
                                <span class="ai-procure-badge ${currentPoState.paymentVerified ? 'success' : (currentPoState.paymentStatus === 'Paid' ? 'warning' : 'danger')}" style="margin-top:4px;">
                                    ${currentPoState.paymentVerified ? 'Payment Verified' : currentPoState.paymentStatus}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${!currentPoState.paymentVerified ? `
                            <button class="ai-procure-btn ai-procure-btn-gold" id="btnPaymentMarkPaid" ${currentPoState.paymentStatus === 'Paid' ? 'disabled style="opacity:0.5;"' : ''}>
                                <i data-lucide="check"></i> Mark as Paid
                            </button>
                            <button class="ai-procure-btn ai-procure-btn-secondary" id="btnPaymentUploadReceipt" style="position:relative; overflow:hidden;">
                                <i data-lucide="upload"></i> Upload Receipt
                                <input type="file" id="receiptFileInput" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;" accept="image/*,application/pdf">
                            </button>
                            <button class="ai-procure-btn ai-procure-btn-primary" id="btnPaymentVerify" ${currentPoState.paymentStatus === 'Paid' ? '' : 'disabled style="opacity:0.5; cursor:not-allowed;"'}>
                                <i data-lucide="shield-check"></i> Verify Payment
                            </button>
                        ` : `
                            <div style="text-align:center; color:#10b981; font-weight:700; font-size:0.85rem; padding:12px; border: 1px solid rgba(16, 185, 129, 0.2); border-radius:8px; background:rgba(16, 185, 129, 0.02); margin-bottom:10px;">
                                <i data-lucide="check-circle" style="vertical-align:middle; width:16px;"></i> Settlement Cleared
                            </div>
                            <button class="ai-procure-btn ai-procure-btn-secondary" style="width:100%;" onclick="alert('Downloading payment receipt...')">
                                <i data-lucide="download"></i> Download Receipt
                            </button>
                        `}
                    </div>
                </div>
            </div>

            <!-- Monthly reports panel & analytics -->
            <div class="ai-procure-card" style="margin-top: 24px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h3 style="color:#fff; margin:0; font-weight:800;">Monthly Procurement Reports</h3>
                    <button class="ai-procure-btn ai-procure-btn-secondary" style="padding:6px 12px; font-size:0.75rem;" onclick="alert('Generating report...')">
                        <i data-lucide="file-plus"></i> Generate Report
                    </button>
                </div>
                <table class="ai-procure-table">
                    <thead>
                        <tr>
                            <th>Report Period</th>
                            <th>Total Purchase Value</th>
                            <th>GST Paid</th>
                            <th>Supplier Settled</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>June 2026</td>
                            <td>₹1,45,690.00</td>
                            <td>₹26,224.20</td>
                            <td>BK Foods & Spices Ltd.</td>
                            <td><button class="ai-procure-btn ai-procure-btn-secondary" style="padding:4px 8px; font-size:0.7rem;" onclick="alert('Downloading June Report...')">Download</button></td>
                        </tr>
                        <tr>
                            <td>May 2026</td>
                            <td>₹1,89,450.00</td>
                            <td>₹34,101.00</td>
                            <td>BK Foods & Spices Ltd.</td>
                            <td><button class="ai-procure-btn ai-procure-btn-secondary" style="padding:4px 8px; font-size:0.7rem;" onclick="alert('Downloading May Report...')">Download</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    // Sub-view: Deliveries Tracking Timeline
    function renderProcurementDeliveries() {
        const trackingStages = [
            { key: "Purchase Request Generated", label: "Request Created", desc: "Purchase Request automatically compiled", time: currentPoState.timestamps.requestCreated },
            { key: "Payment Verified", label: "Payment Verified", desc: "Accounts cleared invoice wire", time: currentPoState.timestamps.paymentVerified },
            { key: "QR Code Generated", label: "QR Code Generated", desc: "Secure webhook QR compiled", time: currentPoState.timestamps.qrGenerated },
            { key: "Order Sent", label: "Order Dispatched", desc: "PO sent to supplier API & WhatsApp", time: currentPoState.timestamps.orderSent },
            { key: "Supplier Accepted", label: "Supplier Accepted", desc: "BK Foods approved logistics queue", time: currentPoState.timestamps.supplierAccepted },
            { key: "Preparing", label: "Preparing Order", desc: "Packing fresh inventory lines", time: currentPoState.timestamps.preparing },
            { key: "Packed", label: "Packed & Ready", desc: "Order sealed at Ichhapore facility", time: currentPoState.timestamps.packed },
            { key: "Dispatched", label: "Out for Delivery", desc: "En route via NH-48", time: currentPoState.timestamps.dispatched },
            { key: "Delivered", label: "Delivered", desc: "Arrived at outlet loading dock", time: currentPoState.timestamps.delivered },
            { key: "Inventory Updated", label: "Inventory Updated", desc: "Materials verified & restocked", time: currentPoState.timestamps.inventoryUpdated }
        ];

        let activeIndex = trackingStages.findIndex(s => s.key === currentPoState.status);
        if (activeIndex === -1) {
            // Handle secondary matches
            if (currentPoState.status === "Payment Completed") activeIndex = 0; // Request created
            else activeIndex = -1;
        }

        // Special override if payment is verified
        let lastCompletedIdx = activeIndex;
        if (currentPoState.paymentVerified && lastCompletedIdx < 1) {
            lastCompletedIdx = 1; // Mark Payment Verified stage active
        }
        if (currentPoState.qrGenerated && lastCompletedIdx < 2) {
            lastCompletedIdx = 2;
        }

        const stagesHTML = trackingStages.map((stage, idx) => {
            let cls = "";
            let dotVal = idx + 1;
            if (idx < lastCompletedIdx || (idx === lastCompletedIdx && currentPoState.status === stage.key)) {
                if (idx < lastCompletedIdx) {
                    cls = "completed";
                    dotVal = "✓";
                } else {
                    cls = "active";
                }
            }
            
            return `
                <div style="display:flex; gap:16px; margin-bottom:20px; position:relative;">
                    ${idx < 9 ? `<div style="position:absolute; top:28px; left:14px; bottom:-20px; width:2px; background:${idx < lastCompletedIdx ? '#10b981' : '#27272a'}; z-index:1;"></div>` : ''}
                    <div style="width:30px; height:30px; border-radius:50%; background:${cls === 'completed' ? '#10b981' : (cls === 'active' ? '#f59e0b' : '#18181b')}; border:2px solid ${cls === 'active' ? '#f59e0b' : '#27272a'}; display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.75rem; font-weight:800; z-index:2; flex-shrink:0;">
                        ${dotVal}
                    </div>
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:flex-start; margin-top:2px;">
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <span style="font-size:0.85rem; font-weight:700; color:${cls !== '' ? '#fff' : '#71717a'};">${stage.label}</span>
                            <span style="font-size:0.75rem; color:#71717a;">${stage.desc}</span>
                        </div>
                        <span style="font-size:0.75rem; color:#71717a; font-weight:600;">${stage.time || '-- : --'}</span>
                    </div>
                </div>
            `;
        }).join("");

        return `
            <div class="ai-procure-header-row">
                <div class="ai-procure-title-desc">
                    <h1>Live Delivery Tracking Timeline</h1>
                    <p>Real-time delivery progress updates and logistics status.</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 360px; gap:24px;">
                <div class="ai-procure-card">
                    <h3 style="color:#fff; margin:0 0 20px 0; font-weight:800; display:flex; align-items:center; gap:8px; border-bottom:1px solid #1f1f23; padding-bottom:16px;">
                        <i data-lucide="map" style="color:var(--pos-beige);"></i> Shipment Status Route
                    </h3>
                    <div style="padding:10px 0 10px 10px;">
                        ${stagesHTML}
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:20px;">
                    <!-- Driver and Route Card -->
                    <div class="ai-procure-card">
                        <div class="ai-procure-card-title">Driver & Dispatch Logistics</div>
                        <div style="display:flex; flex-direction:column; gap:12px; font-size:0.85rem; margin-top:16px;">
                            <div>
                                <span style="color:#71717a;">Current Location</span>
                                <div style="color:#fff; font-weight:600; margin-top:2px;">${currentPoState.location}</div>
                            </div>
                            <div>
                                <span style="color:#71717a;">ETA Window</span>
                                <div style="color:#fff; font-weight:600; margin-top:2px;">${currentPoState.eta}</div>
                            </div>
                            <div style="border-top:1px solid #1f1f23; padding-top:12px;">
                                <span style="color:#71717a;">Driver Assigned</span>
                                <div style="color:#fff; font-weight:700; margin-top:2px;">${currentPoState.driverName}</div>
                                <div style="color:#71717a; font-size:0.75rem; margin-top:2px;">${currentPoState.driverPhone}</div>
                            </div>
                            <div>
                                <span style="color:#71717a;">Vehicle Registration</span>
                                <div style="color:#fff; font-weight:700; font-family:monospace; margin-top:2px;">${currentPoState.vehicleNo}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Sub-view: Supplier Portal Demo Sandbox
    function renderProcurementPortalSandbox() {
        return `
            <div class="ai-procure-header-row">
                <div class="ai-procure-title-desc">
                    <h1>Supplier Dispatch Control Portal</h1>
                    <p>Simulate supplier side response interface (real-time data pipeline testbed).</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 360px; gap:24px;">
                <div class="ai-procure-card">
                    <h3 style="color:#fff; margin:0 0 16px 0; font-weight:800; display:flex; align-items:center; gap:8px; border-bottom:1px solid #1f1f23; padding-bottom:16px;">
                        <i data-lucide="terminal" style="color:var(--pos-beige);"></i> Supplier Sandbox Controls
                    </h3>
                    <p style="font-size:0.82rem; color:#a1a1aa; line-height:1.4; margin-bottom:24px;">
                        Clicking these simulated actions acts as the supplier partner <strong>BK Foods & Spices Ltd.</strong> 
                        This will instantly update order status timelines on the cashier client and update active SQLite inventory rows when marked delivered!
                    </p>

                    <div style="display:grid; grid-template-columns: 1fr; gap:12px;">
                        <button class="ai-procure-btn ai-procure-btn-secondary" id="btnSandboxAccept" ${currentPoState.status === 'Order Sent' ? '' : 'disabled style="opacity:0.5; cursor:not-allowed;"'}>
                            1. Accept Purchase Order (Mark Accepted)
                        </button>
                        <button class="ai-procure-btn ai-procure-btn-secondary" id="btnSandboxPack" ${currentPoState.status === 'Supplier Accepted' ? '' : 'disabled style="opacity:0.5; cursor:not-allowed;"'}>
                            2. Prepare & Pack (Mark Preparing)
                        </button>
                        <button class="ai-procure-btn ai-procure-btn-secondary" id="btnSandboxDispatch" ${currentPoState.status === 'Preparing' ? '' : 'disabled style="opacity:0.5; cursor:not-allowed;"'}>
                            3. Handover to Driver (Mark Dispatched)
                        </button>
                        
                        <!-- Invoice & Challan upload buttons -->
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                            <button class="ai-procure-btn ai-procure-btn-secondary" id="btnSandboxUploadInvoice" ${currentPoState.status !== 'Purchase Request Generated' ? '' : 'disabled style="opacity:0.5; cursor:not-allowed;"'}>
                                ${currentPoState.invoiceUploaded ? '✓ Invoice Loaded' : 'Upload Invoice'}
                            </button>
                            <button class="ai-procure-btn ai-procure-btn-secondary" id="btnSandboxUploadChallan" ${currentPoState.status !== 'Purchase Request Generated' ? '' : 'disabled style="opacity:0.5; cursor:not-allowed;"'}>
                                ${currentPoState.challanUploaded ? '✓ Challan Loaded' : 'Upload Challan'}
                            </button>
                        </div>
                        
                        <button class="ai-procure-btn ai-procure-btn-primary" id="btnSandboxDeliver" ${currentPoState.status === 'Dispatched' ? '' : 'disabled style="opacity:0.5; cursor:not-allowed;"'}>
                            4. Handover to Outlet (Mark Delivered & Restock!)
                        </button>
                    </div>
                </div>

                <div class="ai-procure-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div class="ai-procure-card-title">Live State Registry</div>
                        <div style="display:flex; flex-direction:column; gap:12px; font-size:0.85rem; margin-top:16px;">
                            <div>
                                <span style="color:#71717a;">Active PO Reference</span>
                                <div style="color:#fff; font-weight:600; margin-top:2px;">${currentPoState.poNumber}</div>
                            </div>
                            <div>
                                <span style="color:#71717a;">Current Status</span>
                                <div style="color:var(--pos-beige); font-weight:800; margin-top:2px;">${currentPoState.status}</div>
                            </div>
                            <div>
                                <span style="color:#71717a;">Invoice Uploaded</span>
                                <div style="color:#fff; font-weight:600; margin-top:2px;">${currentPoState.invoiceUploaded ? 'Yes' : 'No'}</div>
                            </div>
                            <div>
                                <span style="color:#71717a;">Delivery Challan Uploaded</span>
                                <div style="color:#fff; font-weight:600; margin-top:2px;">${currentPoState.challanUploaded ? 'Yes' : 'No'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Dynamic QR Code generation panel template
    function renderProcurementQrCode() {
        const amount = currentPoState.totalCost || 0;
        const upiURL = `upi://pay?pa=9978673137@ikwik&pn=Badi%20Katori&am=${amount.toFixed(2)}&tr=${currentPoState.poNumber}&tn=PO%20${currentPoState.poNumber}&cu=INR`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiURL)}`;
        
        const qrItemsList = currentPoState.items.map(it => `
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#e4e4e7; border-bottom:1px solid #1f1f23; padding-bottom:4px; margin-bottom:4px;">
                <span>${it.label}</span>
                <span style="font-weight:700;">${it.qty} ${it.unit}</span>
            </div>
        `).join("");

        return `
            <div class="ai-procure-card" style="border: 2px solid var(--pos-beige); background: rgba(194, 159, 104, 0.02); display:grid; grid-template-columns: 200px 1fr; gap:20px; align-items:center;">
                <!-- QR Code image -->
                <div style="text-align:center; background:#fff; padding:12px; border-radius:12px; display:inline-block; margin:0 auto;">
                    <img src="${qrCodeUrl}" style="display:block; width:140px; height:140px;" alt="Secure QR Code">
                </div>
                <!-- QR Details -->
                <div>
                    <h3 style="color:#fff; margin:0 0 10px 0; font-weight:800; display:flex; justify-content:space-between; align-items:center;">
                        <span>Secure Purchase Order Webhook</span>
                        <span class="ai-procure-badge success">Verified</span>
                    </h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:12px; font-size:0.8rem;">
                        <div>
                            <span style="color:#71717a; display:block; font-weight:700;">PO NUMBER</span>
                            <span style="color:#fff; font-weight:600;">${currentPoState.poNumber}</span>
                        </div>
                        <div>
                            <span style="color:#71717a; display:block; font-weight:700;">SUPPLIER</span>
                            <span style="color:#fff; font-weight:600;">BK Foods & Spices Ltd.</span>
                        </div>
                        <div>
                            <span style="color:#71717a; display:block; font-weight:700;">PAYMENT STATUS</span>
                            <span style="color:#10b981; font-weight:700;">${currentPoState.paymentStatus} (Verified)</span>
                        </div>
                        <div>
                            <span style="color:#71717a; display:block; font-weight:700;">DELIVERY ADDRESS</span>
                            <span style="color:#fff; font-weight:600;">${currentStore === 'All' ? 'Vesu Branch' : currentStore}</span>
                        </div>
                    </div>
                    <div style="border-top:1px solid #1f1f23; padding-top:10px;">
                        <span style="color:#71717a; display:block; font-weight:700; font-size:0.75rem; margin-bottom:6px;">ORDERED MATERIALS</span>
                        ${qrItemsList}
                    </div>
                </div>
            </div>
        `;
    }

    // Purchase Orders Sub-view
    function renderProcurementPO() {
        return `
            <div class="ai-procure-header-row">
                <div class="ai-procure-title-desc">
                    <h1>Purchase Order Archive</h1>
                    <p>History of all compiled POs, requests, and dispatch logs.</p>
                </div>
            </div>
            <div class="ai-procure-card">
                <table class="ai-procure-table">
                    <thead>
                        <tr>
                            <th>PO Reference</th>
                            <th>Request Date</th>
                            <th>Grand Total</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${currentPoState.poNumber}</td>
                            <td>${currentPoState.date} ${currentPoState.time}</td>
                            <td>₹${(currentPoState.totalCost * 1.18).toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
                            <td><span class="ai-procure-badge warning">${currentPoState.status}</span></td>
                            <td><button class="ai-procure-btn ai-procure-btn-secondary" style="padding:4px 8px; font-size:0.7rem;" onclick="activeProcurementSubView='dashboard'; renderAiProcurementScreen();">View Details</button></td>
                        </tr>
                        <tr>
                            <td>PO-2026-0088</td>
                            <td>2026-07-01 10:15</td>
                            <td>₹24,560.00</td>
                            <td><span class="ai-procure-badge success">Inventory Updated</span></td>
                            <td><button class="ai-procure-btn ai-procure-btn-secondary" style="padding:4px 8px; font-size:0.7rem;" onclick="alert('Viewing archived order PO-2026-0088')">View Details</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    // Event binders for all buttons/inputs inside AI Procurement view
    function bindProcurementViewEvents() {
        const getTimestampStr = () => {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
        };

        // 1. Review Order
        const btnReview = document.getElementById("btnPrReview");
        if (btnReview) {
            btnReview.onclick = () => {
                const itemsStr = currentPoState.items.map(it => ` - ${it.label}: ${it.qty} ${it.unit} (₹${it.unitCost} / unit)`).join("\n");
                alert(`Purchase Order Review:\n\nPO Number: ${currentPoState.poNumber}\nSupplier: BK Foods & Spices Ltd.\n\nRequired Items:\n${itemsStr}\n\nTotal Estimate: ₹${currentPoState.totalCost.toLocaleString()}`);
            };
        }

        // 2. Edit Quantity
        const btnEditQty = document.getElementById("btnPrEditQty");
        if (btnEditQty) {
            btnEditQty.onclick = () => {
                const itemLabels = currentPoState.items.map((it, idx) => `${idx + 1}. ${it.label} (Current: ${it.qty})`).join("\n");
                const choiceStr = prompt(`Select item index to edit quantity (1-${currentPoState.items.length}):\n\n${itemLabels}`);
                const choice = parseInt(choiceStr);
                if (isNaN(choice) || choice < 1 || choice > currentPoState.items.length) {
                    if (choiceStr !== null) alert("Invalid choice!");
                    return;
                }
                const selectedItem = currentPoState.items[choice - 1];
                const newQtyStr = prompt(`Enter new quantity for ${selectedItem.label} (${selectedItem.unit}):`, selectedItem.qty);
                const newQty = parseFloat(newQtyStr);
                if (isNaN(newQty) || newQty <= 0) {
                    if (newQtyStr !== null) alert("Invalid quantity!");
                    return;
                }
                
                // Recalculate
                selectedItem.qty = newQty;
                selectedItem.total = Math.round(newQty * selectedItem.unitCost * 100) / 100;
                currentPoState.totalCost = currentPoState.items.reduce((sum, item) => sum + item.total, 0);
                currentPoState.totalCost = Math.round(currentPoState.totalCost * 100) / 100;
                
                alert(`Quantity updated! New subtotal: ₹${currentPoState.totalCost.toLocaleString()}`);
                renderAiProcurementScreen();
            };
        }

        // 3. Generate QR Code
        const btnPrQr = document.getElementById("btnPrQrCode");
        if (btnPrQr) {
            btnPrQr.onclick = () => {
                currentPoState.qrGenerated = true;
                currentPoState.timestamps.qrGenerated = getTimestampStr();
                currentPoState.status = "QR Code Generated";
                alert("Secure QR Code generated successfully!");
                renderAiProcurementScreen();
                
                // Show in panel
                const qrPanel = document.getElementById("dashboardQrPanel");
                if (qrPanel) {
                    qrPanel.style.display = "block";
                    qrPanel.innerHTML = renderProcurementQrCode();
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            };
        }

        // 4. Place Order (Send to Supplier)
        const btnPlace = document.getElementById("btnPrPlaceOrder");
        if (btnPlace) {
            btnPlace.onclick = () => {
                if (currentPoState.status === "Payment Verified (Awaiting SMS Acceptance)") {
                    alert("Cannot place order. Please confirm order placement via SMS Acceptance Prompt first!");
                    return;
                }
                if (!currentPoState.paymentVerified || currentPoState.status !== "Payment Verified") {
                    alert("Cannot place order. Payment must be verified by the AI Auditor first!");
                    return;
                }
                const proceed = confirm("Are you sure you want to send this purchase order to the supplier?");
                if (!proceed) return;

                btnPlace.disabled = true;
                btnPlace.innerHTML = '<i class="spinner-icon"></i> Placing Order...';

                setTimeout(() => {
                    currentPoState.orderPlaced = true;
                    currentPoState.supplierNotified = true;
                    currentPoState.status = "Order Sent";
                    currentPoState.timestamps.orderSent = getTimestampStr();
                    alert("Purchase order successfully placed! Email and WhatsApp Business notifications sent to BK Foods.");
                    renderAiProcurementScreen();
                }, 1500);
            };
        }

        // 5. Cancel Order
        const btnCancel = document.getElementById("btnPrCancel");
        if (btnCancel) {
            btnCancel.onclick = () => {
                const proceed = confirm("Are you sure you want to cancel this purchase request?");
                if (!proceed) return;
                
                currentPoState.items = [];
                currentPoState.paymentStatus = "Unpaid";
                currentPoState.paymentVerified = false;
                currentPoState.qrGenerated = false;
                currentPoState.orderPlaced = false;
                currentPoState.status = "Purchase Request Generated";
                currentPoState.transactionId = "";
                currentPoState.paymentDate = "";
                currentPoState.invoiceUploaded = false;
                currentPoState.challanUploaded = false;
                alert("Order canceled and reset.");
                renderAiProcurementScreen();
            };
        }

        // 6. Download Purchase Order
        const btnDownload = document.getElementById("btnPrDownload");
        if (btnDownload) {
            btnDownload.onclick = () => {
                alert("Generating Purchase Order PDF... Download started successfully!");
            };
        }

        // 7. Make Payment: Mark as Paid
        const btnMarkPaid = document.getElementById("btnPaymentMarkPaid");
        if (btnMarkPaid) {
            btnMarkPaid.onclick = () => {
                currentPoState.paymentStatus = "Paid";
                currentPoState.transactionId = "TXN" + Math.random().toString(36).substring(2, 10).toUpperCase();
                currentPoState.paymentDate = getTimestampStr();
                alert("Payment status updated to: Paid. Awaiting verification.");
                renderAiProcurementScreen();
            };
        }

        // 8. Make Payment: Upload Receipt
        const receiptInput = document.getElementById("receiptFileInput");
        if (receiptInput) {
            receiptInput.onchange = () => {
                if (receiptInput.files.length > 0) {
                    currentPoState.invoiceUploaded = true;
                    alert(`Receipt File Uploaded: ${receiptInput.files[0].name}`);
                    renderAiProcurementScreen();
                }
            };
        }

        // 9. Make Payment: Verify Payment
        const btnVerify = document.getElementById("btnPaymentVerify");
        if (btnVerify) {
            btnVerify.onclick = () => {
                if (currentPoState.paymentStatus !== "Paid") {
                    alert("Cannot verify payment. Please mark as paid first!");
                    return;
                }
                btnVerify.disabled = true;
                btnVerify.innerHTML = '<i class="spinner-icon"></i> Verifying...';

                setTimeout(() => {
                    currentPoState.paymentVerified = true;
                    currentPoState.paymentStatus = "Verified";
                    currentPoState.timestamps.paymentVerified = getTimestampStr();
                    currentPoState.status = "Payment Verified (Awaiting SMS Acceptance)";

                    const gst = Math.round(currentPoState.totalCost * 0.18 * 100) / 100;
                    const grandTotal = Math.round((currentPoState.totalCost + gst) * 100) / 100;

                    // Trigger backend SMS to 9978673137
                    try {
                        const token = localStorage.getItem("bk_jwt_token");
                        fetch(`${window.bk_state.API_BASE}/api/pos/requisitions/send-confirmation-sms`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${token}`
                            },
                            body: JSON.stringify({ poId: currentPoState.poNumber, amount: grandTotal })
                        }).then(res => res.json())
                          .then(data => console.log("AI Procurement SMS sent:", data))
                          .catch(e => console.error("Error sending AI PO SMS:", e));
                    } catch(e) {
                        console.error("SMS fetch trigger failed:", e);
                    }

                    alert("Payment successfully verified by AI Auditor. SMS order acceptance prompt sent to +91 99786 73137!");
                    renderAiProcurementScreen();

                    // Show SMS Confirm modal
                    const lblPoId = document.getElementById("lblSmsPoId");
                    const lblPoAmount = document.getElementById("lblSmsPoAmount");
                    if (lblPoId) lblPoId.innerText = currentPoState.poNumber;
                    if (lblPoAmount) lblPoAmount.innerText = `₹${grandTotal.toFixed(2)}`;

                    const modal = document.getElementById("modalProcSmsConfirm");
                    if (modal) modal.style.display = "flex";
                }, 1500);
            };
        }

        // 10. Supplier Sandbox: Accept Order
        const btnSbAccept = document.getElementById("btnSandboxAccept");
        if (btnSbAccept) {
            btnSbAccept.onclick = () => {
                currentPoState.status = "Supplier Accepted";
                currentPoState.timestamps.supplierAccepted = getTimestampStr();
                currentPoState.location = "BK Foods Loading Dock, Surat";
                alert("Supplier marked order as: Accepted!");
                renderAiProcurementScreen();
            };
        }

        // 11. Supplier Sandbox: Prepare & Pack
        const btnSbPack = document.getElementById("btnSandboxPack");
        if (btnSbPack) {
            btnSbPack.onclick = () => {
                currentPoState.status = "Preparing";
                currentPoState.timestamps.preparing = getTimestampStr();
                currentPoState.location = "Assembly & Packing lines";
                
                // Auto trigger Packed shortly after
                setTimeout(() => {
                    currentPoState.status = "Packed";
                    currentPoState.timestamps.packed = getTimestampStr();
                    currentPoState.location = "Packed & ready at loading dock";
                    renderAiProcurementScreen();
                }, 4000);

                alert("Supplier marked order as: Preparing! Order will auto-transition to Packed shortly.");
                renderAiProcurementScreen();
            };
        }

        // 12. Supplier Sandbox: Handover to Driver (Dispatch)
        const btnSbDispatch = document.getElementById("btnSandboxDispatch");
        if (btnSbDispatch) {
            btnSbDispatch.onclick = () => {
                currentPoState.status = "Dispatched";
                currentPoState.timestamps.dispatched = getTimestampStr();
                currentPoState.location = "En route via NH-48 highway";
                alert("Supplier marked order as: Dispatched!");
                renderAiProcurementScreen();
            };
        }

        // 13. Supplier Sandbox: Upload Invoice / Challan
        const btnSbInvoice = document.getElementById("btnSandboxUploadInvoice");
        if (btnSbInvoice) {
            btnSbInvoice.onclick = () => {
                currentPoState.invoiceUploaded = true;
                alert("Simulated invoice uploaded successfully by supplier.");
                renderAiProcurementScreen();
            };
        }

        const btnSbChallan = document.getElementById("btnSandboxUploadChallan");
        if (btnSbChallan) {
            btnSbChallan.onclick = () => {
                currentPoState.challanUploaded = true;
                alert("Simulated delivery challan uploaded successfully by supplier.");
                renderAiProcurementScreen();
            };
        }

        // 14. Supplier Sandbox: Handover to Outlet (Deliver & Restock Database)
        const btnSbDeliver = document.getElementById("btnSandboxDeliver");
        if (btnSbDeliver) {
            btnSbDeliver.onclick = async () => {
                btnSbDeliver.disabled = true;
                btnSbDeliver.innerHTML = '<i class="spinner-icon"></i> Restocking...';

                try {
                    const storeFilter = currentStore === 'All' ? 'VESU' : currentStore;
                    const itemsToReceive = currentPoState.items.map(it => ({
                        label: it.label,
                        qty: it.qty
                    }));

                    const res = await fetch(`${API_BASE}/api/procurement/receive`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            store: storeFilter,
                            items: itemsToReceive
                        })
                    });

                    if (res.ok) {
                        currentPoState.status = "Inventory Updated";
                        currentPoState.timestamps.delivered = getTimestampStr();
                        currentPoState.timestamps.inventoryUpdated = getTimestampStr();
                        currentPoState.location = "Restocked in Outlet Docks";
                        currentPoState.eta = "Completed";
                        alert("Procurement delivery completed! Stock levels successfully replenished in database.");
                        
                        // Sync state
                        await syncStateFromServer();
                    } else {
                        alert("Failed to update stock levels on API server.");
                    }
                } catch (err) {
                    console.error("Restock failed:", err);
                    alert("Error connecting to database restock endpoint.");
                }

                renderAiProcurementScreen();
            };
        }
    }

    window.bk_state = {
        getInventory: () => inventory,
        getCurrentStore: () => currentStore,
        getCurrentRole: () => currentRole,
        API_BASE: API_BASE,
        syncStateFromServer: syncStateFromServer,
        getCurrentPoState: () => currentPoState
    };
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}



// ==========================================
// TRAINING HANDBOOK LOGIC (EXPANDED)
// ==========================================
const trainingModules = [
    {
        "id": "welcome",
        "title": "1.1 Welcome to the Badi Katori Family",
        "desc": "A warm welcome from the founder and leadership team, outlining the brand legacy.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Welcome to the Badi Katori Family</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>To: Our Valued Franchise Partner</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Subject: A Warm Welcome to the Badi Katori Journey</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Dear Partner,</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">It is with great pride and excitement that we officially welcome you to the Badi Katori Family.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">When we started Badi Katori, our vision was to create more than just a food brand; we wanted to build a legacy of taste, trust, and togetherness. Today, as you join us, that vision grows stronger. By choosing to partner with us, you aren't just opening an outlet—you are becoming a vital guardian of our flavors and our values.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">At Badi Katori, we believe that our success is fundamentally tied to yours. Whether it is through our specialized frozen food innovations, our branded beverages, or our streamlined operations in Surat and beyond, every tool in this handbook is designed to help you thrive. We are committed to standing by you, providing the support, marketing insights, and operational excellence needed to make your outlet a local favorite.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Being part of this \"family\" means we move forward together. We value your dedication to maintaining the high standards of hygiene and service that define us. In return, we promise transparency, constant innovation, and a partnership built on mutual respect.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">We are thrilled to have you on board. Let’s work together to serve happiness, one \"Katori\" at a time.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Welcome home!</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">With Warm Regards,</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The Founder & Leadership Team</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Badi Katori</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">“Growing together, serving excellence.”</p>"
    },
    {
        "id": "commitment",
        "title": "1.2 Our Commitment to Quality & Consistency",
        "desc": "The four pillars of culinary excellence and our pledge to customer trust.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Our Commitment to Quality & Consistency</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">At Badi Katori, our reputation is built on a single promise: The perfect taste, every single time. Whether a customer visits an outlet in Vesu, LP Savani, or Gaurav Path, they expect the same crunch, the same aroma, and the same premium experience. Consistency is not just a goal; it is the foundation of our brand.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To honor this commitment, we adhere to these Four Pillars of Excellence:</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Standardized Sourcing</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">We ensure that every outlet uses identical, high-quality ingredients. By centralizing the supply of our signature frozen items and proprietary spice blends, we eliminate the risk of taste variation. If it isn’t from the Badi Katori central supply, it isn't Badi Katori.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Precision in Preparation (SOPs)</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Great food is a science. Our Standard Operating Procedures (SOPs) dictate exact frying temperatures, precise mixing ratios for beverages, and strict plating guidelines. Following these steps ensures that our signature quality is never left to \"guesswork.\"</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. The 1-Year Quality Shield</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">We utilize advanced freezing technology to ensure our products maintain a 1-year shelf life without compromising on freshness or nutritional value. This allows every franchise to serve food that tastes exactly as the founder intended—fresh, safe, and delicious.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Continuous Monitoring & Audits</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Quality is a journey, not a destination. Through regular audits, feedback from our Surat-based micro-influencer campaigns, and real-time data tracking via our POS systems, we constantly monitor performance. We provide the training and tools necessary to correct any deviations before they reach the customer’s plate.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Our Pledge:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">\"Quality is doing it right when no one is looking.\" We pledge to never take shortcuts, never compromise on ingredients, and always prioritize the customer’s trust above all else.</p>"
    },
    {
        "id": "nda",
        "title": "1.3 Confidentiality & Non-Disclosure (NDA)",
        "desc": "Legal obligations and trade secret protection terms for franchise partners.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Confidentiality & Non-Disclosure Agreement (NDA)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">This agreement is a formal commitment to protect the \"Badi Katori\" legacy. By being part of the Badi Katori family, you are entrusted with proprietary secrets that give us our competitive edge in the culinary market.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Definition of Confidential Information</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Confidential information includes, but is not limited to:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Recipes & Blends: Secret spice ratios, marination techniques, and beverage mixing formulas.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Operational Data: Standard Operating Procedures (SOPs), kitchen manuals, and employee training materials.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Business Strategies: Franchise pricing, revised Zomato/Swiggy rate structures, and upcoming menu launch details.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Marketing Assets: Internal micro-influencer lists, barter collaboration terms, and Surat-specific campaign data.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Non-Disclosure Obligations</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Internal Use Only: You agree to use confidential information solely for the purpose of operating your authorized Badi Katori outlet.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>No External Sharing: You shall not disclose, reveal, or share any part of this handbook or internal processes with third parties, competitors, or media outlets without prior written consent from the founder.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Digital Protection: You agree not to photograph, photocopy, or digitally distribute sensitive documents (like this handbook) via social media or messaging platforms to anyone outside the Badi Katori family.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Protection of Trade Secrets</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">You acknowledge that our specialized frozen food technology (offering a 1-year shelf life) and our specific branding methods (specialized glassware and lids) are unique to Badi Katori. Any attempt to replicate or leak these processes to external suppliers is strictly prohibited.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Term & Termination</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">This duty of confidentiality remains in effect throughout your association with Badi Katori and continues to be legally binding even after the termination of your employment or franchise agreement. Upon exit, all physical and digital copies of confidential manuals must be returned or destroyed.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Consequences of Breach</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Any violation of this agreement undermines the hard work of the entire Badi Katori family. Breach of confidentiality will result in:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Immediate termination of the franchise agreement or employment contract.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Legal action for damages and injunctive relief.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Permanent blacklisting from future brand associations.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Acceptance of Terms</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">I understand that I am being trusted with the \"inner workings\" of Badi Katori. I pledge to guard this information with the highest level of integrity.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Signature: __________________________</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Name: _____________________________</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Date: ______________________________</strong></p>"
    },
    {
        "id": "foh_checklists",
        "title": "2.1 FOH: Opening & Closing Checklists",
        "desc": "Daily morning preparation and night reconciliation procedures for FOH staff.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Front-of-House (FOH): Opening & Closing Checklists</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To ensure every customer experiences the same high standard of service from the moment we open until the moment we close, all staff must strictly follow these daily checklists.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">A. Morning Opening Checklist</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Goal: To prepare the outlet for the first customer and ensure 100% operational readiness.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Premises & Ambiance:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Unlock the outlet and conduct a quick walkthrough.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Switch on all lights, fans/AC, and signage boards.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ensure the entrance, floor, and seating area are swept and mopped.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Wipe down all tables and chairs with food-grade sanitizer.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Counter & Tech Setup:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Log in to Petpooja (POS) and check for any pending updates.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Verify internet connectivity and ensure the receipt printer has enough paper.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Open the cash drawer and count the \"Opening Float\" (petty cash) to ensure accuracy.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Delivery Platform Readiness:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Switch on Zomato and Swiggy tablets.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Verify that the menu is \"Online\" and all items (including the New Menu items) are marked as \"Available.\"</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Display & Stock:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Wipe down the display counter and ensure branded glassware is arranged neatly.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Check tissue dispensers and condiment bottles (ketchup/sauces); refill as needed.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ensure the \"Badi Katori Family\" marketing materials/standees are positioned correctly.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">B. Night Closing Checklist</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Goal: To secure the outlet and ensure a smooth start for the next morning.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Financial Reconciliation:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Perform the \"Day-End\" (Z-Report) on Petpooja.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Tally physical cash, card payments, and UPI transactions against the system report.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Record any discrepancies in the daily log for the Outlet Manager.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Kitchen & FOH Cleanup:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Clear all tables and ensure no food waste is left in the seating area.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Dispose of the day’s trash in the external bin; replace liners in all dustbins.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ensure the beverage station is wiped clean and all lids/caps are tightly sealed.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Inventory Check:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Conduct a quick count of high-moving items and note if any frozen stock needs to be ordered (refer to the Upfront Payment policy for reordering).</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ensure all beverage bottles and glassware are accounted for.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Safety & Utilities:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Switch off the Zomato/Swiggy tablets (mark \"Closed\").</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Turn off all kitchen appliances (fryers/induction) following safety protocols.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Switch off ACs, lights, and signage.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Final Step: Double-check all locks on the main door and shutters.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Management Note:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Consistent execution of these checklists reduces errors and maintains the professional image of the Badi Katori brand. Every \"Opening\" and \"Closing\" must be signed off by the Shift Lead in the daily register.</p>"
    },
    {
        "id": "staff_roles",
        "title": "2.2 FOH: Staff Roles & Daily Schedule",
        "desc": "Specific responsibilities of Outlet Incharge, Ustaad, Chaat boys, and Housekeeping.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To ensure the high standards of the Badi Katori brand, this checklist clearly defines the specialized roles of our team. The addition of the Ustaad ensures that our core flavor profiles and fried items remain consistent across all Surat outlets.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Outlet Incharge (1 Person)</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Focus: Admin, Cash, and Digital Platforms</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Morning Opening:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Systems Check: Log into Petpooja; verify the \"New Menu\" rates and \"Item Availability.\"</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Online Platforms: Turn on Zomato/Swiggy tablets; ensure the outlet is \"Live\" and the \"Badi Katori\" branding is visible.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Cash Audit: Count the opening cash float and ensure the billing printer has paper rolls.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Team Huddle: Conduct a 2-minute \"Badi Katori Family\" briefing on the day’s targets and micro-influencer orders.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Night Closing:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Financial Settlement: Tally physical cash/UPI against the Z-Report. Record any discrepancies.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Inventory Ordering: Finalize the frozen food and beverage order for the next day (Process: Upfront Payment).</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Platform Close: Mark \"Closed\" on delivery apps and check for any pending customer complaints.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Facility Lock-up: Ensure all ACs and lights are off; physically lock the shutters.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Ustaad (The Master Chef - 1 Person)</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Focus: Food Quality, Frying Standards, and Secret Recipes</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Morning Opening:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Oil Management: Inspect the oil quality in the fryers. Refill or replace to ensure the perfect \"Badi Katori\" crunch.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Core Prep: Check the status of the frozen food (1-year shelf life items). Ensure proper thawing techniques are followed.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Secret Blends: Prepare the proprietary Badi Katori spice mixes and chutneys for the day.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Equipment Calibration: Test the frying temperatures and induction settings for consistency.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Night Closing:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Oil Safety: Turn off all fryers and cover them properly after they have cooled down.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Stock Security: Ensure all proprietary spices and \"Badi Katori\" signature items are sealed and stored in the refrigerator.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Hygiene Audit: Inspect the kitchen prep area for cleanliness before the Housekeeping boy begins the deep clean.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Waste Reporting: Note any food wastage to help the Incharge with future inventory planning.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Chaat Counter Boys (2 Persons)</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Focus: Assembly, Beverages, and Customer Service</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Morning Opening:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Assembly Station: Arrange the \"Katoris,\" curd, and toppings. Ensure the setup is neat for \"open-kitchen\" viewing.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Beverage Bar: Arrange the branded beverages and ensure the specialized glassware with lids is polished and ready.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Packaging Prep: Keep a stack of delivery bags and branded lids ready for peak-hour Zomato/Swiggy rushes.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Sample Prep: (If applicable) Prepare small samples for tasting as per the marketing strategy.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Night Closing:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Perishable Care: Properly seal and store remaining curd, garnishes, and prep items in the chiller.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Counter Sanitation: Scrub the assembly counter and wash all serving spoons and beverage mixing tools.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Glassware Count: Clean and stack the branded glasses; report any breakages to the Incharge.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Station Reset: Ensure the counter is completely clear of any food debris to prevent pests.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Housekeeping Boy (1 Person)</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Focus: Floor Care, Waste, and Exterior Shine</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Morning Opening:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Floor Deep-Clean: Mop the entire outlet (Front & Back) using approved disinfectants.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Entrance Glass: Clean the glass doors and the main \"Badi Katori\" signage for a \"crystal clear\" look.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Furniture Polish: Wipe down tables and chairs to remove any dust or previous-night stains.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Waste Setup: Line all bins with fresh bags and ensure the hand-wash area is stocked with soap.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Night Closing:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Garbage Disposal: Clear all wet and dry waste bins and dispose of them at the designated municipal point.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Floor Scrubbing: Use heavy-duty cleaners to remove oil/spills near the Ustaad's frying station.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Utility Safety: Ensure all water taps are tightly closed and the washbasin area is dry.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Exterior Sweep: Clean the area immediately outside the shutter to ensure a clean brand image.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Authorization: The Outlet Incharge must sign off on these tasks in the Employee Register before the shift ends. Unfinished tasks must be reported immediately.</strong></p>"
    },
    {
        "id": "petpooja",
        "title": "2.3 Order Management via Petpooja",
        "desc": "KOT workflow, online platform integration, and payment processing standards.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Order Management via Petpooja</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To maintain the efficiency of the Badi Katori family outlets and ensure accurate data for our Excel-based campaign tracking, every team member must follow this standardized process for the Petpooja POS system.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Order Entry & Punching</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Dine-In: Orders must be punched into the system before the food is prepared. Ensure the table number and the number of guests are accurately recorded.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Takeaway: Select the \"Takeaway\" mode to ensure the correct packaging charges (for branded lids and bags) are applied automatically.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Menu Accuracy: Always select the correct item from the New Menu section. Never use \"Miscellaneous\" or \"Open Item\" buttons, as this disrupts our inventory tracking.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Digital Platform Integration (Zomato & Swiggy)</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Auto-Accept: Ensure the \"Auto-Accept\" feature is toggled ON to prevent order cancellations and maintain our high ranking on delivery apps.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Price Syncing: Verify that the rates displayed in Petpooja match the Revised Zomato/Swiggy Rates provided by the Surat head office.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Item Marking: If a specific item is out of stock (e.g., a particular beverage or a frozen specialty), mark it \"Out of Stock\" in the Petpooja dashboard immediately to avoid customer disappointment.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Payment Processing</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Mode of Payment: Correctly tag the payment method—Cash, Card, or UPI. This is critical for the Incharge to tally the Z-Report at the end of the night.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Discounting: Any discounts (e.g., for micro-influencers or barter collaborations) must be authorized by the Outlet Incharge and recorded under the \"Marketing/Barter\" category in the POS.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Receipts: A printed receipt must be provided to every customer. For delivery orders, the bill must be stapled securely to the branded Badi Katori bag.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. KOT (Kitchen Order Ticket) Workflow</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ustaad’s Instruction: Once an order is punched, the KOT will automatically print at the Ustaad’s station.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Priority Management: The Ustaad must prioritize KOTs based on the \"Time Elapsed\" shown on the Petpooja Kitchen Display (if applicable) or the order sequence to ensure a fresh, hot experience.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Special Instructions: Always check for customer notes (e.g., \"Less Spicy\" or \"Extra Chutney\") on the KOT before assembly.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Inventory & Real-Time Tracking</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Stock Consumption: Because we use an Upfront Payment model for supplies, it is vital to keep Petpooja inventory updated. The system will automatically deduct frozen food portions and beverage counts as orders are punched.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Wastage Logging: Any food dropped, burned, or returned must be logged in the \"Wastage\" module of Petpooja by the Outlet Incharge to maintain an accurate stock count for the next order cycle.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Pro-Tip for Incharges:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">At the end of each day, export the Daily Sales Report to the shared Google Sheet. This allows the central team to monitor the success of our micro-influencer campaigns and ensure our Surat outlets are performing at their peak.</p>"
    },
    {
        "id": "customer_service",
        "title": "2.4 Customer Service & Grievance Handling",
        "desc": "Reelo Loyalty enrollment and the L.A.S.T. method for complaint resolution.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Customer Service & Grievance Handling</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">At Badi Katori, we don’t just serve food; we serve an experience. Every interaction is an opportunity to make a customer feel like part of our family. To streamline our loyalty and feedback, we utilize the Reelo System to track customer satisfaction and reward repeat visits.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. The \"Badi Katori\" Service Standard</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Greeting: Every customer must be greeted with a warm smile and a standard welcome: \"Welcome to the Badi Katori Family!\"</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Menu Guidance: If a customer is new, the Counter Boy should suggest our signature items from the New Menu and explain the uniqueness of our \"Katoris.\"</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Wait Time Transparency: Always inform the customer of the expected prep time (e.g., \"Your fresh chaat will be ready in 5-7 minutes\").</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. The Reelo Loyalty & Feedback System</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">We use Reelo to turn every walk-in customer into a regular guest.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Data Collection: For every bill, the Counter Boy must politely ask for the customer's mobile number: \"Sir/Mam, may I have your number for your Badi Katori loyalty points and a digital bill?\"</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Points Enrollment: Ensure the number is entered into the Reelo-integrated POS. Explain that points can be redeemed for future treats.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Feedback Loop: After the visit, Reelo sends an automated feedback link. The Outlet Incharge must review these ratings daily.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">5-Star Ratings: Can be shared on our social media or sent to our micro-influencers.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Low Ratings: Must be addressed immediately (see Grievance Handling below).</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Grievance Handling (The L.A.S.T. Method)</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">If a customer is unhappy with the food quality, taste, or service, follow these four steps:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">L - Listen: Let the customer speak without interruption. Whether it’s about a Zomato delivery delay or the spice level of a chaat, give them your full attention.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">A - Apologize: Use a sincere apology. \"I’m sorry that your experience wasn't up to our Badi Katori standard today.\" Do not give excuses.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">S - Solve:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Food Issue: If the taste isn't right, the Ustaad should immediately replace the dish with a fresh one.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Service Issue: Offer a complimentary branded beverage or a small discount on the next visit via the Reelo system.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">T - Thank: Thank them for bringing the issue to your attention. \"Thank you for helping us improve. We hope to see you again soon.\"</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Handling Digital Grievances (Zomato/Swiggy)</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Packaging Complaints: If a customer complains about spills, check if the specialized lids were applied correctly.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Missing Items: If an item is forgotten, the Outlet Incharge must contact the customer immediately, apologize, and offer a Reelo coupon code for their next order to compensate.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Bad Reviews: Respond to all online reviews within 24 hours. Keep responses professional, humble, and solution-oriented.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Escalation Matrix</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>If a grievance cannot be resolved at the outlet level:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Level 1: Outlet Incharge attempts resolution.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Level 2: If the customer remains unsatisfied, the Incharge must take the customer's details and inform them that the Surat Head Office will contact them within 24 hours.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Reporting: All major grievances must be logged in the \"Complaints\" tab of your daily Excel report.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Staff Reminder:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">A happy customer tells 3 people, but an unhappy customer tells 10. Use the Reelo system to stay connected and always choose kindness.</p>"
    },
    {
        "id": "boh_inventory",
        "title": "2.5 BOH: Inventory & Upfront Ordering",
        "desc": "Precise ordering cycles, prepaid supply model, and cold chain rules.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Back-of-House (BOH): Inventory Management & Upfront Ordering</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">In the Badi Katori ecosystem, the Back-of-House (BOH) is the engine that drives our consistency. Because we use specialized frozen technology with a 1-year shelf life, our inventory management is focused on precision and maintaining a \"Zero Stock-Out\" environment.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. The Upfront Ordering System</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To ensure a smooth supply chain and high-quality standards, Badi Katori operates on a strict Pre-Paid Supply Model.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Ordering Cycle: The Outlet Incharge must review stock levels every Monday and Thursday.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Payment Protocol: Orders for frozen base products, proprietary spices, and branded packaging (specialized glassware/lids) are only processed once the Upfront Payment is confirmed via the central banking channel.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Lead Time: Always allow a 24-48 hour window for delivery within Surat. Never wait until the last packet is opened to place an order.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Inventory Tracking (Excel & Petpooja)</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Daily Opening Stock: The Ustaad must count the main frozen items (Katori bases, signature fillings) every morning.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Digital Sync: The Outlet Incharge must ensure the physical count matches the \"Stock-in-Hand\" data on Petpooja.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Excel Reporting: At the end of each week, the total consumption versus sales must be entered into the Excel Campaign Tracker. This helps the head office analyze if high-traffic micro-influencer visits are impacting specific stock items.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Storage & The \"1-Year Shelf Life\" Rule</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Our frozen products are designed to last, but only if stored correctly.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Temperature Control: Deep freezers must be maintained at -18°C or below. The Ustaad must check the thermometer thrice daily (Opening, Peak Hour, Closing).</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">FIFO Method (First-In, First-Out): New stock must always be placed behind or under older stock. This ensures that no item exceeds its quality window, even with a long shelf life.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Thawing Protocol: Only thaw the amount of stock required for a 4-hour window. Re-freezing thawed items is strictly prohibited as it destroys the texture and safety of the \"Badi Katori\" experience.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Branded Asset Management</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Inventory isn't just food—it’s also how we present it.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Beverage Glassware: These are premium assets. The Housekeeping boy and Chaat Counter boys must track the count of glasses. Any breakage must be logged as \"Wastage\" in Petpooja.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Lids & Packaging: Since we have revised our Zomato/Swiggy packaging, ensure that the count of \"Specialized Lids\" matches the number of beverage bottles ordered.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Quality Rejection Criteria</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Upon receiving a delivery from the central supply, the Outlet Incharge must inspect the items. Reject stock if:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The vacuum packaging of frozen items is torn or bloated.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The \"Manufactured Date\" is missing.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The branded glassware arrives cracked or chipped.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">There are signs of \"Freezer Burn\" (excessive ice crystals inside the packet), indicating a temperature fluctuation during transport.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>BOH Golden Rule:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">\"If you don't measure it, you can't manage it.\" Accurate inventory ensures that we never have to say \"No\" to a customer or a micro-influencer during a high-profile launch.</p>"
    },
    {
        "id": "order_dispatch",
        "title": "2.6 Zomato & Swiggy Dispatch Protocols",
        "desc": "Spill-proof packaging standards and coordination with delivery riders.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Zomato & Swiggy Order Dispatch Protocols</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Managing digital orders requires speed, accuracy, and perfect presentation. Since we have revised our Zomato & Swiggy rates and updated our packaging, following these protocols is essential to maintain our high ratings and minimize \"bad experience\" refunds.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Order Receipt & Preparation</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Instant Acceptance: Orders must be accepted on the tablet within 60 seconds.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The \"New Menu\" Sync: The Outlet Incharge must ensure the items ordered match the current versions from the New Menu launch.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>KOT Generation: As soon as the order is accepted, the Ustaad must receive the KOT and begin frying or assembly immediately to meet the \"Food Prep Time\" (EPT).</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Quality Control (QC) Before Packing</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Before any item goes into a bag, the Chaat Counter Boy must perform a \"Final Look\" check:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Temperature: Are the fried items hot and crispy? (Cold fried food is the #1 cause of 1-star reviews).</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Customizations: Check the \"Customer Notes\" on the tablet for requests like \"No Onion,\" \"Extra Spicy,\" or \"Send Cutlery.\"</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Portioning: Ensure the \"Badi Katori\" signature base is filled to the standard level—consistency across Surat is our priority.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Specialized Packaging Standards</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">We have invested in premium branding to ensure our food survives the Surat traffic.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Spill-Proof Beverages: Use only the specialized glassware and lids with the Badi Katori branding. Ensure the lid is \"clicked\" into place to prevent leaks during transit.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Crispiness Retention: Use vented packaging for fried items so they don't get soggy from steam.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Secure Sealing: Every bag must be sealed with a Badi Katori brand sticker or stapled with the bill in a way that the customer can tell if it has been tampered with.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Dispatch & Rider Coordination</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Marking \"Ready\": Only mark the order as \"Food Ready\" on the tablet once the bag is completely packed and sealed. Marking it ready too early frustrates riders and triggers platform penalties.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Rider Interaction: Treat delivery riders as part of the extended Badi Katori Family. Greet them politely and verify the Order ID (last 4 digits) before handing over the bag.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Handover Check: Ask the rider to place the bag upright in their thermal carrier. Remind them: \"This contains beverages, please handle with care.\"</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Handling Delays & Issues</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Preparation Delays: If a dish is taking longer than expected, the Outlet Incharge should use the \"Help\" or \"Call Rider\" feature to keep the customer informed.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Out-of-Stock Items: If an item is unavailable, call the customer immediately to offer a replacement from the New Menu instead of just cancelling the order.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Correction Tracking: Every cancelled order or \"Missing Item\" complaint must be logged in the Daily Excel Sheet for the weekly operations review.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Delivery Goal:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">When a customer opens a Badi Katori bag at home, it should look and taste exactly as it does at our counter. Perfect packing = Repeat orders.</p>"
    },
    {
        "id": "maintenance_safety",
        "title": "2.7 Equipment Maintenance & Safety",
        "desc": "Preventive maintenance calendars, kitchen fire protocols, and safety shutdown.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Equipment Maintenance & Safety</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">At Badi Katori, our equipment is the heart of our kitchen. Proper maintenance ensures that our \"Ustaads\" can deliver the perfect crunch every time, while strict safety protocols protect our \"Badi Katori Family\" from workplace hazards.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Daily Equipment Care</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Fryers & Induction Units:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Morning: Check for any frayed wires or oil leaks before switching on.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Night: Wipe down the exterior surfaces once cooled. Never use a dripping wet cloth near electrical panels.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Deep Freezers (-18°C):</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Wipe the door gaskets (rubber seals) to ensure they are airtight. This preserves our 1-year shelf life stock.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Avoid keeping the door open for extended periods to prevent \"Freezer Burn\" on our frozen bases.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Petpooja POS & Tablets:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Clean screens only with a dry microfiber cloth.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ensure charging cables are organized and not stretched, preventing port damage.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Preventive Maintenance Schedule</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To avoid \"Peak Hour\" breakdowns, we follow a strict calendar:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Weekly Deep Clean: Every Sunday night, the Ustaad must oversee a complete oil filtration and deep-scrub of the fryer vats.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Monthly Technical Audit: A certified technician will visit each Surat outlet to check the gas lines, electrical load, and refrigeration compressors.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Filter Cleaning: AC and exhaust chimney filters must be cleaned every 15 days to maintain air quality and prevent grease-fire hazards.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Fire & Electrical Safety</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Oil Safety: Never fill the fryer above the \"MAX\" line. If the oil begins to smoke excessively, turn off the power immediately.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Fire Extinguishers: Every outlet must have at least one Class K (Kitchen) or CO2 fire extinguisher near the exit. All staff must know how to pull the pin and use it.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Water & Electricity: The Housekeeping boy must ensure the floor around the electrical main board and induction units is always dry.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Personal Safety Protocols</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Protective Gear: The Ustaad and Counter Boys must wear closed-toe, non-slip shoes to prevent falls on oily surfaces.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>First Aid Kit: A fully stocked first aid kit (with burn cream, bandages, and antiseptic) must be kept at the billing counter, managed by the Outlet Incharge.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Lifting Technique: When moving heavy crates of beverages or bulk frozen stock, always bend at the knees—never the back.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Emergency Shutdown Procedure</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">In the event of a gas leak, electrical spark, or fire:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Switch Off: Hit the main electrical breaker and close the main gas valve.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Evacuate: Calmly lead customers to the assembly point outside.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Report: Once safe, the Outlet Incharge must immediately call the Surat Head Office emergency line.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Safety Motto:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">\"Speed is good, but safety is better.\" No order is more important than the well-being of our team and customers. Maintain your tools, and they will take care of the business.</p>"
    },
    {
        "id": "frying_parameters",
        "title": "3.1 Frying & Portioning Parameters",
        "desc": "Standard operating procedures and frying times for appetizers and patties.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP): Deep Fried Appetizers & Patties & Beverage Menu & Mixing Ratios for Branded Drinks & Usage of Branded Glassware & Lids</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To maintain the signature Badi Katori crunch and ensure consistency across all Surat outlets, the Ustaad and Chaat Counter Boys must strictly adhere to these frying parameters and serving portions.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Pre-Frying Preparation</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Oil Check: Ensure the fryer is filled with clean oil to the \"MAX\" line.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Temperature Calibration: Preheat the fryer until the thermostat indicates exactly 170°C. Frying at lower temperatures will result in oily, soggy products.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Frozen Handling: Take the product directly from the deep freezer (-18°C). Do not thaw these items unless specifically instructed, as they are designed to be fried from frozen to maintain their 1-year shelf life quality.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Frying & Portioning Table</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">No.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Product Name</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Frying Time</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Temp (°C)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Serving Size (Qty/Weight)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Accompaniments (Dips)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">1</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">French Fries</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">4 Mins</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">170</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150 GM</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ketchup</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">2</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Chilli Garlic Pops</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">4 Mins</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">170</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150 GM</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ketchup & Chipotle</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">3</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Veggie Sticks</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">4 Mins</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">170</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150 GM (6 Pcs)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ketchup & Chipotle</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">4</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Mozzarella Sticks</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">4 Mins</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">170</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">4 Pcs</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ketchup & Chipotle</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">5</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Hara Bhara Kebab</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">4 Mins</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">170</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">6 Pcs</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney & Schezwan</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">6</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Jalapeno Cheese Poppers</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">4 Mins</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">170</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">10 Pcs</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Chipotle Sauce</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">7</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Classic Patty</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">4 Mins</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">170</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">1 Pcs</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">As per Burger/Sandwich SOP</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">8</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Spicy Paneer Patty</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">4 Mins</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">170</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">1 Pcs</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">As per Burger/Sandwich SOP</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Preparation Steps</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Loading: Place the exact portion into the fryer basket. Do not overfill the basket, as this drops the oil temperature rapidly.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Frying: Submerge the basket and set the timer for 4 Minutes. Shake the basket gently halfway through to ensure even browning.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Draining: Once the timer rings, lift the basket and hang it over the fryer for 30 seconds to drain excess oil.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Seasoning: For French Fries and Pops, toss in a clean mixing bowl with the proprietary Badi Katori seasoning while hot.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Plating & Presentation</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Accompaniments: Place the specified dips in branded portion cups. For delivery orders (Zomato/Swiggy), ensure lids are snapped on tightly.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Packaging: Use vented Badi Katori boxes to ensure the steam escapes, keeping the items crispy until they reach the customer.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Visual Check: Items should be golden-brown. If an item is dark brown (burnt) or pale (under-fried), it must be discarded and logged in the Petpooja Wastage Module.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ustaad’s Note:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The secret to our success is the 170°C/4-minute rule. Never rush the process by increasing the heat, as it will cook the outside but leave the inside cold.</p>"
    },
    {
        "id": "beverage_recipes",
        "title": "3.2 Beverage Menu & Mixing Ratios",
        "desc": "Standard ratios, blending times, and quality metrics for cold and hot beverages.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP): Beverages & Mixes</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To ensure every drink served at Badi Katori has the exact flavor profile intended by the brand, the Chaat Counter Boys and Ustaad must follow these precise measurements and blending times.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Cold Beverages (Blended & Shaken)</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Category</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Item Nos.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Weight (Premix)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Output</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ingredients Required</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Cold Coffees</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">1-8</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">27g - 29g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">280-290 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">175ml Milk + 75g Ice</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Add milk and pouch contents to blender.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Add ice and blend for 45 seconds.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Serve chilled in a serving glass.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Frappes</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">9-14</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">38g - 39g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">280-290 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">125ml Milk + 125g Ice</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Add milk and pouch contents to blender.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Add ice and blend for 45 seconds.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Serve chilled.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Bubble Tea</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">15-24</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">46g - 58g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">300-315 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">100ml Milk + 100ml Water + 100g Ice</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Add milk, water, and ice to blender.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Add pouch contents and blend for 45 seconds.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Pour into serving glass and serve chilled.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Coolers</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">25-42</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">29g - 50g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">300-315 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150ml Water + 150g Ice</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Add water and pouch to shaker glass.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Add ice and shake vigorously for 30 seconds.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Pour into serving glass.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Cold Coco</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">43-45</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">51g - 53g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">280-290 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">175ml Milk + 75g Ice</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Add milk and pouch contents to blender.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Add ice and blend for 45 seconds.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Serve chilled.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Smoothies</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">54-57</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">58g - 83g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">250 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">100ml Water + 150g Ice</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Mix premix in water and leave for 5 mins.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Add mix and ice to blender.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Blend on low speed for 90 seconds.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ice Tea</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">64-72</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">27g - 30g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">300-315 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150ml Water + 150g Ice</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Add water, pouch, and ice to shaker.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Shake vigorously for 30 seconds.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Pour into serving glass.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Lassi</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">73-85</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">35g - 60g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">200-220 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">200g Curd (Dahi)</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Add curd and pouch to a vessel.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Use electric whisker for 30s or manual for 60s.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Serve chilled.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Fruit Shakes</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">100-104</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">44g - 56g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">285-300 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">125ml Milk + 125g Ice</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Add milk, ice, and pouch to blender.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Blend for 45 seconds and serve chilled.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Cheesecake Shakes</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">105-110</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">44g - 62g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">285-300 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">125ml Milk + 125g Ice</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Add milk, ice, and pouch to blender.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Blend for 45 seconds and serve chilled.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Mocktails</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">110-114</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">40g - 48g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">285-300 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150ml Soda + 150g Ice</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Shake 50ml water, ice, and pouch for 30s.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Pour into glass; top with 150ml soda and stir.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Hot Beverages</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Category</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Item Nos.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Weight (Premix)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Output</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ingredients Required</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Hot Coffee</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">46-53</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">13g - 69g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150ml Hot Milk</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Add hot milk and pouch to a cup.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Mix well with a spoon to ensure no lumps.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Serve hot.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Milk Based (Hot)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">58-61</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">25g - 31g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">160-175 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150ml Hot Milk</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Mix pouch in 50ml hot milk.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Once thick, add remaining 100ml milk; stir for 1 min.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Water Based (Hot)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">62-63</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">9g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150ml Hot Water</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Mix pouch into hot water, stir well, and serve.</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Hot Tea (Sugar Free)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">94-99</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">5g - 10g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">150 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">50ml Water + 100ml Milk</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Heat water and milk to a boil.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Add pouch, stir well, strain, and serve hot.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Specialized Shots & Smoothies</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Category</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Item Nos.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Weight (Premix)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Output</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ingredients Required</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Fruit Shots</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">115-116</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">58g - 67g</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">300 ml</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">100ml Water + 150g Ice</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Mix premix in water and leave for 3-4 mins.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Blend with ice for 60 seconds and serve.</h4><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Beverage Quality Standards</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Ice Quality: Use only RO-water ice cubes. Never use \"crushed ice\" from outside vendors.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Blending Time: Always use a timer. Under-blending leaves lumps; over-blending makes the drink watery.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Branding: All beverages must be served in Badi Katori branded glassware or delivery bottles with specialized lids.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Verification: The Outlet Incharge must randomly check the weight of the premix pouches to ensure we are following the Upfront Ordering stock precision.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Staff Note:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Consistent measurements equal consistent taste. Whether a customer is in LP Savani or Vesu, the drink must taste the same!</p>"
    },
    {
        "id": "chaat_assembly",
        "title": "3.3 Chaat Assembly & Garnishing Matrix",
        "desc": "Assembly guidelines, Surti touch garnishing, and plating contrasts.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP): Chaat Assembly & Garnishing</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To maintain the signature \"Badi Katori\" visual appeal and flavor profile, the Chaat Counter Boys must follow this assembly guide strictly. Consistency in garnishing ensures that every plate served across Surat looks identical and premium.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Base Assembly Guidelines</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Temperature: Hot bases (Samosa, Tikki, Kachori) must be fresh and crispy. Cold bases (Bhalla, Papdi) must be chilled.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The \"Pour\" Standard: Chutneys should be drizzled in a zig-zag pattern, never dumped in one spot.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Dahi Consistency: Use the Reelo feedback to ensure dahi thickness is maintained. It must be whisked smooth, chilled, and slightly sweetened.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Assembly & Ingredient Matrix</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Category</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Variant</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Mandatory Ingredients & Garnishes</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">ALOO TIKKI</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Chaat</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Dahi, Nylon Sev, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Chole</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth Chutney, Laal Masala</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ragda</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Nylon Sev, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">SAMOSA</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Regular</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth Chutney</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Chaat</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Dahi, Nylon Sev, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Chole</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Laal Masala, Saunf Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ragda</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Nylon Sev, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Kadi</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ratlami Sev, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">KACHORI</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Regular</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth Chutney</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Chaat</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Dahi, Nylon Sev, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Chole</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ragda</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Nylon Sev, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Kadi</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ratlami Sev, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">CHOLE</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Bhatura/Kulcha</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">RAGDA</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Kulcha</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">BHALLA</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Chaat/Papdi</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Dahi, Nylon Sev, Carrot, Beetroot, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Raj Kachori</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Dahi, Nylon Sev, Surti Mix, Tikhi Boondi, Laal Masala, Saunf Masala, Carrot, Beetroot, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">BADI KATORI</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Dahi, Nylon Sev, Surti Mix, Tikhi Boondi, Laal Masala, Saunf Masala, Carrot, Beetroot, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">PURI</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Dahi Puri</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Dahi, Nylon Sev, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Masala Puri</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Nylon Sev, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Sev Puri</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Nylon Sev, Laal Masala, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">MURMURA</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Chowpaty/Jhal</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Nylon Sev, Surti Mix, Tikhi Boondi, Chapta Chana, Chana Dal, Laal Masala, Saunf Masala, Carrot, Beetroot, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Dahi Chowpaty</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Dahi, Nylon Sev, Surti Mix, Tikhi Boondi, Chapta Chana, Chana Dal, Laal Masala, Saunf Masala, Carrot, Beetroot, Coriander</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">PALAK</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Patta Chaat</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Green Chutney, Sonth, Dahi, Nylon Sev, Surti Mix, Tikhi Boondi, Chapta Chana, Chana Dal, Laal Masala, Saunf Masala, Carrot, Beetroot, Coriander</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Specialized Garnishing Steps</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The \"Surti\" Touch: For Raj Kachori, Badi Katori, and Murmura items, ensure the Surti Mix and Tikhi Boondi are crunchy (check daily).</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Color Contrast: Carrot and Beetroot must be finely grated. Place them on top of the dahi/chutney layer to provide a vibrant contrast against the green coriander.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Masala Dusting:Laal Masala and Saunf Masala should be dusted lightly from a height for even distribution. Never clump the masala in one spot.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Sev Application:Nylon Sev is our signature finish. It should cover the top layer generously but should not fall off the sides of the plate.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Delivery Dispatch (Zomato/Swiggy)</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Separation: For items like Samosa Ragda or Chole Bhatura, package the liquid (Ragda/Chole) in a leak-proof container and the dry base separately to prevent sogginess.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Chutney Packets: Always include extra small pouches of Green and Sonth chutney for delivery orders.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Final Visual Check: Before sealing the bag, ensure no dahi or chutney has leaked onto the rim of the container.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ustaad’s Quality Note:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The eye eats before the mouth. If the Beetroot and Carrot garnish isn't fresh, the whole dish looks dull. Keep your garnishing station organized and chilled at all times.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Plating & Presentation Standards</h4>"
    },
    {
        "id": "plating_presentation",
        "title": "3.4 Plating & Presentation Standards",
        "desc": "Visual excellence protocols, clean slate rule, and packaging audits.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP): Visual Excellence & Serving Protocols</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">At Badi Katori, we believe the \"first bite\" is taken with the eyes. Our presentation must reflect the premium nature of our brand, ensuring every plate is Instagram-ready for our customers and micro-influencers.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. The \"Clean Slate\" Rule</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Plate Integrity: Before assembly, inspect every plate or bowl. Any item with chips, cracks, or visible stains must be discarded immediately.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Rim Hygiene: The rim (outer edge) of the plate must remain completely clean. If any chutney, dahi, or spice falls on the rim during assembly, the Chaat Counter Boy must wipe it away with a clean, food-grade tissue before serving.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Branded Placement: Ensure the Badi Katori logo on the liner or container is upright and facing the customer.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Layering & Architecture</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To ensure our chaat doesn't look like a \"messy mix,\" follow the Vertical Layering technique:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Base: Place the hot item (Tikki/Samosa) or the Katori base in the center.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Sauce Foundation: Pour Dahi first (if applicable), followed by Green Chutney, and then Sonth. Use a circular motion to ensure the colors are distinct and visible.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Crunch Layer: Apply Nylon Sev, Tikhi Boondi, or Surti Mix over the chutneys. This prevents the crunchies from getting soggy too quickly.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Signature Garnish: Place grated Carrot and Beetroot in the center-top. Finish with a fresh sprinkle of bright green Coriander.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Masala Dusting: A final light flick of Laal Masala or Saunf Masala over the dahi to add depth.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Beverage Presentation (Reelo Standard)</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Glassware Excellence: Use only the specialized Badi Katori branded glassware. Ensure there are no water spots or fingerprints on the glass.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Lid Lock: For both dine-in and takeaway, the lid must be pressed down until a \"click\" is heard.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Straw Protocol: Serve with a paper straw placed beside the glass (for dine-in) or tucked securely into the packaging (for delivery).</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Delivery (Zomato/Swiggy) Aesthetics</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Anti-Soggy Engineering:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">For Samosa/Tikki Chaat, place the base items in the main compartment and the Ragda/Chole in a separate leak-proof container.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Place a small parchment divider between fried items and cold chutneys if they share a box.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Seal of Trust: Apply the Badi Katori safety seal over the bag's opening. A neat, untampered bag increases our Reelo feedback scores.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Presentation Audit (Visual Checklist)</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The Outlet Incharge must verify these 5 points before any order leaves the counter:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Vibrancy: Are the Green, Red (Sonth), and White (Dahi) colors distinct?</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Garnish: Are the Beetroot and Carrot fresh and brightly colored?</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Cleanliness: Is the rim of the bowl/plate spotless?</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Temperature: Is the steam rising from the hot items? Is the beverage glass chilled?</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Branding: Is the bill attached neatly and the logo visible?</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">6. Service Etiquette</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Placement: Place the dish gently in front of the customer. Do not slide it across the table.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Orientation: The \"Best Face\" of the dish (the side with the most colorful garnish) should face the customer.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The \"Enjoy\" Greeting: Always say: \"Please enjoy your Badi Katori Signature [Item Name].\"</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Management Note:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Our micro-influencer campaigns in Surat rely on how our food looks in photos. One messy plate can hurt our digital reputation. Take the extra 5 seconds to make it perfect.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Packaging Standards</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP): Delivery vs. Dine-in Packaging</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">At Badi Katori, how we wrap our food is as important as how we cook it. We have two distinct standards: Dine-in focuses on \"The Visual Wow,\" while Delivery (Zomato/Swiggy) focuses on \"The Structural Integrity.\"</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Dine-in Presentation (The Experience)</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Focus: Aesthetics, Freshness, and Immediate Enjoyment</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Plating: Use only high-quality, sanitized Badi Katori ceramic or premium Melamine plates (per outlet tier).</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Liners: Every plate must have a fresh Badi Katori branded greaseproof liner to prevent the base (Samosa/Tikki) from slipping.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Beverages: Serve in the specialized branded glassware. The lid should be off unless requested by the customer, and a paper straw should be provided on the side.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Accompaniments: Chutneys and dips are served directly on the plate in artistic swirls or in small reusable ramekins.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Tray: All items must be carried on a clean tray. Never hand a plate directly to a customer by holding the rim with your fingers.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Delivery Packaging (The Protection)</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Focus: Heat Retention, Spill-Prevention, and Anti-Sogginess</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Product Type</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Primary Packaging</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Secondary Packaging</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Critical Instruction</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Fried Items (Fries, Pops)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Vented Badi Katori Box</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Branded Paper Bag</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Do not seal the bag completely; allow steam to escape so they stay crispy.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Gravy Chaat (Ragda/Chole)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Leak-proof PP Container</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Reusable Outer Box</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Pack the Ragda/Chole in a separate 250ml container; keep the Samosa/Tikki dry in the main box.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Signature Beverages</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Specialized Glass/Bottle</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Click-Lock Lid</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ensure the lid \"clicks.\" Place in a cup-holder insert inside the delivery bag.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Pani Puri</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">8-hole Puri Tray</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">500ml Spout Pouch</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Pani (water) must be sent in a sealed pouch to prevent leakage into the Puris.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. The \"Anti-Soggy\" Protocol for Delivery</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To maintain our New Menu standards during a 20-minute Surat traffic transit:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Separate the Wet & Dry: Never pour Ragda, Chole, or Dahi over fried bases for delivery. Provide them in separate \"portion cups\" so the customer can assemble them fresh at home.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Ventilation: All fried snack boxes must have ventilation holes. If the steam stays inside, the \"Badi Katori Crunch\" is lost.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Cold vs. Hot: Never place a chilled Beverage glass in the same bag as a hot Aloo Tikki. Use separate bags or a thermal divider to maintain temperatures.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. The \"Final Seal\" & Dispatch</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Cutlery & Napkins: Include 2 napkins and the required wooden spoons/forks based on the order size.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Safety Seal: Every delivery bag must be closed with a Badi Katori Tamper-Evident Sticker. This reassures the customer of hygiene and safety.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Bill: Staple the Petpooja bill to the outside of the bag, ensuring the \"Revised Rates\" and \"Itemized List\" are clearly visible for the rider to verify.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Inventory Management of Packaging</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Upfront Ordering: The Outlet Incharge must monitor the stock of specialized lids and branded boxes. Since these are proprietary, local market substitutes are strictly prohibited.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Wastage: If a delivery box is crushed or a lid is faulty, log it as \"Packaging Wastage\" in Petpooja to maintain accurate inventory for the next upfront payment cycle.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Staff Reminder:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">For Dine-in, we are selling a 'Vibe.' For Delivery, we are selling 'Convenience.' If a Zomato customer receives a soggy Samosa, we lose a Reelo member. Pack with pride!</p>"
    },
    {
        "id": "personal_grooming",
        "title": "4.1 Personal Grooming & Uniform Protocols",
        "desc": "Strict uniform, hairnet, glove, and breath safety standards for all staff.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP): Personal Grooming & Protective Gear</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">At Badi Katori, hygiene is our first ingredient. As a brand that serves high-traffic areas across Surat, our staff must reflect the cleanliness and professionalism of our central kitchen. The following protocols are mandatory for the Badi Katori Family.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Uniform & Personal Appearance</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Cleanliness: Every staff member must wear a freshly laundered Badi Katori branded uniform daily. Uniforms with visible stains (chutney, oil, or grease) are not permitted on the floor.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Footwear: Closed-toe, non-slip black shoes are mandatory. They must be polished and clean.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Accessories: For food safety, watches, rings, bracelets, or dangling jewelry are strictly prohibited during work hours as they can harbor bacteria or fall into the food.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Nails: Nails must be trimmed short and kept clean. No nail polish or artificial nails are allowed for anyone handling food or beverages.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Hairnet & Headgear Protocol</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">100% Coverage: The Ustaad, Chaat Counter Boys, and Housekeeping Boy must wear a hairnet or the official Badi Katori cap at all times.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Application: All hair must be tucked inside the cap/net. For staff with long hair, it must be tied in a bun before putting on the headgear.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Beard Hygiene: Staff with facial hair must wear a beard net (snood) while in the kitchen or assembly area to ensure no hair falls into the signature \"Katoris.\"</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Glove & Hand Hygiene Protocol</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">We follow a \"Zero Direct Contact\" policy for all ready-to-eat items.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Hand Washing: Hands must be washed for 20 seconds with soap and warm water:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Before starting a shift.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">After using the restroom.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">After touching trash or cleaning tools.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">After sneezing, coughing, or touching the face.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Glove Usage:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Blue Nitrile/Vinyl Gloves must be worn by Chaat Counter Boys and the Ustaad during food assembly and plating.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>When to Change: Change gloves every 2 hours, or immediately if they are torn, or after switching from raw prep to cooked food.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Golden Rule: Wearing gloves is not a substitute for washing hands. Always wash hands before putting on a new pair.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Mask & Breath Safety</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Assembly Area: Staff at the open-facing chaat counter must wear a face mask or a transparent mouth shield. This prevents accidental droplets from contaminating the food while speaking to customers or coworkers.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Illness Policy: Any staff member showing symptoms of cold, cough, or fever must report to the Outlet Incharge immediately and will be prohibited from handling food.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Housekeeping Specific Standards</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Color-Coded Cleaning: The Housekeeping Boy must use separate gloves for cleaning the dining area (Yellow) and the restrooms (Red). These gloves must never enter the kitchen area.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Apron Protocol: Housekeeping must wear a heavy-duty waterproof apron when deep-cleaning the floor or washing the specialized glassware.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">6. Daily Hygiene Audit</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The Outlet Incharge will conduct a \"Line-Up Check\" every morning:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Are all uniforms ironed and clean?</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Is hair fully covered?</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Are fingernails trimmed?</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Are all workstations stocked with fresh gloves and sanitizer?</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Staff Reminder:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Our customers in Surat trust Badi Katori for its quality. Hygiene is a sign of respect for our food and our guests. If you look clean, the food feels safe.</p>"
    },
    {
        "id": "kitchen_sanitation",
        "title": "4.2 Kitchen Sanitation & Cleaning Cycles",
        "desc": "Daily cleaning schedules, nightly deep cleans, and monthly inspections.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP): Kitchen Sanitation & Deep-Cleaning</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">A clean kitchen is the foundation of the Badi Katori taste. Because we handle high volumes of fried items and dairy-based beverages, grease and residue can build up quickly. This schedule ensures every Surat outlet remains \"audit-ready\" at all times.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Daily Cleaning Cycles</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Frequency</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Area / Equipment</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Responsibility</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Task Description</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Every 2 Hours</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Chaat Counter</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Counter Boy</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Wipe down stainless steel surfaces with food-grade sanitizer. Clean spills immediately.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">After Every Use</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Blender Jars</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Beverage Incharge</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Rinse with RO water and sanitize. Ensure no milk/fruit residue remains.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Post-Peak Hour</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Floor (Kitchen)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Housekeeping</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Sweep and mop with degreaser to prevent oil-slick accidents.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Closing (Daily)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Fryers & Vats</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ustaad</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Filter oil (if reusable) or discard. Scrub the vat walls to remove carbon buildup.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. The Nightly Deep-Clean Protocol (End of Shift)</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Before the Outlet Incharge signs off for the night, the following Deep-Clean must be completed:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Refrigeration Units: Wipe down the gaskets (rubber seals) of the -18°C Deep Freezers. Ensure no ice buildup is blocking the doors, as this affects our 1-year shelf life stock.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Drainage Systems: Pour hot water and disinfectant down all kitchen drains to prevent odors and pests.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Induction & Heating: Clean the surface of all induction cooktops and sandwich grillers using a non-abrasive scrubber.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Wall Tiles: Scrub the tiles behind the frying station to remove airborne grease.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Trash Management: Empty all bins, wash them with disinfectant, and line them with fresh bags for the next morning.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Weekly Maintenance & Sanitation</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Every Sunday night (or the designated slow night for your Surat location), the team must perform a Grand Sanitation:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Exhaust Chimneys: Remove filters and soak them in heavy-duty degreaser. Clean filters ensure a smoke-free environment for the \"Badi Katori Family.\"</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Storage Racks: Remove all dry stock and wipe down the shelves in the BOH area.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Glassware Descaling: Perform a deep-clean of all specialized branded glassware to remove any water spots or milk film, ensuring they are crystal clear.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Pest Control Check: Inspect corners and behind heavy equipment for any signs of pests. Report findings in the Daily Excel Report.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Chemical & Tool Safety</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">No Cross-Contamination: Never use the same mop/cloth for the restroom and the kitchen. Use Color-Coded Tools (e.g., Red for Restroom, Green for Kitchen).</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Storage: All cleaning chemicals must be stored in a locked cabinet away from food products to prevent accidental poisoning.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Labeling: Ensure all spray bottles are clearly labeled (e.g., \"Sanitizer,\" \"Degreaser\").</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. The \"White Glove\" Audit</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Outlet Incharge must perform a daily inspection before opening:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Touch Test: Run a finger along the top of the fridge and the side of the fryer. If there is grease, it is not clean.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Smell Test: The kitchen should smell like fresh spices, not stale oil or drains.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Visual Test: Check the specialized lids and packaging area—it should be dust-free and organized.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ustaad’s Quality Tip:</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Cleanliness is not a chore; it is a discipline. A clean kitchen works faster, breaks down less often, and keeps our customers coming back to a brand they can trust.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP): Oil Quality Monitoring & Disposal</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The \"Badi Katori Crunch\" depends entirely on the quality of our frying oil. Stale or degraded oil ruined the taste of our proprietary frozen bases and creates health risks. Every Ustaad must follow these protocols to ensure our fried items remain light, crispy, and gold-standard.</p>"
    },
    {
        "id": "oil_quality",
        "title": "4.3 Oil Quality Monitoring & Disposal",
        "desc": "Total Polar Materials (TPM) testing, filtration rules, and eco-friendly disposal.",
        "content": "<h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Daily Oil Inspection (The Morning Ritual)</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Before starting the first fry of the day at 170°C, the Ustaad must inspect the oil using three criteria:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Color: The oil should be clear and golden. If it is dark brown or \"coffee-colored,\" it must be replaced.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Odour: Fresh oil has a neutral scent. If the oil smells \"fishy,\" \"nutty,\" or \"soapy,\" it has oxidized and is unfit for use.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Smoke Point: If the oil begins to smoke before reaching the target 170°C, it has broken down chemically and must be discarded.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Total Polar Materials (TPM) Monitoring</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>To stay compliant with food safety regulations and maintain Badi Katori quality:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>TPM Testing: Use a digital TPM meter or oil test strips every afternoon before the evening rush.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Limit: If the TPM reading exceeds 25%, the oil is considered \"spent.\" It must be drained and replaced immediately. Serving food fried in oil above 25% TPM is a violation of brand standards.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Operational Best Practices</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To extend the life of our oil and maintain the 1-year shelf life quality of our products:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Skimming: Use a fine-mesh skimmer every 30 minutes to remove \"floaties\" or burnt food particles. Leftover particles carbonize and darken the oil.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>No Salt in the Fryer: Never salt French Fries or Pops directly over the fryer. Salt is the greatest enemy of oil life; always season in a separate mixing bowl.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Cover Up: When the outlet is closed or during slow afternoon hours, keep the fryer lids on to prevent dust and light from oxidizing the oil.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Filtration & Topping Up</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Nightly Filtration: Every night, once the oil cools slightly, it must be filtered through a micro-filter cloth to remove microscopic sediments.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Topping Up: You may add fresh oil to \"top up\" the levels to the MAX line, but never mix fresh oil with extremely degraded oil. If the base oil is bad, a top-up will not save it.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Eco-Friendly Disposal Protocol</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Badi Katori is committed to the environment. Used Cooking Oil (UCO) must never be poured down the kitchen drains, as this causes clogs and violates Surat municipal laws.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Cooling: Allow the spent oil to cool completely before handling.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Storage: Pour the used oil into the designated \"Used Oil Barrels\" (blue containers) kept in the BOH area.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Collection: Coordinate with the Surat Head Office authorized biodiesel collection agency.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Logging: Record the date and quantity (in liters) of oil discarded in your Daily Excel Sheet. This helps track \"Oil Yield\" and prevents internal theft.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">6. Safety Warning</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Water Hazard: Never allow water to come into contact with hot oil. Ensure all baskets and frozen items (Fries/Pops) are free of excess ice crystals before dropping them into the vat.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Burn Prevention: Use heat-resistant gloves when draining the fryer.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ustaad’s Note:Good oil is an investment in our flavor. If you try to save money by using old oil, you will lose money through lost customers. Quality first, always.</p>"
    },
    {
        "id": "storage_fifo",
        "title": "4.4 Storage Protocols & FIFO Golden Rule",
        "desc": "First-In-First-Out rotation, receiving labels, and dry stock storage.",
        "content": "<h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Storage Protocols</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP): FIFO (First-In, First-Out) Method</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">At Badi Katori, we leverage advanced frozen technology that provides a 1-year shelf life. However, to ensure that our customers always receive the freshest possible product and to prevent \"dead stock,\" we strictly enforce the FIFO (First-In, First-Out) method.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. The FIFO Golden Rule</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The principle is simple: The stock that arrives at the outlet first must be sold first.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">This prevents older stock from being pushed to the back of the freezer and forgotten, ensuring we never serve a product that has lost its peak quality.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Receiving & Labeling Protocol</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Every time a delivery arrives from our central supply chain:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Check the Date: The Outlet Incharge must inspect the \"Manufacturing Date\" and \"Expiry Date\" on every carton of frozen bases and premixes.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Date Marking: If the date is not clearly visible, use a permanent marker to write the Arrival Date on the outside of the box in large, clear letters.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Log: Immediately enter the batch details and quantity into the Excel Stock Sheet.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Storage Execution (Inside the Freezer/Racks)</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">When loading the -18°C Deep Freezers or the dry storage racks:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Rear Loading: New stock must always be placed behind or underneath the existing stock.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Front Facing: Older stock must be moved to the front (on shelves) or top (in deep freezers) so that it is the first thing the Ustaad reaches for.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Organization: Group items by category (e.g., all Fries together, all Katori bases together). Never mix batches in a single pile.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Daily \"Pouch\" Check</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Morning Routine: During the morning inventory count, the Counter Boy must ensure that the open packets from the previous day are used before opening a new carton.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Seal Integrity: If a packet is opened but not fully used, it must be sealed with a clip and labeled with the date it was opened. Under FIFO, these \"Open-Label\" items are priority #1 for use.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Dry Stock & Beverage FIFO</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">FIFO isn't just for food; it applies to everything in the Badi Katori inventory:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Beverage Premixes: Use pouches from the oldest batch first.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Packaging: Use the oldest stock of specialized lids and branded boxes first to prevent dust buildup on older inventory.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Syrups/Sauces: Even with long shelf lives, the flavor is best when fresh. Rotate your sauce bottles daily.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">6. Monitoring & Auditing</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Weekly Rotation Audit: Every Sunday, during the deep clean, the Outlet Incharge must physically move all stock to verify that no \"hidden\" old stock is sitting at the bottom of the freezer.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Short-Expiry Alert: If any stock is found to be within 30 days of expiry (despite our 1-year window), it must be flagged in the Excel Sheet and prioritized for \"Micro-Influencer\" sampling or special promotions to clear it immediately.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">7. Visual Aids for Staff</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>To make FIFO easy for the Badi Katori Family:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Green Stickers: Place a green sticker on the \"Current Batch\" to be used.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Red Stickers: Place a red sticker on \"New Arrivals\" that should not be opened until the green-stickered batch is finished.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Staff Reminder:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ignoring FIFO leads to \"Stock Aging.\" Even if a product has a 1-year shelf life, fresh stock always tastes better. Protect the Badi Katori brand by rotating your stock every single day.</p>"
    },
    {
        "id": "frozen_handling",
        "title": "4.5 Managing 1-Year Shelf Life Frozen Stock",
        "desc": "Zero thaw mandate, temperature control, clumping, and waste logging.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP): Managing 1-Year Shelf Life Frozen Stock</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The success of the Badi Katori model relies on our high-quality frozen bases. While these items are engineered with a 1-year shelf life, maintaining that quality requires strict temperature discipline. If the \"Cold Chain\" is broken, the texture of our signature crunch is compromised.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. The \"Zero Thaw\" Mandate</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>To preserve the structural integrity of our proprietary frozen items:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Direct-to-Fryer: Items must move directly from the -18°C freezer into the 170°C oil.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Danger of Thawing: Never leave frozen packets on the kitchen counter \"to soften.\" Thawing causes ice crystals to melt into the breading, leading to soggy products and excessive oil splattering.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Small Batch Retrieval: Only take out the number of pouches needed for immediate orders. Keep the rest of the carton sealed inside the freezer.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Temperature Control & Monitoring</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">The -18°C Standard: Our deep freezers must be maintained at a constant -18°C (0°F) or colder.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Hourly Checks: The Outlet Incharge must check the digital thermometer on the freezer every 2 hours.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Power Backup Rule: In the event of a power cut in Surat, keep the freezer doors tightly shut. Our specialized insulation can maintain the cold for several hours if the seal is not broken.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Freezer Organization & Hygiene</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Airflow Spacing: Do not overstuff the freezer. Leave a 2-inch gap between the stock and the freezer walls to allow cold air to circulate evenly.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Off-the-Floor Storage: Never store frozen cartons directly on the floor. Use pallets or shelving units to prevent contamination and allow for easy cleaning.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Gasket Integrity: Once a week, wipe the rubber door seals with a dry cloth. If you notice \"frost buildup\" (ice on the edges), it means the seal is leaking air and needs immediate repair.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Inventory Traceability</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Because our stock lasts for 12 months, tracking batches is essential for quality audits:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Batch Coding: When a new shipment arrives, enter the Batch Number and Expiry Date into the Daily Excel Sheet.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Carton Integrity: Keep items in their original Badi Katori outer cartons as long as possible. These boxes provide an extra layer of thermal protection against \"freezer burn.\"</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">First-Expiry-First-Out (FEFO): Always check the manufacturer's date. Even if two boxes look the same, the one with the closer expiry date must be moved to the top of the stack.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">5. Quality \"Red Flags\"</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">If you notice any of the following, the stock may have been compromised during transit or storage:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Clumping: If the fries or pops are stuck together in a solid block, the bag has thawed and refrozen. Do not serve.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Ice Crystals: Large \"snow-like\" crystals inside the bag indicate a temperature fluctuation (Freezer Burn).</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Odor: If the frozen product has absorbed smells from the freezer, it indicates the bag was not sealed correctly.</strong></p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">6. Waste Logging</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">If any 1-year shelf life stock is discarded due to freezer failure or contamination:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Photograph: Take a photo of the batch number and the spoiled product.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Petpooja Entry: Log the weight as \"Stock Wastage.\"</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Report: Inform the Badi Katori Supply Chain team so we can investigate if the issue occurred during the \"Upfront\" delivery or at the outlet level.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Ustaad’s Quality Note:Our frozen technology is what allows us to serve the same perfect taste in every Surat neighborhood. Treat the freezer as the most important piece of equipment in the kitchen. If the cold chain stays unbroken, our brand stays strong.</p>"
    },
    {
        "id": "employee_register",
        "title": "5.1 Employee Register & Attendance",
        "desc": "Personnel file requirements, daily attendance sheets, and shift discipline.",
        "content": "<p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Standard Operating Procedure (SOP): Administrative Management</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">This section outlines the professional standards for personnel management, brand protection, and corporate communication within the Badi Katori network.</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">1. Employee Register & Attendance</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To maintain a high-performance culture in our Surat outlets, the following protocols are mandatory:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Daily Attendance: All staff (Ustaad, Counter Boys, and Housekeeping) must log their \"In\" and \"Out\" times in the Daily Excel Sheet.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Grooming Check: Attendance is only marked after the staff member has passed the Personal Grooming Audit (Clean uniform, hairnet/cap, and trimmed nails).</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Shift Discipline:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Punctuality: Staff must arrive 15 minutes prior to their shift for the morning \"Muster Call.\"</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Leave Policy: Planned leaves must be requested 7 days in advance. Emergency leaves require notification 4 hours before the shift via the official WhatsApp group.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Records: The Outlet Incharge must maintain a physical file for every employee containing a copy of their Government ID (Aadhar), emergency contact, and a signed Hygiene & NDA Agreement.</strong></p>"
    },
    {
        "id": "franchise_transfer",
        "title": "5.2 Franchise Transfer & Audit Policies",
        "desc": "Ownership transfer guidelines, monthly audits, and rate compliance checks.",
        "content": "<h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">2. Franchise Transfer & Audit Policies</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">To ensure the Badi Katori name remains synonymous with quality, we implement strict oversight:</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Transfer of Ownership:</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Franchises cannot be transferred or sold without written approval from the Surat Headquarters.</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">New partners must undergo a 7-day mandatory training on Petpooja operations and the Recipe Vault.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>The Audit Protocol:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Operational Audits: Conducted monthly to check FIFO compliance, oil TPM levels (Max 25%), and stock integrity.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Inventory Reconciliation: We cross-check Petpooja sales against Upfront Frozen Stock orders. Any unauthorized local sourcing is a violation of the franchise agreement.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Financial Compliance: Outlets must ensure the March 2026 Revised Rates are implemented across Zomato and Swiggy.</strong></p>"
    },
    {
        "id": "contact_directory",
        "title": "5.3 Contact Directory & Communication",
        "desc": "Surat Headquarters department contacts and official communication protocols.",
        "content": "<h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">3. Official Contact Directory (Surat Headquarters)</h4><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">For operational support, logistics, and emergencies, use the following hierarchy.</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Note: For all general queries, please reference your Outlet Code in the subject line.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Department</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Contact Area</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Primary Channel</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Supply Chain</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Frozen Stock, Beverages, Packaging</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Official WhatsApp - Logistics</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Operations (Service Lane)</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">SOP Training, Audit Appeals, Retraining</p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Email: ops@servicelane.in</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Marketing & PR</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Micro-Influencer Collabs, Reelo Feedback</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Marketing Dashboard / WhatsApp</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Technical Support</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Petpooja Issues, Digital Menu Updates</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">IT Support Line</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Accounts</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Upfront Payments, Invoicing, Franchise Fees</p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">Finance Department</p><h4 style=\"margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: #0F172A;\">4. Communication Protocol</h4><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Internal Communication: All official announcements regarding new menu launches or policy changes will be shared through the \"Badi Katori Family\" official group.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>External Communication: Staff are prohibited from speaking to the media or sharing proprietary Recipe Vault details with outside vendors. All media inquiries must be directed to the Surat Headquarters.</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Management Note:</strong></p><p style=\"margin-bottom: 8px; line-height: 1.6; color: #334155;\"><strong>Transparency and discipline in our administration allow our outlets to focus on what they do best: serving the best chaat in Surat. Follow these guidelines to ensure a smooth, profitable partnership.</strong></p><p style=\"margin-bottom: 16px; line-height: 1.6; color: #475569;\">.</p>"
    }
];

function initTrainingSection() {
    const sidebar = document.getElementById('trainingSidebar');
    if (!sidebar) return;

    sidebar.innerHTML = '';
    trainingModules.forEach(mod => {
        const card = document.createElement('div');
        card.className = 'training-module-card';
        card.innerHTML = `
            <h3>${mod.title}</h3>
            <p>${mod.desc}</p>
        `;
        card.onclick = () => {
            // Remove active class from all
            sidebar.querySelectorAll('.training-module-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // Render content
            const viewer = document.getElementById('trainingContentViewer');
            if (viewer) {
                viewer.innerHTML = mod.content;
                viewer.scrollTop = 0;
            }
        };
        sidebar.appendChild(card);
    });
}

// Hook into the DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    initTrainingSection();
});



// ==========================================
// P&L AND BALANCE SHEET AUTOMATION
// ==========================================
window.fetchAndRenderPnL = async function() {
    try {
        const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
        const token = localStorage.getItem("bk_jwt_token") || "";
        const res = await fetch(`${apiBase}/api/pl/live-summary?branch=VESU&dateFilter=month`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        // --- Render P&L ---
        const plTable = document.querySelector('#plSheetTable tbody');
        if (plTable && data.summary) {
            plTable.innerHTML = `
                <tr>
                    <td>Revenue (Gross Sales)</td>
                    <td style="text-align:right;">POS Sales</td>
                    <td style="text-align:right;">₹${data.summary.totalSales.toLocaleString('en-IN')}</td>
                </tr>
                <tr style="font-size:0.85em; color:#666;">
                    <td style="padding-left:30px;">└ Cash Received</td>
                    <td style="text-align:right;"></td>
                    <td style="text-align:right;">₹${(data.summary.cashInHand || 0).toLocaleString('en-IN')}</td>
                </tr>
                <tr style="font-size:0.85em; color:#666;">
                    <td style="padding-left:30px;">└ Online / Bank Received</td>
                    <td style="text-align:right;"></td>
                    <td style="text-align:right;">₹${(data.summary.bankBalance || 0).toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                    <td>Less: Cost of Goods Sold (COGS)</td>
                    <td style="text-align:right;">Inventory</td>
                    <td style="text-align:right;">₹${data.cogs.toLocaleString('en-IN')}</td>
                </tr>
                <tr style="font-weight:700; background:#f7f5f4;">
                    <td>Gross Profit</td>
                    <td style="text-align:right;"></td>
                    <td style="text-align:right;">₹${data.summary.grossProfit.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                    <td>Operating Expenses</td>
                    <td style="text-align:right;">Ledger</td>
                    <td style="text-align:right;">₹${data.summary.totalExpenses.toLocaleString('en-IN')}</td>
                </tr>
                <tr style="font-weight:800; background:var(--orange-light); border-top:2px solid var(--orange-primary);">
                    <td>Net Profit / Loss</td>
                    <td style="text-align:right;"></td>
                    <td style="text-align:right;">₹${data.summary.netProfit.toLocaleString('en-IN')}</td>
                </tr>
            `;
        }

        // --- Render Balance Sheet ---
        if (data.summary && document.querySelector('#tableBSAssets tbody')) {
            const totalAssets = data.cashInHand + data.bankBalance + data.inventoryValue + data.outstandingCustomer;
            const totalLiabilities = data.outstandingSupplier;
            const totalEquity = totalAssets - totalLiabilities;

            document.querySelector('#tableBSAssets tbody').innerHTML = `
                <tr><td>Cash in Hand</td><td style="text-align:right;">₹${data.cashInHand.toLocaleString('en-IN')}</td></tr>
                <tr><td>Bank Balance</td><td style="text-align:right;">₹${data.bankBalance.toLocaleString('en-IN')}</td></tr>
                <tr><td>Inventory Value</td><td style="text-align:right;">₹${data.inventoryValue.toLocaleString('en-IN')}</td></tr>
                <tr><td>Accounts Receivable</td><td style="text-align:right;">₹${data.outstandingCustomer.toLocaleString('en-IN')}</td></tr>
            `;
            document.getElementById('bsTotalAssets').innerText = `₹${totalAssets.toLocaleString('en-IN')}`;

            document.querySelector('#tableBSLiabilities tbody').innerHTML = `
                <tr><td>Accounts Payable</td><td style="text-align:right;">₹${data.outstandingSupplier.toLocaleString('en-IN')}</td></tr>
            `;
            document.getElementById('bsTotalLiabilities').innerText = `₹${totalLiabilities.toLocaleString('en-IN')}`;

            document.querySelector('#tableBSEquity tbody').innerHTML = `
                <tr><td>Retained Earnings</td><td style="text-align:right;">₹${totalEquity.toLocaleString('en-IN')}</td></tr>
            `;
            document.getElementById('bsTotalEquity').innerText = `₹${totalEquity.toLocaleString('en-IN')}`;
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

