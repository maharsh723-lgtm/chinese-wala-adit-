const fs = require('fs');
let code = fs.readFileSync('src/app.js', 'utf8');
code = code.replace(/doc\.text\("Service Charge \(5%\):", 5, y\);\s*\/\/\s*doc\.text\(`₹\$\{order\.serviceCharge\.toFixed\(2\)\}`, 75, y, \{ align: "right" \}\);/, '');
fs.writeFileSync('src/app.js', code);
