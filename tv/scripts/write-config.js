#!/usr/bin/env node
// Writes src/generated/config.json with the build-time default server URL.
// FS_SERVER_URL wins; otherwise ws://<this machine's LAN IPv4>:8788/ws (PROTOCOL.md sections 1 and 4).
const fs = require('fs');
const os = require('os');
const path = require('path');

function lanIp() {
  const cands = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (/vEthernet|WSL|Hyper-V|VirtualBox|VMware|Loopback|docker|Tailscale|ZeroTier/i.test(name)) continue;
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      let score = 0;
      if (a.address.startsWith('192.168.')) score = 3;
      else if (a.address.startsWith('10.')) score = 2;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) score = 1;
      cands.push({ score, address: a.address, name });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  return cands[0] ? cands[0].address : '192.168.1.100';
}

const url = process.env.FS_SERVER_URL || `ws://${lanIp()}:8788/ws`;
const out = path.resolve(__dirname, '..', 'src', 'generated');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify({ defaultServerUrl: url, builtAt: new Date().toISOString() }, null, 2)
);
console.log(`[write-config] default server URL: ${url}`);
