// One Polly call and one Bedrock call, to confirm the AWS side works. Both are cached/tiny, so re-running costs ~nothing.
//   npm run smoke:aws
import { loadConfig } from "../src/config.js";
import { Tts } from "../src/tts.js";
import { Coach } from "../src/coach.js";

const cfg = loadConfig();
console.log(`profile=${process.env.AWS_PROFILE} region=${cfg.region}`);
let failed = false;

const tts = new Tts(cfg);
try {
  const key = await tts.synth("Your turn. Sign milk.");
  console.log(`POLLY OK  voice=${tts.voice} -> cache/tts/${key}.mp3 (polly calls this run: ${tts.calls})`);
} catch (err) {
  failed = true;
  console.log(`POLLY FAIL ${err.name}: ${err.message}`);
}

// A neutral prompt: no real sign description is needed to prove the model can be invoked.
const coach = new Coach(cfg, { get: () => ({ byId: new Map() }) });
try {
  const r = await coach._converse("Reply with the single word: ready");
  console.log(`BEDROCK OK model=${r.modelId} reply=${JSON.stringify(r.text.trim().slice(0, 60))}`);
} catch (err) {
  failed = true;
  console.log(`BEDROCK FAIL (tried ${cfg.bedrockModels.join(", ")}) last error ${err.name}: ${err.message}`);
}
if (failed) console.log("See server/README.md, 'AWS permissions', for the exact policy to attach.");
process.exit(failed ? 1 : 0);
