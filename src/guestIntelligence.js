// guestIntelligence.js - BK Operations India Guest Intelligence Hub

function _initThisModule() {
    // 1. Core Config
    // Absolute base URL if opened via file:// protocol or other ports
    let API_BASE = '';
    if (window.location.protocol.startsWith('file')) {
        API_BASE = 'http://localhost:3000';
    } else if (window.location.port && window.location.port !== '3000') {
        API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    // 2. State & Variables
    let state = null;
    let activeTab = "dashboard"; // "dashboard", "profiles", "preferences", "ai-recs", "reports"
    let activeCharts = [];
    let selectedCustomerId = null;

    // Helper formatting
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
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

    // 3. Load State
    async function loadData() {
        try {
            const res = await fetch(`${API_BASE}/api/state`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem("bk_jwt_token") || ''}` }
            });
            if (res.ok) {
                state = await res.json();
                renderActiveTab();
                bindPOSBillingHook();
            }
        } catch (e) {
            console.error("Error loading Guest Intelligence data:", e);
        }
    }

    function clearOldCharts() {
        activeCharts.forEach(c => c.destroy());
        activeCharts = [];
    }

    // 4. Tab Navigation Click Handler
    const tabs = {
        dashboard: document.getElementById("btnGuestDashboardTab"),
        profiles: document.getElementById("btnGuestProfilesTab"),
        preferences: document.getElementById("btnGuestPreferencesTab"),
        ai: document.getElementById("btnGuestAIRecommendationsTab"),
        reports: document.getElementById("btnGuestReportsTab")
    };

    Object.entries(tabs).forEach(([tabName, btn]) => {
        if (btn) {
            btn.addEventListener("click", () => {
                Object.values(tabs).forEach(b => { if(b) b.classList.remove("active"); });
                btn.classList.add("active");
                activeTab = tabName;
                renderActiveTab();
            });
        }
    });

    const overlayClose = document.getElementById("btnCloseGuestProfileOverlay");
    if (overlayClose) {
        overlayClose.addEventListener("click", () => {
            document.getElementById("singleGuestProfileOverlay").style.display = "none";
            selectedCustomerId = null;
        });
    }

    // 5. Router
    function renderActiveTab() {
        clearOldCharts();
        const container = document.getElementById("guestIntelligenceTabViewport");
        if (!container || !state) return;
        container.innerHTML = "";

        const customers = state.posCustomers || [];
        const orders = state.posOrders || [];
        const orderItems = state.posOrderItems || [];

        // Auto-compute helper metrics for every customer profile
        const enrichedCustomers = enrichCustomerProfiles(customers, orders, orderItems);

        switch (activeTab) {
            case "dashboard":
                renderDashboardView(container, enrichedCustomers, orders);
                break;
            case "profiles":
                renderProfilesView(container, enrichedCustomers);
                break;
            case "preferences":
                renderPreferencesView(container, enrichedCustomers);
                break;
            case "ai":
                renderAIRecommendationsView(container, enrichedCustomers);
                break;
            case "reports":
                renderReportsView(container, enrichedCustomers);
                break;
        }

        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    // ========================================================
    // AUTO-LEARNING BEHAVIOR COMPUTATION (ENRICH GUEST PROFILES)
    // ========================================================
    function enrichCustomerProfiles(customers, orders, orderItems) {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        return customers.map(c => {
            const customerOrders = orders.filter(o => o.customerId === c.id || o.customerName === c.name);
            const orderIds = new Set(customerOrders.map(o => o.id));
            const customerItems = orderItems.filter(item => orderIds.has(item.orderId));

            // Visit analytics
            const visitCount = customerOrders.length;
            const lifetimeSpend = customerOrders.reduce((sum, o) => sum + parseFloat(o.grandTotal || 0), 0);
            const avgBill = visitCount > 0 ? (lifetimeSpend / visitCount) : 0;
            
            // Last visit date
            let lastVisit = "N/A";
            if (customerOrders.length > 0) {
                const dates = customerOrders.map(o => new Date(o.date)).sort((a,b) => b-a);
                lastVisit = dates[0].toISOString().split('T')[0];
            }

            // Is Active (visited in last 30 days)
            const isActive = customerOrders.some(o => new Date(o.date) >= thirtyDaysAgo);

            // 1. Auto-learn favorite drink, food, dessert
            const categoryFrequencies = {};
            const itemFrequencies = {};
            const payMethods = {};
            const customizedIngredients = { add: {}, remove: {} };

            customerItems.forEach(item => {
                const prod = state.posProducts.find(p => p.id === item.productId || p.name === item.productName);
                const category = prod ? prod.category : "General";
                
                categoryFrequencies[category] = (categoryFrequencies[category] || 0) + item.quantity;
                itemFrequencies[item.productName] = (itemFrequencies[item.productName] || 0) + item.quantity;

                // Customizable parsing
                if (item.modifiers) {
                    let mods = [];
                    try {
                        mods = typeof item.modifiers === 'string' ? JSON.parse(item.modifiers) : item.modifiers;
                    } catch (e) {
                        mods = [];
                    }
                    mods.forEach(mod => {
                        customizedIngredients.add[mod] = (customizedIngredients.add[mod] || 0) + 1;
                    });
                }
            });

            customerOrders.forEach(o => {
                const pm = o.paymentMethod || "UPI";
                payMethods[pm] = (payMethods[pm] || 0) + 1;
            });

            // Extract favorites
            let favFood = "N/A";
            let favDrink = "N/A";
            let favDessert = "N/A";
            let favCategory = "N/A";
            let preferredPay = "UPI";

            // Find most frequent payment method
            let maxPMCount = 0;
            Object.entries(payMethods).forEach(([pm, count]) => {
                if (count > maxPMCount) {
                    maxPMCount = count;
                    preferredPay = pm;
                }
            });

            // Split items into food, drink, dessert categories
            const foods = {}, drinks = {}, desserts = {};
            Object.entries(itemFrequencies).forEach(([name, count]) => {
                const prod = state.posProducts.find(p => p.name === name);
                const cat = prod ? (prod.category || '').toLowerCase() : '';
                if (cat.includes('drink') || cat.includes('coffee') || cat.includes('beverage') || cat.includes('shake') || cat.includes('tea')) {
                    drinks[name] = count;
                } else if (cat.includes('dessert') || cat.includes('cake') || cat.includes('brownie') || cat.includes('sweet')) {
                    desserts[name] = count;
                } else {
                    foods[name] = count;
                }
            });

            // Helper to get max freq
            const getMaxKey = (obj) => {
                let maxVal = 0, maxKey = "N/A";
                Object.entries(obj).forEach(([key, val]) => {
                    if (val > maxVal) { maxVal = val; maxKey = key; }
                });
                return maxKey;
            };

            favFood = getMaxKey(foods);
            favDrink = getMaxKey(drinks);
            favDessert = getMaxKey(desserts);
            favCategory = getMaxKey(categoryFrequencies);

            // Parse existing saved preferences columns
            let savedPrefs = {};
            try { savedPrefs = c.preferences ? JSON.parse(c.preferences) : {}; } catch(e) {}
            let savedReqs = {};
            try { savedReqs = c.specialRequirements ? JSON.parse(c.specialRequirements) : {}; } catch(e) {}

            // Auto-learned customizations
            const usualCustomizations = [];
            Object.entries(customizedIngredients.add).forEach(([ing, count]) => {
                if (count >= 3) usualCustomizations.push(`Extra ${ing}`);
            });

            return {
                ...c,
                visitCount,
                lifetimeSpend,
                avgBill,
                lastVisit,
                isActive,
                email: c.email || "N/A",
                dob: c.dob || "N/A",
                anniversary: c.anniversary || "N/A",
                customerSince: c.customerSince || "2026-01-01",
                preferences: {
                    favFood: favFood !== "N/A" ? favFood : (savedPrefs.favFood || "Burger"),
                    favDrink: favDrink !== "N/A" ? favDrink : (savedPrefs.favDrink || "Cold Coffee"),
                    favDessert: favDessert !== "N/A" ? favDessert : (savedPrefs.favDessert || "Brownie"),
                    favCategory: favCategory !== "N/A" ? favCategory : (savedPrefs.favCategory || "Burgers"),
                    favCombo: savedPrefs.favCombo || "Burger + Drink Combo",
                    favTable: savedPrefs.favTable || "Table 5",
                    seating: savedPrefs.seating || "Window Corner",
                    paymentMethod: preferredPay,
                    spice: savedPrefs.spice || "Medium Spice",
                    sweetness: savedPrefs.sweetness || "Normal Sweet",
                    ice: savedPrefs.ice || "Normal Ice",
                    temp: savedPrefs.temp || "Cold",
                    waiter: savedPrefs.waiter || "Sam Lee",
                    diningTime: savedPrefs.diningTime || "Evening"
                },
                specialRequirements: {
                    vegetarian: savedReqs.vegetarian || false,
                    jain: savedReqs.jain || false,
                    vegan: savedReqs.vegan || false,
                    eggless: savedReqs.eggless || false,
                    noOnion: savedReqs.noOnion || false,
                    noGarlic: savedReqs.noGarlic || false,
                    noSugar: savedReqs.noSugar || false,
                    lessOil: savedReqs.lessOil || false,
                    extraCheese: savedReqs.extraCheese || (usualCustomizations.includes("Extra Cheese")),
                    extraSauce: savedReqs.extraSauce || false,
                    extraButter: savedReqs.extraButter || false,
                    glutenFree: savedReqs.glutenFree || false,
                    nutAllergy: savedReqs.nutAllergy || false,
                    milkAllergy: savedReqs.milkAllergy || false,
                    seafoodAllergy: savedReqs.seafoodAllergy || false
                },
                notes: c.notes || "",
                usualCustomizations,
                orders: customerOrders
            };
        }).filter(c => c.id !== 'cust-1' && c.id !== 'cust-delivery'); // exclude defaults
    }

    // ==========================================
    // VIEW: GUEST DASHBOARD
    // ==========================================
    function renderDashboardView(container, guests, orders) {
        // Dashboard KPI calculations
        const totalGuests = guests.length;
        const activeGuests = guests.filter(g => g.isActive).length;
        const returningGuests = guests.filter(g => g.visitCount >= 2).length;
        
        const thisMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
        const newGuestsThisMonth = guests.filter(g => g.customerSince && g.customerSince.startsWith(thisMonthStr)).length;

        const totalVisits = guests.reduce((sum, g) => sum + g.visitCount, 0);
        const avgVisits = totalGuests > 0 ? (totalVisits / totalGuests) : 0;

        const totalLifetimeSpend = guests.reduce((sum, g) => sum + g.lifetimeSpend, 0);
        const avgBillVal = totalVisits > 0 ? (totalLifetimeSpend / totalVisits) : 0;

        const retentionPct = totalGuests > 0 ? (returningGuests / totalGuests) * 100 : 0;
        const vipGuests = guests.filter(g => g.visitCount >= 10 || g.lifetimeSpend >= 5000).length;

        // Birthday/Anniversary this week
        const bdaysThisWeek = guests.filter(g => {
            if (!g.dob || g.dob === "N/A") return false;
            const birthMonth = parseInt(g.dob.split('-')[1], 10);
            const currMonth = new Date().getMonth() + 1;
            return birthMonth === currMonth; // simplified check
        }).length;

        const annivThisWeek = guests.filter(g => {
            if (!g.anniversary || g.anniversary === "N/A") return false;
            const annivMonth = parseInt(g.anniversary.split('-')[1], 10);
            const currMonth = new Date().getMonth() + 1;
            return annivMonth === currMonth;
        }).length;

        container.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:12px; margin-bottom:24px;">
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Registered Guests</span>
                    <span class="reports-kpi-value">${totalGuests}</span>
                    <span class="reports-kpi-sub">Total database size</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Active Guests</span>
                    <span class="reports-kpi-value" style="color: #10b981;">${activeGuests}</span>
                    <span class="reports-kpi-sub">Visited past 30 days</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Retention Rate</span>
                    <span class="reports-kpi-value">${retentionPct.toFixed(1)}%</span>
                    <span class="reports-kpi-sub">Returning vs New guests</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">VIP Guests</span>
                    <span class="reports-kpi-value" style="color: #c29f68;">${vipGuests}</span>
                    <span class="reports-kpi-sub">&gt;= 10 visits or ₹5k spend</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Average Bill</span>
                    <span class="reports-kpi-value">${formatCurrency(avgBillVal)}</span>
                    <span class="reports-kpi-sub">Lifetime guest spend</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Visits / Guest</span>
                    <span class="reports-kpi-value">${avgVisits.toFixed(1)}</span>
                    <span class="reports-kpi-sub">Avg visit frequency</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">New This Month</span>
                    <span class="reports-kpi-value">+${newGuestsThisMonth}</span>
                    <span class="reports-kpi-sub">Registered this month</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Birthdays (Month)</span>
                    <span class="reports-kpi-value" style="color:#f59e0b;">${bdaysThisWeek}</span>
                    <span class="reports-kpi-sub">Occasions to celebrate</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Anniversaries</span>
                    <span class="reports-kpi-value" style="color:#ef4444;">${annivThisWeek}</span>
                    <span class="reports-kpi-sub">Anniversary this month</span>
                </div>
                <div class="reports-kpi-card">
                    <span class="reports-kpi-label">Total Visits</span>
                    <span class="reports-kpi-value">${totalVisits}</span>
                    <span class="reports-kpi-sub">All-time dining visits</span>
                </div>
            </div>

            <!-- Dashboard Charts -->
            <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:20px;">
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                    <div style="font-weight:700; margin-bottom:12px; color:var(--text-secondary);">Visits Growth & Frequency Trend</div>
                    <canvas id="chartGuestGrowth" style="width:100%; height:260px;"></canvas>
                </div>
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                    <div style="font-weight:700; margin-bottom:12px; color:var(--text-secondary);">Preferred Dining Categories</div>
                    <canvas id="chartPreferredCategories" style="width:100%; height:260px;"></canvas>
                </div>
            </div>
        `;

        setTimeout(() => {
            const ctx1 = document.getElementById("chartGuestGrowth");
            const ctx2 = document.getElementById("chartPreferredCategories");
            if (!ctx1 || !ctx2) return;

            const c1 = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                    datasets: [
                        { label: 'Registered Guests', data: [totalGuests * 0.4, totalGuests * 0.5, totalGuests * 0.6, totalGuests * 0.7, totalGuests * 0.8, totalGuests * 0.9, totalGuests], borderColor: '#c29f68', tension: 0.3 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            // Group favorite categories
            const cats = {};
            guests.forEach(g => {
                const fc = g.preferences.favCategory || 'General';
                cats[fc] = (cats[fc] || 0) + 1;
            });

            const c2 = new Chart(ctx2, {
                type: 'pie',
                data: {
                    labels: Object.keys(cats).slice(0, 5),
                    datasets: [{ data: Object.values(cats).slice(0, 5), backgroundColor: ['#c29f68', '#10b981', '#ef4444', '#f59e0b', '#3b82f6'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            activeCharts.push(c1, c2);
        }, 100);
    }

    // ==========================================
    // VIEW: GUEST PROFILES LIST & SEARCH
    // ==========================================
    function renderProfilesView(container, guests) {
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:16px; margin-bottom:20px; align-items:center;">
                <div style="display:flex; gap:12px; align-items:center; flex:1; max-width:800px;">
                    <input type="text" id="guestSearchInput" class="reports-filter-input" placeholder="🔍 Search guest by name, phone, email, favourite food/drink..." style="width:100%;">
                    <select id="guestLoyaltyFilter" class="reports-filter-select" style="width:180px;">
                        <option value="All">All Loyalty Tiers</option>
                        <option value="VIP">VIP Tier</option>
                        <option value="Active">Active Guests</option>
                        <option value="Inactive">Inactive Guests</option>
                    </select>
                </div>
                <div style="font-size:0.78rem; color:var(--text-secondary); font-weight:700;">
                    Found <span id="guestMatchCount">${guests.length}</span> guests
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:16px;" id="guestCardsGrid">
                <!-- Cards loaded dynamically -->
            </div>
        `;

        const search = document.getElementById("guestSearchInput");
        const loyalty = document.getElementById("guestLoyaltyFilter");

        function drawCards() {
            const query = search.value.toLowerCase();
            const filter = loyalty.value;
            const grid = document.getElementById("guestCardsGrid");
            if (!grid) return;

            const filtered = guests.filter(g => {
                const matchesSearch = g.name.toLowerCase().includes(query) ||
                    (g.phone && g.phone.includes(query)) ||
                    (g.email && g.email.toLowerCase().includes(query)) ||
                    (g.preferences.favFood && g.preferences.favFood.toLowerCase().includes(query)) ||
                    (g.preferences.favDrink && g.preferences.favDrink.toLowerCase().includes(query));
                
                let matchesFilter = true;
                if (filter === "VIP") {
                    matchesFilter = g.visitCount >= 10 || g.lifetimeSpend >= 5000;
                } else if (filter === "Active") {
                    matchesFilter = g.isActive;
                } else if (filter === "Inactive") {
                    matchesFilter = !g.isActive;
                }

                return matchesSearch && matchesFilter;
            });

            document.getElementById("guestMatchCount").textContent = filtered.length;

            grid.innerHTML = filtered.map(g => {
                const isVIP = g.visitCount >= 10 || g.lifetimeSpend >= 5000;
                return `
                    <div class="reports-kpi-card guest-profile-card" data-id="${g.id}" style="cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; height:100%; min-height:220px;">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <div style="background:#c29f68; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; color:#151312; font-weight:800; font-size:1.05rem;">
                                    ${g.name.slice(0,1).toUpperCase()}
                                </div>
                                <span class="pill-badge pill-badge-${isVIP ? 'success' : 'secondary'}">${isVIP ? 'VIP Tier' : 'Classic'}</span>
                            </div>
                            <strong style="font-size:0.95rem; color:#fff; display:block; margin-bottom:4px;">${escapeHTML(g.name)}</strong>
                            <span style="font-size:0.75rem; color:var(--text-secondary); display:block; margin-bottom:8px;">${g.phone}</span>
                            
                            <div style="display:flex; flex-direction:column; gap:4px; margin-top:8px;">
                                <span style="font-size:0.7rem; color:var(--text-tertiary);">Favourite Drink: <strong style="color:#fff;">${escapeHTML(g.preferences.favDrink)}</strong></span>
                                <span style="font-size:0.7rem; color:var(--text-tertiary);">Favourite Food: <strong style="color:#fff;">${escapeHTML(g.preferences.favFood)}</strong></span>
                            </div>
                        </div>
                        <div style="border-top:1px dashed var(--border); padding-top:10px; margin-top:12px; display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-secondary);">
                            <span>Visits: <strong>${g.visitCount}</strong></span>
                            <span>Spending: <strong>${formatCurrency(g.lifetimeSpend)}</strong></span>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click events to open overlay details
            grid.querySelectorAll(".guest-profile-card").forEach(card => {
                card.addEventListener("click", () => {
                    openGuestProfileOverlay(card.getAttribute("data-id"));
                });
            });
        }

        search.addEventListener("input", drawCards);
        loyalty.addEventListener("change", drawCards);
        drawCards();
    }

    // ==========================================
    // VIEW: PREFERENCES & ALLERGIES
    // ==========================================
    function renderPreferencesView(container, guests) {
        // List common allergy segments
        const allergies = {
            nutAllergy: guests.filter(g => g.specialRequirements.nutAllergy).length,
            milkAllergy: guests.filter(g => g.specialRequirements.milkAllergy).length,
            seafoodAllergy: guests.filter(g => g.specialRequirements.seafoodAllergy).length,
            glutenFree: guests.filter(g => g.specialRequirements.glutenFree).length,
            vegetarian: guests.filter(g => g.specialRequirements.vegetarian).length,
            jain: guests.filter(g => g.specialRequirements.jain).length
        };

        container.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:24px;">
                <div class="reports-kpi-card" style="border-left: 4px solid #f59e0b;">
                    <span class="reports-kpi-label" style="color:#f59e0b;"><i data-lucide="alert-triangle"></i> Nut Allergy Segment</span>
                    <span class="reports-kpi-value">${allergies.nutAllergy}</span>
                    <span class="reports-kpi-sub">Guests require allergen-free recipes</span>
                </div>
                <div class="reports-kpi-card" style="border-left: 4px solid #3b82f6;">
                    <span class="reports-kpi-label" style="color:#3b82f6;"><i data-lucide="droplet"></i> Lactose/Milk Allergy</span>
                    <span class="reports-kpi-value">${allergies.milkAllergy}</span>
                    <span class="reports-kpi-sub">Dairy-free preference</span>
                </div>
                <div class="reports-kpi-card" style="border-left: 4px solid #10b981;">
                    <span class="reports-kpi-label" style="color:#10b981;"><i data-lucide="leaf"></i> Vegetarian & Jain Guests</span>
                    <span class="reports-kpi-value">${allergies.vegetarian + allergies.jain}</span>
                    <span class="reports-kpi-sub">Pure Veg kitchen priority</span>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                    <div style="font-weight:700; color:#fff;">Dietary Preference Registry</div>
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <span style="font-size:0.75rem; color:var(--text-secondary);">Add preference for:</span>
                        <select id="btnAddPreferenceGuestSelect" class="reports-filter-select" style="width:200px; padding: 4px 8px; font-size: 0.75rem; background: #151312; border: 1px solid var(--border); color:#fff; border-radius:4px;">
                            <option value="">-- Select Guest --</option>
                            ${guests.map(g => `<option value="${g.id}">${escapeHTML(g.name)} (${g.phone})</option>`).join('')}
                        </select>
                        <button class="saas-btn saas-btn-primary" id="btnGoAddPreference" style="padding: 4px 12px; font-size: 0.75rem; font-weight:800; display:flex; align-items:center; gap:4px;">
                            <i data-lucide="plus-circle" style="width:12px; height:12px;"></i> Add Preference
                        </button>
                    </div>
                </div>
                <table class="saas-table">
                    <thead>
                        <tr>
                            <th>Guest Name</th>
                            <th>Phone</th>
                            <th>Allergies & Restrictions</th>
                            <th>Custom Prep Instructions</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${guests.filter(g => Object.values(g.specialRequirements).some(v => v === true)).map(g => {
                            const activeBadges = [];
                            if (g.specialRequirements.vegetarian) activeBadges.push(`<span class="pill-badge pill-badge-success">Veg</span>`);
                            if (g.specialRequirements.jain) activeBadges.push(`<span class="pill-badge pill-badge-warning">Jain</span>`);
                            if (g.specialRequirements.vegan) activeBadges.push(`<span class="pill-badge pill-badge-info">Vegan</span>`);
                            if (g.specialRequirements.nutAllergy) activeBadges.push(`<span class="pill-badge pill-badge-danger">Nut Allergy</span>`);
                            if (g.specialRequirements.glutenFree) activeBadges.push(`<span class="pill-badge pill-badge-danger">Gluten Free</span>`);

                            return `
                                <tr>
                                    <td style="font-weight:700; color:#fff;">${escapeHTML(g.name)}</td>
                                    <td>${g.phone}</td>
                                    <td><div style="display:flex; gap:6px;">${activeBadges.join('')}</div></td>
                                    <td style="color:#c29f68; font-weight:600;">${escapeHTML(g.notes || 'None')}</td>
                                    <td>
                                        <button class="saas-btn saas-btn-secondary" onclick="window.openGuestProfileOverlay('${g.id}')" style="padding: 4px 8px; font-size: 0.72rem; font-weight:800; display:inline-flex; align-items:center; gap:4px;">
                                            <i data-lucide="edit-3" style="width:12px; height:12px;"></i> Edit
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const select = document.getElementById("btnAddPreferenceGuestSelect");
        const btn = document.getElementById("btnGoAddPreference");
        if (select && btn) {
            btn.onclick = () => {
                const guestId = select.value;
                if (!guestId) {
                    alert("Please select a guest first!");
                    return;
                }
                window.openGuestProfileOverlay(guestId);
            };
        }
        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    // ==========================================
    // VIEW: AI RECOMMENDATIONS
    // ==========================================
    function renderAIRecommendationsView(container, guests) {
        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="display:flex; align-items:center; gap:8px; font-weight:800; color:#c29f68; margin-bottom:16px; font-size:1.1rem;">
                    <i data-lucide="sparkles"></i> AI-Generated Guest Dining Suggestions
                </div>
                <div style="display:flex; flex-direction:column; gap:16px;">
                    ${guests.slice(0, 5).map(g => {
                        // Custom recommendations per guest based on preferences
                        const recFood = g.preferences.favFood || "Burger";
                        const recDrink = g.preferences.favDrink || "Cold Coffee";
                        const projectedSpend = Math.max(500, g.avgBill * 1.15);

                        return `
                            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:8px; padding:16px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                    <strong style="color:#fff;">${escapeHTML(g.name)} (${g.phone})</strong>
                                    <span class="pill-badge pill-badge-info">AI Profile Active</span>
                                </div>
                                <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.5;">
                                    💡 <strong>Recommending</strong>: Offer <em>${escapeHTML(recFood)}</em> and upsell a large <em>${escapeHTML(recDrink)}</em> because they usually order this combination. <br>
                                    🎯 <strong>Opportunity</strong>: Customer is likely to spend around <strong>${formatCurrency(projectedSpend)}</strong>. Suggest adding Chocolate Brownie since dessert is preferred.
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // ==========================================
    // VIEW: REPORTS
    // ==========================================
    function renderReportsView(container, guests) {
        const sortedGuests = [...guests].sort((a,b) => b.lifetimeSpend - a.lifetimeSpend);

        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <div style="font-weight:700; color:#fff;">Most Valuable Guests Report (Sorted by Spending)</div>
                    <button class="saas-btn saas-btn-secondary" id="btnExportGuestsCSV" style="padding:6px 12px; font-weight:700;"><i data-lucide="file-spreadsheet"></i> Export CSV</button>
                </div>
                
                <table class="saas-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Guest Name</th>
                            <th>Phone</th>
                            <th style="text-align:right;">Visits Count</th>
                            <th style="text-align:right;">Avg Order Value</th>
                            <th style="text-align:right;">Lifetime Spending</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedGuests.map((g, idx) => `
                            <tr>
                                <td><span class="pill-badge pill-badge-secondary">#${idx + 1}</span></td>
                                <td style="font-weight:700; color:#fff;">${escapeHTML(g.name)}</td>
                                <td>${g.phone}</td>
                                <td style="text-align:right;">${g.visitCount} visits</td>
                                <td style="text-align:right;">₹${g.avgBill.toFixed(0)}</td>
                                <td style="text-align:right; font-weight:800; color:#10b981;">₹${g.lifetimeSpend.toFixed(0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById("btnExportGuestsCSV").addEventListener("click", () => {
            let csv = "Rank,Guest Name,Phone,Visits,Avg Order Value,Lifetime Spending\n";
            sortedGuests.forEach((g, idx) => {
                csv += `${idx + 1},${g.name},${g.phone},${g.visitCount},${g.avgBill},${g.lifetimeSpend}\n`;
            });
            const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "valuable_guests_report.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // ========================================================
    // GUEST PROFILE OVERLAY WITH TIMELINE & EDIT FORM
    // ========================================================
    window.openGuestProfileOverlay = openGuestProfileOverlay;
    function openGuestProfileOverlay(id) {
        const overlay = document.getElementById("singleGuestProfileOverlay");
        const viewport = document.getElementById("singleGuestProfileDetailContent");
        if (!overlay || !viewport) return;

        // Re-enrich to capture latest updates
        const customers = state.posCustomers || [];
        const orders = state.posOrders || [];
        const orderItems = state.posOrderItems || [];
        const enriched = enrichCustomerProfiles(customers, orders, orderItems);
        const guest = enriched.find(g => g.id === id);
        if (!guest) return;

        selectedCustomerId = id;

        viewport.innerHTML = `
            <div style="display:grid; grid-template-columns: 1.5fr 2.5fr; gap:24px;">
                <!-- Profile & Preferences Form -->
                <div style="display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; gap:16px; align-items:center; background:rgba(255,255,255,0.01); border:1px solid var(--border); padding:16px; border-radius:12px;">
                        <div style="background:#c29f68; border-radius:50%; width:50px; height:50px; display:flex; align-items:center; justify-content:center; color:#151312; font-weight:800; font-size:1.5rem;">
                            ${guest.name.slice(0,1).toUpperCase()}
                        </div>
                        <div>
                            <h2 style="margin:0; font-size:1.35rem; color:#fff;">${escapeHTML(guest.name)}</h2>
                            <span style="font-size:0.8rem; color:var(--text-secondary);">${guest.phone}</span>
                        </div>
                    </div>

                    <!-- Custom Form fields -->
                    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px;">
                        <div style="font-weight:700; color:#c29f68; border-bottom:1px dashed var(--border); padding-bottom:6px;">Profile details</div>
                        <div>
                            <label style="font-size:0.75rem; color:var(--text-tertiary); display:block; margin-bottom:4px;">Email Address</label>
                            <input type="text" id="editGuestEmail" value="${escapeHTML(guest.email)}" class="reports-filter-input" style="width:100%;">
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                            <div>
                                <label style="font-size:0.75rem; color:var(--text-tertiary); display:block; margin-bottom:4px;">Birthday</label>
                                <input type="text" id="editGuestDob" value="${escapeHTML(guest.dob)}" class="reports-filter-input" placeholder="YYYY-MM-DD" style="width:100%;">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; color:var(--text-tertiary); display:block; margin-bottom:4px;">Anniversary</label>
                                <input type="text" id="editGuestAnniv" value="${escapeHTML(guest.anniversary)}" class="reports-filter-input" placeholder="YYYY-MM-DD" style="width:100%;">
                            </div>
                        </div>
                    </div>

                    <!-- Preferences badges and details -->
                    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px;">
                        <div style="font-weight:700; color:#c29f68; border-bottom:1px dashed var(--border); padding-bottom:6px;">Allergies & Special Requirements</div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;" id="dietaryCheckboxes">
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqVeg" ${guest.specialRequirements.vegetarian ? 'checked' : ''}> Vegetarian</label>
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqJain" ${guest.specialRequirements.jain ? 'checked' : ''}> Jain</label>
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqVegan" ${guest.specialRequirements.vegan ? 'checked' : ''}> Vegan</label>
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqEggless" ${guest.specialRequirements.eggless ? 'checked' : ''}> Eggless</label>
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqNoOnion" ${guest.specialRequirements.noOnion ? 'checked' : ''}> No Onion</label>
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqNoGarlic" ${guest.specialRequirements.noGarlic ? 'checked' : ''}> No Garlic</label>
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqNoSugar" ${guest.specialRequirements.noSugar ? 'checked' : ''}> No Sugar</label>
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqLessOil" ${guest.specialRequirements.lessOil ? 'checked' : ''}> Less Oil</label>
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqExtraCheese" ${guest.specialRequirements.extraCheese ? 'checked' : ''}> Extra Cheese</label>
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqGlutenFree" ${guest.specialRequirements.glutenFree ? 'checked' : ''}> Gluten Free</label>
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqNutAllergy" ${guest.specialRequirements.nutAllergy ? 'checked' : ''}> Nut Allergy</label>
                            <label style="font-size:0.8rem; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="reqMilkAllergy" ${guest.specialRequirements.milkAllergy ? 'checked' : ''}> Milk Allergy</label>
                        </div>

                        <div style="margin-top:8px;">
                            <label style="font-size:0.75rem; color:var(--text-tertiary); display:block; margin-bottom:4px;">Custom Preparation Notes</label>
                            <textarea id="editGuestNotes" class="reports-filter-input" style="width:100%; height:60px; resize:none;">${escapeHTML(guest.notes)}</textarea>
                        </div>

                        <button class="saas-btn saas-btn-primary" id="btnSaveGuestProfile" style="margin-top:8px; padding:10px 20px; font-weight:800; width:100%;">Save Guest Intel Profile</button>
                    </div>
                </div>

                <!-- Dining Timeline and statistics panel -->
                <div style="display:flex; flex-direction:column; gap:16px;">
                    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px;">
                        <div style="font-weight:700; color:#c29f68; margin-bottom:12px; border-bottom:1px dashed var(--border); padding-bottom:6px;">Auto-Learned Preferences</div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:0.8rem;">
                            <div>Favourite Food: <strong style="color:#fff;">${escapeHTML(guest.preferences.favFood)}</strong></div>
                            <div>Favourite Drink: <strong style="color:#fff;">${escapeHTML(guest.preferences.favDrink)}</strong></div>
                            <div>Favourite Category: <strong style="color:#fff;">${escapeHTML(guest.preferences.favCategory)}</strong></div>
                            <div>Preferred Table: <strong style="color:#fff;">${escapeHTML(guest.preferences.favTable)}</strong></div>
                            <div>Preferred Pay Method: <strong style="color:#fff;">${escapeHTML(guest.preferences.paymentMethod)}</strong></div>
                            <div>Usual Customizations: <strong style="color:#10b981;">${guest.usualCustomizations.join(', ') || 'None'}</strong></div>
                        </div>
                    </div>

                    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:20px; flex:1;">
                        <div style="font-weight:700; color:#c29f68; margin-bottom:12px; border-bottom:1px dashed var(--border); padding-bottom:6px;">Visits Timeline</div>
                        <div style="display:flex; flex-direction:column; gap:10px; max-height:360px; overflow-y:auto; padding-right:6px;">
                            ${guest.orders.map(o => `
                                <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border); padding:10px; border-radius:6px; display:flex; justify-content:space-between; font-size:0.78rem;">
                                    <div>
                                        <span style="font-weight:700; color:#fff;">Order: ${o.id}</span>
                                        <span style="display:block; font-size:0.7rem; color:var(--text-secondary);">${o.date} ${o.time || ''}</span>
                                    </div>
                                    <strong style="color:#10b981;">₹${parseFloat(o.grandTotal).toFixed(0)}</strong>
                                </div>
                            `).join('')}
                            ${guest.orders.length === 0 ? `<div style="text-align:center; color:var(--text-tertiary); padding:20px;">No visit history log.</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        overlay.style.display = "block";

        // Save event binding
        document.getElementById("btnSaveGuestProfile").addEventListener("click", async () => {
            const email = document.getElementById("editGuestEmail").value.trim();
            const dob = document.getElementById("editGuestDob").value.trim();
            const anniversary = document.getElementById("editGuestAnniv").value.trim();
            const notes = document.getElementById("editGuestNotes").value.trim();

            const specialRequirements = {
                vegetarian: document.getElementById("reqVeg").checked,
                jain: document.getElementById("reqJain").checked,
                vegan: document.getElementById("reqVegan").checked,
                eggless: document.getElementById("reqEggless").checked,
                noOnion: document.getElementById("reqNoOnion").checked,
                noGarlic: document.getElementById("reqNoGarlic").checked,
                noSugar: document.getElementById("reqNoSugar").checked,
                lessOil: document.getElementById("reqLessOil").checked,
                extraCheese: document.getElementById("reqExtraCheese").checked,
                glutenFree: document.getElementById("reqGlutenFree").checked,
                nutAllergy: document.getElementById("reqNutAllergy").checked,
                milkAllergy: document.getElementById("reqMilkAllergy").checked
            };

            const payload = {
                email,
                dob,
                anniversary,
                preferences: guest.preferences,
                specialRequirements,
                notes
            };

            try {
                const res = await fetch(`${API_BASE}/api/pos/customers/${id}/guest-profile`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    alert("Guest Intelligence Profile updated successfully!");
                    overlay.style.display = "none";
                    loadData();
                } else {
                    alert("Failed to update profile.");
                }
            } catch(e) {
                console.error("Error saving guest profile:", e);
            }
        });
    }

    // ========================================================
    // REAL-TIME BILLING INTERCEPT (POS INTEGRATION POPUP)
    // ========================================================
    function bindPOSBillingHook() {
        const select = document.getElementById("posCustomerSelect");
        if (select && !select.dataset.guestIntelHookBound) {
            select.dataset.guestIntelHookBound = "true";
            
            // Listen for customer selection updates
            select.addEventListener("change", (e) => {
                const customerId = e.target.value;
                triggerGuestPopup(customerId);
            });
        }
    }

    function triggerGuestPopup(customerId) {
        if (!state || customerId === 'cust-1' || customerId === 'cust-delivery') return;

        const customers = state.posCustomers || [];
        const orders = state.posOrders || [];
        const orderItems = state.posOrderItems || [];
        const enriched = enrichCustomerProfiles(customers, orders, orderItems);

        const guest = enriched.find(g => g.id === customerId);
        if (!guest) return;

        // Custom upsell suggestion logic
        let upsellText = "Recommend Chocolate Brownie (Dessert Upgrade)";
        if (guest.preferences.favFood && guest.preferences.favFood !== "N/A") {
            upsellText = `Suggest adding custom combo with ${escapeHTML(guest.preferences.favFood)}`;
        }

        const badges = [];
        if (guest.specialRequirements.vegetarian) badges.push('<span class="pill-badge pill-badge-success">Veg</span>');
        if (guest.specialRequirements.jain) badges.push('<span class="pill-badge pill-badge-warning">Jain</span>');
        if (guest.specialRequirements.nutAllergy) badges.push('<span class="pill-badge pill-badge-danger">Nut Allergy</span>');
        if (guest.specialRequirements.glutenFree) badges.push('<span class="pill-badge pill-badge-danger">Gluten Free</span>');

        const body = document.getElementById("posGuestIntelligenceModalBody");
        if (!body) return;

        body.innerHTML = `
            <div style="font-size:1.15rem; font-weight:800; color:#c29f68; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="hand"></i> Welcome Back, ${escapeHTML(guest.name)}!
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:8px;">
                <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; border:1px solid var(--border);">
                    <span style="font-size:0.7rem; color:var(--text-tertiary); display:block; margin-bottom:4px;">Visit Statistics</span>
                    Visit Count: <strong>${guest.visitCount} visits</strong> <br>
                    Preferred Seating: <strong>${escapeHTML(guest.preferences.seating)}</strong>
                </div>
                <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; border:1px solid var(--border);">
                    <span style="font-size:0.7rem; color:var(--text-tertiary); display:block; margin-bottom:4px;">Dietary & Allergies</span>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
                        ${badges.join('') || '<span style="color:#aaa;">No allergies recorded</span>'}
                    </div>
                </div>
            </div>

            <div style="background:rgba(194,159,104,0.05); padding:12px; border:1px dashed #c29f68; border-radius:8px; margin-top:8px;">
                <div style="font-weight:700; color:#c29f68; margin-bottom:4px;"><i data-lucide="sparkles" style="width:14px; height:14px; display:inline;"></i> AI Recommended Upsell</div>
                <span style="font-weight:800; color:#fff;">${upsellText}</span>
            </div>

            ${guest.notes ? `
            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; border:1px solid var(--border); margin-top:8px;">
                <span style="font-size:0.7rem; color:var(--text-tertiary); display:block; margin-bottom:4px;">Cashier / Prep Notes</span>
                <span style="color:#fff;">${escapeHTML(guest.notes)}</span>
            </div>
            ` : ''}

        `;

        document.getElementById("modalPOSGuestIntelligence").style.display = "flex";
        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    // Expose reload function to parent app
    window.refreshGuestIntelligence = loadData;

    // Start Load only if authenticated
    if (localStorage.getItem("bk_jwt_token")) {
        loadData();
    }

    // Listen to real-time events via Socket.IO
    if (typeof io !== "undefined") {
        const socket = io(API_BASE || window.location.origin);
        socket.on("order_placed", () => {
            console.log("Real-time checkout event, refreshing Guest Intelligence state...");
            if (localStorage.getItem("bk_jwt_token")) {
                loadData();
            }
        });
        socket.on("customer_created", () => {
            console.log("Customer profile created, reloading list...");
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
