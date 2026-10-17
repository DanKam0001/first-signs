// Loads the sign model bundle (PROTOCOL §2) from the server's /model/ route and runs it with onnxruntime-web.
// The server serves model/export/<file> when it exists and phone/stub/<file> otherwise, so swapping in the real
// model needs no code change. If model.onnx is missing (or the page URL has ?stub=1) a STUB model returns random
// logits, and the page shows a "STUB MODEL" badge.
import { parseSigns } from "./signs.js";
import { maskedSoftmax, handFraction, buildPred } from "./verdict.js";
import { buildDuoPred } from "./duo.js";

export const ORT_VERSION = "1.20.1";
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

export async function loadModel({ forceStub = false, base = "/model/" } = {}) {
  const signsRaw = await fetchJson(base + "signs.json");
  const signs = parseSigns(signsRaw);
  const pre = await import(new URL(base + "preprocess.js", location.href).href);
  let labels = null;
  try { labels = await fetchJson(base + "labels.json"); } catch {}
  if (labels && !Array.isArray(labels)) labels = labels.labels || null;
  if (!labels) labels = signs.signs.map((s) => s.id);

  let session = null;
  let stub = forceStub;
  if (!stub) {
    const head = await fetch(base + "model.onnx", { method: "HEAD", cache: "no-cache" }).catch(() => null);
    stub = !head || !head.ok;
  }
  if (!stub) {
    const ort = await import(ORT_BASE + "ort.wasm.min.mjs");
    ort.env.wasm.wasmPaths = ORT_BASE;
    ort.env.wasm.numThreads = 1; // no cross-origin isolation on this page, so no SharedArrayBuffer threads
    session = await ort.InferenceSession.create(base + "model.onnx", { executionProviders: ["wasm"] });
    session.ort = ort;
  }

  const model = {
    stub,
    stubPreprocess: !!pre.STUB,
    T: pre.T,
    F: pre.F,
    labels,
    signs,
    thresholds: signs.thresholds,

    async logits(frames) {
      const feats = pre.toFeatures(frames);
      if (feats.length !== pre.T * pre.F) throw new Error(`toFeatures returned ${feats.length}, expected ${pre.T * pre.F}`);
      if (stub) return Float32Array.from(labels, () => Math.random() * 4 - 2);
      const ort = session.ort;
      const input = new ort.Tensor("float32", feats, [1, pre.T, pre.F]);
      const out = await session.run({ [session.inputNames[0]]: input });
      const data = out[session.outputNames[0]].data;
      if (data.length !== labels.length) throw new Error(`model has ${data.length} outputs but ${labels.length} labels`);
      return data;
    },

    packLabels(pack) {
      const ids = signs.signs.filter((s) => !pack || (s.packs || []).includes(pack)).map((s) => s.id);
      return new Set(ids.length ? ids : labels); // unknown pack: rank everything rather than nothing
    },

    async rank(attempt, frames) {
      const allowed = this.packLabels(attempt.pack);
      allowed.add(attempt.target);
      try { return maskedSoftmax(await this.logits(frames), labels, allowed); }
      catch (err) { console.error("[model] inference failed", err); return []; }
    },

    // attempt: {id, target, pack}. frames: the window's full-precision frame objects.
    async predict(attempt, frames) {
      const ranked = await this.rank(attempt, frames);
      return buildPred({ id: attempt.id, target: attempt.target, ranked, handFrac: handFraction(frames), thresholds: signs.thresholds });
    },

    // Sign Together (PROTOCOL §1b): each side's window is classified on its own, same pack mask and §3 verdict.
    predictDuo(attempt, frames) {
      return buildDuoPred(attempt, frames, (a, f) => this.rank(a, f), signs.thresholds);
    },
  };
  return model;
}
