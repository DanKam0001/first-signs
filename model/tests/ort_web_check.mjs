// Loads model/export/model.onnx with onnxruntime-web (the same wasm build the phone page uses) under node,
// runs preprocess.js on reference clips, and compares the logits with PyTorch (tests/onnx_check.json,
// written by export_onnx.py).
// usage: ORT_WEB_DIR=<.../node_modules/onnxruntime-web> node model/tests/ort_web_check.mjs
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const exp = resolve(here, "../export");
const dir = process.env.ORT_WEB_DIR;
if (!dir) throw new Error("set ORT_WEB_DIR to an onnxruntime-web package folder");
const ort = await import(pathToFileURL(resolve(dir, "dist/ort.wasm.min.mjs")).href);
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = pathToFileURL(resolve(dir, "dist") + "/").href;
const { toFeatures, T, F } = await import(pathToFileURL(resolve(exp, "preprocess.js")).href);
const modelBytes = readFileSync(resolve(exp, "model.onnx"));
const session = await ort.InferenceSession.create(modelBytes, { executionProviders: ["wasm"] });
const cases = JSON.parse(readFileSync(resolve(here, "onnx_check.json"), "utf8"));
let worst = 0;
for (const [name, c] of Object.entries(cases)) {
  const feats = c.input ? Float32Array.from(c.input) : toFeatures(JSON.parse(readFileSync(resolve(exp, "refs", c.ref + ".json"), "utf8")).frames);
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", feats, [1, T, F]) });
  const got = out[session.outputNames[0]].data;
  let d = 0;
  for (let i = 0; i < got.length; i++) d = Math.max(d, Math.abs(got[i] - c.logits[i]));
  worst = Math.max(worst, d);
  console.log(`${name}: ${got.length} logits, max |ort-web - torch| = ${d.toExponential(2)}`);
}
console.log(worst < 1e-3 ? "PASS onnxruntime-web" : "FAIL onnxruntime-web", `(ort ${ort.env.versions?.web ?? ""})`);
process.exit(worst < 1e-3 ? 0 : 1);
