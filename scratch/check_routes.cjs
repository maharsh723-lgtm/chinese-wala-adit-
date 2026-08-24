const fs = require('fs');
const code = fs.readFileSync('server.cjs', 'utf8');

const regex = /app\.(get|post|put|delete)\(\s*['"`](\/api\/[^'"`]+)['"`]\s*,([^)]+)\)\s*=>/g;
let match;
const unprotected = [];

while ((match = regex.exec(code)) !== null) {
  const method = match[1];
  const route = match[2];
  const args = match[3];

  if (!args.includes('authenticateToken')) {
    unprotected.push(`${method.toUpperCase()} ${route}`);
  }
}

console.log('Unprotected API routes:');
unprotected.forEach(r => console.log(r));
