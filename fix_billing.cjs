const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// fix item.modifiers.forEach to (item.modifiers || []).forEach
content = content.replace(/item\.modifiers\.forEach\(/g, '(item.modifiers || []).forEach(');
// also fix item.modifiers && item.modifiers.length > 0 to (item.modifiers && item.modifiers.length > 0)
// no wait, that's already safe.

// Are there any other potential issues?
// let's just write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed item.modifiers.forEach');
