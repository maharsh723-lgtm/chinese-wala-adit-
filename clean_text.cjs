const fs = require('fs');
const path = require('path');

// Replace remaining case variations of vesu
['index.html', 'src/app.js', 'db.cjs'].forEach(fileRel => {
  const filePath = path.join(__dirname, fileRel);
  if (!fs.existsSync(filePath)) return;
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replace(/Vesu outlet/g, 'ADIT Campus outlet');
  text = text.replace(/Vesu Branch/g, 'ADIT Campus');
  text = text.replace(/Vesu, Surat/g, 'ADIT Campus, Surat');
  text = text.replace(/VESU branch/g, 'ADIT Campus branch');
  text = text.replace(/VESU/g, 'ADIT CAMPUS');
  fs.writeFileSync(filePath, text, 'utf8');
});

console.log('Final text cleanup finished!');
