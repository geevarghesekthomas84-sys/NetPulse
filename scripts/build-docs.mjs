import fs from 'node:fs';
import { execSync } from 'node:child_process';

console.log('Building production bundle...');
execSync('npm run build', { stdio: 'inherit' });

console.log('Syncing dist/ to docs/ for GitHub Pages...');
if (fs.existsSync('docs')) {
  fs.rmSync('docs', { recursive: true, force: true });
}
fs.cpSync('dist', 'docs', { recursive: true });
fs.writeFileSync('docs/.nojekyll', '');

console.log('Successfully prepared docs/ with .nojekyll for GitHub Pages deployment.');
