const fs = require('fs');
let code = fs.readFileSync('src/app.js', 'utf8');

const target1 = "            socket.on('order_placed', (data) => {\r\n                showToast(`New order placed: ${data.kotNumber} (₹${data.grandTotal})`);\r\n                syncStateFromServer();\r\n            });";
const replacement1 = "            socket.on('order_placed', (data) => {\r\n                showToast(`New order placed: ${data.kotNumber} (₹${data.grandTotal})`);\r\n                syncStateFromServer();\r\n                window.dispatchEvent(new CustomEvent('bk_order_placed', { detail: data }));\r\n            });";

if (code.includes(target1)) {
    code = code.replace(target1, replacement1);
    console.log('Replaced order_placed event handler (CRLF).');
} else {
    // Try LF
    const target2 = target1.replace(/\r\n/g, '\n');
    const replacement2 = replacement1.replace(/\r\n/g, '\n');
    if (code.includes(target2)) {
        code = code.replace(target2, replacement2);
        console.log('Replaced order_placed event handler (LF).');
    } else {
        console.log('Target string not found!');
    }
}

fs.writeFileSync('src/app.js', code);
