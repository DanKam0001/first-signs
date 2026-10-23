// All settings come from env vars, with dev defaults. See server/README.md.
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_DIR = path.resolve(here, "..");
export const REPO_DIR = path.resolve(SERVER_DIR, "..");

// The AWS SDK reads AWS_PROFILE from the environment, so set the default before any client is made.
process.env.AWS_PROFILE ||= "default";

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 8788),
    host: env.HOST || "0.0.0.0",
    // The https URL the phone uses. If unset, the server reads server/.public_url (written by `npm run tunnel`),
    // and if that is missing too, it falls back to the origin the TV connected through.
    publicUrl: (env.PUBLIC_URL || "").replace(/\/+$/, ""),
    publicUrlFile: env.PUBLIC_URL_FILE || path.join(SERVER_DIR, ".public_url"),
    region: env.AWS_REGION || "us-east-1",
    pollyVoice: env.POLLY_VOICE || "Danielle",
    pollyFallbackVoice: "Joanna",
    bedrockModels: (env.BEDROCK_MODEL_ID
      ? [env.BEDROCK_MODEL_ID]
      : ["us.amazon.nova-micro-v1:0", "amazon.nova-micro-v1:0", "us.amazon.nova-lite-v1:0", "amazon.nova-lite-v1:0"]),
    cacheDir: env.CACHE_DIR || path.join(SERVER_DIR, "cache"),
    phoneDir: env.PHONE_DIR || path.join(REPO_DIR, "phone"),
    toolsDir: path.join(REPO_DIR, "tools"),
    modelDir: env.MODEL_DIR || path.join(REPO_DIR, "model", "export"),
    // Used when model/export does not have a file yet (the model is built in parallel).
    stubDir: path.join(REPO_DIR, "phone", "stub"),
    roomIdleMs: Number(env.ROOM_IDLE_MS || 30 * 60 * 1000),
    sweepMs: Number(env.SWEEP_MS || 60 * 1000),
    // Hourly caps on speak/coach requests (the AWS key is shared: keep spend tiny).
    maxSpeakPerHour: Number(env.MAX_SPEAK_PER_HOUR || 300),
    maxCoachPerHour: Number(env.MAX_COACH_PER_HOUR || 120),
    // Set DISABLE_AWS=1 in tests so nothing calls (or bills) AWS.
    disableAws: env.DISABLE_AWS === "1",
  };
}

export function readPublicUrl(cfg) {
  if (cfg.publicUrl) return cfg.publicUrl;
  try {
    const s = fs.readFileSync(cfg.publicUrlFile, "utf8").trim().replace(/\/+$/, "");
    if (/^https?:\/\//.test(s)) return s;
  } catch {}
  return "";
}
