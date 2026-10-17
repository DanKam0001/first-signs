// Starts a cloudflared quick tunnel to the local server and writes its https URL to server/.public_url.
// The server reads that file when it builds phoneUrl, so `npm run dev` + `npm run tunnel` in two terminals just works.
// `npm run tunnel -- --server` also starts the server (with PUBLIC_URL set) in this same terminal.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const urlFile = path.join(serverDir, ".public_url");
const port = Number(process.env.PORT || 8788);
const exe = process.env.CLOUDFLARED ||
  (process.platform === "win32" ? "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe" : "cloudflared");
const withServer = process.argv.includes("--server");

let server = null;
const cf = spawn(exe, ["tunnel", "--no-autoupdate", "--url", `http://localhost:${port}`], { stdio: ["ignore", "pipe", "pipe"] });
cf.on("error", (err) => { console.error(`[tunnel] could not start ${exe}: ${err.message} (set CLOUDFLARED=path)`); process.exit(1); });

let found = false;
const onData = (buf) => {
  const s = buf.toString();
  if (process.env.TUNNEL_VERBOSE) process.stderr.write(s);
  const m = !found && s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (!m) { if (/ERR|error/i.test(s) && !found) process.stderr.write(s); return; }
  found = true;
  fs.writeFileSync(urlFile, m[0] + "\n");
  console.log(`[tunnel] PUBLIC_URL=${m[0]}`);
  console.log(`[tunnel] wrote ${urlFile} (the server reads it for phoneUrl). TV over the tunnel: wss://${m[0].slice(8)}/ws`);
  console.log(`[tunnel] fake TV: ${m[0]}/tools/fake_tv.html`);
  if (withServer) {
    server = spawn(process.execPath, ["src/index.js"], { cwd: serverDir, stdio: "inherit", env: { ...process.env, PUBLIC_URL: m[0] } });
    server.on("exit", (code) => shutdown(code ?? 0));
  }
};
cf.stdout.on("data", onData);
cf.stderr.on("data", onData);
cf.on("exit", (code) => { console.log(`[tunnel] cloudflared exited (${code})`); shutdown(code ?? 1); });

let done = false;
function shutdown(code) {
  if (done) return;
  done = true;
  try { fs.unlinkSync(urlFile); } catch {}
  try { cf.kill(); } catch {}
  try { server && server.kill(); } catch {}
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
