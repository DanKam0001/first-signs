# model/: the First Signs sign recogniser

This folder holds a small classifier for 40 early-childhood ASL signs, grouped into 4 routine packs. It runs in the phone browser with onnxruntime-web. It was trained on landmarks that Deaf signers recorded for Google's GISLR dataset. The bundle it produces is described in PROTOCOL.md §2, and it lives in `export/`:

| File | What it is |
|---|---|
| `export/model.onnx` | 4.0 MB, opset 17, about 995k parameters. Input `features` float32[1,32,196], output `logits` float32[1,40]. |
| `export/preprocess.js` | ES module. Exports `toFeatures(frames)`, `T` (32), `F` (196) and `handPresence(frames)`. |
| `export/signs.json` | `{_thresholds, _packs, _credits, signs:[{id,label,packs,description,verified,sources,note,credit}]}`. The `signs[]` order is the model's output order. |
| `export/labels.json` | The output order, plus T and F. |
| `export/refs/<id>.json` | One reference performance for each sign: `{fps, frames}` with hands and pose only, never the face, plus its source clip id. |
| `export/metrics.json` | Held-out-signer accuracy: overall, in-pack, per sign, per signer, the confusions, a sweep over verdict thresholds, and the data split. |

## Results: Deaf signers the model never saw

The shipped model is trained on all 21 GISLR train signers. It is tested on GISLR's **rerun set**, Kaggle's public release of the competition's hidden test data. That set has 10 different Deaf signers and 6,461 clips of our 40 signs, and none of those people are in the training data.

"In-pack" is how the app uses the model: the logits are masked to the current pack before the softmax. "Phone-sim" makes the clips look more like the phone's window. It keeps every 2nd frame (15 fps), adds idle holds before and after the sign, and drops 10% of hand detections.

| Pack | Signs | Top-1 | Top-3 | Top-1 (phone-sim) | Top-3 (phone-sim) |
|---|---|---|---|---|---|
| Mealtime | 10 | 97.6% | 98.4% | 96.0% | 97.3% |
| Bedtime | 10 | 94.5% | 97.6% | 91.8% | 95.8% |
| Bath time | 8 | 93.4% | 97.0% | 90.6% | 95.4% |
| Family | 12 | 92.3% | 97.6% | 89.8% | 95.9% |
| **All packs** | 40 | **94.4%** | **97.7%** | **92.0%** | **96.1%** |

- **Without pack masking** (all 40 signs at once), top-1 is 90.9% and top-3 is 95.5%. Under phone-sim they are 87.8% and 92.9%.
- **Spread across the 10 unseen signers:** 40-way top-1 ranges from 78.6% to 96.9%. Some people's signing is much harder for the model than others'.
- **Cross-validation inside the train set** (5 folds, split by signer): in-pack top-1 is 89.5% and top-3 is 95.5%, over 15,204 clips. Each fold trains on about 17 signers.
- **Verdict (PROTOCOL §3)** at the default thresholds (top-3, p ≥ 0.25, hands in ≥ 40% of frames):
  - When the target sign is made, the true-accept rate is 81.5%. Many GISLR clips are cropped, so hands show in fewer than 40% of their frames. Without the hand gate the true-accept rate is 94.6% (91.8% under phone-sim).
  - When a different sign from the same pack is made, the false-accept rate is 0.3–0.7%.

**What the model gets wrong.** These are the main in-pack confusions on the unseen signers:
- **shower** is predicted as dry (14%) or clean (8%). At 77% top-1 it is the weakest sign.
- **dad** is predicted as grandpa (13%), and **mom** as grandma (12%). These signs use the same hand and differ only by a forward hop.
- **brother** is predicted as cry (7%), and **book** as morning (4%).

**What these numbers are not.** They come from GISLR's own phone recordings. They are **not** a measurement on First Signs' live phone camera, at a different distance and with different lighting, made by hearing learners. Learners will sign less cleanly than fluent Deaf signers. Measure live before claiming accuracy, and publish whatever that measurement shows.

<details><summary>Per-sign in-pack accuracy on the unseen signers (as recorded)</summary>

| Sign | Pack | Top-1 | Top-3 | Clips |
|---|---|---|---|---|
| shower | bath | 77% | 89% | 103 |
| mom | family | 85% | 97% | 160 |
| dad | family | 85% | 98% | 178 |
| book | bedtime | 88% | 97% | 156 |
| bath | bath | 89% | 95% | 160 |
| night | bedtime | 89% | 94% | 140 |
| brother | family | 90% | 96% | 167 |
| bye | family | 92% | 98% | 163 |
| morning | bedtime | 93% | 96% | 162 |
| grandma | family | 93% | 99% | 138 |
| grandpa | family | 93% | 100% | 142 |
| bed | bedtime | 94% | 95% | 155 |
| clean | bath | 94% | 98% | 155 |
| dirty | bath | 94% | 98% | 173 |
| thirsty | mealtime | 94% | 95% | 129 |
| pajamas | bedtime | 94% | 98% | 168 |
| sad | family | 94% | 97% | 173 |
| hello | family | 95% | 97% | 165 |
| yes | family | 95% | 98% | 172 |
| no | family | 95% | 98% | 165 |
| happy | family | 95% | 97% | 172 |
| cry | family | 95% | 98% | 173 |
| potty | bath | 96% | 97% | 159 |
| hungry | mealtime | 96% | 99% | 170 |
| dry | bath | 96% | 98% | 172 |
| moon | bedtime | 96% | 100% | 170 |
| sleep | bedtime | 97% | 99% | 178 |
| shhh | bedtime | 97% | 98% | 179 |
| water | mealtime | 97% | 98% | 166 |
| food | mealtime | 97% | 98% | 168 |
| drink | mealtime | 97% | 97% | 170 |
| kiss | bedtime | 98% | 99% | 142 |
| wet | bath | 98% | 98% | 157 |
| finish | mealtime | 98% | 99% | 168 |
| milk | mealtime | 98% | 99% | 174 |
| wake | bedtime | 98% | 99% | 177 |
| please | mealtime | 99% | 99% | 176 |
| thankyou | mealtime | 99% | 100% | 143 |
| toothbrush | bath | 99% | 100% | 150 |
| apple | mealtime | 100% | 100% | 173 |
</details>

## Vocabulary

| Pack | Signs |
|---|---|
| Mealtime | milk, drink, water, food, hungry, thirsty, apple, finish, please, thank you |
| Bedtime | sleep, bed, pajamas, book, night, kiss, moon, shhh, wake, morning |
| Bath time | bath, wet, dry, toothbrush, potty, shower, clean, dirty |
| Family | mom, dad, grandma, grandpa, brother, hello, bye, yes, no, happy, sad, cry |

**How the 40 were chosen.** There were 64 candidates, all of them GISLR signs (`vocab_candidates.txt`). We ran a 5-fold signer cross-validation on all 64 (`data/candidate_cv_metrics.json`) and kept the signs that were distinct within their pack. This used only the train set; the rerun test set played no part in the choice. The dropped signs:

- **Too confusable:**
  - awake: 67% of awake clips were predicted as wake, and the sources treat them as one sign.
  - nap and sleepy: predicted as sleep 24% and 21% of the time.
  - quiet: signed like shhh.
  - lamp: confused with shhh.
- **No dedicated sign:** snack. Signers use EAT with a "small" face, or fingerspell it.
- **Weak or unverified:** child (52% top-1), all, yucky, cereal, napkin, empty and underwear.
- **To keep packs at about 10:** story, read, ice cream, duck, hair, tooth, aunt, uncle, boy and girl.

mom/grandma and dad/grandpa were kept even though they are the main confusion. Families need them, and top-3 still holds them at 97% or more.

**Descriptions** (`data/sign_descriptions.json`, copied into signs.json) are written in our own words from Lifeprint/ASL University and HandSpeak pages fetched on 2026-10-17, with the URLs listed for each sign. 38 of the 40 are `"verified": true`. **pajamas** and **toothbrush** are `"verified": false`: no reliable source had a text description, and the notes say why. The descriptions are memory aids. They are not lessons, and they are no substitute for a Deaf teacher.

## Features (preprocess.js, mirrored in preprocess.py)

The input is the PROTOCOL §1 frames: unmirrored, normalised image coordinates, with the signer's anatomical left/right hands. `z` and the pose visibility `v` are ignored, because GISLR has no visibility and comes from a different MediaPipe build.

1. Trim to the frames between the first and last hand. Then trim further, to the span that holds the middle 90% of hand movement (wrist and fingertips) plus a margin. The idle hands before and after a sign in the phone's 2.5 s window are dropped.
2. Build a body frame from the pose, averaged over the trimmed frames. The centre is the shoulder midpoint, **x is in shoulder widths** and **y is in nose-to-shoulder heights**. Scaling the two axes separately cancels the camera's aspect ratio, so phone and dataset features match without knowing either video size. That is why `frame.aspect` isn't needed here.
3. If the left hand is present in more frames than the right (ties go to whichever wrist moved more), mirror everything, so the dominant hand is always "right". Left-handed signers then look right-handed.
4. Resample to T=32: interpolate linearly where both neighbouring frames have the part, and otherwise use the neighbour that has it.
5. Each frame has 196 values:
   - the dominant and other hand in body units (2 × 42)
   - the dominant and other hand shape relative to the wrist, scaled by the wrist-to-middle-knuckle length (2 × 42)
   - 13 upper-body pose points (26)
   - 2 hand-presence flags

**GISLR handedness, checked.** Over 933k train frames and 332k test frames, the GISLR `left_hand` wrist sits on pose landmark 15 (left wrist) 99.6–99.9% of the time, and on the image's right side. So GISLR's labels are the signer's anatomical hands in an unmirrored image, which matches PROTOCOL §1, and the mapping is `left_hand → left`, `right_hand → right`. Step 3 would make the model insensitive to a global mirror anyway.

**Parity.** `tests/test_parity.py` runs the same fixture through Python and through `preprocess.js` under node. It has 12 synthetic edge cases and 16 real GISLR clips, train and test. Both outputs agree to within 1e-14, against a tolerance of 1e-4.

**Refs.** Each sign's reference is chosen automatically: a clip that the held-out-signer model recognised with p ≥ 0.85, with hands in at least 60% of its frames, from a right-hand-dominant signer, and with a length close to the sign's 75th percentile. Clips are trimmed to the signing, with 3 frames of margin.
- `fps: 30` is assumed. GISLR doesn't state its frame rate, but the Pixel 4a records video at 30 fps.
- `aspect` is omitted, as PROTOCOL §1 says to do when it is unknown. Body proportions suggest a portrait frame of about 3:4, which matches the TV's 0.75 default.

## Reproduce

Commands are run from `first-signs/`. The data and caches live on D:, because C: is short of space.

```bash
python -m venv D:/venvs/firstsigns
D:/venvs/firstsigns/Scripts/pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cu124
D:/venvs/firstsigns/Scripts/pip install -r model/requirements.txt
PY=D:/venvs/firstsigns/Scripts/python

# 1. data: no Kaggle login needed. One API call per dataset, then HTTP Range reads of only the files we need.
#    (fetch_gislr.py without --meta-only downloads file by file instead, but anonymous Kaggle calls are rate limited)
$PY model/data/fetch_gislr.py --root D:/datasets/gislr --signs model/vocab_candidates.txt --meta-only           # train.csv
$PY model/data/fetch_zip_ranges.py --dataset carolineyyy/merged-islr-data --prefix asl-signs/ \
    --csv D:/datasets/gislr/meta/train.csv --signs model/vocab_candidates.txt --root D:/datasets/gislr
$PY model/data/fetch_gislr.py --root D:/datasets/gislr --signs model/vocab_candidates.txt --rerun --meta-only   # meta/rerun.csv
$PY model/data/fetch_zip_ranges.py --dataset sohier/461054610546105 \
    --csv D:/datasets/gislr/meta/rerun.csv --signs model/vocab_candidates.txt --root D:/datasets/gislr
$PY model/data/build_cache.py --signs model/vocab_candidates.txt --name train
$PY model/data/build_cache.py --signs model/vocab_candidates.txt --name rerun --csv rerun.csv
$PY model/data/build_cache.py --check --name train          # handedness check

# 2. vocabulary selection (64 candidates, signer CV), then the shipped vocabulary
$PY model/train.py --vocab candidates --cv 5 --epochs 40 --out D:/datasets/gislr/runs/cand
$PY model/evaluate.py --run D:/datasets/gislr/runs/cand
$PY model/train.py --vocab final --cv 5 --all --epochs 60 --out D:/datasets/gislr/runs/final   # ~25 min on a GTX 1660

# 3. metrics, bundle, export, checks
$PY model/evaluate.py --run D:/datasets/gislr/runs/final --metrics model/export/metrics.json
$PY model/test_rerun.py --ckpt D:/datasets/gislr/runs/final/model_all.pt --metrics model/export/metrics.json
$PY model/make_bundle.py --run D:/datasets/gislr/runs/final
$PY model/export_onnx.py --ckpt D:/datasets/gislr/runs/final/model_all.pt     # also checks onnxruntime vs torch
$PY model/tests/test_parity.py                                                  # Python vs JS preprocess
(cd D:/node-ortweb && npm i onnxruntime-web@1.20.1)
ORT_WEB_DIR=D:/node-ortweb/node_modules/onnxruntime-web node model/tests/ort_web_check.mjs
```

Note that `metrics.json` is written by evaluate.py, then extended by test_rerun.py. The `summary`, `model` and `dataset` blocks were added by a short script; they restate numbers that are already in the file.

**Checks run on 2026-10-17:**
- onnxruntime (Python) matches PyTorch to 1.1e-6.
- onnxruntime-web 1.20.1 (wasm, the build the phone loads) under node runs preprocess.js on the reference clips and matches PyTorch to 2.9e-6.
- Python and JS preprocessing agree, as described under Parity above.

## Data, credit and licence

**GISLR**, the Isolated Sign Language Recognition corpus v1.0 (Kaggle competition `asl-signs`, 2023). It holds MediaPipe Holistic landmarks for about 100k clips of 250 signs, recorded by 21 Deaf signers recruited by the **Deaf Professional Arts Network (D-PAN)**. The clips were reviewed by researchers at the **Georgia Institute of Technology**, and the dataset was released by **Google** on Kaggle. Its licence is **CC BY 4.0**: the competition's Acknowledgements say "The dataset provided by Deaf Professional Arts Network and the Georgia Institute of Technology is licensed under CC-BY 4.0", and the rules say "DATA ACCESS AND USE: CC-BY 4.0".

Where our copy came from:
- **Train files:** the public Kaggle mirror `carolineyyy/merged-islr-data`, folder `asl-signs/`. It has the original layout and `train.csv`. Spot-checked files are byte-identical (SHA-1) to an independent mirror, `najaf456ali/asl-100-google-slr`.
- **Test files:** `sohier/461054610546105`, Kaggle's public "ASL Isolated Sign Recognition Rerun Set", which is linked from the competition's data page.

Dataset terms we follow:
- The landmarks must not be used to identify anyone. We never use or ship face landmarks.
- The dataset card says the corpus is for educational sign-learning games, "not appropriate for ... ASL-to-English translation". First Signs is a learning game for hearing families.
