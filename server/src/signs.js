// Loads signs.json from model/export, falling back to the phone/stub fixture until the real one exists.
// Re-reads the file when it changes, so the model bundle can be dropped in while the server runs.
import fs from "node:fs";
import path from "node:path";
import { parseSigns } from "../../phone/lib/signs.js";

export class SignsStore {
  constructor(cfg, log = console) {
    this.cfg = cfg;
    this.log = log;
    this.cache = null;
    this.key = "";
  }

  get() {
    const real = path.join(this.cfg.modelDir, "signs.json");
    const file = fs.existsSync(real) ? real : path.join(this.cfg.stubDir, "signs.json");
    let mtime = 0;
    try { mtime = fs.statSync(file).mtimeMs; } catch {}
    const key = `${file}:${mtime}`;
    if (key !== this.key) {
      try {
        const parsed = parseSigns(JSON.parse(fs.readFileSync(file, "utf8")));
        this.cache = { ...parsed, file, fixture: file !== real };
        this.key = key;
        this.log.log(`[signs] loaded ${parsed.signs.length} signs from ${file}${file !== real ? " (FIXTURE)" : ""}`);
      } catch (err) {
        this.log.error(`[signs] could not read ${file}: ${err.message}`);
        if (!this.cache) this.cache = { ...parseSigns([]), file, fixture: true };
      }
    }
    return this.cache;
  }
}
