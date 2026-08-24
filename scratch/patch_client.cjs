const fs = require('fs');
let code = fs.readFileSync('src/app.js', 'utf8');

// 1. Remove password field from defaultEmployees
code = code.replace(/password:\s*["'][^"']*["']/g, 'password: ""');

// 2. Add JWT token to socket connection
code = code.replace(/socket\s*=\s*io\(API_BASE\s*\|\|\s*window\.location\.origin\);/g, 
  "socket = io(API_BASE || window.location.origin, { auth: { token: localStorage.getItem('bk_jwt_token') } });");

fs.writeFileSync('src/app.js', code);
console.log('src/app.js patched.');
