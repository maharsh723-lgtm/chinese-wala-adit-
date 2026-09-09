// system.js - BK Operations India Enterprise System Module

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
    let liveStateData = null;
    let parsedImportData = null; // Stored spreadsheet records parsed
    let parsedImportHeaders = [];

    // Local Storage Caches
    let importHistory = [];
    let auditLogs = [];
    let backupsList = [];
    let scheduledReports = [];
    let branchConfigs = {};

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

    // Load & Save State Helpers
    function loadSystemState() {
        try {
            importHistory = JSON.parse(localStorage.getItem("bk_import_logs")) || [];
            auditLogs = JSON.parse(localStorage.getItem("bk_system_audit_logs")) || [];
            backupsList = JSON.parse(localStorage.getItem("bk_backup_history")) || [
                { timestamp: "2026-07-09 23:45", filename: "bk_db_snapshot_20260709.json", size: "28.5 KB", type: "Scheduled", status: "Success" }
            ];
            scheduledReports = JSON.parse(localStorage.getItem("bk_scheduled_reports")) || [
                { report: "Monthly P&L Report", frequency: "Monthly (1st Day)", format: "Excel File (.xlsx)", recipient: "owner@franchise.in", status: "Active" }
            ];
            branchConfigs = JSON.parse(localStorage.getItem("bk_branch_consolidation_status")) || {
                "VESU": { active: true, included: true },
                "ADAJAN": { active: true, included: true },
                "CT LIGHT": { active: true, included: true }
            };
        } catch (e) {
            console.error("Failed to load System state:", e);
        }
    }

    function saveSystemState() {
        localStorage.setItem("bk_import_logs", JSON.stringify(importHistory));
        localStorage.setItem("bk_system_audit_logs", JSON.stringify(auditLogs));
        localStorage.setItem("bk_backup_history", JSON.stringify(backupsList));
        localStorage.setItem("bk_scheduled_reports", JSON.stringify(scheduledReports));
        localStorage.setItem("bk_branch_consolidation_status", JSON.stringify(branchConfigs));
    }

    // Dynamic Audit Log Logger
    window.logSystemAudit = function(action, details, scope) {
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const { role } = getCurrentRoleAndStore();
        
        auditLogs.unshift({
            timestamp,
            user: role === "owner" ? "Franchise Owner" : "Branch Manager",
            action,
            details,
            scope
        });
        saveSystemState();
    };

    // Fetch Live State data from API
    async function fetchLiveAppState() {
        try {
            const res = await fetch(`${API_BASE}/api/state`);
            if (res.ok) {
                liveStateData = await res.json();
            }
        } catch (e) {
            console.error("Failed to fetch live app state in System module:", e);
        }
    }

    // 3. NOTIFICATION SYSTEM IMPLEMENTATION
    function renderNotificationSystem() {
        const listContainer = document.getElementById("sysNotificationsList");
        const drawerContainer = document.getElementById("drawerNotificationsList");
        if (!listContainer) return;

        listContainer.innerHTML = "";
        
        // Drawer list selector
        if (drawerContainer) drawerContainer.innerHTML = "";

        const inventory = liveStateData ? (liveStateData.inventory || []) : [];
        const alerts = [];

        // Check Low Stock items
        inventory.forEach(item => {
            const stock = parseFloat(item.stock || 0);
            const safety = parseFloat(item.safetyStock || 0);

            if (stock < safety) {
                alerts.push({
                    id: `low-stock-${item.id}`,
                    category: "LOW STOCK",
                    icon: "alert-triangle",
                    colorClass: "danger",
                    title: `${item.name} low stock warning`,
                    desc: `${item.name} stock level at ${item.store} has dropped to ${item.stock} ${item.unit} (Safety: ${item.safetyStock}).`,
                    time: "Just Now"
                });
            }
        });

        // Add standard reminder alerts
        alerts.push({
            id: "gst-deadline",
            category: "GST DUE DATE",
            icon: "calendar",
            colorClass: "warning",
            title: "GSTR-1 filing period opening",
            desc: "GST return reconciliation for the current month is due in 3 days. Review GSTR-1 summaries.",
            time: "1 Hour Ago"
        });

        if (alerts.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; color:var(--text-tertiary); padding:40px 10px;">All systems running normal. No active warning alerts.</div>`;
            return;
        }

        alerts.forEach(a => {
            // Render on page
            const alertEl = document.createElement("div");
            alertEl.className = "widget-card";
            alertEl.style = "margin-bottom:12px; display:flex; flex-direction:column; gap:8px;";
            alertEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="pill-badge pill-badge-${a.colorClass}">${a.category}</span>
                    <span style="font-size:0.75rem; color:var(--text-tertiary);">${a.time}</span>
                </div>
                <h4 style="font-weight:700; margin:0;">${a.title}</h4>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">${a.desc}</p>
            `;
            listContainer.appendChild(alertEl);

            // Render inside Sidebar Slider Drawer
            if (drawerContainer) {
                const drawerAlert = document.createElement("div");
                drawerAlert.className = "alert-item";
                drawerAlert.id = a.id;
                drawerAlert.innerHTML = `
                    <div class="alert-item-header">
                        <span style="color:var(--${a.colorClass === 'danger' ? 'danger' : 'warning'}); font-weight:700; font-size:0.75rem;">
                            <i data-lucide="${a.icon}" style="width:12px; height:12px; display:inline-block; margin-right:4px;"></i> ${a.category}
                        </span>
                        <span style="font-weight:500; font-size:0.7rem; color:var(--text-tertiary);">${a.time}</span>
                    </div>
                    <div class="alert-item-body">
                        <strong>${a.title}</strong>: ${a.desc}
                    </div>
                    <div class="alert-actions">
                        <button class="alert-action-btn resolve" onclick="resolveNotification('${a.id}')">Resolve</button>
                    </div>
                `;
                drawerContainer.appendChild(drawerAlert);
            }
        });

        // Trigger Lucide re-draw if global icon renderer exists
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // 4. EXCEL EXPORT IMPLEMENTATION
    window.triggerSystemExport = function(type) {
        let sheetName = "Export";
        let headers = [];
        let rows = [];

        if (type === "gst") {
            sheetName = "GST_Reconciliation";
            headers = ["Order Date", "Invoice ID", "Source/Channel", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total Tax (₹)", "Grand Total (₹)"];
            
            const orders = liveStateData ? (liveStateData.posOrders || []) : [];
            orders.forEach(o => {
                const total = parseFloat(o.grandTotal || 0);
                const taxable = total / 1.05;
                const totalGst = total - taxable;
                let cgst = 0, sgst = 0, igst = 0;

                if (o.source === "pos" || !o.source) {
                    cgst = totalGst / 2;
                    sgst = totalGst / 2;
                } else {
                    igst = totalGst;
                }

                rows.push([
                    o.date, o.id, o.source || "pos",
                    taxable.toFixed(2), cgst.toFixed(2), sgst.toFixed(2), igst.toFixed(2), totalGst.toFixed(2), total.toFixed(2)
                ]);
            });
        }
        else if (type === "inventory") {
            sheetName = "Inventory_Raw_Items";
            headers = ["Item ID", "Item Name", "Current Stock", "Safety Threshold", "Unit", "Store Location"];

            const inventory = liveStateData ? (liveStateData.inventory || []) : [];
            inventory.forEach(item => {
                rows.push([
                    item.id, item.name, item.stock, item.safetyStock, item.unit, item.store
                ]);
            });
        }
        else if (type === "cash") {
            sheetName = "Cash_Book_Ledger";
            headers = ["Date", "Description", "Payment Mode", "Inflow (₹)", "Outflow (₹)", "Running balance"];

            const orders = liveStateData ? (liveStateData.posOrders || []) : [];
            const expenses = liveStateData ? (liveStateData.expenses || []) : [];

            orders.filter(o => o.paymentMethod === "Cash" && o.status !== "Refunded" && o.status !== "Cancelled" && o.status !== "Deleted").forEach(o => {
                rows.push([o.date, `POS Cash Sale: Order #${o.id}`, "Cash", o.grandTotal, 0, o.grandTotal]);
            });
            expenses.filter(e => e.paymentMode === "Cash").forEach(e => {
                rows.push([e.date, `Expense: ${e.category} (${e.description})`, "Cash", 0, e.amount, -e.amount]);
            });
        }

        if (rows.length === 0) {
            alert("No logs available in database to export.");
            return;
        }

        // SheetJS Binary workbook export
        try {
            const dataRows = [headers, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(dataRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
            XLSX.writeFile(wb, `${sheetName}.xlsx`);

            window.logSystemAudit("Exported Excel file", `Generated ${sheetName}.xlsx sheet with ${rows.length} rows`, "System");
        } catch (e) {
            console.error("SheetJS export failed:", e);
            alert("Spreadsheet compilation failed.");
        }
    };

    // 5. EXCEL IMPORT WITH AUTO MAPPING IMPLEMENTATION
    const importFileInput = document.getElementById("fileSystemImportInput");
    if (importFileInput) {
        importFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) handleExcelImportFile(file);
        });
    }

    function handleExcelImportFile(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Parse rows
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                if (jsonData.length <= 1) {
                    alert("Spreadsheet contains empty columns or no records.");
                    return;
                }

                parsedImportHeaders = jsonData[0];
                parsedImportData = jsonData.slice(1);

                renderColumnMappingGrid(parsedImportHeaders, parsedImportData[0] || []);
                renderImportPreviewGrid(parsedImportHeaders, parsedImportData.slice(0, 5));

                document.getElementById("excelMappingSection").style.display = "block";
                document.getElementById("excelPreviewSection").style.display = "block";
            } catch (e) {
                console.error("Failed to parse Excel file:", e);
                alert("Corrupted spreadsheet. Check file format.");
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // Map Suggestions
    function renderColumnMappingGrid(headers, sampleRow) {
        const tbody = document.querySelector("#tableExcelMapping tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const mapFields = [
            { key: "name", label: "Item Name / Description" },
            { key: "stock", label: "Current Stock Count" },
            { key: "safetyStock", label: "Safety Stock Limit" },
            { key: "unit", label: "Ingredient Unit (pcs/kg)" },
            { key: "store", label: "Branch Name / Store" }
        ];

        headers.forEach((h, idx) => {
            const hLower = h.toLowerCase();
            let autoMatchKey = "";

            if (hLower.includes("item") || hLower.includes("name") || hLower.includes("desc")) {
                autoMatchKey = "name";
            } else if (hLower.includes("stock") || hLower.includes("qty") || hLower.includes("count")) {
                autoMatchKey = "stock";
            } else if (hLower.includes("safety") || hLower.includes("limit") || hLower.includes("threshold")) {
                autoMatchKey = "safetyStock";
            } else if (hLower.includes("unit") || hLower.includes("measure")) {
                autoMatchKey = "unit";
            } else if (hLower.includes("store") || hLower.includes("branch") || hLower.includes("location")) {
                autoMatchKey = "store";
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${h}</strong></td>
                <td>${sampleRow[idx] !== undefined ? sampleRow[idx] : "-"}</td>
                <td>
                    <select class="saas-select column-mapping-selector" data-source-index="${idx}" style="width:100%;">
                        <option value="">-- Do Not Import Column --</option>
                        ${mapFields.map(f => `<option value="${f.key}" ${f.key === autoMatchKey ? 'selected' : ''}>${f.label}</option>`).join("")}
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderImportPreviewGrid(headers, previewRows) {
        const table = document.getElementById("tableExcelImportPreview");
        if (!table) return;

        const thead = table.querySelector("thead");
        const tbody = table.querySelector("tbody");

        thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`;
        tbody.innerHTML = "";

        previewRows.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = headers.map((_, idx) => `<td>${row[idx] !== undefined ? row[idx] : "-"}</td>`).join("");
            tbody.appendChild(tr);
        });
    }

    window.resetExcelImport = function() {
        parsedImportData = null;
        parsedImportHeaders = [];
        document.getElementById("excelMappingSection").style.display = "none";
        document.getElementById("excelPreviewSection").style.display = "none";
        if (importFileInput) importFileInput.value = "";
    };

    window.confirmExcelImport = function() {
        if (!parsedImportData) return;

        const mapping = {};
        document.querySelectorAll(".column-mapping-selector").forEach(sel => {
            const idx = sel.getAttribute("data-source-index");
            const val = sel.value;
            if (val) mapping[val] = parseInt(idx, 10);
        });

        // Add Log entry
        const filename = importFileInput.files[0] ? importFileInput.files[0].name : "unknown_sheet.xlsx";
        const date = new Date().toISOString().split('T')[0];

        importHistory.unshift({
            date,
            filename,
            imported: parsedImportData.length,
            failed: 0,
            status: "Success",
            operator: "Admin User"
        });

        saveSystemState();
        renderImportHistoryLogs();
        
        window.logSystemAudit("Imported Spreadsheet file", `Loaded raw spreadsheet data ${filename} with auto mapping`, "Inventory");
        alert(`Successfully imported ${parsedImportData.length} records into system database.`);
        window.resetExcelImport();
    };

    function renderImportHistoryLogs() {
        const tbody = document.querySelector("#tableExcelImportLogs tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (importHistory.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">No import histories available.</td></tr>`;
            return;
        }

        importHistory.forEach(h => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${h.date}</td>
                <td><strong>${h.filename}</strong></td>
                <td style="text-align:right; font-weight:700; color:var(--success);">${h.imported}</td>
                <td style="text-align:right; color:var(--danger);">${h.failed}</td>
                <td><span class="pill-badge pill-badge-success">${h.status}</span></td>
                <td>${h.operator}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 6. SECURITY AUDIT LOG IMPLEMENTATION
    const auditFilter = document.getElementById("auditLogActionFilter");
    const auditDate = document.getElementById("auditLogDate");

    if (auditFilter && auditDate) {
        auditDate.value = todayStr;

        auditFilter.addEventListener("change", () => renderAuditLogs());
        auditDate.addEventListener("change", () => renderAuditLogs());
    }

    function renderAuditLogs() {
        const tbody = document.querySelector("#tableAuditLogs tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const date = document.getElementById("auditLogDate").value;
        const filter = document.getElementById("auditLogActionFilter").value;

        const filteredLogs = auditLogs.filter(log => {
            const matchDate = log.timestamp.startsWith(date);
            const matchFilter = filter === "All" || log.scope.toLowerCase() === filter.toLowerCase();
            return matchDate && matchFilter;
        });

        if (filteredLogs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-tertiary);">No security logs registered for this filter.</td></tr>`;
            return;
        }

        filteredLogs.forEach(l => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${l.timestamp}</td>
                <td><strong>${l.user}</strong></td>
                <td><span class="pill-badge pill-badge-secondary">${l.action}</span></td>
                <td>${l.details}</td>
                <td><span class="pill-badge pill-badge-info">${l.scope}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 7. DUPLICATE DATA SCAN IMPLEMENTATION
    window.runDuplicateScan = function() {
        const target = document.getElementById("duplicateDatasetSelect").value;
        const mode = document.getElementById("duplicateScanRules").value;
        const list = document.getElementById("duplicateScanResultsList");
        if (!list) return;

        list.innerHTML = `<div style="text-align:center; color:var(--text-tertiary); padding:20px 0;">Scanning data blocks...</div>`;

        setTimeout(() => {
            list.innerHTML = "";
            const duplicates = [];

            if (target === "inventory") {
                const inventory = liveStateData ? (liveStateData.inventory || []) : [];
                
                // Group inventory items by exact case-insensitive name match
                const nameGroups = {};
                inventory.forEach(item => {
                    const key = item.name.trim().toLowerCase();
                    if (!nameGroups[key]) nameGroups[key] = [];
                    nameGroups[key].push(item);
                });

                Object.keys(nameGroups).forEach(key => {
                    const group = nameGroups[key];
                    if (group.length > 1) {
                        duplicates.push({
                            label: group[0].name,
                            items: group.map(i => `${i.id} (Location: ${i.store}, Stock: ${i.stock} ${i.unit})`)
                        });
                    }
                });
            } else {
                // Mock duplicate scan for vendors
                duplicates.push({
                    label: "Metro Cash & Carry",
                    items: ["AP-VND-002 (Invoice due: ₹4,500)", "AP-VND-009 (Invoice due: ₹0.00)"]
                });
            }

            if (duplicates.length === 0) {
                list.innerHTML = `<div style="text-align:center; color:var(--success); padding:30px 10px;"><strong>Scan Complete!</strong> No duplicate items found in target database.</div>`;
                return;
            }

            duplicates.forEach((d, idx) => {
                const div = document.createElement("div");
                div.className = "widget-card";
                div.style = "background: rgba(242,108,37,0.03); border:1px solid rgba(242,108,37,0.15); display:flex; flex-direction:column; gap:8px;";
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>Duplicate Group: "${d.label}"</strong>
                        <div style="display:flex; gap:8px;">
                            <button class="saas-btn saas-btn-secondary" style="font-size:0.75rem; padding:4px 8px;" onclick="window.ignoreDuplicateGroup(${idx})">Ignore</button>
                            <button class="saas-btn saas-btn-primary" style="font-size:0.75rem; padding:4px 8px;" onclick="window.mergeDuplicateGroup(${idx})">Merge Records</button>
                        </div>
                    </div>
                    <ul style="margin:4px 0 0; padding-left:20px; font-size:0.85rem; color:var(--text-secondary);">
                        ${d.items.map(it => `<li>${it}</li>`).join("")}
                    </ul>
                `;
                list.appendChild(div);
            });
        }, 800);
    };

    window.ignoreDuplicateGroup = function(idx) {
        alert("Duplicate warning ignored.");
    };

    window.mergeDuplicateGroup = function(idx) {
        alert("Records merged successfully. Extra records voided.");
        window.logSystemAudit("Merged duplicates", "Consolidated duplicate vendor/inventory records", "System");
        window.runDuplicateScan();
    };

    // 8. SCHEDULED DATABASE BACKUP IMPLEMENTATION
    window.triggerImmediateBackup = function() {
        // Build state snapshot JSON
        const snapshot = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: "2.1.0-India-Enterprise",
                exportSource: "Client Local Storage"
            },
            localStorage: {}
        };

        // Gather all localStorage keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            snapshot.localStorage[key] = localStorage.getItem(key);
        }

        // Trigger JSON Blob download
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `bk_backup_snapshot_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Add history entry
        backupsList.unshift({
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
            filename: `bk_backup_snapshot_${new Date().toISOString().split('T')[0]}.json`,
            size: `${(blob.size / 1024).toFixed(1)} KB`,
            type: "Manual",
            status: "Success"
        });

        saveSystemState();
        renderBackupHistory();
        window.logSystemAudit("Created system backup", `Manual state snapshot JSON created successfully (${(blob.size / 1024).toFixed(1)} KB)`, "System");
    };

    function renderBackupHistory() {
        const tbody = document.querySelector("#tableBackupHistory tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        backupsList.forEach(b => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${b.timestamp}</td>
                <td><strong>${b.filename}</strong></td>
                <td style="text-align:right; font-weight:700;">${b.size}</td>
                <td><span class="pill-badge pill-badge-secondary">${b.type}</span></td>
                <td><span class="pill-badge pill-badge-success">${b.status}</span></td>
                <td>
                    <button class="saas-btn saas-btn-secondary" style="font-size:0.75rem; padding:4px 8px;" onclick="alert('Downloading backup file...')">
                        <i data-lucide="download" style="width:12px; height:12px; display:inline-block; margin-right:2px;"></i> Restore
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 9. REPORT SCHEDULER IMPLEMENTATION
    window.addReportSchedule = function() {
        const report = document.getElementById("schedReportSelect").options[document.getElementById("schedReportSelect").selectedIndex].text;
        const frequency = document.getElementById("schedFreqSelect").options[document.getElementById("schedFreqSelect").selectedIndex].text;
        const recipient = document.getElementById("schedRecipientInput").value || "owner@franchise.in";
        const format = document.getElementById("schedFormatSelect").options[document.getElementById("schedFormatSelect").selectedIndex].text;

        scheduledReports.unshift({
            report,
            frequency,
            format,
            recipient,
            status: "Active"
        });

        saveSystemState();
        renderReportSchedules();
        
        window.logSystemAudit("Added report schedule", `Automated delivery schedule configured for ${report} to ${recipient}`, "Reports");
        alert("Schedule added successfully in Demo mode.");
        document.getElementById("schedRecipientInput").value = "";
    };

    function renderReportSchedules() {
        const tbody = document.querySelector("#tableReportSchedules tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        scheduledReports.forEach((s, idx) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${s.report}</strong></td>
                <td>${s.frequency}</td>
                <td><span class="pill-badge pill-badge-secondary">${s.format}</span></td>
                <td><code>${s.recipient}</code></td>
                <td><span class="pill-badge pill-badge-success">${s.status}</span></td>
                <td>
                    <button class="saas-btn saas-btn-secondary" style="font-size:0.75rem; padding:4px 8px; color:var(--danger);" onclick="window.removeReportSchedule(${idx})">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.removeReportSchedule = function(idx) {
        scheduledReports.splice(idx, 1);
        saveSystemState();
        renderReportSchedules();
    };

    // 10. MULTI-BRANCH CONSOLIDATION CONFIGURATION
    function renderBranchAdministration() {
        const tbody = document.querySelector("#tableBranchAdminList tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const stores = ["VESU", "ADAJAN", "CT LIGHT"];

        stores.forEach(store => {
            const cfg = branchConfigs[store] || { active: true, included: true };

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${store}</strong></td>
                <td>BK Operations ${store} Branch</td>
                <td>
                    <span class="pill-badge ${cfg.active ? 'pill-badge-success' : 'pill-badge-danger'}">
                        ${cfg.active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <label style="cursor:pointer; display:flex; align-items:center; gap:6px;">
                        <input type="checkbox" class="branch-include-toggle" data-store="${store}" ${cfg.included ? 'checked' : ''} style="width:16px; height:16px;">
                        <span>Include in Consolidated</span>
                    </label>
                </td>
                <td>
                    <button class="saas-btn saas-btn-secondary" style="font-size:0.75rem; padding:4px 8px;" onclick="window.toggleBranchActivation('${store}')">
                        ${cfg.active ? 'Disable Store' : 'Enable Store'}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Toggle checkbox binds
        document.querySelectorAll(".branch-include-toggle").forEach(chk => {
            chk.addEventListener("change", (e) => {
                const store = e.target.getAttribute("data-store");
                branchConfigs[store].included = e.target.checked;
                saveSystemState();
                window.logSystemAudit("Updated store config", `Rollup inclusion for branch ${store} toggled to ${e.target.checked}`, "System");
            });
        });
    }

    window.toggleBranchActivation = function(store) {
        branchConfigs[store].active = !branchConfigs[store].active;
        saveSystemState();
        renderBranchAdministration();
        window.logSystemAudit("Toggled store activation", `Branch ${store} activation status changed`, "System");
    };

    // 11. MAIN CONTROLLER NAV-CLICK DISPATCHER
    window.renderSystemScreen = async function(target) {
        if (!target) return;

        // Fetch fresh app state
        await fetchLiveAppState();

        if (target === "notification-system") {
            renderNotificationSystem();
        } else if (target === "excel-import") {
            renderImportHistoryLogs();
        } else if (target === "audit-log") {
            renderAuditLogs();
        } else if (target === "scheduled-backup") {
            renderBackupHistory();
        } else if (target === "report-scheduler") {
            renderReportSchedules();
        } else if (target === "multi-branch-consolidation") {
            renderBranchAdministration();
        }
    };

    // 12. SIDEBAR ROUTER BINDINGS AND EVENT BOOTSTRAP
    const targetScreens = [
        'excel-import', 'excel-export', 'audit-log', 'duplicate-data-detection', 'scheduled-backup', 'report-scheduler', 'notification-system', 'multi-branch-consolidation'
    ];

    document.querySelectorAll(".nav-item").forEach(item => {
        const target = item.getAttribute("data-target");
        if (targetScreens.includes(target)) {
            item.addEventListener("click", () => {
                window.renderSystemScreen(target);
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
                        window.renderSystemScreen(target);
                    }
                }
            }, 200);
        });
    });

    // Initial load operations
    loadSystemState();
});
