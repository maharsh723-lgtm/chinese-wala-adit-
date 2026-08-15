const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /if\s*\(method\s*===\s*'UPI'\)\s*\{\s*if\s*\(posCart\.length\s*===\s*0\)\s*\{\s*alert\("No items in the cart to settle!"\);\s*return;\s*\}\s*processPayment\(method\);\s*\}\s*else\s*\{\s*processPayment\(method\);\s*\}/;

const replacementStr = `if (method === 'UPI') {
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
                    }`;

if (regex.test(content)) {
    content = content.replace(regex, replacementStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed QR popup logic!');
} else {
    console.log('Target regex not found!');
}
