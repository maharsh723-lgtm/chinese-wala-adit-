// accounting.js - BK Operations India Enterprise Accounting Module

function _initThisModule() {
    // 1. Core API Base Configuration
    // Absolute base URL if opened via file:// protocol or other ports
    let API_BASE = '';
    if (window.location.protocol.startsWith('file')) {
        API_BASE = 'http://localhost:3000';
    } else if (window.location.port && window.location.port !== '3000') {
        API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    // 2. State & Storage Schema Initialization
    let transactions = [];
    let arInvoices = [];
    let apBills = [];
    let plAdjustments = [];
    let liveStateData = null; // Stored backend api data (orders, purchases, wastage)
    const targetScreens = [
        'cash-book', 'bank-book', 'journal-entries', 'trial-balance',
        'pl-automation', 'accounts-receivable', 'accounts-payable'
    ];

    // Helper: Get active store and role based on local storage cache
    function getCurrentRoleAndStore() {
        const cachedRoleKey = localStorage.getItem("bk_current_role_key") || "bm-adit";
        let store = "ADIT CAMPUS";
        let role = "bm";

        if (cachedRoleKey === "owner") {
            role = "owner";
            store = "All";
        } else if (cachedRoleKey === "bm-adit") {
            store = "ADIT CAMPUS";
        } else if (cachedRoleKey === "bm-lpsavani") {
            store = "LP SAVANI";
        } else if (cachedRoleKey === "bm-gauravpath") {
            store = "GAURAV PATH";
        } else if (cachedRoleKey === "bm-sudamachowk") {
            store = "SUDAMA CHOWK";
        }
        return { role, store };
    }

    // Date range helper (defaults to current month)
    function getDefaultDateRange() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const format = (d) => d.toISOString().split('T')[0];
        return {
            start: format(start),
            end: format(now)
        };
    }

    // 3. Seeding Default Data
    function seedDefaultData() {
        const initialTransactions = [
            {
                id: "tx-seed-1",
                date: "2026-07-01",
                description: "Cash Sales registry summary",
                type: "cash",
                voucherNo: "V-001",
                store: "ADIT CAMPUS",
                lines: [
                    { account: "Cash", debit: 25000, credit: 0 },
                    { account: "Sales", debit: 0, credit: 25000 }
                ]
            },
            {
                id: "tx-seed-2",
                date: "2026-07-01",
                description: "Cash Sales registry summary",
                type: "cash",
                voucherNo: "V-002",
                store: "LP SAVANI",
                lines: [
                    { account: "Cash", debit: 18000, credit: 0 },
                    { account: "Sales", debit: 0, credit: 18000 }
                ]
            },
            {
                id: "tx-seed-3",
                date: "2026-07-02",
                description: "Paid local veggie vendor cash",
                type: "cash",
                voucherNo: "V-003",
                store: "ADIT CAMPUS",
                lines: [
                    { account: "Cost of Goods Sold", debit: 5000, credit: 0 },
                    { account: "Cash", debit: 0, credit: 5000 }
                ]
            },
            {
                id: "tx-seed-4",
                date: "2026-07-02",
                description: "Corporate lunch box advance deposit",
                type: "bank",
                chequeRef: "TXN-998811",
                bankAccount: "HDFC Bank",
                store: "ADIT CAMPUS",
                lines: [
                    { account: "HDFC Bank", debit: 12000, credit: 0 },
                    { account: "Sales", debit: 0, credit: 12000 }
                ]
            },
            {
                id: "tx-seed-5",
                date: "2026-07-03",
                description: "Rent payout via bank transfer",
                type: "bank",
                chequeRef: "TXN-884411",
                bankAccount: "ICICI Bank",
                store: "ADIT CAMPUS",
                lines: [
                    { account: "Rent", debit: 35000, credit: 0 },
                    { account: "ICICI Bank", debit: 0, credit: 35000 }
                ]
            },
            {
                id: "tx-seed-6",
                date: "2026-07-04",
                description: "Equipment depreciation adjustment",
                type: "journal",
                voucherNo: "JV-101",
                store: "ADIT CAMPUS",
                lines: [
                    { account: "Utilities", debit: 2500, credit: 0 },
                    { account: "Cash", debit: 0, credit: 2500 }
                ]
            }
        ];

        const initialAR = [
            {
                id: "ar-1",
                partyName: "Swiggy Corporate Settlements",
                invoiceRef: "INV/26/01",
                amount: 45000,
                outstanding: 45000,
                dueDate: "2026-07-15",
                store: "ADIT CAMPUS",
                status: "Pending"
            },
            {
                id: "ar-2",
                partyName: "Zomato India Settlements",
                invoiceRef: "INV/26/02",
                amount: 30000,
                outstanding: 10000,
                dueDate: "2026-07-12",
                store: "ADIT CAMPUS",
                status: "Partially Paid"
            }
        ];

        const initialAP = [
            {
                id: "ap-1",
                vendorName: "Standard Packaging Corp",
                billRef: "BILL-2289",
                amount: 18000,
                outstanding: 18000,
                dueDate: "2026-07-18",
                store: "ADIT CAMPUS",
                status: "Pending"
            },
            {
                id: "ap-2",
                vendorName: "Sardar Patel Organic Farms",
                billRef: "BILL-4101",
                amount: 12000,
                outstanding: 0,
                dueDate: "2026-07-05",
                store: "ADIT CAMPUS",
                status: "Paid"
            }
        ];

        if (!localStorage.getItem("bk_acct_transactions")) {
            localStorage.setItem("bk_acct_transactions", JSON.stringify(initialTransactions));
        }
        if (!localStorage.getItem("bk_acct_ar_invoices")) {
            localStorage.setItem("bk_acct_ar_invoices", JSON.stringify(initialAR));
        }
        if (!localStorage.getItem("bk_acct_ap_bills")) {
            localStorage.setItem("bk_acct_ap_bills", JSON.stringify(initialAP));
        }
    }

    // Load state from Storage
    function loadState() {
        transactions = JSON.parse(localStorage.getItem("bk_acct_transactions") || "[]");
        arInvoices = JSON.parse(localStorage.getItem("bk_acct_ar_invoices") || "[]");
        apBills = JSON.parse(localStorage.getItem("bk_acct_ap_bills") || "[]");
        plAdjustments = JSON.parse(localStorage.getItem("bk_acct_pl_adjustments") || "[]");
    }

    // Save state to Storage and trigger render of active page
    function saveState(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
        loadState();
        const activeItem = document.querySelector(".nav-item.active");
        if (activeItem) {
            const target = activeItem.getAttribute("data-target");
            renderAccountingScreen(target);
        }
    }

    // Fetch live application sales/wastage/inventory state from Server
    async function fetchLiveAppState() {
        try {
            const res = await fetch(`${API_BASE}/api/state?_t=${Date.now()}`);
            if (res.ok) {
                liveStateData = await res.json();
            }
        } catch (e) {
            console.error("Failed to load application state for P&L calculations:", e);
        }
    }

    // Helper formatting currency
    function formatCurrency(amt) {
        return "₹" + parseFloat(amt).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Get list of standard accounts
    const STANDARD_ACCOUNTS = [
        "Cash", "HDFC Bank", "ICICI Bank", "SBI Bank", "Accounts Receivable",
        "Accounts Payable", "Sales", "Delivery Orders", "Cost of Goods Sold",
        "Wastage Expense", "Rent", "Salaries", "Utilities", "Marketing", "Owner's Equity"
    ];

    // Global exposed modal opening helpers (bound to window)
    window.openAccountingModal = function(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.style.display = "flex";

        const todayStr = new Date().toISOString().split('T')[0];
        
        // Reset default dates in modals to today
        if (modalId === 'modalAddCashEntry') {
            document.getElementById("cashDate").value = todayStr;
        } else if (modalId === 'modalAddBankEntry') {
            document.getElementById("bankDate").value = todayStr;
        } else if (modalId === 'modalAddJournalEntry') {
            document.getElementById("journalDate").value = todayStr;
            const container = document.getElementById("journalLinesContainer");
            container.innerHTML = "";
            window.addJournalLineRow();
            window.addJournalLineRow();
        } else if (modalId === 'modalAddPLAdjustment') {
            document.getElementById("plAdjDate").value = todayStr;
        } else if (modalId === 'modalAddInvoice') {
            document.getElementById("arDueDate").value = todayStr;
        } else if (modalId === 'modalAddBill') {
            document.getElementById("apDueDate").value = todayStr;
        }
    };

    window.closeAccountingModal = function(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.style.display = "none";
    };

    // 4. JOURNAL ENTRIES PAGE LOGIC & DOUBLE ENTRY
    let journalLines = [];

    window.addJournalLineRow = function() {
        const container = document.getElementById("journalLinesContainer");
        if (!container) return;

        const rowIdx = container.children.length;
        const row = document.createElement("div");
        row.className = "journal-line-row";
        row.style.display = "grid";
        row.style.gridTemplateColumns = "2fr 1fr 1fr auto";
        row.style.gap = "10px";
        row.style.alignItems = "center";
        row.style.marginBottom = "8px";

        let acctOptions = STANDARD_ACCOUNTS.map(a => `<option value="${a}">${a}</option>`).join('');

        row.innerHTML = `
            <select class="saas-select journal-acct" style="width:100%;">
                ${acctOptions}
            </select>
            <input type="number" class="saas-input journal-debit" min="0" step="0.01" value="0" placeholder="Debit" style="width:100%;">
            <input type="number" class="saas-input journal-credit" min="0" step="0.01" value="0" placeholder="Credit" style="width:100%;">
            <button type="button" class="saas-btn saas-btn-danger" style="padding:6px; border:none;" onclick="this.parentElement.remove(); window.updateJournalTotals();">
                <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
        `;

        container.appendChild(row);

        // Bind listeners to trigger total checks
        row.querySelector(".journal-debit").addEventListener("input", (e) => {
            if (parseFloat(e.target.value) > 0) {
                row.querySelector(".journal-credit").value = "0";
            }
            window.updateJournalTotals();
        });

        row.querySelector(".journal-credit").addEventListener("input", (e) => {
            if (parseFloat(e.target.value) > 0) {
                row.querySelector(".journal-debit").value = "0";
            }
            window.updateJournalTotals();
        });

        if (window.lucide) window.lucide.createIcons();
        window.updateJournalTotals();
    };

    window.updateJournalTotals = function() {
        const container = document.getElementById("journalLinesContainer");
        if (!container) return;

        let totalDebit = 0;
        let totalCredit = 0;

        container.querySelectorAll(".journal-line-row").forEach(row => {
            const deb = parseFloat(row.querySelector(".journal-debit").value) || 0;
            const cred = parseFloat(row.querySelector(".journal-credit").value) || 0;
            totalDebit += deb;
            totalCredit += cred;
        });

        document.getElementById("journalTotalDebitDisplay").textContent = formatCurrency(totalDebit);
        document.getElementById("journalTotalCreditDisplay").textContent = formatCurrency(totalCredit);

        const statusLabel = document.getElementById("journalBalanceStatus");
        const submitBtn = document.getElementById("journalSubmitBtn");

        if (totalDebit === totalCredit && totalDebit > 0) {
            statusLabel.textContent = "Balanced";
            statusLabel.style.color = "var(--success, #10B981)";
            submitBtn.disabled = false;
        } else {
            statusLabel.textContent = "Imbalanced";
            statusLabel.style.color = "var(--danger, #EF4444)";
            submitBtn.disabled = true;
        }
    };

    // Show details modal for a specific journal entry
    window.viewJournalDetails = function(txId) {
        const tx = transactions.find(t => t.id === txId);
        if (!tx) return;

        document.getElementById("jdDate").textContent = tx.date;
        document.getElementById("jdNarration").textContent = tx.description;
        document.getElementById("jdStore").textContent = tx.store || "ADIT CAMPUS";

        const tbody = document.querySelector("#tableJournalDetailsLines tbody");
        tbody.innerHTML = "";

        tx.lines.forEach(l => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${l.account}</td>
                <td style="text-align:right;">${l.debit > 0 ? formatCurrency(l.debit) : "-"}</td>
                <td style="text-align:right;">${l.credit > 0 ? formatCurrency(l.credit) : "-"}</td>
            `;
            tbody.appendChild(row);
        });

        window.openAccountingModal('modalJournalDetails');
    };

    // 5. RENDERING CORE FUNCTIONS

    // A. JOURNAL ENTRIES PAGE
    function renderJournalEntries() {
        const tbody = document.querySelector("#tableJournalEntries tbody");
        tbody.innerHTML = "";

        const searchVal = document.getElementById("journalSearch").value.toLowerCase();
        const filterDate = document.getElementById("journalFilterDate").value;

        const { role, store } = getCurrentRoleAndStore();

        // Filter transactions for this store
        let filtered = transactions.filter(t => {
            if (store !== "All" && t.store !== store) return false;
            return true;
        });

        // Filter search & date
        filtered = filtered.filter(t => {
            if (filterDate && t.date !== filterDate) return false;
            if (searchVal) {
                const matchesNarration = t.description.toLowerCase().includes(searchVal);
                const matchesAcct = t.lines.some(l => l.account.toLowerCase().includes(searchVal));
                return matchesNarration || matchesAcct;
            }
            return true;
        });

        // Sort descending date
        filtered.sort((a, b) => b.date.localeCompare(a.date));

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">No journal entries found.</td></tr>`;
            return;
        }

        filtered.forEach(t => {
            const totalDeb = t.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
            const totalCred = t.lines.reduce((sum, l) => sum + (l.credit || 0), 0);

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${t.date}</td>
                <td><span class="pill-badge pill-badge-secondary">${t.voucherNo || t.chequeRef || 'JV'}</span></td>
                <td>${t.description}</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(totalDeb)}</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(totalCred)}</td>
                <td style="text-align:center;">
                    <button class="saas-btn saas-btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="window.viewJournalDetails('${t.id}')">
                        <i data-lucide="eye" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> View
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    // B. CASH BOOK PAGE
    function renderCashBook() {
        const tbody = document.querySelector("#tableCashBook tbody");
        tbody.innerHTML = "";

        const startDate = document.getElementById("cashBookStartDate").value;
        const endDate = document.getElementById("cashBookEndDate").value;

        const { role, store } = getCurrentRoleAndStore();

        // Get all lines affecting cash account
        let cashLines = [];
        transactions.forEach(t => {
            if (store !== "All" && t.store !== store) return;
            
            // Find Cash ledger line in this transaction
            const cLine = t.lines.find(l => l.account === "Cash");
            if (cLine) {
                cashLines.push({
                    date: t.date,
                    voucherNo: t.voucherNo || t.chequeRef || 'V',
                    description: t.description,
                    debit: cLine.debit, // Inflow
                    credit: cLine.credit // Outflow
                });
            }
        });

        // Sort ascending by date to compute running balances correctly
        cashLines.sort((a, b) => a.date.localeCompare(b.date));

        let runningBal = 0;
        let openingBal = 0;
        let totalIn = 0;
        let totalOut = 0;

        let tableRows = [];

        cashLines.forEach(l => {
            // Apply Date Filters
            const inRange = (!startDate || l.date >= startDate) && (!endDate || l.date <= endDate);
            
            if (!inRange) {
                // If before the range, add to opening balance
                if (startDate && l.date < startDate) {
                    openingBal += (l.debit - l.credit);
                }
                runningBal += (l.debit - l.credit);
            } else {
                if (tableRows.length === 0) {
                    runningBal += openingBal;
                }
                runningBal += (l.debit - l.credit);
                totalIn += l.debit;
                totalOut += l.credit;

                tableRows.push({
                    ...l,
                    runningBal: runningBal
                });
            }
        });

        // Display KPIs
        document.getElementById("cash-kpi-opening").textContent = formatCurrency(openingBal);
        document.getElementById("cash-kpi-inflow").textContent = formatCurrency(totalIn);
        document.getElementById("cash-kpi-outflow").textContent = formatCurrency(totalOut);
        document.getElementById("cash-kpi-closing").textContent = formatCurrency(openingBal + totalIn - totalOut);

        if (tableRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">No cash records found.</td></tr>`;
            return;
        }

        // Display in descending order for natural log view
        tableRows.reverse().forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${r.date}</td>
                <td><span class="pill-badge pill-badge-secondary">${r.voucherNo}</span></td>
                <td>${r.description}</td>
                <td style="text-align:right; color:var(--success); font-weight:700;">${r.debit > 0 ? formatCurrency(r.debit) : "-"}</td>
                <td style="text-align:right; color:var(--danger); font-weight:700;">${r.credit > 0 ? formatCurrency(r.credit) : "-"}</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(r.runningBal)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // C. BANK BOOK PAGE
    function renderBankBook() {
        const tbody = document.querySelector("#tableBankBook tbody");
        tbody.innerHTML = "";

        const selectedBank = document.getElementById("bankAccountSelect").value;
        const startDate = document.getElementById("bankBookStartDate").value;
        const endDate = document.getElementById("bankBookEndDate").value;

        const { role, store } = getCurrentRoleAndStore();

        document.getElementById("bankLedgerTitle").textContent = `${selectedBank} Statement Ledger`;

        let bankLines = [];
        transactions.forEach(t => {
            if (store !== "All" && t.store !== store) return;
            
            const bLine = t.lines.find(l => l.account === selectedBank);
            if (bLine) {
                bankLines.push({
                    date: t.date,
                    chequeRef: t.chequeRef || t.voucherNo || 'REF',
                    description: t.description,
                    debit: bLine.debit, // Deposit (inflow)
                    credit: bLine.credit // Withdrawal (outflow)
                });
            }
        });

        // Sort ascending by date
        bankLines.sort((a, b) => a.date.localeCompare(b.date));

        let runningBal = 0;
        let openingBal = 0;
        let totalIn = 0;
        let totalOut = 0;

        let tableRows = [];

        bankLines.forEach(l => {
            const inRange = (!startDate || l.date >= startDate) && (!endDate || l.date <= endDate);
            
            if (!inRange) {
                if (startDate && l.date < startDate) {
                    openingBal += (l.debit - l.credit);
                }
                runningBal += (l.debit - l.credit);
            } else {
                if (tableRows.length === 0) {
                    runningBal += openingBal;
                }
                runningBal += (l.debit - l.credit);
                totalIn += l.debit;
                totalOut += l.credit;

                tableRows.push({
                    ...l,
                    runningBal: runningBal
                });
            }
        });

        // Display KPIs
        document.getElementById("bank-kpi-opening").textContent = formatCurrency(openingBal);
        document.getElementById("bank-kpi-deposits").textContent = formatCurrency(totalIn);
        document.getElementById("bank-kpi-withdrawals").textContent = formatCurrency(totalOut);
        document.getElementById("bank-kpi-closing").textContent = formatCurrency(openingBal + totalIn - totalOut);

        if (tableRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">No transactions logged for this bank.</td></tr>`;
            return;
        }

        tableRows.reverse().forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${r.date}</td>
                <td><span class="pill-badge pill-badge-secondary">${r.chequeRef}</span></td>
                <td>${r.description}</td>
                <td style="text-align:right; color:var(--success); font-weight:700;">${r.debit > 0 ? formatCurrency(r.debit) : "-"}</td>
                <td style="text-align:right; color:var(--danger); font-weight:700;">${r.credit > 0 ? formatCurrency(r.credit) : "-"}</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(r.runningBal)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // D. TRIAL BALANCE PAGE
    function renderTrialBalance() {
        const tbody = document.querySelector("#tableTrialBalance tbody");
        tbody.innerHTML = "";

        const tbDate = document.getElementById("trialBalanceDate").value;

        const { role, store } = getCurrentRoleAndStore();

        // Accumulate Debits & Credits per account
        const balances = {};
        STANDARD_ACCOUNTS.forEach(a => {
            balances[a] = { debit: 0, credit: 0 };
        });

        transactions.forEach(t => {
            if (store !== "All" && t.store !== store) return;
            if (tbDate && t.date > tbDate) return;

            t.lines.forEach(l => {
                if (!balances[l.account]) {
                    balances[l.account] = { debit: 0, credit: 0 };
                }
                balances[l.account].debit += (l.debit || 0);
                balances[l.account].credit += (l.credit || 0);
            });
        });

        let totalDebit = 0;
        let totalCredit = 0;
        let count = 0;

        STANDARD_ACCOUNTS.forEach(acct => {
            const bal = balances[acct];
            if (bal.debit === 0 && bal.credit === 0) return;

            // Standard net off for trial balance representation
            let finalDeb = 0;
            let finalCred = 0;
            if (bal.debit > bal.credit) {
                finalDeb = bal.debit - bal.credit;
            } else {
                finalCred = bal.credit - bal.debit;
            }

            totalDebit += finalDeb;
            totalCredit += finalCred;
            count++;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:700; color:var(--text-primary);">${acct}</td>
                <td style="text-align:right; font-weight:700;">${finalDeb > 0 ? formatCurrency(finalDeb) : "-"}</td>
                <td style="text-align:right; font-weight:700;">${finalCred > 0 ? formatCurrency(finalCred) : "-"}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById("trialBalanceTotalDebit").textContent = formatCurrency(totalDebit);
        document.getElementById("trialBalanceTotalCredit").textContent = formatCurrency(totalCredit);

        const alertBanner = document.getElementById("trialBalanceAlert");
        
        // Exact floating point matching logic
        const delta = Math.abs(totalDebit - totalCredit);
        if (delta < 0.1) {
            alertBanner.innerHTML = `<i data-lucide="check-circle" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:6px;"></i> Ledger Audit Balanced: Total Debit balances match Total Credit balances.`;
            alertBanner.style.background = "rgba(16, 185, 129, 0.08)";
            alertBanner.style.border = "1px solid var(--success)";
            alertBanner.style.color = "var(--success)";
        } else {
            alertBanner.innerHTML = `<i data-lucide="alert-triangle" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:6px;"></i> Ledger Discrepancy Found! Debit/Credit mismatch off by ${formatCurrency(delta)}. Please verify past journal records.`;
            alertBanner.style.background = "rgba(239, 68, 68, 0.08)";
            alertBanner.style.border = "1px solid var(--danger)";
            alertBanner.style.color = "var(--danger)";
        }

        if (window.lucide) window.lucide.createIcons();
    }

    // E. BALANCE SHEET PAGE
    function renderBalanceSheet() {
        const bsDate = document.getElementById("balanceSheetDate").value;
        const { role, store } = getCurrentRoleAndStore();

        // 1. Compute ledger account totals
        const balances = {};
        STANDARD_ACCOUNTS.forEach(a => {
            balances[a] = 0; // Net Debit (Asset side standard)
        });

        transactions.forEach(t => {
            if (store !== "All" && t.store !== store) return;
            if (bsDate && t.date > bsDate) return;

            t.lines.forEach(l => {
                if (balances[l.account] === undefined) {
                    balances[l.account] = 0;
                }
                // Assets: standard Debit positive
                balances[l.account] += (l.debit - l.credit);
            });
        });

        // 2. Classify accounts
        const assetAccts = ["Cash", "HDFC Bank", "ICICI Bank", "SBI Bank", "Accounts Receivable"];
        const liabilityAccts = ["Accounts Payable"];
        const equityAccts = ["Owner's Equity"];

        // Dynamic retained earnings from revenues & costs up to date
        let netProfit = 0;
        transactions.forEach(t => {
            if (store !== "All" && t.store !== store) return;
            if (bsDate && t.date > bsDate) return;

            t.lines.forEach(l => {
                if (l.account === "Sales" || l.account === "Delivery Orders") {
                    netProfit += (l.credit - l.debit); // Credit positive for revenue
                } else if (l.account === "Cost of Goods Sold" || l.account === "Wastage Expense" || l.account === "Rent" || l.account === "Salaries" || l.account === "Utilities" || l.account === "Marketing") {
                    netProfit -= (l.debit - l.credit); // Debit positive for costs
                }
            });
        });

        // Render Assets
        const tAssets = document.querySelector("#tableBSAssets tbody");
        tAssets.innerHTML = "";
        let sumAssets = 0;

        assetAccts.forEach(a => {
            const bal = balances[a] || 0;
            if (bal === 0) return;
            sumAssets += bal;
            tAssets.innerHTML += `
                <tr>
                    <td>${a}</td>
                    <td style="text-align:right; font-weight:700;">${formatCurrency(bal)}</td>
                </tr>
            `;
        });

        if (sumAssets === 0) {
            tAssets.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--text-tertiary);">No Asset records.</td></tr>`;
        }
        document.getElementById("bsTotalAssets").textContent = formatCurrency(sumAssets);

        // Render Liabilities
        const tLiab = document.querySelector("#tableBSLiabilities tbody");
        tLiab.innerHTML = "";
        let sumLiab = 0;

        liabilityAccts.forEach(l => {
            const bal = -(balances[l] || 0); // Credit positive
            if (bal === 0) return;
            sumLiab += bal;
            tLiab.innerHTML += `
                <tr>
                    <td>${l}</td>
                    <td style="text-align:right; font-weight:700;">${formatCurrency(bal)}</td>
                </tr>
            `;
        });

        if (sumLiab === 0) {
            tLiab.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--text-tertiary);">No Liability records.</td></tr>`;
        }
        document.getElementById("bsTotalLiabilities").textContent = formatCurrency(sumLiab);

        // Render Equity
        const tEquity = document.querySelector("#tableBSEquity tbody");
        tEquity.innerHTML = "";
        let sumEquity = 0;

        equityAccts.forEach(e => {
            const bal = -(balances[e] || 0); // Credit positive
            if (bal === 0) return;
            sumEquity += bal;
            tEquity.innerHTML += `
                <tr>
                    <td>${e}</td>
                    <td style="text-align:right; font-weight:700;">${formatCurrency(bal)}</td>
                </tr>
            `;
        });

        // Add Retained Earnings (Profit)
        sumEquity += netProfit;
        tEquity.innerHTML += `
            <tr>
                <td style="font-style:italic;">Retained Earnings (Net Profit)</td>
                <td style="text-align:right; font-weight:700; color:var(--success);">${formatCurrency(netProfit)}</td>
            </tr>
        `;

        document.getElementById("bsTotalEquity").textContent = formatCurrency(sumEquity);

        // Verify balance sheet equation: Assets = Liabilities + Equity
        const totalLAndE = sumLiab + sumEquity;
        const verifCard = document.getElementById("bsBalanceVerification");
        const diff = Math.abs(sumAssets - totalLAndE);

        if (diff < 0.1) {
            verifCard.innerHTML = `<i data-lucide="check" style="width:16px; height:16px; display:inline-block; vertical-align:middle; color:var(--success);"></i> Equation Verified: Assets (${formatCurrency(sumAssets)}) = Liabilities + Equity (${formatCurrency(totalLAndE)})`;
            verifCard.style.color = "var(--success)";
            verifCard.style.borderLeft = "4px solid var(--success)";
        } else {
            verifCard.innerHTML = `<i data-lucide="alert-circle" style="width:16px; height:16px; display:inline-block; vertical-align:middle; color:var(--danger);"></i> Imbalanced! Assets (${formatCurrency(sumAssets)}) != L+E (${formatCurrency(totalLAndE)}). Difference: ${formatCurrency(diff)}`;
            verifCard.style.color = "var(--danger)";
            verifCard.style.borderLeft = "4px solid var(--danger)";
        }

        if (window.lucide) window.lucide.createIcons();
    }

    // F. PROFIT & LOSS STATEMENT AUTOMATION PAGE
    function renderPLAutomation() {
        const period = document.getElementById("plPeriodSelect").value;
        const customDiv = document.getElementById("plCustomDates");

        let start = "";
        let end = "";

        if (period === "custom") {
            customDiv.style.display = "flex";
            start = document.getElementById("plStartDate").value;
            end = document.getElementById("plEndDate").value;
        } else {
            customDiv.style.display = "none";
            const today = new Date();
            const format = (d) => d.toISOString().split('T')[0];

            if (period === "today") {
                start = format(today);
                end = format(today);
            } else if (period === "week") {
                const first = today.getDate() - today.getDay();
                start = format(new Date(today.setDate(first)));
                end = format(new Date());
            } else if (period === "month") {
                start = format(new Date(today.getFullYear(), today.getMonth(), 1));
                end = format(new Date());
            }
        }

        // Set P&L Title period text
        document.getElementById("plTitleText").textContent = `Profit & Loss Statement (${start || 'Start'} to ${end || 'Present'})`;

        const { role, store } = getCurrentRoleAndStore();

        // 1. Gather Automated Revenues from POS Orders & Delivery
        let autoSales = 0;
        let autoDelivery = 0;

        if (liveStateData && liveStateData.posOrders) {
            liveStateData.posOrders.forEach(o => {
                if (store !== "All" && o.store !== store) return;
                if (o.status === "Refunded" || o.status === "Cancelled" || o.status === "Deleted") return;
                
                // Match dates
                const oDate = o.date; // YYYY-MM-DD format usually
                if (start && oDate < start) return;
                if (end && oDate > end) return;

                const billVal = parseFloat(o.grandTotal) || 0;
                if (o.orderType === "Delivery" || o.source === "swiggy" || o.source === "zomato") {
                    autoDelivery += billVal;
                } else {
                    autoSales += billVal;
                }
            });
        }

        // 2. Gather Automated Costs from Inventory purchases & Wastage
        let autoPurchases = 0;
        let autoWastage = 0;

        if (liveStateData) {
            if (liveStateData.purchases) {
                liveStateData.purchases.forEach(p => {
                    if (store !== "All" && p.store !== store) return;
                    if (start && p.date < start) return;
                    if (end && p.date > end) return;
                    autoPurchases += parseFloat(p.totalCost) || 0;
                });
            }
            if (liveStateData.wastage) {
                liveStateData.wastage.forEach(w => {
                    if (store !== "All" && w.store !== store) return;
                    if (start && w.date < start) return;
                    if (end && w.date > end) return;
                    autoWastage += parseFloat(w.totalCost) || parseFloat(w.cost) || 0;
                });
            }
        }

        // 3. Gather manual accounting entries logged in cash/bank/journals
        let ledgerRevenue = 0;
        let ledgerCOGS = 0;
        let ledgerRent = 0;
        let ledgerSalaries = 0;
        let ledgerUtilities = 0;
        let ledgerMarketing = 0;

        transactions.forEach(t => {
            if (store !== "All" && t.store !== store) return;
            if (start && t.date < start) return;
            if (end && t.date > end) return;

            t.lines.forEach(l => {
                if (l.account === "Sales" || l.account === "Delivery Orders") {
                    ledgerRevenue += (l.credit - l.debit);
                } else if (l.account === "Cost of Goods Sold") {
                    ledgerCOGS += (l.debit - l.credit);
                } else if (l.account === "Wastage Expense") {
                    autoWastage += (l.debit - l.credit);
                } else if (l.account === "Rent") {
                    ledgerRent += (l.debit - l.credit);
                } else if (l.account === "Salaries") {
                    ledgerSalaries += (l.debit - l.credit);
                } else if (l.account === "Utilities") {
                    ledgerUtilities += (l.debit - l.credit);
                } else if (l.account === "Marketing") {
                    ledgerMarketing += (l.debit - l.credit);
                }
            });
        });

        // 4. Incorporate manual custom adjustments
        let adjRevenues = 0;
        let adjCOGS = 0;
        let adjExpenses = 0;

        plAdjustments.forEach(adj => {
            if (start && adj.date < start) return;
            if (end && adj.date > end) return;

            if (adj.type === "Revenue") {
                adjRevenues += adj.amount;
            } else if (adj.type === "COGS") {
                adjCOGS += adj.amount;
            } else if (adj.type === "Expense") {
                adjExpenses += adj.amount;
            }
        });

        // Compute P&L sections
        const totalSalesRevenue = autoSales + ledgerRevenue + adjRevenues;
        const totalDeliveryRevenue = autoDelivery;
        const totalGrossRevenue = totalSalesRevenue + totalDeliveryRevenue;

        const totalCOGS = autoPurchases + ledgerCOGS + adjCOGS;
        const totalWastage = autoWastage;
        const totalDirectCosts = totalCOGS + totalWastage;

        const grossProfit = totalGrossRevenue - totalDirectCosts;

        const rentExp = ledgerRent;
        const salariesExp = ledgerSalaries;
        const utilitiesExp = ledgerUtilities;
        const marketingExp = ledgerMarketing + adjExpenses;
        const totalExpenses = rentExp + salariesExp + utilitiesExp + marketingExp;

        const netProfit = grossProfit - totalExpenses;

        const tbody = document.querySelector("#plSheetTable tbody");
        tbody.innerHTML = `
            <!-- REVENUES -->
            <tr style="font-weight:700; color:#5C4033; background:#FAF6EF;"><td colspan="3">REVENUES</td></tr>
            <tr><td>POS Dine-In / Takeaway Sales</td><td style="text-align:right; font-size:0.75rem; color:var(--text-tertiary);">Automated POS API</td><td style="text-align:right;">${formatCurrency(totalSalesRevenue)}</td></tr>
            <tr><td>POS Delivery Orders Sales</td><td style="text-align:right; font-size:0.75rem; color:var(--text-tertiary);">Delivery Webhooks</td><td style="text-align:right;">${formatCurrency(totalDeliveryRevenue)}</td></tr>
            <tr style="font-weight:700; border-top:1px solid #EAE3D5;"><td>Total Revenue (A)</td><td></td><td style="text-align:right; font-weight:800;">${formatCurrency(totalGrossRevenue)}</td></tr>

            <!-- DIRECT COSTS / COGS -->
            <tr style="font-weight:700; color:#5C4033; background:#FAF6EF;"><td colspan="3">COST OF GOODS SOLD</td></tr>
            <tr><td>Kitchen Inventory Purchases</td><td style="text-align:right; font-size:0.75rem; color:var(--text-tertiary);">Inventory Log</td><td style="text-align:right;">${formatCurrency(totalCOGS)}</td></tr>
            <tr><td>Kitchen Wastage Control Cost</td><td style="text-align:right; font-size:0.75rem; color:var(--text-tertiary);">Wastage Module</td><td style="text-align:right; color:var(--danger);">${formatCurrency(totalWastage)}</td></tr>
            <tr style="font-weight:700; border-top:1px solid #EAE3D5;"><td>Total Direct Costs (B)</td><td></td><td style="text-align:right; font-weight:800; color:var(--danger);">${formatCurrency(totalDirectCosts)}</td></tr>

            <!-- GROSS PROFIT -->
            <tr style="font-weight:800; background:#F5EFE4; font-size:1.05rem;">
                <td>GROSS PROFIT (A - B)</td>
                <td></td>
                <td style="text-align:right; color:${grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatCurrency(grossProfit)}</td>
            </tr>

            <!-- OPERATING EXPENSES -->
            <tr style="font-weight:700; color:#5C4033; background:#FAF6EF;"><td colspan="3">OPERATING EXPENSES</td></tr>
            <tr><td>Outlet Landlord Rent payouts</td><td style="text-align:right; font-size:0.75rem; color:var(--text-tertiary);">Ledger Book</td><td style="text-align:right;">${formatCurrency(rentExp)}</td></tr>
            <tr><td>Crew Salaries & Compensation</td><td style="text-align:right; font-size:0.75rem; color:var(--text-tertiary);">Payroll Ledger</td><td style="text-align:right;">${formatCurrency(salariesExp)}</td></tr>
            <tr><td>Electricity, gas & Water Bills</td><td style="text-align:right; font-size:0.75rem; color:var(--text-tertiary);">Utilities Ledger</td><td style="text-align:right;">${formatCurrency(utilitiesExp)}</td></tr>
            <tr><td>Marketing, Promotions & Custom adjustments</td><td style="text-align:right; font-size:0.75rem; color:var(--text-tertiary);">Marketing Ledger</td><td style="text-align:right;">${formatCurrency(marketingExp)}</td></tr>
            <tr style="font-weight:700; border-top:1px solid #EAE3D5;"><td>Total Operating Expenses (C)</td><td></td><td style="text-align:right; font-weight:800;">${formatCurrency(totalExpenses)}</td></tr>

            <!-- NET PROFIT -->
            <tr style="font-weight:800; background:#EFECE6; font-size:1.15rem; border-top:2px solid #5C4033;">
                <td>NET PROFIT / LOSS (Gross Profit - C)</td>
                <td></td>
                <td style="text-align:right; color:${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatCurrency(netProfit)}</td>
            </tr>
        `;
    }

    // G. ACCOUNTS RECEIVABLE (AR) PAGE
    function renderAccountsReceivable() {
        const tbody = document.querySelector("#tableARInvoices tbody");
        tbody.innerHTML = "";

        const { role, store } = getCurrentRoleAndStore();

        let filtered = arInvoices.filter(i => {
            if (store !== "All" && i.store !== store) return false;
            return true;
        });

        let totalOutstanding = 0;
        let totalOverdue = 0;
        let totalCollectedThisMonth = 0;

        const today = new Date();
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Fetch AR records from ledger to compute collected values
        transactions.forEach(t => {
            if (store !== "All" && t.store !== store) return;
            const txDate = new Date(t.date);
            if (txDate >= firstOfMonth) {
                // Find debits/credits on Accounts Receivable
                t.lines.forEach(l => {
                    if (l.account === "Accounts Receivable") {
                        // Credit to Accounts Receivable means customer paid (collected)
                        if (l.credit > 0) {
                            totalCollectedThisMonth += l.credit;
                        }
                    }
                });
            }
        });

        filtered.forEach(inv => {
            const due = new Date(inv.dueDate);
            const isOverdue = today > due && inv.outstanding > 0;
            const diffTime = today - due;
            const daysOverdue = isOverdue ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

            totalOutstanding += inv.outstanding;
            if (isOverdue) {
                totalOverdue += inv.outstanding;
            }

            const statusClass = inv.status === 'Paid' ? 'pill-badge-success' : inv.status === 'Partially Paid' ? 'pill-badge-warning' : 'pill-badge-danger';

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:700; color:var(--text-primary);">${inv.partyName}</td>
                <td><span class="pill-badge pill-badge-secondary">${inv.invoiceRef}</span></td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(inv.amount)}</td>
                <td style="text-align:right; font-weight:700; color:${inv.outstanding > 0 ? 'var(--orange-primary)' : 'var(--success)'};">${formatCurrency(inv.outstanding)}</td>
                <td>${inv.dueDate}</td>
                <td style="font-weight:700; color:${daysOverdue > 0 ? 'var(--danger)' : 'var(--text-secondary)'};">${daysOverdue > 0 ? `${daysOverdue} days` : "-"}</td>
                <td><span class="pill-badge ${statusClass}">${inv.status}</span></td>
                <td style="text-align:center;">
                    ${inv.outstanding > 0 ? `
                        <button class="saas-btn saas-btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="window.promptRecordPayment('AR', '${inv.id}', '${inv.partyName}', ${inv.outstanding})">
                            Record Payment
                        </button>
                    ` : `
                        <span style="color:var(--text-tertiary); font-size:0.75rem;"><i data-lucide="check" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> Settled</span>
                    `}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Set KPIs
        document.getElementById("ar-kpi-outstanding").textContent = formatCurrency(totalOutstanding);
        document.getElementById("ar-kpi-overdue").textContent = formatCurrency(totalOverdue);
        document.getElementById("ar-kpi-collected").textContent = formatCurrency(totalCollectedThisMonth);

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-tertiary);">No receivables accounts registered.</td></tr>`;
        }

        if (window.lucide) window.lucide.createIcons();
    }

    // H. ACCOUNTS PAYABLE (AP) PAGE
    function renderAccountsPayable() {
        const tbody = document.querySelector("#tableAPInvoices tbody");
        tbody.innerHTML = "";

        const { role, store } = getCurrentRoleAndStore();

        let filtered = apBills.filter(b => {
            if (store !== "All" && b.store !== store) return false;
            return true;
        });

        let totalPayable = 0;
        let totalOverdue = 0;
        let totalPaidThisMonth = 0;

        const today = new Date();
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Fetch AP records from ledger to compute paid values
        transactions.forEach(t => {
            if (store !== "All" && t.store !== store) return;
            const txDate = new Date(t.date);
            if (txDate >= firstOfMonth) {
                t.lines.forEach(l => {
                    if (l.account === "Accounts Payable") {
                        // Debit to Accounts Payable means we paid the supplier (decrease payable)
                        if (l.debit > 0) {
                            totalPaidThisMonth += l.debit;
                        }
                    }
                });
            }
        });

        filtered.forEach(bill => {
            const due = new Date(bill.dueDate);
            const isOverdue = today > due && bill.outstanding > 0;
            const diffTime = today - due;
            const daysOverdue = isOverdue ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

            totalPayable += bill.outstanding;
            if (isOverdue) {
                totalOverdue += bill.outstanding;
            }

            const statusClass = bill.status === 'Paid' ? 'pill-badge-success' : bill.status === 'Partially Paid' ? 'pill-badge-warning' : 'pill-badge-danger';

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:700; color:var(--text-primary);">${bill.vendorName}</td>
                <td><span class="pill-badge pill-badge-secondary">${bill.billRef}</span></td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(bill.amount)}</td>
                <td style="text-align:right; font-weight:700; color:${bill.outstanding > 0 ? 'var(--orange-primary)' : 'var(--success)'};">${formatCurrency(bill.outstanding)}</td>
                <td>${bill.dueDate}</td>
                <td style="font-weight:700; color:${daysOverdue > 0 ? 'var(--danger)' : 'var(--text-secondary)'};">${daysOverdue > 0 ? `${daysOverdue} days` : "-"}</td>
                <td><span class="pill-badge ${statusClass}">${bill.status}</span></td>
                <td style="text-align:center;">
                    ${bill.outstanding > 0 ? `
                        <button class="saas-btn saas-btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="window.promptRecordPayment('AP', '${bill.id}', '${bill.vendorName}', ${bill.outstanding})">
                            Pay Supplier
                        </button>
                    ` : `
                        <span style="color:var(--text-tertiary); font-size:0.75rem;"><i data-lucide="check" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> Settled</span>
                    `}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Set KPIs
        document.getElementById("ap-kpi-payable").textContent = formatCurrency(totalPayable);
        document.getElementById("ap-kpi-overdue").textContent = formatCurrency(totalOverdue);
        document.getElementById("ap-kpi-paid").textContent = formatCurrency(totalPaidThisMonth);

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-tertiary);">No supplier bills registered.</td></tr>`;
        }

        if (window.lucide) window.lucide.createIcons();
    }

    // Shared: Open payment recording dialog
    window.promptRecordPayment = function(type, itemId, partyName, outstanding) {
        document.getElementById("rpType").value = type;
        document.getElementById("rpItemId").value = itemId;
        document.getElementById("rpPartyLabel").textContent = `Settlement for: ${partyName}`;
        document.getElementById("rpOutstandingDisplay").textContent = formatCurrency(outstanding);
        document.getElementById("rpAmount").value = outstanding.toString();
        document.getElementById("rpAmount").max = outstanding.toString();
        document.getElementById("rpDate").value = new Date().toISOString().split('T')[0];

        window.openAccountingModal('modalRecordPayment');
    };

    // Main accounting screen navigator router dispatcher
    window.renderAccountingScreen = async function(target) {
        if (!target) return;

        // Fetch fresh sales, wastage, inventory purchases before displaying sheet reports
        if (target === 'pl-automation') {
            await fetchLiveAppState();
        }

        if (target === 'journal-entries') {
            renderJournalEntries();
        } else if (target === 'cash-book') {
            renderCashBook();
        } else if (target === 'bank-book') {
            renderBankBook();
        } else if (target === 'trial-balance') {
            renderTrialBalance();
        } else if (target === 'balance-sheet') {
            renderBalanceSheet();
        } else if (target === 'pl-automation') {
            renderPLAutomation();
        } else if (target === 'accounts-receivable') {
            renderAccountsReceivable();
        } else if (target === 'accounts-payable') {
            renderAccountsPayable();
        }
    };

    window.refreshAccountingData = async function() {
        await fetchLiveAppState();
        const activeItem = document.querySelector(".nav-item.active");
        if (activeItem) {
            const target = activeItem.getAttribute("data-target");
            if (targetScreens.includes(target)) {
                window.renderAccountingScreen(target);
            }
        }
    };

    // 6. EVENT BINDINGS FOR FORMS AND FILTERS

    // Initial setups for UI
    const defaultDates = getDefaultDateRange();
    
    // Cash Book dates
    const cashBookStartDate = document.getElementById("cashBookStartDate");
    const cashBookEndDate = document.getElementById("cashBookEndDate");
    if (cashBookStartDate && cashBookEndDate) {
        cashBookStartDate.value = defaultDates.start;
        cashBookEndDate.value = defaultDates.end;
        cashBookStartDate.addEventListener("change", () => renderCashBook());
        cashBookEndDate.addEventListener("change", () => renderCashBook());
    }

    // Bank Book dates & selector
    const bankBookStartDate = document.getElementById("bankBookStartDate");
    const bankBookEndDate = document.getElementById("bankBookEndDate");
    const bankAccountSelect = document.getElementById("bankAccountSelect");
    if (bankBookStartDate && bankBookEndDate && bankAccountSelect) {
        bankBookStartDate.value = defaultDates.start;
        bankBookEndDate.value = defaultDates.end;
        bankAccountSelect.addEventListener("change", () => renderBankBook());
        bankBookStartDate.addEventListener("change", () => renderBankBook());
        bankBookEndDate.addEventListener("change", () => renderBankBook());
    }

    // Journal entries search & dates
    const journalSearch = document.getElementById("journalSearch");
    const journalFilterDate = document.getElementById("journalFilterDate");
    if (journalSearch && journalFilterDate) {
        journalSearch.addEventListener("input", () => renderJournalEntries());
        journalFilterDate.addEventListener("change", () => renderJournalEntries());
    }

    // Trial Balance date
    const trialBalanceDate = document.getElementById("trialBalanceDate");
    if (trialBalanceDate) {
        trialBalanceDate.value = new Date().toISOString().split('T')[0];
        trialBalanceDate.addEventListener("change", () => renderTrialBalance());
    }

    // Balance sheet date
    const balanceSheetDate = document.getElementById("balanceSheetDate");
    if (balanceSheetDate) {
        balanceSheetDate.value = new Date().toISOString().split('T')[0];
        balanceSheetDate.addEventListener("change", () => renderBalanceSheet());
    }

    // P&L selectors
    const plStartDate = document.getElementById("plStartDate");
    const plEndDate = document.getElementById("plEndDate");
    const plPeriodSelect = document.getElementById("plPeriodSelect");
    if (plStartDate && plEndDate && plPeriodSelect) {
        plStartDate.value = defaultDates.start;
        plEndDate.value = defaultDates.end;
        plPeriodSelect.addEventListener("change", () => renderPLAutomation());
        plStartDate.addEventListener("change", () => renderPLAutomation());
        plEndDate.addEventListener("change", () => renderPLAutomation());
    }

    // Submit Cash Entry Form
    document.getElementById("formAddCashEntry").addEventListener("submit", (e) => {
        e.preventDefault();

        const date = document.getElementById("cashDate").value;
        const voucherNo = document.getElementById("cashVoucherNo").value;
        const type = document.getElementById("cashType").value;
        const offsetAcct = document.getElementById("cashOffsetAccount").value;
        const amount = parseFloat(document.getElementById("cashAmount").value) || 0;
        const desc = document.getElementById("cashDescription").value;

        const { role, store } = getCurrentRoleAndStore();

        // Create transaction double entry lines
        const lines = [];
        if (type === 'debit') {
            // Cash Inflow: Debit Cash, Credit Offset
            lines.push({ account: "Cash", debit: amount, credit: 0 });
            lines.push({ account: offsetAcct, debit: 0, credit: amount });
        } else {
            // Cash Outflow: Debit Offset, Credit Cash
            lines.push({ account: offsetAcct, debit: amount, credit: 0 });
            lines.push({ account: "Cash", debit: 0, credit: amount });
        }

        const newTx = {
            id: "tx-cash-" + Date.now(),
            date,
            description: desc,
            type: "cash",
            voucherNo,
            store: store === "All" ? "ADIT CAMPUS" : store, // fallback to active branch
            lines
        };

        transactions.push(newTx);
        saveState("bk_acct_transactions", transactions);
        window.closeAccountingModal('modalAddCashEntry');
        document.getElementById("formAddCashEntry").reset();
    });

    // Submit Bank Entry Form
    document.getElementById("formAddBankEntry").addEventListener("submit", (e) => {
        e.preventDefault();

        const bankAcct = document.getElementById("bankAccountInput").value;
        const date = document.getElementById("bankDate").value;
        const chequeRef = document.getElementById("bankChequeRef").value;
        const type = document.getElementById("bankType").value;
        const offsetAcct = document.getElementById("bankOffsetAccount").value;
        const amount = parseFloat(document.getElementById("bankAmount").value) || 0;
        const desc = document.getElementById("bankDescription").value;

        const { role, store } = getCurrentRoleAndStore();

        const lines = [];
        if (type === 'debit') {
            // Deposit: Debit Bank, Credit Offset
            lines.push({ account: bankAcct, debit: amount, credit: 0 });
            lines.push({ account: offsetAcct, debit: 0, credit: amount });
        } else {
            // Withdrawal: Debit Offset, Credit Bank
            lines.push({ account: offsetAcct, debit: amount, credit: 0 });
            lines.push({ account: bankAcct, debit: 0, credit: amount });
        }

        const newTx = {
            id: "tx-bank-" + Date.now(),
            date,
            description: desc,
            type: "bank",
            chequeRef,
            bankAccount: bankAcct,
            store: store === "All" ? "ADIT CAMPUS" : store,
            lines
        };

        transactions.push(newTx);
        saveState("bk_acct_transactions", transactions);
        window.closeAccountingModal('modalAddBankEntry');
        document.getElementById("formAddBankEntry").reset();
    });

    // Submit Journal Entry Form
    document.getElementById("formAddJournalEntry").addEventListener("submit", (e) => {
        e.preventDefault();

        const date = document.getElementById("journalDate").value;
        const voucherNo = document.getElementById("journalVoucher").value;
        const narration = document.getElementById("journalNarration").value;

        const { role, store } = getCurrentRoleAndStore();

        const lines = [];
        const container = document.getElementById("journalLinesContainer");
        container.querySelectorAll(".journal-line-row").forEach(row => {
            const account = row.querySelector(".journal-acct").value;
            const debit = parseFloat(row.querySelector(".journal-debit").value) || 0;
            const credit = parseFloat(row.querySelector(".journal-credit").value) || 0;
            if (debit > 0 || credit > 0) {
                lines.push({ account, debit, credit });
            }
        });

        const newTx = {
            id: "tx-journal-" + Date.now(),
            date,
            description: narration,
            type: "journal",
            voucherNo,
            store: store === "All" ? "ADIT CAMPUS" : store,
            lines
        };

        transactions.push(newTx);
        saveState("bk_acct_transactions", transactions);
        window.closeAccountingModal('modalAddJournalEntry');
        document.getElementById("formAddJournalEntry").reset();
    });

    // Submit P&L Adjustment Form
    document.getElementById("formAddPLAdjustment").addEventListener("submit", (e) => {
        e.preventDefault();

        const date = document.getElementById("plAdjDate").value;
        const type = document.getElementById("plAdjType").value;
        const label = document.getElementById("plAdjLabel").value;
        const amount = parseFloat(document.getElementById("plAdjAmount").value) || 0;

        const newAdj = {
            id: "pl-adj-" + Date.now(),
            date,
            type,
            label,
            amount
        };

        plAdjustments.push(newAdj);
        saveState("bk_acct_pl_adjustments", plAdjustments);
        window.closeAccountingModal('modalAddPLAdjustment');
        document.getElementById("formAddPLAdjustment").reset();
    });

    // Submit AR Invoice Form
    document.getElementById("formAddInvoice").addEventListener("submit", (e) => {
        e.preventDefault();

        const partyName = document.getElementById("arPartyName").value;
        const invoiceRef = document.getElementById("arInvoiceRef").value;
        const amount = parseFloat(document.getElementById("arAmount").value) || 0;
        const dueDate = document.getElementById("arDueDate").value;

        const { role, store } = getCurrentRoleAndStore();

        const newInv = {
            id: "inv-" + Date.now(),
            partyName,
            invoiceRef,
            amount,
            outstanding: amount,
            dueDate,
            store: store === "All" ? "ADIT CAMPUS" : store,
            status: "Pending"
        };

        // Create transaction entry to record the accounts receivable asset increase
        const lines = [
            { account: "Accounts Receivable", debit: amount, credit: 0 },
            { account: "Sales", debit: 0, credit: amount }
        ];

        const newTx = {
            id: "tx-ar-inv-" + Date.now(),
            date: new Date().toISOString().split('T')[0],
            description: `Receivable invoice generated: ${invoiceRef} to ${partyName}`,
            type: "journal",
            voucherNo: "AR-INV",
            store: store === "All" ? "ADIT CAMPUS" : store,
            lines
        };

        transactions.push(newTx);
        arInvoices.push(newInv);
        saveState("bk_acct_transactions", transactions);
        saveState("bk_acct_ar_invoices", arInvoices);
        window.closeAccountingModal('modalAddInvoice');
        document.getElementById("formAddInvoice").reset();
    });

    // Submit AP Supplier Bill Form
    document.getElementById("formAddBill").addEventListener("submit", (e) => {
        e.preventDefault();

        const vendorName = document.getElementById("apVendorName").value;
        const billRef = document.getElementById("apBillRef").value;
        const amount = parseFloat(document.getElementById("apAmount").value) || 0;
        const dueDate = document.getElementById("apDueDate").value;

        const { role, store } = getCurrentRoleAndStore();

        const newBill = {
            id: "bill-" + Date.now(),
            vendorName,
            billRef,
            amount,
            outstanding: amount,
            dueDate,
            store: store === "All" ? "ADIT CAMPUS" : store,
            status: "Pending"
        };

        // Create transaction entry to record liability increase
        const lines = [
            { account: "Cost of Goods Sold", debit: amount, credit: 0 },
            { account: "Accounts Payable", debit: 0, credit: amount }
        ];

        const newTx = {
            id: "tx-ap-bill-" + Date.now(),
            date: new Date().toISOString().split('T')[0],
            description: `Supplier bill recorded: ${billRef} from ${vendorName}`,
            type: "journal",
            voucherNo: "AP-BILL",
            store: store === "All" ? "ADIT CAMPUS" : store,
            lines
        };

        transactions.push(newTx);
        apBills.push(newBill);
        saveState("bk_acct_transactions", transactions);
        saveState("bk_acct_ap_bills", apBills);
        window.closeAccountingModal('modalAddBill');
        document.getElementById("formAddBill").reset();
    });

    // Submit Record Payment Form (For AR/AP payments settlement)
    document.getElementById("formRecordPayment").addEventListener("submit", (e) => {
        e.preventDefault();

        const type = document.getElementById("rpType").value;
        const itemId = document.getElementById("rpItemId").value;
        const amountPaid = parseFloat(document.getElementById("rpAmount").value) || 0;
        const date = document.getElementById("rpDate").value;
        const destAccount = document.getElementById("rpPaymentAccount").value;

        const { role, store } = getCurrentRoleAndStore();

        if (type === 'AR') {
            const inv = arInvoices.find(i => i.id === itemId);
            if (!inv) return;

            inv.outstanding = Math.max(0, inv.outstanding - amountPaid);
            if (inv.outstanding === 0) {
                inv.status = "Paid";
            } else {
                inv.status = "Partially Paid";
            }

            // Create ledger entry to record collection: Debit Cash/Bank, Credit Accounts Receivable
            const lines = [
                { account: destAccount, debit: amountPaid, credit: 0 },
                { account: "Accounts Receivable", debit: 0, credit: amountPaid }
            ];

            const newTx = {
                id: "tx-ar-pay-" + Date.now(),
                date,
                description: `Received payment for Invoice ${inv.invoiceRef} from ${inv.partyName}`,
                type: destAccount === "Cash" ? "cash" : "bank",
                voucherNo: "AR-PMT",
                chequeRef: "PMT-" + Date.now().toString().slice(-6),
                bankAccount: destAccount !== "Cash" ? destAccount : undefined,
                store: inv.store || store,
                lines
            };

            transactions.push(newTx);
            saveState("bk_acct_transactions", transactions);
            saveState("bk_acct_ar_invoices", arInvoices);
        } else {
            const bill = apBills.find(b => b.id === itemId);
            if (!bill) return;

            bill.outstanding = Math.max(0, bill.outstanding - amountPaid);
            if (bill.outstanding === 0) {
                bill.status = "Paid";
            } else {
                bill.status = "Partially Paid";
            }

            // Create ledger entry to record payment: Debit Accounts Payable, Credit Cash/Bank
            const lines = [
                { account: "Accounts Payable", debit: amountPaid, credit: 0 },
                { account: destAccount, debit: 0, credit: amountPaid }
            ];

            const newTx = {
                id: "tx-ap-pay-" + Date.now(),
                date,
                description: `Paid Supplier Bill ${bill.billRef} to ${bill.vendorName}`,
                type: destAccount === "Cash" ? "cash" : "bank",
                voucherNo: "AP-PMT",
                chequeRef: "PMT-" + Date.now().toString().slice(-6),
                bankAccount: destAccount !== "Cash" ? destAccount : undefined,
                store: bill.store || store,
                lines
            };

            transactions.push(newTx);
            saveState("bk_acct_transactions", transactions);
            saveState("bk_acct_ap_bills", apBills);
        }

        window.closeAccountingModal('modalRecordPayment');
    });

    // 7. ROUTING / SIDEBAR HANDLER AND BOOTSTRAP

    document.querySelectorAll(".nav-item").forEach(item => {
        const target = item.getAttribute("data-target");
        if (targetScreens.includes(target)) {
            item.addEventListener("click", () => {
                window.renderAccountingScreen(target);
            });
        }
    });

    // Listen to changes in the active Role dropdown
    const roleOptions = document.querySelectorAll(".role-option");
    roleOptions.forEach(opt => {
        opt.addEventListener("click", () => {
            // When role is toggled, wait for app.js to update the active role and re-render
            setTimeout(() => {
                const activeItem = document.querySelector(".nav-item.active");
                if (activeItem) {
                    const target = activeItem.getAttribute("data-target");
                    if (targetScreens.includes(target)) {
                        window.renderAccountingScreen(target);
                    }
                }
            }, 200);
        });
    });

    // Initial seeding & loading operations
    seedDefaultData();
    loadState();
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _initThisModule);
    } else {
        _initThisModule();
    }
}
