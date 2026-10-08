const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract content inside <body>...</body>
const bodyMatch = htmlContent.match(/<body>([\s\S]*?)<\/body>/i);
if (!bodyMatch) {
  console.error('Failed to extract <body> from index.html');
  process.exit(1);
}

const bodyInnerHtml = bodyMatch[1].trim();

// Construct app/page.js
const pageJsContent = `'use client';

import { useEffect } from 'react';
import '../src/app.js';

export default function Home() {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.initApp) {
      window.initApp();
    }
  }, []);

  return (
    <div dangerouslySetInnerHTML={{ __html: \`${bodyInnerHtml.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\` }} />
  );
}
`;

const targetPath = path.join(__dirname, 'app', 'page.js');
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, pageJsContent, 'utf8');

console.log('Successfully generated app/page.js from index.html!');
