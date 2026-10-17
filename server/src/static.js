// Minimal static file serving with path-traversal protection.
import fs from "node:fs";
import path from "node:path";

export const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".onnx": "application/octet-stream",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".task": "application/octet-stream",
};

// Resolves `rel` inside `root`, or returns null if it escapes root or is not a file.
export function resolveIn(root, rel) {
  let decoded;
  try { decoded = decodeURIComponent(rel); } catch { return null; }
  const full = path.resolve(root, "." + path.sep + decoded);
  const rootAbs = path.resolve(root);
  if (full !== rootAbs && !full.startsWith(rootAbs + path.sep)) return null;
  try { return fs.statSync(full).isFile() ? full : null; } catch { return null; }
}

export function sendFile(req, res, file, { cache = "no-cache" } = {}) {
  const stat = fs.statSync(file);
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": cache,
    "Access-Control-Allow-Origin": "*",
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
}

export function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

export function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end("not found");
}
