// `speak` -> Amazon Polly (neural voice). Every mp3 is cached on disk by sha1(voice + text), so a phrase is billed once.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const MAX_TTS_CHARS = 300;

export function ttsKey(voice, text) {
  return createHash("sha1").update(voice + text).digest("hex");
}

export class Tts {
  constructor(cfg, log = console) {
    this.cfg = cfg;
    this.log = log;
    this.dir = path.join(cfg.cacheDir, "tts");
    fs.mkdirSync(this.dir, { recursive: true });
    this.voice = cfg.pollyVoice;
    this.inflight = new Map();
    this.client = null;
    this.lastError = null;
    this.calls = 0;
    this.hits = 0;
  }

  async getClient() {
    if (!this.client) {
      const { PollyClient } = await import("@aws-sdk/client-polly");
      this.client = new PollyClient({ region: this.cfg.region });
    }
    return this.client;
  }

  filePath(key) {
    return path.join(this.dir, `${key}.mp3`);
  }

  // Resolves to the sha1 key of a cached mp3. Throws if Polly fails and nothing is cached.
  async synth(text) {
    text = String(text || "").trim().slice(0, MAX_TTS_CHARS);
    if (!text) throw new Error("empty text");
    const key = ttsKey(this.voice, text);
    if (fs.existsSync(this.filePath(key))) { this.hits++; return key; }
    if (this.inflight.has(key)) return this.inflight.get(key);
    const job = this._call(text, key).finally(() => this.inflight.delete(key));
    this.inflight.set(key, job);
    return job;
  }

  async _call(text, key) {
    if (this.cfg.disableAws) throw new Error("AWS disabled (DISABLE_AWS=1)");
    const { SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly");
    const client = await this.getClient();
    let res;
    try {
      this.calls++;
      res = await client.send(new SynthesizeSpeechCommand({
        Engine: "neural", VoiceId: this.voice, OutputFormat: "mp3", Text: text, TextType: "text",
      }));
    } catch (err) {
      // An unknown/unsupported voice is a config problem, so retry once with a voice that is always neural in us-east-1.
      if (err.name === "ValidationException" && this.voice !== this.cfg.pollyFallbackVoice) {
        this.log.warn(`[tts] voice ${this.voice} failed (${err.message}); switching to ${this.cfg.pollyFallbackVoice}`);
        this.voice = this.cfg.pollyFallbackVoice;
        return this.synth(text);
      }
      this.lastError = `${err.name}: ${err.message}`;
      throw err;
    }
    const bytes = await res.AudioStream.transformToByteArray();
    const tmp = this.filePath(key) + ".tmp";
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, this.filePath(key));
    this.lastError = null;
    this.log.log(`[tts] polly ${this.voice} ${text.length} chars -> ${key}.mp3`);
    return key;
  }
}
