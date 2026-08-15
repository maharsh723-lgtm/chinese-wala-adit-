const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/document\.getElementById\("posCouponInput"\)\.value = '';/g, 'const _pci = document.getElementById("posCouponInput"); if(_pci) _pci.value = "";');
content = content.replace(/document\.getElementById\("posOrderInstructions"\)\.value = '';/g, 'const _poi = document.getElementById("posOrderInstructions"); if(_poi) _poi.value = "";');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed nulls');
