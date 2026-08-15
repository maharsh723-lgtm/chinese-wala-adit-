const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(srcDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Regex to match the API_BASE pattern
  const regex = /let API_BASE = '';\s*if\s*\(window\.location\.hostname === 'localhost' \|\| window\.location\.hostname === '127\.0\.0\.1'\)\s*\{\s*API_BASE = 'http:\/\/localhost:3000';\s*\}\s*else\s*\{\s*API_BASE = `\$\{window\.location\.protocol\}\/\/\$\{window\.location\.hostname\}:3000`;\s*\}/g;
  
  if (regex.test(content)) {
    content = content.replace(regex, "let API_BASE = '';");
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated', file);
  }
}
