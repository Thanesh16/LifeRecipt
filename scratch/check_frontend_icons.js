import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const lucide = require('../frontend/node_modules/lucide-react/dist/cjs/lucide-react.js');

function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        results = results.concat(getAllFiles(filePath));
      }
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(filePath);
    }
  });
  return results;
}

const lucideSet = new Set(Object.keys(lucide));
const files = getAllFiles(path.resolve('frontend/src'));
let totalIssues = 0;

files.forEach((f) => {
  const content = fs.readFileSync(f, 'utf8');
  const tags = [...content.matchAll(/<([A-Z][a-zA-Z0-9]+)/g)].map((m) => m[1]);
  const importedMatches = [...content.matchAll(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/g)];
  const importedLucide = [];
  importedMatches.forEach((m) => {
    m[1].split(',').forEach((s) => importedLucide.push(s.trim()));
  });
  const importedSet = new Set(importedLucide);

  const localDeclared = new Set([
    ...content.matchAll(/(?:const|function|let|class)\s+([A-Za-z0-9_]+)/g),
  ].map((m) => m[1]));

  const missingForFile = new Set();
  tags.forEach((t) => {
    if (lucideSet.has(t) && !importedSet.has(t) && !localDeclared.has(t)) {
      missingForFile.add(t);
    }
  });

  if (missingForFile.size > 0) {
    console.log(`${f} -> MISSING: ${[...missingForFile].join(', ')}`);
    totalIssues += missingForFile.size;
  }
});

console.log(`Total missing icon issues across frontend: ${totalIssues}`);
