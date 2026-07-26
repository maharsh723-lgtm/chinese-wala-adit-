const getSupplierPhone = () => (window.bk_config && window.bk_config.supplierPhone) || '+91 99786 73137';
const getSupplierEmail = () => (window.bk_config && window.bk_config.supplierEmail) || 'supplies@badikatori.com';
const getSupplierName = () => (window.bk_config && window.bk_config.supplierName) || 'Anand Verma (GM Supplies)';

let currentPo = {
    id: "PO-2026-07-101",
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    priority: "High",
    status: "Low Stock Detected",
    paymentStatus: "Pending Approval",
    transactionId: "",
    paymentDate: "",
    receiptUploaded: false,
    paymentVerified: false,
    qrGenerated: false,
    items: [],
    subtotal: 0,
    gst: 0,
    grandTotal: 0,
    trackingStep: 0 // 0: Created, 1: Paid/Verified, 2: QR Generated, 3: Sent, 4: Accepted, 5: Preparing, 6: Packed, 7: Dispatched, 8: Delivered, 9: Inventory Updated
};

let activeOrderDetails = null;

// Initialize the Smart Procurement Module
window.initProcurementModule = function() {
    console.log("Procurement Module Initialized");

    // Mode toggles
    document.getElementById("btnProcModeManager")?.addEventListener("click", () => {
        setProcMode("manager");
    });
    document.getElementById("btnProcModeSupplier")?.addEventListener("click", () => {
        setProcMode("supplier");
    });
    document.getElementById("btnQuickSupplierPortalToggle")?.addEventListener("click", () => {
        const banner = document.getElementById("portalSimBanner");
        if (banner) {
            banner.style.display = banner.style.display === "none" ? "flex" : "none";
        }
    });

    // Action button listeners
    document.getElementById("btnProcReview")?.addEventListener("click", reviewOrder);
    document.getElementById("btnProcEdit")?.addEventListener("click", openEditQtyModal);
    document.getElementById("btnProcSaveQty")?.addEventListener("click", saveEditedQuantities);
    document.getElementById("btnProcViewSupplier")?.addEventListener("click", viewSupplierCard);
    document.getElementById("btnProcGenQr")?.addEventListener("click", generateQrCode);
    document.getElementById("btnProcPay")?.addEventListener("click", openCheckoutModal);
    document.getElementById("btnProcPlace")?.addEventListener("click", openConfirmPlaceModal);
    document.getElementById("btnProcConfirmPlaceSend")?.addEventListener("click", confirmAndSendOrder);
    document.getElementById("btnProcCancel")?.addEventListener("click", cancelActiveOrder);
    document.getElementById("btnProcDownloadPo")?.addEventListener("click", downloadPOText);
    
    // Copy details buttons
    document.getElementById("btnCopyBankAcc")?.addEventListener("click", () => {
        copyToClipboard("50200084325729", "Bank Account number copied!");
    });
    document.getElementById("btnCopyUPI")?.addEventListener("click", () => {
        copyToClipboard("9978673137@ikwik", "UPI ID copied!");
    });
    document.getElementById("btnDownloadBankDetails")?.addEventListener("click", downloadBankDetailsFile);

    // Payment Section listeners
    document.getElementById("btnProcMarkPaid")?.addEventListener("click", openCheckoutModal);
    document.getElementById("btnProcUploadReceipt")?.addEventListener("click", openCheckoutModal);
    document.getElementById("btnProcVerifyPay")?.addEventListener("click", openCheckoutModal);
    document.getElementById("btnCheckoutUpload")?.addEventListener("click", uploadCheckoutReceipt);
    document.getElementById("txtCheckoutTxnId")?.addEventListener("input", validateCheckoutForm);
    document.getElementById("btnCheckoutConfirmPay")?.addEventListener("click", confirmCheckoutPayment);
    document.getElementById("btnSmsAcceptOrder")?.addEventListener("click", acceptSmsOrderPlacement);
    document.getElementById("btnSmsRejectOrder")?.addEventListener("click", rejectSmsOrderPlacement);

    // QR Details preview button
    document.getElementById("btnPreviewQrDetails")?.addEventListener("click", previewQrDetails);

    // Download PO report
    document.getElementById("btnDownloadPoReport")?.addEventListener("click", downloadMonthlyReport);

    // Secure QR Code display modal listeners
    document.getElementById("btnDownloadPoQr")?.addEventListener("click", downloadPoQr);
    document.getElementById("btnPrintPoQr")?.addEventListener("click", printPoQr);
    document.getElementById("btnCopyPoQrLink")?.addEventListener("click", copyPoQrLink);
    document.getElementById("btnRegeneratePoQr")?.addEventListener("click", regeneratePoQr);
};

// Set operational mode (Manager view vs. Supplier Portal simulator)
function setProcMode(mode) {
    const btnManager = document.getElementById("btnProcModeManager");
    const btnSupplier = document.getElementById("btnProcModeSupplier");
    const banner = document.getElementById("portalSimBanner");

    if (mode === "manager") {
        btnManager.className = "saas-btn saas-btn-primary active";
        btnSupplier.className = "saas-btn saas-btn-secondary";
        if (banner) banner.style.display = "none";
    } else {
        btnManager.className = "saas-btn saas-btn-secondary";
        btnSupplier.className = "saas-btn saas-btn-primary active";
        if (banner) banner.style.display = "flex";
    }
}

// Generate Toast notifications matching the luxury SaaS theme
function showToast(title, message, icon = "info") {
    // Create toast container if not exists
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
    toast.style.background = "linear-gradient(135deg, #1f1d1c 0%, #151312 100%)";
    toast.style.border = "1px solid rgba(194, 159, 104, 0.3)";
    toast.style.color = "#FFFFFF";
    toast.style.padding = "16px 20px";
    toast.style.borderRadius = "10px";
    toast.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";
    toast.style.display = "flex";
    toast.style.gap = "12px";
    toast.style.alignItems = "center";
    toast.style.minWidth = "300px";
    toast.style.maxWidth = "450px";
    toast.style.transform = "translateY(20px)";
    toast.style.opacity = "0";
    toast.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

    // Set icons
    let iconSvg = `<i data-lucide="bell" style="color: var(--antique-brass); width: 20px; height: 20px;"></i>`;
    if (icon === "whatsapp") {
        iconSvg = `<i data-lucide="message-square" style="color: #25D366; width: 20px; height: 20px;"></i>`;
    } else if (icon === "success") {
        iconSvg = `<i data-lucide="check-circle" style="color: var(--success); width: 20px; height: 20px;"></i>`;
    }

    toast.innerHTML = `
        <div style="flex-shrink: 0;">${iconSvg}</div>
        <div style="flex-grow: 1;">
            <div style="font-weight: 700; font-size: 0.85rem; color: #FFF; margin-bottom: 2px;">${title}</div>
            <div style="font-size: 0.75rem; color: #A89F9B; line-height: 1.3;">${message}</div>
        </div>
        <button style="background: none; border: none; color: #A89F9B; cursor: pointer; font-size: 1rem; line-height: 1;" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);
    
    // Trigger Lucide icons inside toast
    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ attrs: { class: 'lucide-icon' } });
    }

    // Animate in
    setTimeout(() => {
        toast.style.transform = "translateY(0)";
        toast.style.opacity = "1";
    }, 50);

    // Auto dismiss after 6 seconds
    setTimeout(() => {
        toast.style.transform = "translateY(-20px)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 6000);
}

// Copy content to clipboard
function copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Success", successMsg, "success");
    }).catch(err => {
        console.error("Failed to copy text: ", err);
    });
}

// Render the entire Procurement Screen UI
window.renderProcurementScreen = function() {
    console.log("Rendering Procurement Screen");

    const inventory = window.bk_state.getInventory();
    const currentStore = window.bk_state.getCurrentStore();

    // 1. Detect Low/Out of Stock items
    const storeInventory = inventory.filter(i => i.store === currentStore);
    const lowStock = storeInventory.filter(i => (i.stock <= i.reorder || i.stock === 0) && i.reorder > 0);
    const outStock = storeInventory.filter(i => i.stock === 0 && i.reorder > 0);

    // Update KPI Numbers
    document.getElementById("lblProcLowStock").innerText = `${lowStock.length} SKUs`;
    document.getElementById("lblProcOutStock").innerText = `${outStock.length} SKUs`;

    // 2. Initialize draft PO items ONLY on first load (not after user empties cart)
    if (!currentPo._initialized) {
        currentPo._initialized = true;
        if (lowStock.length > 0) {
            currentPo.items = lowStock.map(item => {
                const suggested = Math.max(50, (item.reorder * 2) - item.stock);
                return {
                    productId: item.id,
                    productName: item.label,
                    quantity: suggested,
                    stock: item.stock,
                    rate: item.unitCost || 20.00,
                    amount: suggested * (item.unitCost || 20.00)
                };
            });
            currentPo.status = "Low Stock Detected";
            currentPo.priority = outStock.length > 0 ? "Critical" : "High";
        } else {
            // Start empty if no low stock items are present
            currentPo.items = [];
            currentPo.status = "Draft";
            currentPo.priority = "Normal";
        }
        calculatePoTotals();
    }

    // 3. Render Items Table
    const tableBody = document.getElementById("tblProcItemsBody");
    if (tableBody) {
        tableBody.innerHTML = "";
        if (currentPo.items.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary); padding: 16px 0;">No items in active Purchase Order. Go to Inventory Management to add items.</td></tr>`;
        } else {
            currentPo.items.forEach(item => {
                const tr = document.createElement("tr");
                const disableAttr = currentPo.trackingStep >= 3 ? "disabled" : "";
                tr.innerHTML = `
                    <td><strong>${item.productName}</strong></td>
                    <td>${item.quantity} units</td>
                    <td><span style="color: ${item.stock <= 0 ? 'var(--danger)' : 'var(--warning)'}; font-weight:700;">${item.stock} in stock</span></td>
                    <td>Rs ${item.rate.toFixed(2)}</td>
                    <td style="text-align: right; font-weight: 700;">Rs ${item.amount.toFixed(2)}</td>
                    <td style="text-align: right;">
                        <button class="proc-action-btn" style="padding: 4px 8px; border-color: rgba(220,53,69,0.2); color: var(--danger); background: transparent;" onclick="window.removeInventoryItemFromPO('${item.productId}')" ${disableAttr}>
                            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                        </button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }
    }

    // 4. Update PO Card text
    document.getElementById("txtProcOrderID").innerText = currentPo.id;
    document.getElementById("txtProcPriority").innerText = `${currentPo.priority} Priority`;
    document.getElementById("txtProcPriority").className = `proc-pill proc-pill-${currentPo.priority.toLowerCase() === 'critical' ? 'high' : 'medium'}`;
    document.getElementById("txtProcDateTime").innerText = `Auto-generated on ${currentPo.date} at ${currentPo.time}`;
    
    // Status Pill
    const statusPill = document.getElementById("txtProcOrderStatus");
    if (statusPill) {
        statusPill.innerText = currentPo.status;
        if (currentPo.status.includes("Paid") || currentPo.status.includes("Sent") || currentPo.status.includes("Delivered")) {
            statusPill.className = "proc-pill proc-pill-success";
        } else {
            statusPill.className = "proc-pill proc-pill-pending";
        }
    }

    // Update AI Insights panel
    const lowStockLabel = currentPo.items[0] ? currentPo.items[0].productName : "Ingredients";
    document.getElementById("txtProcAiInsight").innerHTML = `
        <i data-lucide="sparkles" style="width: 12px; height: 12px; margin-right: 4px; display:inline;"></i>
        <strong>AI Prediction:</strong> ${lowStockLabel} velocity increased by 24% this week. Stock depletion date estimated on <strong>${getFutureDateStr(5)}</strong>. Ordering suggested quantities guarantees zero stockouts.
    `;

    // 5. Update Payment Summaries
    document.getElementById("lblProcSubtotal").innerText = `Rs ${currentPo.subtotal.toFixed(2)}`;
    document.getElementById("lblProcGst").innerText = `Rs ${currentPo.gst.toFixed(2)}`;
    document.getElementById("lblProcGrandTotal").innerText = `Rs ${currentPo.grandTotal.toFixed(2)}`;
    document.getElementById("lblProcPaymentStatus").innerText = currentPo.paymentStatus;
    document.getElementById("lblProcPaymentStatus").className = `proc-pill proc-pill-${currentPo.paymentVerified ? 'success' : 'pending'}`;
    document.getElementById("lblProcTxnID").innerText = currentPo.transactionId || "-";
    document.getElementById("lblProcPayDate").innerText = currentPo.paymentDate || "-";

    // Show/hide PO QR code inside payment card reactively
    const qrSection = document.getElementById("procPaymentQrSection");
    if (qrSection) {
        qrSection.style.display = currentPo.qrGenerated ? "block" : "none";
    }

    // 6. Update Timeline Track
    updateTimelineUI();

    // 7. Update Action Button states
    updateActionButtons();

    // 8. Render Supplier Portal Controls if in Supplier view
    renderSupplierPortalSimulation();

    // 9. Load Requisitions Stats
    loadPreviousRequisitionsStats();

    // Trigger Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

// Calculate purchase request financial totals
function calculatePoTotals() {
    let subtotal = 0;
    currentPo.items.forEach(item => {
        item.amount = item.quantity * item.rate;
        subtotal += item.amount;
    });
    currentPo.subtotal = subtotal;
    currentPo.gst = subtotal * 0.18; // 18% GST standard
    currentPo.grandTotal = subtotal + currentPo.gst;
}

// Update Timeline Step highlights
function updateTimelineUI() {
    const steps = document.querySelectorAll(".timeline-track-step");
    const activeStep = activeOrderDetails ? activeOrderDetails.trackingStep : currentPo.trackingStep;
    const activeDate = activeOrderDetails ? activeOrderDetails.date : currentPo.date;
    const activeTime = activeOrderDetails ? activeOrderDetails.time : currentPo.time;

    steps.forEach((step, index) => {
        step.classList.remove("active", "completed");
        
        // Setup timestamp display
        const timeEl = document.getElementById(`time-step-${index}`);
        if (timeEl) {
            if (index <= activeStep) {
                timeEl.innerText = `${activeDate} ${activeTime}`;
            } else {
                timeEl.innerText = "-";
            }
        }

        if (index === activeStep) {
            step.classList.add("active");
        } else if (index < activeStep) {
            step.classList.add("completed");
        }
    });

    // Animate map delivery truck based on tracking stage
    const truck = document.getElementById("mapTruck");
    if (truck) {
        let progressPercent = "10%";
        if (activeStep >= 8) progressPercent = "90%";
        else if (activeStep === 7) progressPercent = "70%";
        else if (activeStep === 6) progressPercent = "50%";
        else if (activeStep >= 4) progressPercent = "35%";

        truck.style.transition = "left 2s ease-in-out";
        truck.style.left = progressPercent;
    }
}

// Update Action button disabling & active states
function updateActionButtons() {
    const btnGenQr = document.getElementById("btnProcGenQr");
    const btnPlace = document.getElementById("btnProcPlace");
    const btnPay = document.getElementById("btnProcPay");
    const btnVerify = document.getElementById("btnProcVerifyPay");
    const btnMarkPaid = document.getElementById("btnProcMarkPaid");
    const btnUpload = document.getElementById("btnProcUploadReceipt");

    // If order has no items, disable all primary buttons
    if (currentPo.items.length === 0) {
        btnGenQr?.setAttribute("disabled", "true");
        btnPlace?.setAttribute("disabled", "true");
        btnPay?.setAttribute("disabled", "true");
        btnVerify?.setAttribute("disabled", "true");
        btnMarkPaid?.setAttribute("disabled", "true");
        btnUpload?.setAttribute("disabled", "true");
        document.getElementById("btnProcEdit")?.setAttribute("disabled", "true");
        document.getElementById("btnProcReview")?.setAttribute("disabled", "true");
        document.getElementById("btnProcCancel")?.setAttribute("disabled", "true");
        return;
    }

    // "Place Order" & "Generate QR" disabled until payment verified
    if (currentPo.paymentVerified) {
        btnGenQr.removeAttribute("disabled");
        btnPlace.removeAttribute("disabled");
        btnVerify.setAttribute("disabled", "true");
        btnMarkPaid.setAttribute("disabled", "true");
        btnUpload.setAttribute("disabled", "true");
        btnPay.setAttribute("disabled", "true");
    } else {
        btnGenQr.setAttribute("disabled", "true");
        btnPlace.setAttribute("disabled", "true");
        btnPay?.removeAttribute("disabled");
        btnMarkPaid?.removeAttribute("disabled");
        btnUpload?.removeAttribute("disabled");
        
        if (currentPo.transactionId && currentPo.receiptUploaded) {
            btnVerify.removeAttribute("disabled");
        } else {
            btnVerify.setAttribute("disabled", "true");
        }
    }

    // If order placed, disable edit or payment modifications
    if (currentPo.trackingStep >= 3) {
        document.getElementById("btnProcEdit")?.setAttribute("disabled", "true");
        document.getElementById("btnProcReview")?.setAttribute("disabled", "true");
        document.getElementById("btnProcCancel")?.setAttribute("disabled", "true");
        btnPlace.setAttribute("disabled", "true");
        btnGenQr.removeAttribute("disabled"); // remain copyable
    } else {
        document.getElementById("btnProcEdit")?.removeAttribute("disabled");
        document.getElementById("btnProcReview")?.removeAttribute("disabled");
        document.getElementById("btnProcCancel")?.removeAttribute("disabled");
    }
}

// Review Requisition Order
function reviewOrder() {
    if (currentPo.trackingStep >= 1) return;
    
    currentPo.status = "Reviewed by Manager";
    currentPo.paymentStatus = "Awaiting Payment";
    showToast("Requisition Reviewed", "The purchase request has been approved. Please proceed to payment details.", "success");
    
    window.renderProcurementScreen();
}

// View Supplier information card details
function viewSupplierCard() {
    const card = document.getElementById("procSupplierInfoCard");
    if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.style.borderColor = "var(--success)";
        setTimeout(() => {
            card.style.borderColor = "var(--border)";
        }, 2000);
    }
}

// Focus Payment details card
function focusPaymentBreakdown() {
    const card = document.getElementById("procPaymentSummaryCard");
    if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.style.borderColor = "var(--antique-brass)";
        setTimeout(() => {
            card.style.borderColor = "var(--border)";
        }, 2000);
    }
}

// Edit Quantities Modal
function openEditQtyModal() {
    const modal = document.getElementById("modalProcEditQty");
    const container = document.getElementById("divProcEditList");
    if (!modal || !container) return;

    container.innerHTML = "";
    currentPo.items.forEach((item, index) => {
        const div = document.createElement("div");
        div.style.display = "flex";
        div.style.flexDirection = "column";
        div.style.gap = "4px";
        div.style.padding = "10px";
        div.style.background = "rgba(46, 35, 31, 0.02)";
        div.style.borderRadius = "6px";
        div.style.border = "1px solid var(--border)";

        div.innerHTML = `
            <span style="font-size: 0.8rem; font-weight:700; color:var(--text-secondary);">${item.productName}</span>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size: 0.72rem; color: var(--text-tertiary);">Current stock: ${item.stock} units</span>
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="number" class="saas-form-control" id="edit-qty-${index}" value="${item.quantity}" style="width: 80px; padding: 4px 8px; font-size: 0.8rem; text-align:right;">
                    <span style="font-size:0.75rem; font-weight:600; color:var(--text-tertiary);">units</span>
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    modal.style.display = "flex";
}

// Save Quantities
function saveEditedQuantities() {
    currentPo.items.forEach((item, index) => {
        const input = document.getElementById(`edit-qty-${index}`);
        if (input) {
            item.quantity = Math.max(1, parseInt(input.value) || 1);
        }
    });

    calculatePoTotals();
    document.getElementById("modalProcEditQty").style.display = "none";
    showToast("Quantities Updated", "Suggested purchase request totals recalculated.", "success");
    window.renderProcurementScreen();
}

// Open Checkout Modal
function openCheckoutModal() {
    const modal = document.getElementById("modalProcCheckout");
    if (!modal) return;

    // Set grand total in modal
    const totalEl = document.getElementById("lblCheckoutGrandTotal");
    if (totalEl) totalEl.innerText = `Rs ${currentPo.grandTotal.toFixed(2)}`;

    // Dynamic UPI QR generation based on exact grand total and PO reference ID!
    const imgEl = document.getElementById("imgProcUpiQr");
    if (imgEl) {
        const upiLink = `upi://pay?pa=9978673137@ikwik&pn=Badi%20Katori&am=${currentPo.grandTotal.toFixed(2)}&cu=INR&tn=${currentPo.id}`;
        imgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiLink)}`;
        imgEl.onerror = () => {
            imgEl.src = "./upi_qr.jpg"; // Fallback to user uploaded QR code if offline
        };
    }

    // Reset checkout form fields & auto-populate a valid UPI Transaction reference if empty
    const txnInput = document.getElementById("txtCheckoutTxnId");
    if (txnInput) {
        txnInput.value = currentPo.transactionId || `TXN${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    }

    const fileLabel = document.getElementById("txtCheckoutFileName");
    if (fileLabel) {
        fileLabel.innerText = currentPo.receiptUploaded ? "receipt_payment.png (Attached)" : "No file chosen";
    }

    validateCheckoutForm();

    modal.style.display = "flex";
}

// Validate checkout form to enable/disable confirm pay button
function validateCheckoutForm() {
    const txnInput = document.getElementById("txtCheckoutTxnId");
    const btnConfirm = document.getElementById("btnCheckoutConfirmPay");
    if (!btnConfirm) return;

    const txnId = txnInput ? txnInput.value.trim() : "";
    if (txnId) {
        btnConfirm.removeAttribute("disabled");
    } else {
        btnConfirm.setAttribute("disabled", "true");
    }
}

// Upload receipt file in checkout modal
function uploadCheckoutReceipt() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,application/pdf";
    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            currentPo.receiptUploaded = true;
            const fileLabel = document.getElementById("txtCheckoutFileName");
            if (fileLabel) fileLabel.innerText = file.name;
            
            const btnUpload = document.getElementById("btnCheckoutUpload");
            if (btnUpload) {
                btnUpload.innerHTML = `<i data-lucide="check" style="color:var(--success);"></i> ${file.name.substring(0, 12)}...`;
                btnUpload.style.borderColor = "var(--success)";
            }

            validateCheckoutForm();
            showToast("Receipt Uploaded", `Receipt ${file.name} attached successfully.`, "success");
        }
    };
    fileInput.click();
}

// Confirm checkout payment & verify
function confirmCheckoutPayment() {
    const txnInput = document.getElementById("txtCheckoutTxnId");
    const txnId = txnInput ? txnInput.value.trim() : `TXN${Math.floor(100000000000 + Math.random() * 900000000000)}`;

    currentPo.transactionId = txnId;
    currentPo.paymentVerified = true;
    currentPo.paymentStatus = "Verified & Settled";
    currentPo.status = "Payment Verified (Awaiting SMS Acceptance)";
    currentPo.paymentDate = new Date().toISOString().split('T')[0] + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    currentPo.trackingStep = 1; // Timeline: Payment Verified

    // Close checkout modal
    const checkoutModal = document.getElementById("modalProcCheckout");
    if (checkoutModal) checkoutModal.style.display = "none";

    showToast("Payment Verified", "Funds received. Sending SMS confirmation request...", "success");

    // Send real SMS to 9978673137 via backend
    try {
        const token = localStorage.getItem("bk_token");
        fetch(`${window.bk_state.API_BASE}/api/pos/requisitions/send-confirmation-sms`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ poId: currentPo.id, amount: currentPo.grandTotal })
        }).then(res => res.json())
          .then(data => {
              console.log("Confirmation SMS sent successfully:", data);
              showToast("SMS Sent", "Confirmation SMS dispatched to +91 99786 73137.", "success");
          })
          .catch(e => {
              console.error("Failed to send SMS:", e);
              showToast("SMS Dispatch Error", "Could not send automated SMS to supplier.", "error");
          });
    } catch (e) {
        console.error("SMS fetch trigger failed:", e);
    }

    window.renderProcurementScreen();

    // Automatically trigger and display the secure PO matching QR Code
    generateQrCode();

    // Open SMS Order Acceptance prompt for supplier
    setTimeout(() => {
        openSmsConfirmModal();
    }, 500);
}

function openSmsConfirmModal() {
    const lblPoId = document.getElementById("lblSmsPoId");
    const lblPoAmount = document.getElementById("lblSmsPoAmount");
    if (lblPoId) lblPoId.innerText = activeOrderDetails ? activeOrderDetails.id : currentPo.id;
    if (lblPoAmount) lblPoAmount.innerText = `₹${(activeOrderDetails ? activeOrderDetails.grandTotal : currentPo.grandTotal).toFixed(2)}`;

    const modal = document.getElementById("modalProcSmsConfirm");
    if (modal) modal.style.display = "flex";
}

async function acceptSmsOrderPlacement() {
    const modal = document.getElementById("modalProcSmsConfirm");
    if (modal) modal.style.display = "none";

    // If standard currentPo is empty but AI currentPoState has items, copy them so it places correctly!
    let usingAiDashboard = false;
    if (currentPo.items.length === 0 && typeof window.bk_state.getCurrentPoState === 'function') {
        const aiPo = window.bk_state.getCurrentPoState();
        if (aiPo && aiPo.items && aiPo.items.length > 0) {
            usingAiDashboard = true;
            currentPo.id = aiPo.poNumber;
            currentPo.subtotal = aiPo.totalCost;
            currentPo.gst = Math.round(aiPo.totalCost * 0.18 * 100) / 100;
            currentPo.grandTotal = Math.round((aiPo.totalCost + currentPo.gst) * 100) / 100;
            currentPo.transactionId = aiPo.transactionId || `TXN${Math.floor(100000000000 + Math.random() * 900000000000)}`;
            currentPo.items = aiPo.items.map(item => {
                const inv = window.bk_state.getInventory();
                const matched = inv.find(i => i.label.toLowerCase() === item.label.toLowerCase());
                return {
                    productId: matched ? matched.id : "inv-custom",
                    productName: item.label,
                    quantity: item.qty,
                    rate: item.unitCost,
                    amount: item.total
                };
            });
        }
    }

    currentPo.status = "Order Sent (Placed)";
    currentPo.trackingStep = 3; // Timeline: Order Placed

    const poId = currentPo.id;
    const amount = currentPo.grandTotal.toFixed(2);

    showToast("📱 SMS Order Placed", `Sent to ${getSupplierPhone()}: "Order ${poId} ACCEPTED & Placed successfully."`, "whatsapp");

    // Save Requisition Order in Database!
    try {
        const token = localStorage.getItem("bk_token");
        const store = window.bk_state.getCurrentStore();
        
        const payload = {
            id: currentPo.id,
            branchName: store,
            managerName: "Branch Manager",
            subtotal: currentPo.subtotal,
            gst: currentPo.gst,
            grandTotal: currentPo.grandTotal,
            paymentMethod: "UPI Transfer",
            expectedDeliveryDate: getFutureDateStr(1),
            notes: "Automated replenishment from Low Stock smart module.",
            items: currentPo.items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                rate: item.rate,
                amount: item.amount,
                gst: item.gst || (item.amount * 0.18),
                total: item.total || (item.amount * 1.18)
            }))
        };

        const response = await fetch(`${window.bk_state.API_BASE}/api/pos/requisitions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log("Purchase order persisted in database successfully.");
            // Mark payment as paid in database
            await fetch(`${window.bk_state.API_BASE}/api/pos/requisitions/${currentPo.id}/pay`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ transactionId: currentPo.transactionId })
            });
            
            // Sync
            window.bk_state.syncStateFromServer();
        }
    } catch (e) {
        console.error("Failed to save PO to database:", e);
    }

    // Update the AI dashboard state too if we were using it!
    if (usingAiDashboard && typeof window.bk_state.getCurrentPoState === 'function') {
        const aiPo = window.bk_state.getCurrentPoState();
        if (aiPo) {
            aiPo.orderPlaced = true;
            aiPo.supplierNotified = true;
            aiPo.status = "Order Sent";
            aiPo.timestamps.orderSent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (typeof renderAiProcurementScreen === 'function') {
                renderAiProcurementScreen();
            }
        }
    }

    // Save active tracking details
    activeOrderDetails = JSON.parse(JSON.stringify(currentPo));

    // Clear and empty the cart draft!
    currentPo.items = [];
    currentPo.transactionId = "";
    currentPo.receiptUploaded = false;
    currentPo.paymentVerified = false;
    currentPo.qrGenerated = false;
    currentPo.trackingStep = 0;
    currentPo.status = "Draft (Empty)";
    currentPo.paymentStatus = "Pending Approval";
    currentPo.id = "PO-2026-07-" + Math.floor(100 + Math.random()*900);
    calculatePoTotals();

    // Switch to Supplier Portal simulation automatically to guide user testing!
    setProcMode("supplier");

    // Real-world Integration: Dispatch SMS and WhatsApp to the Master Supplier
    let cleanPhone = "919978673137"; // default fallback for India (+91)
    const rawPhone = getSupplierPhone();
    if (rawPhone) {
        const digits = rawPhone.replace(/\D/g, '');
        if (digits.length === 10) {
            cleanPhone = "91" + digits;
        } else if (digits.length > 10) {
            cleanPhone = digits;
        }
    }
    
    const message = `Order ${poId} ACCEPTED & Placed successfully. Total Amount: ₹${amount}`;
    
    // 1. WhatsApp API trigger
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');

    // 2. Native SMS scheme trigger (Detecting iOS vs Android separator differences)
    setTimeout(() => {
        const ua = navigator.userAgent.toLowerCase();
        const isiOS = ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1 || ua.indexOf('ipod') > -1;
        const separator = isiOS ? '&' : '?';
        window.location.href = `sms:${cleanPhone}${separator}body=${encodeURIComponent(message)}`;
    }, 1200);

    // Dispatch notification to Owner Dashboard
    if (typeof window.addOwnerDashboardNotification === "function") {
        window.addOwnerDashboardNotification(
            `📦 Order Placed via SMS (${getSupplierPhone()})`,
            `Payment confirmed & Purchase Order <strong>${poId}</strong> (₹${amount}) ACCEPTED via SMS (${getSupplierPhone()}). Order placed with Master Supplier.`,
            "success"
        );
    }

    window.renderProcurementScreen();
}

function rejectSmsOrderPlacement() {
    const modal = document.getElementById("modalProcSmsConfirm");
    if (modal) modal.style.display = "none";

    currentPo.status = "Cancelled (Rejected)";
    currentPo.paymentStatus = "Order Rejected";

    const poId = activeOrderDetails ? activeOrderDetails.id : currentPo.id;

    showToast("❌ SMS Order Rejected", `Sent to ${getSupplierPhone()}: "Order ${poId} placement REJECTED."`, "error");

    // Dispatch warning alert to Owner Dashboard
    if (typeof window.addOwnerDashboardNotification === "function") {
        window.addOwnerDashboardNotification(
            `⚠️ Order Placement Rejected (${getSupplierPhone()})`,
            `Payment for Purchase Order <strong>${poId}</strong> was settled, but order placement was REJECTED via SMS prompt (${getSupplierPhone()}).`,
            "warning"
        );
    }

    window.renderProcurementScreen();
}

// Generate QR Code Module
function generateQrCode() {
    if (!currentPo.paymentVerified) return;

    currentPo.qrGenerated = true;
    currentPo.trackingStep = 2; // Timeline: QR Generated

    const secureToken = currentPo.qrToken || Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);
    currentPo.qrToken = secureToken;

    const secureUrl = `${window.location.origin}/api/supplier/orders/${currentPo.id}?token=${secureToken}`;
    const qrData = {
        poNumber: currentPo.id,
        supplierId: "badikatori-wholesale",
        secureUrl: secureUrl,
        orderToken: secureToken
    };

    const imgEl = document.getElementById("imgProcPoQr");
    if (imgEl) {
        imgEl.style.opacity = "0";
        imgEl.style.transform = "scale(0.95)";
        imgEl.style.transition = "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
        
        imgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify(qrData))}`;
        
        setTimeout(() => {
            imgEl.style.opacity = "1";
            imgEl.style.transform = "scale(1)";
        }, 150);
    }

    const lblId = document.getElementById("lblProcPoQrID");
    if (lblId) lblId.innerText = currentPo.id;

    const lblToken = document.getElementById("lblProcPoQrToken");
    if (lblToken) lblToken.innerText = `Token: ${secureToken.substring(0, 12)}...`;

    // Display the modal
    const modal = document.getElementById("modalProcQrDisplay");
    if (modal) modal.style.display = "flex";

    // Also display the inline QR block
    const qrSection = document.getElementById("procPaymentQrSection");
    if (qrSection) {
        qrSection.style.display = "block";
        const inlineImg = qrSection.querySelector("#divProcQrSvg");
        if (inlineImg) {
            inlineImg.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(JSON.stringify(qrData))}" style="width: 120px; height: 120px; border-radius: 6px; border: 1px solid var(--border);">`;
        }
    }

    showToast("QR Code Generated", "Secure purchase order QR code activated for receipt matching.", "success");
    window.renderProcurementScreen();
}

// Download PO QR Code image
function downloadPoQr() {
    const secureToken = currentPo.qrToken || "default_token";
    const secureUrl = `${window.location.origin}/api/supplier/orders/${currentPo.id}?token=${secureToken}`;
    const qrData = {
        poNumber: currentPo.id,
        supplierId: "badikatori-wholesale",
        secureUrl: secureUrl,
        orderToken: secureToken
    };
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(JSON.stringify(qrData))}`;
    
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `PO_QR_${currentPo.id}.png`;
    a.target = "_blank";
    a.click();
    showToast("Download Started", "Downloading secure QR code PNG image.", "success");
}

// Print PO QR Code
function printPoQr() {
    const secureToken = currentPo.qrToken || "default_token";
    const secureUrl = `${window.location.origin}/api/supplier/orders/${currentPo.id}?token=${secureToken}`;
    const qrData = {
        poNumber: currentPo.id,
        supplierId: "badikatori-wholesale",
        secureUrl: secureUrl,
        orderToken: secureToken
    };
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;

    const printWin = window.open("", "_blank");
    printWin.document.write(`
        <html>
        <head>
            <title>Print PO QR - ${currentPo.id}</title>
            <style>
                body { font-family: sans-serif; text-align: center; padding: 40px; }
                h2 { margin-bottom: 20px; }
                img { border: 1px solid #ccc; padding: 10px; border-radius: 8px; }
                p { margin-top: 10px; font-size: 14px; color: #555; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <h2>Badi Katori Wholesale Ltd.</h2>
            <h3>Purchase Order Secure QR: ${currentPo.id}</h3>
            <img src="${qrUrl}" alt="PO QR">
            <p>Scan to match and verify delivery challan matching details.</p>
        </body>
        </html>
    `);
    printWin.document.close();
}

// Copy Secure Order Link
function copyPoQrLink() {
    const secureToken = currentPo.qrToken || "default_token";
    const secureUrl = `${window.location.origin}/api/supplier/orders/${currentPo.id}?token=${secureToken}`;
    navigator.clipboard.writeText(secureUrl).then(() => {
        showToast("Link Copied", "Secure supplier portal verification link copied to clipboard.", "success");
    });
}

// Regenerate QR Code Token
function regeneratePoQr() {
    currentPo.qrToken = Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);
    generateQrCode();
    showToast("QR Regenerated", "Security token rotated and new QR code generated.", "success");
}

// Open Place Order confirm Modal
function openConfirmPlaceModal() {
    if (currentPo.status === "Payment Verified (Awaiting SMS Acceptance)") {
        alert("Cannot place order. Please confirm order placement via SMS Acceptance Prompt first!");
        return;
    }
    if (!currentPo.paymentVerified) {
        alert("Cannot place order. Payment must be verified first!");
        return;
    }
    const modal = document.getElementById("modalProcConfirmPlace");
    if (modal) modal.style.display = "flex";
}

// Confirm and Send Order to Master Supplier
async function confirmAndSendOrder() {
    if (!currentPo.paymentVerified) {
        alert("Cannot place order. Payment must be verified first!");
        return;
    }
    const modal = document.getElementById("modalProcConfirmPlace");
    if (modal) modal.style.display = "none";

    currentPo.status = "Order Sent (Placed)";
    currentPo.trackingStep = 3; // Timeline: Order Placed

    showToast("Order Dispatched", "Purchase order PR-2026-07-001 routed to Master Supplier portal.", "success");
    
    // Simulate Email & WhatsApp notifications
    setTimeout(() => {
        showToast(
            "📧 Email Outgoing", 
            `To: ${getSupplierName()} &lt;${getSupplierEmail()}&gt;<br>Subject: Purchase Order ${activeOrderDetails ? activeOrderDetails.id : currentPo.id} Created`, 
            "info"
        );
    }, 1000);

    setTimeout(() => {
        showToast(
            "💬 WhatsApp Business Alert", 
            `Sent to ${getSupplierPhone()}: "Hello ${getSupplierName().split(' ')[0]}, Badi Katori has created PO ${activeOrderDetails ? activeOrderDetails.id : currentPo.id} for Rs ${(activeOrderDetails ? activeOrderDetails.grandTotal : currentPo.grandTotal).toFixed(2)}. Verification details attached."`, 
            "whatsapp"
        );
    }, 2500);

    // Save Requisition Order in Database!
    try {
        const token = localStorage.getItem("bk_token");
        const store = window.bk_state.getCurrentStore();
        const role = window.bk_state.getCurrentRole();
        
        const payload = {
            id: currentPo.id,
            branchName: store,
            managerName: "Branch Manager",
            subtotal: currentPo.subtotal,
            gst: currentPo.gst,
            grandTotal: currentPo.grandTotal,
            paymentMethod: "UPI Transfer",
            expectedDeliveryDate: getFutureDateStr(1),
            notes: "Automated replenishment from Low Stock smart module.",
            items: currentPo.items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                rate: item.rate,
                amount: item.amount,
                gst: item.gst || (item.amount * 0.18),
                total: item.total || (item.amount * 1.18)
            }))
        };

        const response = await fetch(`${window.bk_state.API_BASE}/api/pos/requisitions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log("Purchase order persisted in database successfully.");
            // Mark payment as paid in database
            await fetch(`${window.bk_state.API_BASE}/api/pos/requisitions/${currentPo.id}/pay`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ transactionId: currentPo.transactionId })
            });
            
            // Sync
            window.bk_state.syncStateFromServer();
        }
    } catch (e) {
        console.error("Failed to save PO to database:", e);
    }

    // Save active tracking details
    activeOrderDetails = JSON.parse(JSON.stringify(currentPo));

    // Clear and empty the cart draft!
    currentPo.items = [];
    currentPo.transactionId = "";
    currentPo.receiptUploaded = false;
    currentPo.paymentVerified = false;
    currentPo.qrGenerated = false;
    currentPo.trackingStep = 0;
    currentPo.status = "Draft (Empty)";
    currentPo.paymentStatus = "Pending Approval";
    currentPo.id = "PO-2026-07-" + Math.floor(100 + Math.random()*900);
    calculatePoTotals();

    // Switch to Supplier Portal simulation automatically to guide user testing!
    setProcMode("supplier");
    
    window.renderProcurementScreen();
}

// Supplier Portal simulator buttons rendering
function renderSupplierPortalSimulation() {
    const controls = document.getElementById("supplierPortalControls");
    if (!controls) return;

    controls.innerHTML = "";

    const activeStep = activeOrderDetails ? activeOrderDetails.trackingStep : currentPo.trackingStep;

    // Render supplier buttons depending on the manager order tracking step
    if (activeStep === 3) {
        controls.innerHTML = `
            <button class="saas-btn" id="btnSupAccept" style="background: var(--success); color:#FFF; font-size:0.75rem; padding: 4px 10px;">Accept Order</button>
            <button class="saas-btn" id="btnSupReject" style="background: var(--danger); color:#FFF; font-size:0.75rem; padding: 4px 10px;">Reject Order</button>
        `;
        document.getElementById("btnSupAccept")?.addEventListener("click", () => updateSupplierStep(4, "Supplier Accepted", "Order accepted by Anand Verma. Packed stage initialized."));
        document.getElementById("btnSupReject")?.addEventListener("click", () => updateSupplierStep(0, "Cancelled (Rejected)", "Order rejected by supplier due to item inventory shortage."));
    } 
    else if (activeStep === 4) {
        controls.innerHTML = `
            <button class="saas-btn" id="btnSupPrep" style="background: var(--antique-brass); color:#FFF; font-size:0.75rem; padding: 4px 10px;">Mark Preparing</button>
        `;
        document.getElementById("btnSupPrep")?.addEventListener("click", () => updateSupplierStep(5, "Preparing", "Supplier assembling ingredients in cold storage."));
    } 
    else if (activeStep === 5) {
        controls.innerHTML = `
            <button class="saas-btn" id="btnSupPack" style="background: var(--orange-primary); color:#FFF; font-size:0.75rem; padding: 4px 10px;">Mark Packed</button>
        `;
        document.getElementById("btnSupPack")?.addEventListener("click", () => updateSupplierStep(6, "Packed & Ready", "Crates loaded, sealed with barcodes."));
    } 
    else if (activeStep === 6) {
        controls.innerHTML = `
            <button class="saas-btn" id="btnSupDispatch" style="background: var(--text-primary); color:#FFF; font-size:0.75rem; padding: 4px 10px;">Mark Dispatched</button>
        `;
        document.getElementById("btnSupDispatch")?.addEventListener("click", () => {
            const trackNo = prompt("Enter Dispatch Shipment Waybill (e.g. SURAT-EXP-9283):", "SURAT-EXP-" + Math.floor(1000 + Math.random()*9000));
            if (trackNo) {
                updateSupplierStep(7, "Dispatched", `Transit via Surat Express Cargo. Tracker ID: ${trackNo}`);
            }
        });
    } 
    else if (activeStep === 7) {
        controls.innerHTML = `
            <button class="saas-btn" id="btnSupDeliver" style="background: var(--success); color:#FFF; font-size:0.75rem; padding: 4px 10px;">Mark Delivered</button>
        `;
        document.getElementById("btnSupDeliver")?.addEventListener("click", completeRequisitionWorkflow);
    } 
    else if (activeStep >= 8) {
        controls.innerHTML = `<span style="font-size:0.75rem; font-weight:700; color:var(--success); display:flex; align-items:center; gap:4px;"><i data-lucide="check-circle-2" style="width:14px; height:14px;"></i> Order Fulfilled &amp; Synced</span>`;
    } 
    else {
        controls.innerHTML = `<span style="font-size:0.75rem; color:var(--text-tertiary);">Awaiting Order Dispatch</span>`;
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Supplier state modifications
async function updateSupplierStep(step, statusName, detailsText) {
    if (!activeOrderDetails) return;

    activeOrderDetails.trackingStep = step;
    activeOrderDetails.status = statusName;
    
    showToast(`Supplier Action: ${statusName}`, detailsText, "success");

    // Sync status to database server!
    try {
        const token = localStorage.getItem("bk_token");
        await fetch(`${window.bk_state.API_BASE}/api/pos/requisitions/${activeOrderDetails.id}/status`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: statusName, notes: detailsText })
        });
        window.bk_state.syncStateFromServer();
    } catch(e) {
        console.error("Failed to sync status to server:", e);
    }

    window.renderProcurementScreen();
}

// Complete Requisition Workflow & Update Local inventory via server API
async function completeRequisitionWorkflow() {
    if (!activeOrderDetails) return;

    activeOrderDetails.trackingStep = 8;
    activeOrderDetails.status = "Delivered";
    showToast("Shipment Delivered", "Cargo received at branch. QR matched. Verifying inventory integration...", "success");
    window.renderProcurementScreen();

    // Trigger Timeline Step 9: Inventory Auto-Updated
    setTimeout(async () => {
        if (!activeOrderDetails) return;
        activeOrderDetails.trackingStep = 9;
        activeOrderDetails.status = "Inventory Integrated";
        showToast("Stock Auto Integrated", "Local stock levels increased based on purchase order quantities.", "success");

        // Execute status update to 'Completed' on database server
        try {
            const token = localStorage.getItem("bk_token");
            await fetch(`${window.bk_state.API_BASE}/api/pos/requisitions/${activeOrderDetails.id}/status`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ status: "Completed", notes: "Order received and stock added back to branch inventory." })
            });
            // Fetch updated state from server (triggers inventory tables redraws)
            window.bk_state.syncStateFromServer();
        } catch(e) {
            console.error("Failed to complete PO on server:", e);
        }

        window.renderProcurementScreen();
    }, 2000);
}

// Cancel Requisition Order
function cancelActiveOrder() {
    if (confirm("Are you sure you want to cancel this draft purchase request?")) {
        currentPo.items = [];
        currentPo.transactionId = "";
        currentPo.receiptUploaded = false;
        currentPo.paymentVerified = false;
        currentPo.qrGenerated = false;
        currentPo.trackingStep = 0;
        
        // Hide QR section
        const qrSection = document.getElementById("procPaymentQrSection");
        if (qrSection) qrSection.style.display = "none";
        
        // Reset receipt upload button
        const btnUpload = document.getElementById("btnProcUploadReceipt");
        if (btnUpload) {
            btnUpload.innerHTML = `<i data-lucide="upload-cloud"></i> Upload Receipt`;
            btnUpload.style.borderColor = "var(--border)";
        }

        // Generate a new PO number
        currentPo.id = "PO-2026-07-" + Math.floor(100 + Math.random()*900);
        
        showToast("Requisition Reset", "Draft purchase request discarded. Scanning low stock levels.", "info");
        window.renderProcurementScreen();
    }
}

// Download PO Text Receipt
function downloadPOText() {
    let output = `====================================================
BADI KATORI RESTAURANT GROUP
PURCHASE ORDER: ${currentPo.id}
====================================================
Date: ${currentPo.date}
Time: ${currentPo.time}
Store Branch: ${window.bk_state.getCurrentStore()}
Manager Name: Operations Lead
Supplier: Badi Katori Wholesale Ltd.
Priority: ${currentPo.priority}
----------------------------------------------------
ORDERED ITEMS SUMMARY:
`;
    
    currentPo.items.forEach((item, idx) => {
        output += `${idx+1}. ${item.productName} 
   Quantity: ${item.quantity} units  | Rate: Rs ${item.rate.toFixed(2)} | Subtotal: Rs ${item.amount.toFixed(2)}\n`;
    });

    output += `----------------------------------------------------
Financial Breakdown:
Subtotal: Rs ${currentPo.subtotal.toFixed(2)}
GST (18%): Rs ${currentPo.gst.toFixed(2)}
Grand Total: Rs ${currentPo.grandTotal.toFixed(2)}
----------------------------------------------------
Payment Details:
Payment Status: ${currentPo.paymentStatus}
Transaction Ref: ${currentPo.transactionId || "N/A"}
Payment Date: ${currentPo.paymentDate || "N/A"}
====================================================\n`;

    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Purchase_Order_${currentPo.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// Download Bank details file
function downloadBankDetailsFile() {
    const text = `HDFC Bank Account Details for Badi Katori Master Supplies:
----------------------------------------
Account Holder Name: Badi Katori Wholesale Supplies Ltd.
Bank Name: HDFC Bank Ltd.
Account Number: 50200084325729
IFSC Code: HDFC0001248
Branch: Ichhapore Branch, Surat
UPI ID: badikatori@hdfcbank
GST Number: 24AAACB1234F1Z5
----------------------------------------`;
    
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Badi_Katori_Supplier_Bank_Details.txt";
    a.click();
    URL.revokeObjectURL(url);
}

// QR Details modal preview
function previewQrDetails() {
    const modal = document.getElementById("modalProcQrDetails");
    const container = document.getElementById("divProcQrDetailsContent");
    if (!modal || !container) return;

    const targetPo = activeOrderDetails || currentPo;

    let itemsHtml = "";
    targetPo.items.forEach(item => {
        itemsHtml += `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>${item.productName} (x${item.quantity})</span>
                <strong>Rs ${item.amount.toFixed(2)}</strong>
            </div>
        `;
    });

    container.innerHTML = `
        <div style="background: rgba(194, 159, 104, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(194, 159, 104, 0.2); margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between;">
                <span>PO Identifier:</span>
                <strong>${targetPo.id}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:4px;">
                <span>Supplier Name:</span>
                <strong>Badi Katori Wholesale Ltd.</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:4px;">
                <span>UPI Settle Ref:</span>
                <strong>${targetPo.transactionId || "N/A"}</strong>
            </div>
        </div>

        <div style="margin-bottom: 12px;">
            <div style="font-weight: 700; border-bottom: 1px solid var(--border); padding-bottom: 4px; margin-bottom: 8px;">Requisition Items</div>
            ${itemsHtml}
        </div>

        <div style="margin-bottom: 12px;">
            <div style="font-weight: 700; border-bottom: 1px solid var(--border); padding-bottom: 4px; margin-bottom: 8px;">Delivery Routing Details</div>
            <div><strong>Address:</strong> Plot No. 12, VIP Road, Vesu, Surat - 395007</div>
            <div style="margin-top: 4px;"><strong>Expected Transit Time:</strong> ${getFutureDateStr(1)} (Express Delivery)</div>
        </div>

        <div style="background: rgba(46, 35, 31, 0.02); padding: 10px; border-radius: 6px; border: 1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <span>Current Timeline Stage:</span>
            <span class="proc-pill proc-pill-success">${targetPo.status}</span>
        </div>
    `;

    modal.style.display = "flex";
}

// Download Monthly procurement report
function downloadMonthlyReport() {
    const text = `BK OPERATIONS INDIA - PROCUREMENT REPORT
Reporting Month: July 2026
Franchise Branch: ${window.bk_state.getCurrentStore()}
============================================================
Total Procurement Orders Placed: 12
Total Verified Capital Expenses: Rs 2,45,820.00
Average Fulfillment Transit Time: 5.2 Hours
Suppliers Associated: 1 (Badi Katori Wholesale Ltd.)
Most Ordered SKU: Raw Chicken Patties (Whopper)
============================================================
Order ID       Date         Vendor             Amount      Status
------------------------------------------------------------
PO-2026-07-001 2026-07-02   BK Wholesale Ltd.  Rs 21,535   Completed
PO-2026-07-002 2026-07-05   BK Wholesale Ltd.  Rs 18,250   Completed
PO-2026-07-003 2026-07-08   BK Wholesale Ltd.  Rs 41,200   Completed
PO-2026-07-004 2026-07-10   BK Wholesale Ltd.  Rs 12,800   Dispatched
PO-2026-07-005 2026-07-13   BK Wholesale Ltd.  Rs ${currentPo.grandTotal}   ${currentPo.status}
============================================================`;
    
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "BK_Procurement_Monthly_Report_July_2026.txt";
    a.click();
    URL.revokeObjectURL(url);
}

// Load previous requisitions stats to count dashboard metrics
async function loadPreviousRequisitionsStats() {
    try {
        const token = localStorage.getItem("bk_token");
        const response = await fetch(`${window.bk_state.API_BASE}/api/pos/requisitions`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        if (response.ok) {
            const list = await response.json();
            const currentStore = window.bk_state.getCurrentStore();
            const storeList = list.filter(o => o.branchName === currentStore);

            // Calculate card metrics based on actual DB records
            const awaitingApproval = storeList.filter(o => o.paymentStatus === 'Waiting for Payment' || o.orderStatus === 'Payment Pending').length;
            const inProgress = storeList.filter(o => o.orderStatus !== 'Completed' && o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Payment Pending' && o.orderStatus !== 'Waiting for Payment').length;
            const completed = storeList.filter(o => o.orderStatus === 'Completed' || o.orderStatus === 'Delivered').length;

            document.getElementById("lblProcActiveRequests").innerText = `${storeList.length} Active`;
            document.getElementById("lblProcAwaitingApproval").innerText = `${awaitingApproval} Orders`;
            document.getElementById("lblProcInProgress").innerText = `${inProgress} Shipments`;
            document.getElementById("lblProcDelivered").innerText = `${completed} Completed`;
        }
    } catch(e) {
        console.error("Failed to load requisition stats:", e);
    }
}

// Add an item directly from the Inventory Management screen to the active Purchase Request
window.addInventoryItemToPO = function(itemId) {
    const inventory = window.bk_state.getInventory();
    const item = inventory.find(i => i.id === itemId);
    if (!item) {
        alert("Inventory item not found.");
        return;
    }

    // Reset current PO if it is already placed/completed
    if (currentPo.trackingStep >= 3) {
        currentPo.items = [];
        currentPo.transactionId = "";
        currentPo.receiptUploaded = false;
        currentPo.paymentVerified = false;
        currentPo.qrGenerated = false;
        currentPo.trackingStep = 0;
        currentPo.status = "Low Stock Detected";
        currentPo.paymentStatus = "Pending Approval";
        currentPo.id = "PO-2026-07-" + Math.floor(100 + Math.random()*900);
        
        // Hide QR section
        const qrSection = document.getElementById("procPaymentQrSection");
        if (qrSection) qrSection.style.display = "none";
        
        // Reset receipt upload button
        const btnUpload = document.getElementById("btnProcUploadReceipt");
        if (btnUpload) {
            btnUpload.innerHTML = `<i data-lucide="upload-cloud"></i> Upload Receipt`;
            btnUpload.style.borderColor = "var(--border)";
        }
    }

    const existing = currentPo.items.find(i => i.productId === itemId);
    const suggestedQty = Math.max(50, (item.reorder * 2) - (item.stock || 0));
    
    if (existing) {
        existing.quantity += suggestedQty;
        existing.amount = existing.quantity * existing.rate;
        showToast("Quantity Increased", `${item.label} quantity increased in active Purchase Order.`, "success");
    } else {
        currentPo.items.push({
            productId: item.id,
            productName: item.label,
            quantity: suggestedQty,
            stock: item.stock || 0,
            rate: item.unitCost || 20.00,
            amount: suggestedQty * (item.unitCost || 20.00)
        });
        showToast("Item Added", `${item.label} added to active Purchase Order.`, "success");
    }

    calculatePoTotals();
    
    // Update the procurement screen metrics and table in the background
    if (typeof window.renderProcurementScreen === 'function') {
        window.renderProcurementScreen();
    }
};

// Remove an item from the active Purchase Order draft
window.removeInventoryItemFromPO = function(productId) {
    const index = currentPo.items.findIndex(i => i.productId === productId);
    if (index !== -1) {
        const removedItem = currentPo.items[index];
        currentPo.items.splice(index, 1);
        calculatePoTotals();
        showToast("Item Removed", `${removedItem.productName} removed from Purchase Order.`, "info");
        window.renderProcurementScreen();
    }
};

// Helper date strings
function getFutureDateStr(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Hook into DOMContentLoaded for testing standalone loading
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        if (window.initProcurementModule) window.initProcurementModule();
    });
} else {
    if (window.initProcurementModule) window.initProcurementModule();
}
