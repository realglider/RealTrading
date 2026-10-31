/**
 * Starts TradingView AI Pro local server + free public HTTPS tunnel (localhost.run)
 * so you can open the app from any smartphone (Wi-Fi or 4G/5G) without installing anything.
 */

const { spawn } = require('child_process');
require('./server.js');

const ssh = spawn(
  'ssh',
  [
    '-o',
    'StrictHostKeyChecking=no',
    '-o',
    'ServerAliveInterval=30',
    '-R',
    '80:localhost:3000',
    'nokey@localhost.run'
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);

ssh.stdout.on('data', (data) => {
  process.stdout.write(data.toString());
});

ssh.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});
