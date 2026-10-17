import os from "node:os";
import { loadConfig, readPublicUrl } from "./config.js";
import { createServer, ensureDirs } from "./server.js";

const cfg = loadConfig();
ensureDirs(cfg);
const app = createServer(cfg);
const port = await app.listen();

const lan = Object.values(os.networkInterfaces()).flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
console.log(`[server] First Signs relay on http://localhost:${port}`);
for (const ip of lan) console.log(`[server]   LAN: ws://${ip}:${port}/ws   (TV can connect here)`);
console.log(`[server]   public URL for phones: ${readPublicUrl(cfg) || "(none yet: run `npm run tunnel` or set PUBLIC_URL)"}`);
console.log(`[server]   fake TV: http://localhost:${port}/tools/fake_tv.html   health: http://localhost:${port}/healthz`);
console.log(`[server]   AWS profile ${process.env.AWS_PROFILE}, region ${cfg.region}${cfg.disableAws ? " (AWS DISABLED)" : ""}`);

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, async () => { await app.close(); process.exit(0); });
