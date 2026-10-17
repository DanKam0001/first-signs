// Runs model/export/preprocess.js on every case in a fixture file and prints the features as JSON.
// usage: node model/tests/parity_node.mjs <fixture.json>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { toFeatures, handPresence, T, F } = await import(pathToFileURL(resolve(here, "../export/preprocess.js")).href);
const cases = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out = { T, F, cases: {} };
for (const [name, frames] of Object.entries(cases)) {
  out.cases[name] = { features: Array.from(toFeatures(frames)), presence: handPresence(frames) };
}
process.stdout.write(JSON.stringify(out));
