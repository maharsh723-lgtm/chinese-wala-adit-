const fs = require('fs');
let code = fs.readFileSync('server.cjs', 'utf8');

// 1. Remove the static server exposing the root directory
code = code.replace(/app\.use\(express\.static\(__dirname,\s*\{\s*setHeaders:\s*\(res,\s*filePath\)\s*=>\s*\{\s*res\.set\('Cache-Control',\s*'no-store,\s*no-cache,\s*must-revalidate,\s*private'\);\s*\}\s*\}\)\);/, '');

// 2. Add authenticateToken to API routes
const regex = /(app\.(get|post|put|delete)\(\s*['"`]\/api\/([^'"`]+)['"`]\s*,)\s*([^)]+)\)\s*=>/g;

// List of routes to ignore (public routes)
const publicRoutesRegex = /^\/api\/(config|patch-dates|auth\/login|webhooks\/swiggy\/order|webhooks\/zomato\/order)$/;

code = code.replace(regex, (match, prefix, method, route, args) => {
  const fullRoute = '/api/' + route;
  
  if (publicRoutesRegex.test(fullRoute)) {
    return match; // Do not modify public routes
  }
  
  if (args.includes('authenticateToken')) {
    return match; // Already authenticated
  }

  // Insert authenticateToken
  return `${prefix} authenticateToken, ${args}) =>`;
});

fs.writeFileSync('server.cjs', code);
console.log('Security patch applied successfully.');
