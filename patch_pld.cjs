const fs = require('fs');
let code = fs.readFileSync('src/plDashboard.js', 'utf8');

const target1 = "    });\r\n});";
const replacement1 = "    });\r\n\r\n    // Listen for custom event from app.js to update P&L instantly on order placed\r\n    window.addEventListener('bk_order_placed', () => {\r\n        const activeItem = document.querySelector(\".nav-item.active\");\r\n        if (activeItem && activeItem.getAttribute(\"data-target\") === 'pl-management-dashboard') {\r\n            refreshPLDashboard();\r\n        }\r\n    });\r\n});";

if (code.includes(target1)) {
    code = code.replace(target1, replacement1);
    console.log('Replaced end of plDashboard (CRLF).');
} else {
    const target2 = "    });\n});";
    const replacement2 = "    });\n\n    // Listen for custom event from app.js to update P&L instantly on order placed\n    window.addEventListener('bk_order_placed', () => {\n        const activeItem = document.querySelector(\".nav-item.active\");\n        if (activeItem && activeItem.getAttribute(\"data-target\") === 'pl-management-dashboard') {\n            refreshPLDashboard();\n        }\n    });\n});";
    if (code.includes(target2)) {
        code = code.replace(target2, replacement2);
        console.log('Replaced end of plDashboard (LF).');
    } else {
        console.log('Target string not found in plDashboard!');
    }
}
fs.writeFileSync('src/plDashboard.js', code);
