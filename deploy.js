const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DOMAIN = 'tv-ki-pro-live.surge.sh';
const DIST_DIR = path.join(__dirname, 'dist');
const surgeBin = 'C:\\Users\\realg\\AppData\\Local\\npm-cache\\_npx\\23158936acd5c32d\\node_modules\\surge\\lib\\cli.js';

fs.writeFileSync(path.join(DIST_DIR, 'CNAME'), DOMAIN + '\n');

const cmd = fs.existsSync(surgeBin) ? process.execPath : 'cmd.exe';
const args = fs.existsSync(surgeBin)
  ? [surgeBin, DIST_DIR, DOMAIN]
  : ['/c', 'npx.cmd', '--yes', 'surge', DIST_DIR, DOMAIN];

const child = spawn(cmd, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, CI: '1' }
});

child.stdout.on('data', (d) => process.stdout.write(d.toString()));
child.stderr.on('data', (d) => process.stderr.write(d.toString()));

child.on('close', async (code) => {
  const res = await fetch(`https://${DOMAIN}/`).catch(() => ({ status: 0 }));
  console.log(`\nLIVE CHECK https://${DOMAIN}/ -> HTTP ${res.status}`);
  process.exit(code || 0);
});
