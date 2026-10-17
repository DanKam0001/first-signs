// `coach` -> Amazon Bedrock (Converse API) writes a short, warm tip from the sign's description in signs.json.
// It never gets to invent how a sign is made: the prompt contains only the signs.json descriptions and forbids adding
// anything. If Bedrock fails, a canned tip built from the same description is returned. Tips are cached on disk.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const SYSTEM = [
  "You coach a hearing parent who is learning American Sign Language (ASL) words to use with their Deaf child.",
  "Write a warm, encouraging tip of at most 2 short sentences.",
  "When you say how to make a sign, only restate the description you are given.",
  "Never add handshapes, movements, locations or facts that are not in that description.",
  "No emojis, no quotation marks, no lists.",
].join(" ");

const sentence = (s) => { s = String(s || "").trim(); return s && !/[.!?]$/.test(s) ? s + "." : s; };

// Only descriptions that model/ marked as checked are ever shown or sent to the LLM ("verified": false -> not used).
export function usableDescription(sign) {
  if (!sign || sign.verified === false) return "";
  return sentence(sign.description);
}

export function cannedTip(sign, attempts) {
  const d = usableDescription(sign);
  if (!d) return "Watch the example once more, then give it another go.";
  const lead = attempts >= 3 ? "Take it slowly." : attempts === 2 ? "Almost there." : "Nice try!";
  return `${lead} ${d}`;
}

// Keeps at most 2 sentences and 240 characters.
export function tidy(text) {
  let t = String(text || "").replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
  const parts = t.match(/[^.!?]+[.!?]+/g);
  if (parts && parts.length > 2) t = parts.slice(0, 2).join("").trim();
  if (t.length > 240) t = t.slice(0, 237).replace(/\s+\S*$/, "") + "...";
  return t;
}

export function buildPrompt(sign, other, attempts) {
  const lines = [`Target sign: ${sign.label || sign.id}. How it is made: ${usableDescription(sign)}`];
  if (usableDescription(other)) {
    lines.push(`The app thought their attempt looked more like the sign ${other.label || other.id} (made like this: ${usableDescription(other)})`);
  }
  lines.push(`This was attempt number ${attempts}. Write the tip.`);
  return lines.join("\n");
}

export class Coach {
  constructor(cfg, signs, log = console) {
    this.cfg = cfg;
    this.signs = signs;
    this.log = log;
    this.dir = path.join(cfg.cacheDir, "coach");
    fs.mkdirSync(this.dir, { recursive: true });
    this.models = [...cfg.bedrockModels];
    this.modelId = null; // the first model id that worked
    this.disabledUntil = 0;
    this.lastError = null;
    this.client = null;
    this.calls = 0;
  }

  async getClient() {
    if (!this.client) {
      const { BedrockRuntimeClient } = await import("@aws-sdk/client-bedrock-runtime");
      this.client = new BedrockRuntimeClient({ region: this.cfg.region });
    }
    return this.client;
  }

  // msg: {target, top:[[label,p]...], attempts}. Resolves to { text, source: "bedrock"|"cache"|"canned", modelId? }
  async tip(msg, { allowAws = true } = {}) {
    const store = this.signs.get();
    const sign = store.byId.get(msg.target);
    const attempts = Math.max(1, Math.min(3, Number(msg.attempts) || 1)); // bucketed so the cache gets hits
    // Nothing checked to ground a tip on: never let the LLM describe the sign from its own knowledge.
    if (!sign || !usableDescription(sign)) return { text: cannedTip(null, attempts), source: "canned" };
    const top = Array.isArray(msg.top) ? msg.top : [];
    const otherId = (top.find((e) => Array.isArray(e) && e[0] !== msg.target) || [])[0];
    const other = otherId ? store.byId.get(otherId) : null;
    const prompt = buildPrompt(sign, other, attempts);
    const key = createHash("sha1").update(SYSTEM + "\n" + prompt).digest("hex");
    const file = path.join(this.dir, `${key}.json`);
    try { return { ...JSON.parse(fs.readFileSync(file, "utf8")), source: "cache" }; } catch {}

    if (!allowAws || this.cfg.disableAws || Date.now() < this.disabledUntil) return { text: cannedTip(sign, attempts), source: "canned" };
    try {
      const { text, modelId } = await this._converse(prompt);
      const out = { text: tidy(text), modelId };
      if (!out.text) throw new Error("empty Bedrock reply");
      fs.writeFileSync(file, JSON.stringify(out));
      return { ...out, source: "bedrock" };
    } catch (err) {
      this.lastError = `${err.name}: ${err.message}`;
      this.disabledUntil = Date.now() + 10 * 60 * 1000; // don't hammer a failing endpoint
      this.log.warn(`[coach] Bedrock failed, using canned tip for ${msg.target}: ${this.lastError}`);
      return { text: cannedTip(sign, attempts), source: "canned" };
    }
  }

  async _converse(prompt) {
    const { ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
    const client = await this.getClient();
    const candidates = this.modelId ? [this.modelId] : this.models;
    let lastErr;
    for (const modelId of candidates) {
      try {
        this.calls++;
        const res = await client.send(new ConverseCommand({
          modelId,
          system: [{ text: SYSTEM }],
          messages: [{ role: "user", content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 90, temperature: 0.4 },
        }));
        const text = (res.output?.message?.content || []).map((c) => c.text || "").join(" ");
        if (this.modelId !== modelId) this.log.log(`[coach] Bedrock model in use: ${modelId}`);
        this.modelId = modelId;
        this.lastError = null;
        return { text, modelId };
      } catch (err) {
        lastErr = err;
        this.log.warn(`[coach] ${modelId}: ${err.name}: ${err.message}`);
      }
    }
    throw lastErr || new Error("no Bedrock model configured");
  }
}
