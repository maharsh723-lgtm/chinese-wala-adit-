// Enterprise Procurement Management System Controller

(function() {
  let currentTab = 'dashboard';
  let suppliersList = [];
  let inventoryItems = [];
  let purchaseOrders = [];
  let whatsappLogs = [];
  let dashboardStats = {};
  let reportsData = {};
  
  // Active PO being viewed in details modal/overlay
  let activePoDetails = null;
  
  // Draft PO state (for generating a new PO)
  let draftPO = {
    items: [],
    supplierId: '',
    expectedDeliveryDate: '',
    notes: '',
    internalRemarks: ''
  };

  // Helper to format currency
  function formatINR(val) {
    return '₹' + parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Get active store from bk_state
  function getActiveStore() {
    const store = (window.bk_state && window.bk_state.getCurrentStore()) || 'VESU';
    return store === 'All' ? 'VESU' : store;
  }

  // Get auth token
  function getAuthHeader() {
    const token = localStorage.getItem("bk_jwt_token") || localStorage.getItem("bk_token") || "";
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  let initialized = false;

  // Initialize the module
  window.initProcurementModule = function() {
    if (initialized) return;
    console.log("Enterprise Procurement Module Initialized");
    injectStyles();
    renderBaseLayout();
    switchTab('dashboard');
    
    // Listen for global state updates
    const socket = window.bk_socket;
    if (socket) {
      socket.on('requisition_update', () => {
        if (document.getElementById('screen-procurement-module')?.classList.contains('active')) {
          refreshCurrentTab();
        }
      });
      socket.on('whatsapp_log_update', () => {
        if (currentTab === 'whatsapp-logs') {
          fetchWhatsappLogs();
        }
      });
    }
    initialized = true;
  };

  // Re-render when active screen becomes visible
  window.renderProcurementScreen = function() {
    console.log("Navigated to Procurement Screen");
    if (!initialized) {
      window.initProcurementModule();
    } else {
      refreshCurrentTab();
    }
  };

  // Switch tabs and load data
  function switchTab(tabId) {
    currentTab = tabId;
    
    // Update tab button classes
    document.querySelectorAll('.proc-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    refreshCurrentTab();
  }

  // Refresh data for the current tab
  async function refreshCurrentTab() {
    const root = document.getElementById('proc-tab-content');
    if (!root) return;

    // Show loading spinner
    root.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; min-height:300px; color:var(--antique-brass);">
        <div class="proc-spinner"></div>
      </div>
    `;

    try {
      if (currentTab === 'dashboard') {
        await fetchDashboardStats();
        renderDashboard(root);
      } else if (currentTab === 'inventory') {
        await fetchInventoryItems();
        renderInventoryMonitor(root);
      } else if (currentTab === 'orders') {
        await fetchPOList();
        await fetchSuppliers(); // needed for supplier dropdown in PO creation
        renderPurchaseOrders(root);
      } else if (currentTab === 'suppliers') {
        await fetchSuppliers();
        renderSupplierMaster(root);
      } else if (currentTab === 'reports') {
        await fetchReportsData();
        renderReports(root);
      } else if (currentTab === 'whatsapp-logs') {
        await fetchWhatsappLogs();
        renderWhatsappLogs(root);
      }
    } catch (err) {
      console.error(`Failed to load tab ${currentTab}:`, err);
      root.innerHTML = `
        <div style="padding:24px; text-align:center; color:var(--danger);">
          <i data-lucide="alert-circle" style="width:40px; height:40px; margin-bottom:12px;"></i>
          <h4 style="font-weight:700;">Failed to load data</h4>
          <p style="font-size:0.85rem; color:var(--text-tertiary); margin-top:4px;">${err.message || 'Connection error'}</p>
          <button class="proc-btn primary" style="margin-top:16px;" onclick="window.renderProcurementScreen()">Retry</button>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }

  // API Call Helpers
  async function fetchDashboardStats() {
    const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
    const store = getActiveStore();
    const res = await fetch(`${apiBase}/api/procurement/dashboard?store=${store}`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    dashboardStats = await res.json();
  }

  async function fetchInventoryItems() {
    const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
    const store = getActiveStore();
    const res = await fetch(`${apiBase}/api/inventory/items?store=${store}`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch inventory items');
    inventoryItems = await res.json();
  }

  async function fetchPOList() {
    const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
    const res = await fetch(`${apiBase}/api/pos/requisitions`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch PO list');
    const allPOs = await res.json();
    // Filter POs by store
    const store = getActiveStore();
    purchaseOrders = allPOs.filter(o => o.branchName === store);
  }

  async function fetchSuppliers() {
    const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
    const res = await fetch(`${apiBase}/api/suppliers`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch suppliers');
    suppliersList = await res.json();
  }

  async function fetchReportsData() {
    const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
    const store = getActiveStore();
    const res = await fetch(`${apiBase}/api/procurement/reports?store=${store}`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch reports data');
    reportsData = await res.json();
  }

  async function fetchWhatsappLogs() {
    const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
    const res = await fetch(`${apiBase}/api/whatsapp/logs`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch WhatsApp logs');
    whatsappLogs = await res.json();
  }

  // Base Layout Shell Injection
  function renderBaseLayout() {
    const root = document.getElementById('procurement-module-root');
    if (!root) return;

    root.innerHTML = `
      <div class="proc-container">
        <!-- Dashboard Header -->
        <div class="proc-header">
          <div>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary); display:flex; align-items:center; gap:8px;">
              <i data-lucide="shield-check" style="color:var(--antique-brass); width:24px; height:24px;"></i> Smart Enterprise Procurement
            </h2>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
              Monitor stock levels, manage supplier relationships, audit workflows, and track logistics.
            </p>
          </div>
          <div class="proc-header-actions">
            <button class="proc-btn" id="btn-proc-refresh">
              <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Sync State
            </button>
          </div>
        </div>

        <!-- Segemented Navigation Tabs -->
        <div class="proc-tabs">
          <button class="proc-tab-btn active" data-tab="dashboard">
            <i data-lucide="layout-dashboard"></i> Dashboard
          </button>
          <button class="proc-tab-btn" data-tab="inventory">
            <i data-lucide="activity"></i> Stock Monitor
          </button>
          <button class="proc-tab-btn" data-tab="orders">
            <i data-lucide="file-spreadsheet"></i> Drafts & Purchase Orders
          </button>
          <button class="proc-tab-btn" data-tab="suppliers">
            <i data-lucide="users"></i> Suppliers
          </button>
          <button class="proc-tab-btn" data-tab="reports">
            <i data-lucide="pie-chart"></i> Spending Reports
          </button>
        </div>

        <!-- Tab Body Container -->
        <div id="proc-tab-content" style="margin-top:24px;"></div>
      </div>
    `;

    // Wire up events
    document.querySelectorAll('.proc-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    document.getElementById('btn-proc-refresh').addEventListener('click', () => {
      const icon = document.querySelector('#btn-proc-refresh i');
      if (icon) icon.classList.add('proc-spin');
      refreshCurrentTab().finally(() => {
        if (icon) icon.classList.remove('proc-spin');
      });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // 1. Render Dashboard Tab
  function renderDashboard(container) {
    const stats = dashboardStats;
    container.innerHTML = `
      <!-- KPI Grid -->
      <div class="proc-grid-kpi">
        <div class="proc-kpi-card text-gold">
          <div class="kpi-header">Total Suppliers <i data-lucide="users" class="kpi-icon"></i></div>
          <div class="kpi-val">${stats.totalSuppliers || 0}</div>
          <div class="kpi-desc">Verified distributors</div>
        </div>
        <div class="proc-kpi-card text-warning">
          <div class="kpi-header">Pending Orders <i data-lucide="clock" class="kpi-icon"></i></div>
          <div class="kpi-val">${stats.pendingPOs || 0}</div>
          <div class="kpi-desc">Awaiting fulfillment</div>
        </div>
        <div class="proc-kpi-card text-danger">
          <div class="kpi-header">Stock Alerts <i data-lucide="alert-triangle" class="kpi-icon"></i></div>
          <div class="kpi-val">${stats.stockAlerts || 0}</div>
          <div class="kpi-desc">${stats.criticalInventoryAlerts || 0} Out of Stock</div>
        </div>
        <div class="proc-kpi-card text-success">
          <div class="kpi-header">Average Delivery <i data-lucide="truck" class="kpi-icon"></i></div>
          <div class="kpi-val">${stats.avgDeliveryTime || 2.5} Days</div>
          <div class="kpi-desc">Mean lead time</div>
        </div>
        <div class="proc-kpi-card text-gold" style="grid-column: span 2;">
          <div class="kpi-header">Procurement Volume <i data-lucide="trending-up" class="kpi-icon"></i></div>
          <div class="kpi-val">${formatINR(stats.totalProcurementValue || 0)}</div>
          <div class="kpi-desc">All active branch purchases</div>
        </div>
      </div>

      <!-- Dashboard Alerts & Overview Section -->
      <div class="proc-workspace-grid" style="margin-top: 24px;">
        <div class="proc-glass-card">
          <div class="card-header"><i data-lucide="bell" style="color:var(--antique-brass);"></i> Active Action Needed</div>
          <div id="dashboard-alerts-list" style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">
            <!-- Render Alert items dynamically -->
          </div>
        </div>

        <div class="proc-glass-card">
          <div class="card-header"><i data-lucide="info" style="color:var(--success);"></i> Quick Info</div>
          <div style="font-size:0.8rem; line-height:1.6; color:var(--text-secondary); margin-top:16px; display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:8px;">
              <span>Orders Waiting Approval:</span>
              <strong style="color:var(--text-primary);">${stats.ordersWaitingApproval || 0}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:8px;">
              <span>Orders in Transit:</span>
              <strong style="color:var(--text-primary);">${stats.ordersSent || 0}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:8px;">
              <span>Orders Delivered:</span>
              <strong style="color:var(--text-primary);">${stats.ordersDelivered || 0}</strong>
            </div>
            <div style="background:rgba(194, 159, 104, 0.05); padding:12px; border-left:3px solid var(--antique-brass); border-radius:4px; margin-top:10px;">
              <strong>WhatsApp Business Prep Status:</strong> Ready. Messages will be captured and saved dynamically in the WhatsApp Log tab.
            </div>
          </div>
        </div>
      </div>
    `;

    // Populate dashboard alerts
    const alertsList = document.getElementById('dashboard-alerts-list');
    if (alertsList) {
      const alerts = [];
      if (stats.stockAlerts > 0) {
        alerts.push({
          type: 'danger',
          title: 'Low/Out of Stock SKUs Detected',
          desc: `There are ${stats.stockAlerts} inventory items below the reorder point. Go to Stock Monitor to auto-generate POs.`,
          action: 'Stock Monitor',
          tab: 'inventory'
        });
      }
      if (stats.ordersWaitingApproval > 0) {
        alerts.push({
          type: 'warning',
          title: 'Draft Requisitions Need Review',
          desc: `You have ${stats.ordersWaitingApproval} purchase orders waiting for manager approval or payment verify.`,
          action: 'View Orders',
          tab: 'orders'
        });
      }

      if (alerts.length === 0) {
        alertsList.innerHTML = `<div style="text-align:center; padding:32px 0; color:var(--text-tertiary); font-size:0.85rem;">All systems operational. No actions required.</div>`;
      } else {
        alerts.forEach(item => {
          const div = document.createElement('div');
          div.className = `alert-item ${item.type}`;
          div.innerHTML = `
            <div>
              <div class="alert-title">${item.title}</div>
              <div class="alert-desc">${item.desc}</div>
            </div>
            <button class="proc-btn" style="padding: 4px 8px; font-size:0.75rem; flex-shrink:0;">${item.action}</button>
          `;
          div.querySelector('button').addEventListener('click', () => switchTab(item.tab));
          alertsList.appendChild(div);
        });
      }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // 2. Render Inventory Monitor Tab
  function renderInventoryMonitor(container) {
    container.innerHTML = `
      <div class="proc-glass-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div class="card-header"><i data-lucide="activity" style="color:var(--antique-brass);"></i> Real-Time Stock Monitoring</div>
          <div style="display:flex; gap:8px;">
            <button class="proc-btn primary" id="btn-generate-bulk-po"><i data-lucide="plus-circle"></i> Create PO from Low Stock</button>
          </div>
        </div>

        <div class="saas-table-container">
          <table class="saas-table">
            <thead>
              <tr>
                <th>Ingredient Name</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Reorder Threshold</th>
                <th>Status</th>
                <th>Days Remaining</th>
                <th>Recommended Reorder</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody id="inventory-monitor-rows"></tbody>
          </table>
        </div>
      </div>
    `;

    const tbody = document.getElementById('inventory-monitor-rows');
    if (tbody) {
      tbody.innerHTML = '';
      if (inventoryItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-tertiary); padding:24px;">No inventory items found.</td></tr>`;
      } else {
        inventoryItems.forEach(item => {
          // Determine status
          let statusText = 'Normal';
          let statusClass = 'status-normal';
          
          if (item.stock === 0) {
            statusText = 'Out of Stock';
            statusClass = 'status-danger';
          } else if (item.stock <= (item.reorder * 0.5)) {
            statusText = 'Critical Stock';
            statusClass = 'status-critical';
          } else if (item.stock <= item.reorder) {
            statusText = 'Low Stock';
            statusClass = 'status-warning';
          }

          // Expected days remaining
          // Simulate consumption rate if none: default consumption 100 units/day
          const consumptionRate = 100;
          const daysRemaining = item.stock > 0 ? Math.ceil(item.stock / consumptionRate) : 0;
          
          // Reorder recommendation
          const recommended = statusText !== 'Normal' ? Math.max(200, (item.reorder * 3) - item.stock) : 0;

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${item.label}</strong></td>
            <td><span style="font-size:0.75rem; color:var(--text-secondary);">${item.category || 'Chaat'}</span></td>
            <td>${item.stock} ${item.unit}</td>
            <td>${item.reorder} ${item.unit}</td>
            <td><span class="status-pill ${statusClass}">${statusText}</span></td>
            <td>${daysRemaining === 0 ? '<strong style="color:var(--danger)">0 days</strong>' : `${daysRemaining} days`}</td>
            <td>${recommended > 0 ? `<strong>${recommended} ${item.unit}</strong>` : '-'}</td>
            <td style="text-align:right;">
              <button class="proc-btn" ${recommended === 0 ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.72rem;">
                <i data-lucide="shopping-cart" style="width:12px; height:12px;"></i> Add to PO
              </button>
            </td>
          `;

          // Add to draft PO listener
          const btn = tr.querySelector('button');
          if (btn) {
            btn.addEventListener('click', () => {
              addToDraftPO(item, recommended);
              showToast('Added to Draft PO', `${item.label} was added to the active requisition.`, 'success');
              switchTab('orders');
            });
          }

          tbody.appendChild(tr);
        });
      }
    }

    // Bulk PO creation button
    document.getElementById('btn-generate-bulk-po').addEventListener('click', () => {
      const lowStockItems = inventoryItems.filter(i => i.stock <= i.reorder && i.reorder > 0);
      if (lowStockItems.length === 0) {
        showToast('No items to reorder', 'All items are currently at normal stock levels.', 'info');
        return;
      }

      lowStockItems.forEach(item => {
        const recommended = Math.max(200, (item.reorder * 3) - item.stock);
        addToDraftPO(item, recommended);
      });

      showToast('Bulk PO Generated', `${lowStockItems.length} items added to draft PO.`, 'success');
      switchTab('orders');
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // Helper to add item to draft PO state
  function addToDraftPO(item, recommendedQty) {
    const existing = draftPO.items.find(i => i.productId === item.id);
    // Find default supplier for this item if mapped
    let defaultSupplierId = '';
    let unitCost = item.unitCost || 25.00;
    
    if (item.suppliers && item.suppliers.length > 0) {
      const defMapping = item.suppliers.find(m => m.isDefault);
      if (defMapping) {
        defaultSupplierId = defMapping.supplierId;
        unitCost = defMapping.unitCost;
      } else {
        defaultSupplierId = item.suppliers[0].supplierId;
        unitCost = item.suppliers[0].unitCost;
      }
    } else {
      // Fallback supplier Anand Verma
      defaultSupplierId = 'SUP-001';
    }

    if (existing) {
      existing.quantity += recommendedQty;
      existing.amount = existing.quantity * existing.rate;
    } else {
      draftPO.items.push({
        productId: item.id,
        productName: item.label,
        quantity: recommendedQty,
        unit: item.unit,
        rate: unitCost,
        amount: recommendedQty * unitCost,
        supplierId: defaultSupplierId,
        availableSuppliers: item.suppliers || []
      });
    }

    // Set default supplier of PO to match first item if not set
    if (!draftPO.supplierId) {
      draftPO.supplierId = defaultSupplierId;
    }
  }

  // 3. Render Purchase Orders & PO Generator Tab
  function renderPurchaseOrders(container) {
    container.innerHTML = `
      <div class="proc-workspace-grid">
        <!-- Left Side: Generated PO List -->
        <div class="proc-glass-card">
          <div class="card-header"><i data-lucide="file-text" style="color:var(--antique-brass);"></i> Requisitions &amp; PO History</div>
          <div style="margin-top:16px; margin-bottom:12px; display:flex; gap:8px;">
            <select id="filter-po-status" class="saas-form-control" style="max-width:180px; font-size:0.8rem; height:34px;">
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Review">Review</option>
              <option value="Approved">Approved</option>
              <option value="Sent">Sent</option>
              <option value="Accepted">Accepted</option>
              <option value="Delivered">Delivered</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div class="saas-table-container">
            <table class="saas-table" style="font-size:0.8rem;">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Branch</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th style="text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody id="po-list-rows"></tbody>
            </table>
          </div>
        </div>

        <!-- Right Side: Active Draft Requisition Generator -->
        <div class="proc-glass-card">
          <div class="card-header"><i data-lucide="shopping-cart" style="color:var(--success);"></i> Active Draft Requisition</div>
          
          <div style="margin-top:20px; display:flex; flex-direction:column; gap:16px;">
            <!-- Items Table -->
            <div class="saas-table-container" style="max-height: 200px; overflow-y:auto;">
              <table class="saas-table" style="font-size:0.75rem;">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="draft-po-items-rows"></tbody>
              </table>
            </div>

            <!-- Draft PO Form -->
            <div>
              <label class="proc-form-label">Default Supplier</label>
              <select class="saas-form-control" id="draft-po-supplier" style="width:100%;">
                <option value="">-- Choose Supplier --</option>
                ${suppliersList.map(s => `<option value="${s.id}" ${draftPO.supplierId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
              </select>
            </div>

            <div style="display:grid; grid-template-columns:1fr; gap:12px;">
              <div>
                <label class="proc-form-label">Expected Delivery Date</label>
                <input type="date" class="saas-form-control" id="draft-po-expected-date" value="${draftPO.expectedDeliveryDate || ''}" style="width:100%;">
              </div>
              <div>
                <label class="proc-form-label">Public Notes / Instructions</label>
                <textarea class="saas-form-control" id="draft-po-notes" placeholder="Delivery instructions..." style="width:100%; height:50px; resize:none;">${draftPO.notes || ''}</textarea>
              </div>
              <div>
                <label class="proc-form-label">Internal Remarks (Audit Trail)</label>
                <textarea class="saas-form-control" id="draft-po-internal-remarks" placeholder="Internal audit remarks..." style="width:100%; height:50px; resize:none;">${draftPO.internalRemarks || ''}</textarea>
              </div>
            </div>

            <!-- Total display -->
            <div style="background:rgba(46,35,31,0.02); padding:12px; border-radius:8px; border:1px solid var(--border); font-size:0.8rem; display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-tertiary);">Subtotal:</span>
                <span id="draft-subtotal">₹0.00</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-tertiary);">GST (18%):</span>
                <span id="draft-gst">₹0.00</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-weight:800; font-size:0.9rem; border-top:1px dashed var(--border); padding-top:6px; margin-top:4px;">
                <span>Grand Total:</span>
                <span style="color:var(--orange-primary);" id="draft-total">₹0.00</span>
              </div>
            </div>

            <div style="display:flex; gap:8px;">
              <button class="proc-btn" id="btn-clear-draft" style="flex:1; border-color:var(--danger); color:var(--danger);">Clear Draft</button>
              <button class="proc-btn primary" id="btn-save-draft" style="flex:2;">Create Draft PO</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Populate PO List
    renderPOListTable('All');

    // Filter listener
    document.getElementById('filter-po-status').addEventListener('change', (e) => {
      renderPOListTable(e.target.value);
    });

    // Populate Draft PO UI
    updateDraftTotals();
    renderDraftItems();

    // Draft form change listeners
    document.getElementById('draft-po-supplier').addEventListener('change', (e) => {
      draftPO.supplierId = e.target.value;
    });
    document.getElementById('draft-po-expected-date').addEventListener('change', (e) => {
      draftPO.expectedDeliveryDate = e.target.value;
    });
    document.getElementById('draft-po-notes').addEventListener('input', (e) => {
      draftPO.notes = e.target.value;
    });
    document.getElementById('draft-po-internal-remarks').addEventListener('input', (e) => {
      draftPO.internalRemarks = e.target.value;
    });

    // Clear Draft
    document.getElementById('btn-clear-draft').addEventListener('click', () => {
      draftPO = { items: [], supplierId: '', expectedDeliveryDate: '', notes: '', internalRemarks: '' };
      renderDraftItems();
      updateDraftTotals();
      document.getElementById('draft-po-supplier').value = '';
      document.getElementById('draft-po-expected-date').value = '';
      document.getElementById('draft-po-notes').value = '';
      document.getElementById('draft-po-internal-remarks').value = '';
      showToast('Draft PO cleared', 'All items have been removed.', 'info');
    });

    // Save Draft PO
    document.getElementById('btn-save-draft').addEventListener('click', async () => {
      if (draftPO.items.length === 0) {
        showToast('Draft is empty', 'Add items from Stock Monitor before creating a PO.', 'warning');
        return;
      }
      if (!draftPO.supplierId) {
        showToast('Supplier required', 'Please select a supplier for the PO.', 'warning');
        return;
      }

      const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
      const store = getActiveStore();
      const user = JSON.parse(localStorage.getItem('bk_logged_in_user') || '{}');
      const managerName = user.name || 'Branch Manager';

      const subtotal = draftPO.items.reduce((sum, i) => sum + i.amount, 0);
      const gst = subtotal * 0.18;
      const grandTotal = subtotal + gst;

      const payload = {
        branchName: store,
        managerName,
        subtotal,
        gst,
        grandTotal,
        paymentMethod: 'UPI',
        expectedDeliveryDate: draftPO.expectedDeliveryDate,
        notes: draftPO.notes,
        internalRemarks: draftPO.internalRemarks,
        supplierId: draftPO.supplierId,
        items: draftPO.items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          rate: i.rate,
          amount: i.amount,
          gst: i.amount * 0.18,
          total: i.amount * 1.18
        }))
      };

      try {
        const res = await fetch(`${apiBase}/api/pos/requisitions`, {
          method: 'POST',
          headers: getAuthHeader(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Server error generating PO');
        const data = await res.json();
        showToast('Draft PO Created', `PO ${data.orderId} initialized successfully!`, 'success');
        
        // Reset draft
        draftPO = { items: [], supplierId: '', expectedDeliveryDate: '', notes: '', internalRemarks: '' };
        
        // Refresh PO Tab
        await fetchPOList();
        renderPOListTable(document.getElementById('filter-po-status').value);
        renderDraftItems();
        updateDraftTotals();
        document.getElementById('draft-po-supplier').value = '';
        document.getElementById('draft-po-expected-date').value = '';
        document.getElementById('draft-po-notes').value = '';
        document.getElementById('draft-po-internal-remarks').value = '';
      } catch (err) {
        showToast('Error saving PO', err.message, 'danger');
      }
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // Render list of POs based on status
  function renderPOListTable(statusFilter) {
    const tbody = document.getElementById('po-list-rows');
    if (!tbody) return;

    tbody.innerHTML = '';
    const filtered = statusFilter === 'All' ? purchaseOrders : purchaseOrders.filter(o => o.orderStatus === statusFilter);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-tertiary); padding:20px;">No purchase orders found.</td></tr>`;
      return;
    }

    filtered.forEach(o => {
      const sup = suppliersList.find(s => s.id === o.supplierId);
      const supplierName = sup ? sup.name : (o.supplierName || 'Default Supplier');
      
      let badgeClass = 'status-normal';
      if (o.orderStatus === 'Draft' || o.orderStatus === 'Review') badgeClass = 'status-normal';
      else if (o.orderStatus === 'Approved') badgeClass = 'status-warning';
      else if (o.orderStatus === 'Sent' || o.orderStatus === 'Accepted') badgeClass = 'status-critical';
      else if (o.orderStatus === 'Delivered') badgeClass = 'status-normal';
      else if (o.orderStatus === 'Completed') badgeClass = 'status-success';
      else if (o.orderStatus === 'Cancelled' || o.orderStatus === 'Rejected') badgeClass = 'status-danger';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${o.id}</strong></td>
        <td>${o.date}</td>
        <td>${supplierName}</td>
        <td>${o.branchName}</td>
        <td><strong>${formatINR(o.grandTotal)}</strong></td>
        <td><span class="status-pill ${badgeClass}">${o.orderStatus}</span></td>
        <td style="text-align:right;">
          <button class="proc-btn" style="padding: 4px 8px; font-size: 0.72rem;"><i data-lucide="eye" style="width:12px; height:12px;"></i> Details</button>
        </td>
      `;

      tr.querySelector('button').addEventListener('click', () => {
        openPoDetailsModal(o);
      });

      tbody.appendChild(tr);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // Render items inside the draft PO container
  function renderDraftItems() {
    const tbody = document.getElementById('draft-po-items-rows');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (draftPO.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-tertiary); padding:16px 0;">Draft requisition is empty.</td></tr>`;
      return;
    }

    draftPO.items.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.productName}</strong></td>
        <td>
          <input type="number" class="saas-form-control" value="${item.quantity}" style="width:70px; height:24px; padding:2px; font-size:0.75rem;" min="1">
        </td>
        <td>₹${item.rate.toFixed(2)}</td>
        <td><strong>₹${item.amount.toFixed(2)}</strong></td>
        <td style="text-align:right;">
          <button class="proc-action-btn" style="color:var(--danger); border:none; background:transparent; padding:2px;" title="Remove"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
        </td>
      `;

      // Change Qty listener
      const input = tr.querySelector('input');
      input.addEventListener('change', (e) => {
        const val = parseInt(e.target.value) || 1;
        item.quantity = val;
        item.amount = val * item.rate;
        renderDraftItems();
        updateDraftTotals();
      });

      // Delete listener
      tr.querySelector('button').addEventListener('click', () => {
        draftPO.items.splice(idx, 1);
        renderDraftItems();
        updateDraftTotals();
        showToast('Item Removed', `${item.productName} removed from draft.`, 'info');
      });

      tbody.appendChild(tr);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // Update totals for Draft PO
  function updateDraftTotals() {
    const subtotal = draftPO.items.reduce((sum, i) => sum + i.amount, 0);
    const gst = subtotal * 0.18;
    const grandTotal = subtotal + gst;

    const lblSub = document.getElementById('draft-subtotal');
    const lblGst = document.getElementById('draft-gst');
    const lblTotal = document.getElementById('draft-total');

    if (lblSub) lblSub.textContent = formatINR(subtotal);
    if (lblGst) lblGst.textContent = formatINR(gst);
    if (lblTotal) lblTotal.textContent = formatINR(grandTotal);
  }

  // 4. Render Supplier Master Tab
  function renderSupplierMaster(container) {
    container.innerHTML = `
      <div class="proc-glass-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div class="card-header"><i data-lucide="users" style="color:var(--antique-brass);"></i> Supplier Directory</div>
          <button class="proc-btn primary" id="btn-add-supplier"><i data-lucide="user-plus"></i> Add New Supplier</button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
          ${suppliersList.length === 0 ? '<div style="grid-column: span 3; text-align:center; padding:32px; color:var(--text-tertiary);">No suppliers registered.</div>' : ''}
          ${suppliersList.map(s => {
            const metrics = s.metrics || { totalOrders: 0, avgDeliveryDays: s.deliveryDays, lateDeliveries: 0, orderAcceptanceRate: 100, procurementValue: 0, lastOrderDate: 'N/A' };
            return `
              <div class="proc-glass-card" style="border: 1px solid var(--border); display:flex; flex-direction:column; gap:12px; margin-bottom:0;">
                <div style="display:flex; justify-content:space-between; align-items:start; border-bottom: 1px solid var(--border); padding-bottom:8px;">
                  <div>
                    <h4 style="font-weight:800; color:var(--text-primary); font-size:0.95rem; display:flex; align-items:center; gap:6px;">
                      ${s.name} ${s.isPreferred ? '<span class="status-pill status-success" style="font-size:0.6rem; padding:2px 4px; text-transform:uppercase;">Preferred</span>' : ''}
                    </h4>
                    <span style="font-size:0.75rem; color:var(--text-tertiary);">ID: ${s.id} | Contact: ${s.contactPerson}</span>
                  </div>
                  <div style="display:flex; gap:6px;">
                    <button class="proc-action-btn edit-sup" data-id="${s.id}" style="padding:4px 8px; border:none;" title="Edit"><i data-lucide="edit-3" style="width:14px; height:14px;"></i></button>
                    <button class="proc-action-btn delete-sup" data-id="${s.id}" style="color:var(--danger); padding:4px 8px; border:none;" title="Delete"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
                  </div>
                </div>

                <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:8px; font-size:0.75rem; color:var(--text-secondary);">
                  <div><i data-lucide="phone" style="width:11px; height:11px; vertical-align:middle; margin-right:4px;"></i> Mobile: <strong>${s.mobileNumber}</strong></div>
                  <div><i data-lucide="message-square" style="width:11px; height:11px; vertical-align:middle; margin-right:4px;"></i> WhatsApp: <strong>${s.whatsappNumber}</strong></div>
                  <div style="grid-column: span 2;"><i data-lucide="mail" style="width:11px; height:11px; vertical-align:middle; margin-right:4px;"></i> Email: <strong>${s.email}</strong></div>
                  <div style="grid-column: span 2;"><i data-lucide="landmark" style="width:11px; height:11px; vertical-align:middle; margin-right:4px;"></i> GST: <strong style="font-family:monospace;">${s.gstNumber || 'N/A'}</strong></div>
                  <div style="grid-column: span 2;"><i data-lucide="map-pin" style="width:11px; height:11px; vertical-align:middle; margin-right:4px;"></i> Address: <span>${s.address}</span></div>
                  <div>Payment Terms: <strong>${s.paymentTerms}</strong></div>
                  <div>Lead Time: <strong>${s.deliveryDays} days</strong></div>
                </div>

                <!-- Supplier Metrics Block -->
                <div style="background:rgba(194, 159, 104, 0.04); padding:10px; border-radius:6px; border:1px dashed var(--border); font-size:0.75rem; display:flex; flex-direction:column; gap:4px; margin-top:8px;">
                  <div style="font-weight:700; color:var(--antique-brass); font-size:0.75rem; border-bottom:1px solid rgba(194, 159, 104, 0.1); padding-bottom:4px; margin-bottom:4px; text-transform:uppercase;">Performance Summary</div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                    <div>Total Orders: <strong>${metrics.totalOrders}</strong></div>
                    <div>Acceptance Rate: <strong>${metrics.orderAcceptanceRate}%</strong></div>
                    <div>Avg Lead Time: <strong>${metrics.avgDeliveryDays} Days</strong></div>
                    <div>Late Deliveries: <strong style="color:${metrics.lateDeliveries > 0 ? 'var(--danger)' : 'inherit'}">${metrics.lateDeliveries}</strong></div>
                    <div style="grid-column: span 2;">Procured Value: <strong>${formatINR(metrics.procurementValue)}</strong></div>
                    <div style="grid-column: span 2;">Last Order Date: <span>${metrics.lastOrderDate}</span></div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Wire up supplier Directory events
    document.getElementById('btn-add-supplier').addEventListener('click', () => openSupplierModal(null));
    document.querySelectorAll('.edit-sup').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const sup = suppliersList.find(s => s.id === id);
        openSupplierModal(sup);
      });
    });

    document.querySelectorAll('.delete-sup').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm(`Are you sure you want to delete supplier ${id}? All mapped items will be unassigned.`)) {
          const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
          try {
            const res = await fetch(`${apiBase}/api/suppliers/${id}`, {
              method: 'DELETE',
              headers: getAuthHeader()
            });
            if (!res.ok) throw new Error('Failed to delete supplier');
            showToast('Supplier Deleted', `Supplier ${id} deleted successfully.`, 'info');
            switchTab('suppliers');
          } catch(e) {
            showToast('Error deleting supplier', e.message, 'danger');
          }
        }
      });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // 5. Render Procurement Reports Tab
  function renderReports(container) {
    const data = reportsData;
    container.innerHTML = `
      <div class="proc-workspace-grid">
        <!-- Purchase History list -->
        <div class="proc-glass-card" style="grid-column: span 2;">
          <div class="card-header"><i data-lucide="file-spreadsheet" style="color:var(--antique-brass);"></i> Outstanding Requisitions (Pending Delivery)</div>
          <div class="saas-table-container" style="margin-top:16px;">
            <table class="saas-table" style="font-size:0.8rem;">
              <thead>
                <tr>
                  <th>PO ID</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Grand Total</th>
                  <th>Logistics Status</th>
                </tr>
              </thead>
              <tbody>
                ${(data.outstandingOrders || []).length === 0 ? '<tr><td colspan="5" style="text-align:center; color:var(--text-tertiary); padding:16px;">No outstanding orders.</td></tr>' : ''}
                ${(data.outstandingOrders || []).map(o => `
                  <tr>
                    <td><strong>${o.id}</strong></td>
                    <td>${o.date}</td>
                    <td>${o.supplierName || 'Default Supplier'}</td>
                    <td><strong>${formatINR(o.grandTotal)}</strong></td>
                    <td><span class="status-pill status-warning">${o.orderStatus}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Visual Analytics Cards -->
        <div class="proc-glass-card">
          <div class="card-header"><i data-lucide="bar-chart-2" style="color:var(--antique-brass);"></i> Spend Trend (Last 6 Months)</div>
          <div style="height: 220px; display:flex; align-items:flex-end; gap:20px; padding:16px 10px; margin-top:20px; border-bottom:1px solid var(--border);">
            ${(data.monthlyPurchases || []).length === 0 ? '<div style="text-align:center; width:100%; color:var(--text-tertiary);">No spending data recorded.</div>' : ''}
            ${(data.monthlyPurchases || []).map(item => {
              const pct = Math.max(10, Math.min(100, Math.round((item.total / 100000) * 100)));
              return `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:8px;">
                  <span style="font-size:0.65rem; font-weight:700; color:var(--text-secondary);">₹${Math.round(item.total/1000)}k</span>
                  <div style="width:100%; max-width:40px; height:${pct * 1.5}px; background:linear-gradient(to top, var(--orange-primary) 0%, var(--antique-brass) 100%); border-radius:4px 4px 0 0; box-shadow:0 4px 10px rgba(0,0,0,0.1);"></div>
                  <span style="font-size:0.7rem; color:var(--text-tertiary); font-family:monospace; transform:rotate(-15deg); margin-top:4px;">${item.month}</span>
                </div>
              `;
            }).reverse().join('')}
          </div>
        </div>

        <div class="proc-glass-card">
          <div class="card-header"><i data-lucide="trending-up" style="color:var(--success);"></i> Top Purchased Ingredients</div>
          <div style="margin-top:20px; display:flex; flex-direction:column; gap:12px;">
            ${(data.mostPurchasedItems || []).length === 0 ? '<div style="text-align:center; padding:32px; color:var(--text-tertiary);">No purchase item data.</div>' : ''}
            ${(data.mostPurchasedItems || []).map(item => {
              const maxVal = Math.max(...data.mostPurchasedItems.map(i => i.totalSpend));
              const widthPct = Math.round((item.totalSpend / maxVal) * 100);
              return `
                <div style="font-size:0.8rem;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <strong>${item.productName}</strong>
                    <span style="color:var(--text-secondary);">${item.totalQty} units (₹${item.totalSpend.toLocaleString('en-IN')})</span>
                  </div>
                  <div style="width:100%; height:8px; background:rgba(46,35,31,0.04); border-radius:4px; overflow:hidden;">
                    <div style="width:${widthPct}%; height:100%; background:var(--antique-brass); border-radius:4px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Supplier performance details -->
        <div class="proc-glass-card" style="grid-column: span 2;">
          <div class="card-header"><i data-lucide="award" style="color:var(--antique-brass);"></i> Supplier Fulfillment Performance</div>
          <div class="saas-table-container" style="margin-top:16px;">
            <table class="saas-table" style="font-size:0.8rem;">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Total Orders</th>
                  <th>Total Spending</th>
                  <th>Late Deliveries</th>
                  <th>On-Time Delivery Rate</th>
                </tr>
              </thead>
              <tbody>
                ${(data.supplierPerformance || []).length === 0 ? '<tr><td colspan="5" style="text-align:center; color:var(--text-tertiary); padding:16px;">No supplier logs.</td></tr>' : ''}
                ${(data.supplierPerformance || []).map(sup => `
                  <tr>
                    <td><strong>${sup.supplierName}</strong></td>
                    <td>${sup.totalOrders}</td>
                    <td><strong>${formatINR(sup.totalSpend)}</strong></td>
                    <td style="color:${sup.lateDeliveries > 0 ? 'var(--danger)' : 'inherit'}; font-weight:700;">${sup.lateDeliveries}</td>
                    <td>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <div style="flex-grow:1; max-width:80px; height:6px; background:rgba(0,0,0,0.05); border-radius:3px; overflow:hidden;">
                          <div style="width:${sup.onTimeRate}%; height:100%; background:${sup.onTimeRate > 80 ? 'var(--success)' : 'var(--warning)'}; border-radius:3px;"></div>
                        </div>
                        <strong>${sup.onTimeRate}%</strong>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // 6. Render WhatsApp Logs Tab
  function renderWhatsappLogs(container) {
    container.innerHTML = `
      <div class="proc-glass-card">
        <div class="card-header"><i data-lucide="message-square" style="color:var(--antique-brass);"></i> WhatsApp Business Outbox (Placeholder Logs)</div>
        <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:4px;">
          Logs of outbound communication queued for Meta Cloud API integration. Statuses are marked as <strong>Pending Integration</strong>.
        </p>

        <div class="saas-table-container" style="margin-top:20px;">
          <table class="saas-table" style="font-size:0.8rem;">
            <thead>
              <tr>
                <th>Log Date</th>
                <th>PO Number</th>
                <th>Type</th>
                <th>Recipient Number</th>
                <th>Message Content</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${whatsappLogs.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary); padding:24px;">No message requests captured in the outbox.</td></tr>' : ''}
              ${whatsappLogs.map(log => {
                let typePill = 'status-normal';
                if (log.type === 'purchase_order') typePill = 'status-success';
                else if (log.type === 'reminder') typePill = 'status-warning';
                else if (log.type === 'delivery_reminder') typePill = 'status-critical';
                else if (log.type === 'payment_reminder') typePill = 'status-danger';

                return `
                  <tr>
                    <td style="white-space:nowrap; color:var(--text-tertiary); font-size:0.75rem;">${new Date(log.timestamp).toLocaleString()}</td>
                    <td><strong>${log.poId}</strong></td>
                    <td><span class="status-pill ${typePill}" style="font-size:0.65rem; text-transform:uppercase;">${log.type.replace('_',' ')}</span></td>
                    <td style="font-family:monospace; font-weight:600;">${log.recipientNumber}</td>
                    <td style="max-width:350px; font-size:0.75rem; white-space:pre-wrap; line-height:1.4; color:var(--text-secondary);">${log.messageContent}</td>
                    <td><span class="status-pill status-normal" style="color:var(--antique-brass); background:rgba(194,159,104,0.15); border:1px solid rgba(194, 159, 104, 0.3); font-weight:700;">${log.status}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // Modals Implementation
  
  // 1. Supplier Add/Edit Modal
  function openSupplierModal(supplier = null) {
    const isEdit = !!supplier;
    const modalId = 'modal-proc-supplier-form';
    
    // Remove existing if any
    document.getElementById(modalId)?.remove();

    const div = document.createElement('div');
    div.id = modalId;
    div.className = 'saas-modal';
    div.style.cssText = 'display: flex; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999;';
    
    div.innerHTML = `
      <div class="saas-modal-card" style="background: var(--bg-card); border-radius: var(--radius-md); max-width: 550px; width: 100%; padding: 24px; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom:1px solid var(--border); padding-bottom:8px;">
          <h3 style="font-weight: 800; font-size: 1.15rem; color: var(--text-heading); display:flex; align-items:center; gap:8px;">
            <i data-lucide="user-plus" style="color:var(--antique-brass);"></i> ${isEdit ? 'Edit Supplier Record' : 'Register New Supplier'}
          </h3>
          <button class="proc-action-btn" id="btn-close-sup-modal" style="padding: 4px 8px; border: none; font-size: 1.2rem;">&times;</button>
        </div>
        
        <form id="supplier-form" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:0.8rem;">
          <div>
            <label class="proc-form-label">Supplier/Business Name *</label>
            <input type="text" class="saas-form-control" name="name" value="${supplier?.name || ''}" required style="width:100%;">
          </div>
          <div>
            <label class="proc-form-label">Contact Person Name *</label>
            <input type="text" class="saas-form-control" name="contactPerson" value="${supplier?.contactPerson || ''}" required style="width:100%;">
          </div>
          <div>
            <label class="proc-form-label">Mobile Number *</label>
            <input type="text" class="saas-form-control" name="mobileNumber" value="${supplier?.mobileNumber || ''}" required style="width:100%;">
          </div>
          <div>
            <label class="proc-form-label">WhatsApp Number *</label>
            <input type="text" class="saas-form-control" name="whatsappNumber" value="${supplier?.whatsappNumber || ''}" required style="width:100%;">
          </div>
          <div style="grid-column: span 2;">
            <label class="proc-form-label">Email Address</label>
            <input type="email" class="saas-form-control" name="email" value="${supplier?.email || ''}" style="width:100%;">
          </div>
          <div>
            <label class="proc-form-label">GST Number (GSTIN)</label>
            <input type="text" class="saas-form-control" name="gstNumber" value="${supplier?.gstNumber || ''}" placeholder="e.g. 24AAACB1234F1Z5" style="width:100%; font-family:monospace;">
          </div>
          <div>
            <label class="proc-form-label">Payment Terms</label>
            <select class="saas-form-control" name="paymentTerms" style="width:100%;">
              <option value="COD" ${supplier?.paymentTerms === 'COD' ? 'selected' : ''}>COD (Cash on Delivery)</option>
              <option value="Net 15" ${supplier?.paymentTerms === 'Net 15' ? 'selected' : ''}>Net 15</option>
              <option value="Net 30" ${supplier?.paymentTerms === 'Net 30' ? 'selected' : ''}>Net 30</option>
              <option value="Upfront" ${supplier?.paymentTerms === 'Upfront' ? 'selected' : ''}>Upfront Payment</option>
            </select>
          </div>
          <div>
            <label class="proc-form-label">Delivery Days (Lead Time)</label>
            <input type="number" class="saas-form-control" name="deliveryDays" value="${supplier?.deliveryDays || 3}" min="1" style="width:100%;">
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:20px;">
            <input type="checkbox" name="isPreferred" id="chk-pref" ${supplier?.isPreferred ? 'checked' : ''} style="width:16px; height:16px;">
            <label for="chk-pref" style="font-weight:700; cursor:pointer;">Mark as Preferred Supplier</label>
          </div>
          <div style="grid-column: span 2;">
            <label class="proc-form-label">Address</label>
            <textarea class="saas-form-control" name="address" style="width:100%; height:45px; resize:none;">${supplier?.address || ''}</textarea>
          </div>
          <div style="grid-column: span 2;">
            <label class="proc-form-label">Notes</label>
            <textarea class="saas-form-control" name="notes" style="width:100%; height:45px; resize:none;">${supplier?.notes || ''}</textarea>
          </div>
          
          <div style="grid-column: span 2; display: flex; gap: 8px; justify-content: flex-end; border-top:1px solid var(--border); padding-top:16px; margin-top:12px;">
            <button type="button" class="saas-btn saas-btn-secondary" id="btn-cancel-sup-modal">Cancel</button>
            <button type="submit" class="saas-btn saas-btn-primary">${isEdit ? 'Save Changes' : 'Register'}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Close listeners
    const closeModal = () => div.remove();
    document.getElementById('btn-close-sup-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-sup-modal').addEventListener('click', closeModal);

    // Form submit listener
    document.getElementById('supplier-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get('name'),
        contactPerson: fd.get('contactPerson'),
        mobileNumber: fd.get('mobileNumber'),
        whatsappNumber: fd.get('whatsappNumber'),
        email: fd.get('email'),
        gstNumber: fd.get('gstNumber'),
        paymentTerms: fd.get('paymentTerms'),
        deliveryDays: parseInt(fd.get('deliveryDays')) || 3,
        isPreferred: fd.get('isPreferred') === 'on',
        address: fd.get('address'),
        notes: fd.get('notes'),
        status: supplier?.status || 'Active'
      };

      const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
      const url = isEdit ? `${apiBase}/api/suppliers/${supplier.id}` : `${apiBase}/api/suppliers`;
      const method = isEdit ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method,
          headers: getAuthHeader(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Server error registering supplier');
        showToast('Supplier Saved', `Supplier records updated successfully.`, 'success');
        closeModal();
        switchTab('suppliers');
      } catch(err) {
        showToast('Error saving supplier', err.message, 'danger');
      }
    });
  }

  // 2. PO Details & Approval Timeline Modal Overlay
  function openPoDetailsModal(po) {
    activePoDetails = po;
    const modalId = 'modal-proc-po-details';
    document.getElementById(modalId)?.remove();

    const sup = suppliersList.find(s => s.id === po.supplierId);
    const supplierInfo = sup || { name: po.supplierName || 'Default Supplier', contactPerson: 'Supplier Rep', mobileNumber: '+91 99786 73137', email: 'supplies@badikatori.com', gstNumber: '24AAACB1234F1Z5', address: 'Vesu, Surat', paymentTerms: 'Net 30' };

    const div = document.createElement('div');
    div.id = modalId;
    div.className = 'saas-modal';
    div.style.cssText = 'display: flex; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999;';

    // Status mapping for visual timeline
    const statuses = ['Draft', 'Review', 'Approved', 'Sent', 'Accepted', 'Delivered', 'Completed'];
    const currentStatusIdx = statuses.indexOf(po.orderStatus);

    div.innerHTML = `
      <div class="saas-modal-card" style="background: var(--bg-card); border-radius: var(--radius-md); max-width: 800px; width: 100%; padding: 24px; border: 1px solid var(--border); max-height:90vh; overflow-y:auto; box-shadow: var(--shadow-lg);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom:1px solid var(--border); padding-bottom:8px;">
          <div>
            <h3 style="font-weight: 800; font-size: 1.15rem; color: var(--text-heading); display:flex; align-items:center; gap:8px;">
              <i data-lucide="receipt" style="color:var(--antique-brass);"></i> Requisition Details: ${po.id}
            </h3>
            <span style="font-size:0.75rem; color:var(--text-tertiary);">Created on: ${po.date} | Store: ${po.branchName} | Manager: ${po.managerName}</span>
          </div>
          <button class="proc-action-btn" id="btn-close-details-modal" style="padding: 4px 8px; border: none; font-size: 1.2rem;">&times;</button>
        </div>

        <!-- Timeline -->
        <div style="margin:20px 0; display:flex; justify-content:space-between; align-items:center; position:relative; overflow-x:auto; padding-bottom:10px;">
          <div style="position:absolute; left:20px; right:20px; top:12px; height:2px; background:var(--border); z-index:1;"></div>
          ${statuses.map((st, idx) => {
            const isActive = idx <= currentStatusIdx;
            const isCurrent = idx === currentStatusIdx;
            const color = isCurrent ? 'var(--antique-brass)' : (isActive ? 'var(--success)' : 'var(--text-tertiary)');
            const bg = isActive ? (isCurrent ? 'var(--antique-brass)' : 'var(--success)') : 'var(--bg-app)';
            const border = isCurrent ? 'var(--antique-brass)' : (isActive ? 'var(--success)' : 'var(--border)');
            return `
              <div style="display:flex; flex-direction:column; align-items:center; gap:6px; z-index:2; position:relative; flex:1;">
                <div style="width:24px; height:24px; border-radius:50%; background:${bg}; border:2px solid ${border}; display:flex; align-items:center; justify-content:center; color:#FFF; font-size:0.65rem; font-weight:800; box-shadow:var(--shadow-sm);">
                  ${isActive ? '✓' : idx + 1}
                </div>
                <span style="font-size:0.7rem; font-weight:700; color:${color};">${st}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:20px; margin-top:20px;">
          <!-- Left: Invoice Sheet -->
          <div style="border: 1px solid var(--border); border-radius:8px; padding:16px; background:rgba(46,35,31,0.02); display:flex; flex-direction:column; gap:16px;">
            <!-- Brand & Info Header -->
            <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border); padding-bottom:12px;">
              <div>
                <strong style="color:var(--orange-primary); font-size:1.1rem; letter-spacing:0.5px;">BADI KATORI</strong>
                <div style="font-size:0.65rem; color:var(--text-tertiary); text-transform:uppercase; margin-top:2px;">Luxury Operations</div>
              </div>
              <div style="text-align:right; font-size:0.75rem; color:var(--text-secondary);">
                <div>PO Ref: <strong>${po.id}</strong></div>
                <div>Expected: <strong>${po.expectedDeliveryDate || 'N/A'}</strong></div>
              </div>
            </div>

            <!-- Supplier -->
            <div style="font-size:0.75rem; color:var(--text-secondary);">
              <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px; text-transform:uppercase; font-size:0.7rem;">Supplier Details</div>
              <div>Name: <strong>${supplierInfo.name}</strong></div>
              <div>Contact: ${supplierInfo.contactPerson} (${supplierInfo.mobileNumber})</div>
              <div>GSTIN: <span style="font-family:monospace;">${supplierInfo.gstNumber || 'N/A'}</span></div>
            </div>

            <!-- Items -->
            <div>
              <div style="font-weight:700; color:var(--text-primary); margin-bottom:6px; text-transform:uppercase; font-size:0.7rem;">Order Items</div>
              <table class="saas-table" style="font-size:0.75rem; background:#FFF; border-radius:6px; border:1px solid var(--border);">
                <thead>
                  <tr style="background:var(--bg-app); font-weight:800;">
                    <th style="padding:6px 8px;">Item Name</th>
                    <th style="padding:6px 8px; text-align:right;">Qty</th>
                    <th style="padding:6px 8px; text-align:right;">Rate</th>
                    <th style="padding:6px 8px; text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${po.items.map(it => `
                    <tr>
                      <td style="padding:6px 8px;"><strong>${it.productName}</strong></td>
                      <td style="padding:6px 8px; text-align:right;">${it.quantity} ${it.unit || 'units'}</td>
                      <td style="padding:6px 8px; text-align:right;">₹${it.rate.toFixed(2)}</td>
                      <td style="padding:6px 8px; text-align:right; font-weight:700;">₹${it.amount.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Totals -->
            <div style="align-self:flex-end; width:100%; max-width:220px; font-size:0.78rem; display:flex; flex-direction:column; gap:4px; border-top:1px dashed var(--border); padding-top:8px;">
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-tertiary);">Subtotal:</span>
                <span>${formatINR(po.subtotal)}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-tertiary);">GST (18%):</span>
                <span>${formatINR(po.gst)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-weight:800; font-size:0.85rem; border-top:1px solid var(--border); padding-top:4px; margin-top:4px;">
                <span>Grand Total:</span>
                <span style="color:var(--orange-primary);">${formatINR(po.grandTotal)}</span>
              </div>
            </div>

            <!-- Remarks -->
            <div style="font-size:0.75rem; border-top:1px dashed var(--border); padding-top:8px;">
              <div>Public Notes: <span style="color:var(--text-secondary); font-style:italic;">${po.notes || 'None'}</span></div>
              <div style="margin-top:4px;">Internal Remarks: <span style="color:var(--text-secondary); font-style:italic;">${po.internalRemarks || 'None'}</span></div>
            </div>
          </div>

          <!-- Right: Control Panel & QR -->
          <div style="display:flex; flex-direction:column; gap:16px;">
            <!-- QR Box -->
             <div style="background:#FFF; border:1px solid var(--border); border-radius:8px; padding:16px; text-align:center; display:flex; flex-direction:column; align-items:center;">
              <div style="font-weight:800; font-size:0.8rem; color:var(--text-primary); margin-bottom:8px;">PO QR Verification Code</div>
              
              <!-- Secure QR Code -->
              <div style="padding:12px; background:#FFF; border:1px solid var(--border); border-radius:8px; box-shadow:var(--shadow-sm); width:150px; height:150px; display:flex; justify-content:center; align-items:center;">
                <img id="po-qr-image" src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(JSON.stringify({ poId: po.id, supplierId: po.supplierId, total: po.grandTotal }))}" alt="PO QR" style="width:130px; height:130px; border-radius:4px;">
              </div>
              <span style="font-size:0.65rem; color:var(--text-tertiary); margin-top:8px;">Scan with warehouse audit scanner to verify authenticity.</span>
            </div>

            <!-- PDF Download -->
            <button class="proc-btn" id="btn-download-pdf-po" style="width:100%; justify-content:center; background:rgba(194, 159, 104, 0.1); color:var(--antique-brass); border-color:var(--antique-brass);">
              <i data-lucide="download"></i> Download Official PO PDF
            </button>

            <!-- WhatsApp Testing Trigger -->
            <div style="border:1px solid var(--border); border-radius:8px; padding:12px; background:rgba(46,35,31,0.02);">
              <div style="font-weight:700; font-size:0.75rem; color:var(--text-secondary); margin-bottom:8px; display:flex; align-items:center; gap:4px;">
                <i data-lucide="message-square" style="color:#25D366; width:14px; height:14px;"></i> WhatsApp Integration Previews
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <button class="proc-btn ws-trigger" data-type="purchase_order" style="font-size:0.7rem; padding:4px 6px;">Send PO</button>
                <button class="proc-btn ws-trigger" data-type="reminder" style="font-size:0.7rem; padding:4px 6px;">Send Reminder</button>
                <button class="proc-btn ws-trigger" data-type="delivery_reminder" style="font-size:0.7rem; padding:4px 6px;">Delivery Alerts</button>
                <button class="proc-btn ws-trigger" data-type="payment_reminder" style="font-size:0.7rem; padding:4px 6px;">Pay Reminder</button>
              </div>
            </div>

            <!-- Workflow Approval Controller -->
            <div style="border:1px solid var(--border); border-radius:8px; padding:12px; background:rgba(46,35,31,0.02);">
              <div style="font-weight:700; font-size:0.75rem; color:var(--text-secondary); margin-bottom:8px;">Workflow Approvals Board</div>
              <div style="display:flex; flex-direction:column; gap:8px;" id="po-approval-buttons-box">
                <!-- Buttons rendered dynamically -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Close modal listener
    const closeModal = () => div.remove();
    document.getElementById('btn-close-details-modal').addEventListener('click', closeModal);

    // Download PDF PO
    document.getElementById('btn-download-pdf-po').addEventListener('click', () => {
      const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
      const token = localStorage.getItem("bk_jwt_token") || localStorage.getItem("bk_token") || "";
      window.open(`${apiBase}/api/pos/requisitions/${po.id}/pdf?token=${encodeURIComponent(token)}`, '_blank');
    });

    // WhatsApp Message Triggers
    div.querySelectorAll('.ws-trigger').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.getAttribute('data-type');
        const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
        try {
          btn.disabled = true;
          const originalText = btn.innerHTML;
          btn.innerHTML = 'Sending...';
          const res = await fetch(`${apiBase}/api/pos/requisitions/${po.id}/whatsapp-trigger`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ type })
          });
          if (!res.ok) throw new Error('WhatsApp trigger failed');
          showToast('Message Queued', `WhatsApp ${type.replace('_',' ')} recorded in logs.`, 'success');
        } catch (err) {
          showToast('Trigger failed', err.message, 'danger');
        } finally {
          btn.disabled = false;
          btn.innerHTML = type.replace('_',' ');
        }
      });
    });

    // Render approval/workflow action buttons
    const approvalsBox = document.getElementById('po-approval-buttons-box');
    if (approvalsBox) {
      approvalsBox.innerHTML = '';
      
      const updateStatus = async (newStatus, notesStr) => {
        const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
        try {
          const res = await fetch(`${apiBase}/api/pos/requisitions/${po.id}/status`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ status: newStatus, notes: notesStr })
          });
          if (!res.ok) throw new Error('Fails status transition');
          showToast('Status Updated', `PO status transitioned to ${newStatus}.`, 'success');
          closeModal();
          
          // Refresh list
          await fetchPOList();
          renderPOListTable(document.getElementById('filter-po-status').value);
        } catch(e) {
          showToast('Fails status update', e.message, 'danger');
        }
      };

      if (po.orderStatus === 'Draft') {
        approvalsBox.innerHTML = `
          <button class="proc-btn primary" id="btn-wf-review">Submit for Review</button>
          <button class="proc-btn" id="btn-wf-cancel" style="color:var(--danger); border-color:var(--danger);">Cancel PO</button>
        `;
        document.getElementById('btn-wf-review').addEventListener('click', () => updateStatus('Review', 'Requisition sent for manager review.'));
        document.getElementById('btn-wf-cancel').addEventListener('click', () => updateStatus('Cancelled', 'Purchase order cancelled in draft phase.'));
      }
      else if (po.orderStatus === 'Review') {
        approvalsBox.innerHTML = `
          <button class="proc-btn primary" id="btn-wf-approve">Approve Purchase Order</button>
          <button class="proc-btn" id="btn-wf-cancel" style="color:var(--danger); border-color:var(--danger);">Reject / Cancel</button>
        `;
        document.getElementById('btn-wf-approve').addEventListener('click', () => updateStatus('Approved', 'Purchase order approved by branch manager.'));
        document.getElementById('btn-wf-cancel').addEventListener('click', () => updateStatus('Cancelled', 'Purchase order rejected during review.'));
      }
      else if (po.orderStatus === 'Approved') {
        approvalsBox.innerHTML = `
          <button class="proc-btn primary" id="btn-wf-send"><i data-lucide="send"></i> Mark as Sent to Supplier</button>
        `;
        document.getElementById('btn-wf-send').addEventListener('click', () => updateStatus('Sent', 'Purchase order sent to supplier for fulfillment.'));
      }
      else if (po.orderStatus === 'Sent') {
        approvalsBox.innerHTML = `
          <button class="proc-btn primary" id="btn-wf-accept">Supplier Accepted Order</button>
          <button class="proc-btn" id="btn-wf-reject" style="color:var(--danger); border-color:var(--danger);">Supplier Rejected Order</button>
        `;
        document.getElementById('btn-wf-accept').addEventListener('click', () => updateStatus('Accepted', 'Supplier accepted order and scheduled delivery.'));
        document.getElementById('btn-wf-reject').addEventListener('click', () => updateStatus('Rejected', 'Supplier rejected order due to stock shortages.'));
      }
      else if (po.orderStatus === 'Accepted') {
        approvalsBox.innerHTML = `
          <button class="proc-btn primary" id="btn-wf-deliver">Mark as Delivered</button>
        `;
        document.getElementById('btn-wf-deliver').addEventListener('click', () => updateStatus('Delivered', 'Shipment arrived at store. Awaiting inventory check.'));
      }
      else if (po.orderStatus === 'Delivered') {
        approvalsBox.innerHTML = `
          <button class="proc-btn primary" id="btn-wf-complete">Approve Audit &amp; Complete (Update Stock)</button>
        `;
        document.getElementById('btn-wf-complete').addEventListener('click', () => updateStatus('Completed', 'Fulfillment audited. Stock values added to inventory.'));
      }
      else {
        approvalsBox.innerHTML = `<div style="text-align:center; font-size:0.75rem; color:var(--text-tertiary); font-style:italic;">Order is ${po.orderStatus}. No actions possible.</div>`;
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }

  // 3. Supplier Add/Edit Modal Form helper
  function openSupplierModal(supplier = null) {
    const isEdit = !!supplier;
    const modalId = 'modal-proc-supplier-form';
    
    // Remove existing if any
    document.getElementById(modalId)?.remove();

    const div = document.createElement('div');
    div.id = modalId;
    div.className = 'saas-modal';
    div.style.cssText = 'display: flex; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999;';
    
    div.innerHTML = `
      <div class="saas-modal-card" style="background: var(--bg-card); border-radius: var(--radius-md); max-width: 550px; width: 100%; padding: 24px; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom:1px solid var(--border); padding-bottom:8px;">
          <h3 style="font-weight: 800; font-size: 1.15rem; color: var(--text-heading); display:flex; align-items:center; gap:8px;">
            <i data-lucide="user-plus" style="color:var(--antique-brass);"></i> ${isEdit ? 'Edit Supplier Record' : 'Register New Supplier'}
          </h3>
          <button class="proc-action-btn" id="btn-close-sup-modal" style="padding: 4px 8px; border: none; font-size: 1.2rem;">&times;</button>
        </div>
        
        <form id="supplier-form" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:0.8rem;">
          <div>
            <label class="proc-form-label">Supplier/Business Name *</label>
            <input type="text" class="saas-form-control" name="name" value="${supplier?.name || ''}" required style="width:100%;">
          </div>
          <div>
            <label class="proc-form-label">Contact Person Name *</label>
            <input type="text" class="saas-form-control" name="contactPerson" value="${supplier?.contactPerson || ''}" required style="width:100%;">
          </div>
          <div>
            <label class="proc-form-label">Mobile Number *</label>
            <input type="text" class="saas-form-control" name="mobileNumber" value="${supplier?.mobileNumber || ''}" required style="width:100%;">
          </div>
          <div>
            <label class="proc-form-label">WhatsApp Number *</label>
            <input type="text" class="saas-form-control" name="whatsappNumber" value="${supplier?.whatsappNumber || ''}" required style="width:100%;">
          </div>
          <div style="grid-column: span 2;">
            <label class="proc-form-label">Email Address</label>
            <input type="email" class="saas-form-control" name="email" value="${supplier?.email || ''}" style="width:100%;">
          </div>
          <div>
            <label class="proc-form-label">GST Number (GSTIN)</label>
            <input type="text" class="saas-form-control" name="gstNumber" value="${supplier?.gstNumber || ''}" placeholder="e.g. 24AAACB1234F1Z5" style="width:100%; font-family:monospace;">
          </div>
          <div>
            <label class="proc-form-label">Payment Terms</label>
            <select class="saas-form-control" name="paymentTerms" style="width:100%;">
              <option value="COD" ${supplier?.paymentTerms === 'COD' ? 'selected' : ''}>COD (Cash on Delivery)</option>
              <option value="Net 15" ${supplier?.paymentTerms === 'Net 15' ? 'selected' : ''}>Net 15</option>
              <option value="Net 30" ${supplier?.paymentTerms === 'Net 30' ? 'selected' : ''}>Net 30</option>
              <option value="Upfront" ${supplier?.paymentTerms === 'Upfront' ? 'selected' : ''}>Upfront Payment</option>
            </select>
          </div>
          <div>
            <label class="proc-form-label">Delivery Days (Lead Time)</label>
            <input type="number" class="saas-form-control" name="deliveryDays" value="${supplier?.deliveryDays || 3}" min="1" style="width:100%;">
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:20px;">
            <input type="checkbox" name="isPreferred" id="chk-pref" ${supplier?.isPreferred ? 'checked' : ''} style="width:16px; height:16px;">
            <label for="chk-pref" style="font-weight:700; cursor:pointer;">Mark as Preferred Supplier</label>
          </div>
          <div style="grid-column: span 2;">
            <label class="proc-form-label">Address</label>
            <textarea class="saas-form-control" name="address" style="width:100%; height:45px; resize:none;">${supplier?.address || ''}</textarea>
          </div>
          <div style="grid-column: span 2;">
            <label class="proc-form-label">Notes</label>
            <textarea class="saas-form-control" name="notes" style="width:100%; height:45px; resize:none;">${supplier?.notes || ''}</textarea>
          </div>
          
          <div style="grid-column: span 2; display: flex; gap: 8px; justify-content: flex-end; border-top:1px solid var(--border); padding-top:16px; margin-top:12px;">
            <button type="button" class="saas-btn saas-btn-secondary" id="btn-cancel-sup-modal">Cancel</button>
            <button type="submit" class="saas-btn saas-btn-primary">${isEdit ? 'Save Changes' : 'Register'}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Close listeners
    const closeModal = () => div.remove();
    document.getElementById('btn-close-sup-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-sup-modal').addEventListener('click', closeModal);

    // Form submit listener
    document.getElementById('supplier-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get('name'),
        contactPerson: fd.get('contactPerson'),
        mobileNumber: fd.get('mobileNumber'),
        whatsappNumber: fd.get('whatsappNumber'),
        email: fd.get('email'),
        gstNumber: fd.get('gstNumber'),
        paymentTerms: fd.get('paymentTerms'),
        deliveryDays: parseInt(fd.get('deliveryDays')) || 3,
        isPreferred: fd.get('isPreferred') === 'on',
        address: fd.get('address'),
        notes: fd.get('notes'),
        status: supplier?.status || 'Active'
      };

      const apiBase = (window.bk_state && window.bk_state.API_BASE) || '';
      const url = isEdit ? `${apiBase}/api/suppliers/${supplier.id}` : `${apiBase}/api/suppliers`;
      const method = isEdit ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method,
          headers: getAuthHeader(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Server error registering supplier');
        showToast('Supplier Saved', `Supplier records updated successfully.`, 'success');
        closeModal();
        switchTab('suppliers');
      } catch(err) {
        showToast('Error saving supplier', err.message, 'danger');
      }
    });
  }

  // Generate Toast notifications matching the luxury SaaS theme
  function showToast(title, message, icon = 'info') {
    let container = document.getElementById("proc-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "proc-toast-container";
      container.style.position = "fixed";
      container.style.bottom = "24px";
      container.style.right = "24px";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "10px";
      container.style.zIndex = "99999";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.style.background = "linear-gradient(135deg, #2E231F 0%, #1A120F 100%)";
    toast.style.border = "1px solid rgba(194, 159, 104, 0.4)";
    toast.style.color = "#FFFFFF";
    toast.style.padding = "16px 20px";
    toast.style.borderRadius = "10px";
    toast.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
    toast.style.display = "flex";
    toast.style.gap = "12px";
    toast.style.alignItems = "center";
    toast.style.minWidth = "300px";
    toast.style.maxWidth = "450px";
    toast.style.transform = "translateY(20px)";
    toast.style.opacity = "0";
    toast.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

    let iconSvg = `<i data-lucide="bell" style="color: var(--antique-brass); width: 20px; height: 20px;"></i>`;
    if (icon === "success") {
      iconSvg = `<i data-lucide="check-circle" style="color: var(--success); width: 20px; height: 20px;"></i>`;
    } else if (icon === "danger") {
      iconSvg = `<i data-lucide="alert-triangle" style="color: var(--danger); width: 20px; height: 20px;"></i>`;
    }

    toast.innerHTML = `
      <div style="flex-shrink: 0;">${iconSvg}</div>
      <div style="flex-grow: 1;">
        <div style="font-weight: 800; font-size: 0.85rem; color: #FFF; margin-bottom: 2px;">${title}</div>
        <div style="font-size: 0.72rem; color: #D5CECB; line-height: 1.3;">${message}</div>
      </div>
      <button style="background: none; border: none; color: #A89F9B; cursor: pointer; font-size: 1.1rem; line-height: 1;" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    setTimeout(() => {
      toast.style.transform = "translateY(0)";
      toast.style.opacity = "1";
    }, 50);

    setTimeout(() => {
      toast.style.transform = "translateY(-20px)";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  // Styles Injection
  function injectStyles() {
    const styleId = 'proc-custom-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .proc-container {
        padding: 24px;
        background: radial-gradient(circle at top, #FAF6F0 0%, #FAF6F0 100%);
        min-height: 80vh;
      }
      .proc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--border);
        padding-bottom: 16px;
        margin-bottom: 24px;
      }
      .proc-header-actions {
        display: flex;
        gap: 12px;
      }
      .proc-tabs {
        display: flex;
        gap: 8px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 2px;
        overflow-x: auto;
      }
      .proc-tab-btn {
        background: transparent;
        border: none;
        border-bottom: 3px solid transparent;
        padding: 10px 16px;
        font-weight: 700;
        font-size: 0.82rem;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .proc-tab-btn i, .proc-tab-btn svg {
        width: 14px;
        height: 14px;
      }
      .proc-tab-btn:hover {
        color: var(--text-primary);
        background: rgba(46,35,31,0.02);
      }
      .proc-tab-btn.active {
        color: var(--antique-brass);
        border-bottom-color: var(--antique-brass);
      }
      .proc-grid-kpi {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
      }
      .proc-kpi-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 20px;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: all 0.2s ease;
      }
      .kpi-header {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 800;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: var(--text-tertiary);
      }
      .kpi-icon {
        width: 14px;
        height: 14px;
      }
      .kpi-val {
        font-size: 1.6rem;
        font-weight: 800;
        color: var(--text-primary);
      }
      .kpi-desc {
        font-size: 0.68rem;
        color: var(--text-secondary);
      }
      .text-gold .kpi-val, .text-gold .kpi-icon { color: var(--antique-brass); }
      .text-warning .kpi-val, .text-warning .kpi-icon { color: var(--warning); }
      .text-danger .kpi-val, .text-danger .kpi-icon { color: var(--danger); }
      .text-success .kpi-val, .text-success .kpi-icon { color: var(--success); }
      
      .proc-workspace-grid {
        display: grid;
        grid-template-columns: 1.7fr 1.1fr;
        gap: 24px;
        align-items: start;
      }
      .proc-glass-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 24px;
        box-shadow: var(--shadow-sm);
      }
      .card-header {
        font-size: 0.95rem;
        font-weight: 800;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .alert-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid var(--border);
        font-size: 0.8rem;
        gap: 12px;
      }
      .alert-item.danger {
        background: rgba(239, 68, 68, 0.04);
        border-left: 4px solid var(--danger);
      }
      .alert-item.warning {
        background: rgba(166, 75, 42, 0.04);
        border-left: 4px solid var(--warning);
      }
      .alert-title {
        font-weight: 800;
        color: var(--text-primary);
        margin-bottom: 2px;
      }
      .alert-desc {
        font-size: 0.72rem;
        color: var(--text-secondary);
        line-height: 1.4;
      }
      .status-pill {
        font-size: 0.65rem;
        font-weight: 800;
        padding: 4px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: inline-block;
      }
      .status-normal { background: rgba(0,0,0,0.05); color: var(--text-secondary); }
      .status-warning { background: var(--warning-light); color: var(--warning); }
      .status-critical { background: rgba(166, 75, 42, 0.2); color: var(--warning); }
      .status-danger { background: var(--danger-light); color: var(--danger); }
      .status-success { background: var(--success-light); color: var(--success); }

      .proc-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        font-size: 0.8rem;
        font-weight: 700;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--bg-card);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .proc-btn:hover:not(:disabled) {
        background: var(--bg-app);
        color: var(--text-primary);
        border-color: var(--text-tertiary);
      }
      .proc-btn.primary {
        background: var(--orange-primary);
        color: #FFFFFF;
        border-color: var(--orange-primary);
      }
      .proc-btn.primary:hover:not(:disabled) {
        background: var(--orange-hover);
        border-color: var(--orange-hover);
      }
      .proc-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .proc-form-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--text-secondary);
        margin-bottom: 4px;
        display: block;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .proc-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(194, 159, 104, 0.15);
        border-radius: 50%;
        border-top-color: var(--antique-brass);
        animation: procSpin 0.8s linear infinite;
      }
      
      @keyframes procSpin {
        to { transform: rotate(360deg); }
      }
      .proc-spin {
        animation: procSpin 1s linear infinite;
      }
      
      /* Toast outbox overrides */
      #proc-toast-container .lucide-icon {
        vertical-align: middle;
      }
    `;
    document.head.appendChild(style);
  }

})();
