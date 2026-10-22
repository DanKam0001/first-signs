# model/: the First Signs sign recogniser

This folder holds a small classifier for 61 early-childhood ASL signs, grouped into 6 routine packs. It runs in the phone browser with onnxruntime-web. It was trained on landmarks that Deaf signers recorded for Google's GISLR dataset. The bundle it produces is described in PROTOCOL.md §2, and it lives in `export/`:

| File | What it is |
|---|---|
| `export/model.onnx` | 4.0 MB, opset 17, about 1.0M parameters. Input `features` float32[1,32,196], output `logits` float32[1,61]. |
| `export/preprocess.js` | ES module. Exports `toFeatures(frames)`, `T` (32), `F` (196) and `handPresence(frames)`. |
| `export/signs.json` | `{_thresholds, _packs, _credits, signs:[{id,label,packs,description,verified,sources,note,credit}]}`. The `signs[]` order is the model's output order. |
| `export/labels.json` | The output order, plus T and F. |
| `export/refs/<id>.json` | One reference performance for each sign: `{fps, frames}` with hands and pose only, never the face, plus its source clip id. |
| `export/metrics.json` | Held-out-signer accuracy: overall, in-pack, per sign, per signer, the confusions, a sweep over verdict thresholds, and the data split. |

## Results: Deaf signers the model never saw

The shipped model is trained on all 21 GISLR train signers. It is tested on GISLR's **rerun set**, Kaggle's public release of the competition's hidden test data. That set has 10 different Deaf signers and 9,882 clips of our 61 signs, and none of those people are in the training data.

"In-pack" is how the app uses the model: the logits are masked to the current pack before the softmax. "Phone-sim" makes the clips look more like the phone's window. It keeps every 2nd frame (15 fps), adds idle holds before and after the sign, and drops 10% of hand detections.

| Pack | Signs | Top-1 | Top-3 | Top-1 (phone-sim) | Top-3 (phone-sim) |
|---|---|---|---|---|---|
| Mealtime | 10 | 97.2% | 98.5% | 95.4% | 97.6% |
| Bedtime | 10 | 94.7% | 97.5% | 92.6% | 96.2% |
| Bath time | 8 | 95.2% | 98.0% | 92.8% | 96.6% |
| Family | 12 | 92.1% | 97.5% | 89.5% | 95.8% |
| Play | 11 | 93.6% | 96.7% | 92.2% | 95.8% |
| Feelings & needs | 10 | 95.0% | 98.0% | 92.6% | 96.2% |
| **All packs** | 61 | **94.5%** | **97.7%** | **92.4%** | **96.3%** |

- **Without pack masking** (all 61 signs at once), top-1 is 89.3% and top-3 is 94.6%. Under phone-sim they are 86.6% and 92.3%.
- **Spread across the 10 unseen signers:** 61-way top-1 ranges from 76.4% to 96.9%. Some people's signing is much harder for the model than others'.
- **Cross-validation inside the train set** (5 folds, split by signer): in-pack top-1 is 89.3% and top-3 is 95.2%, over 23,247 clips. Each fold trains on about 17 signers.
- **Verdict (PROTOCOL §3)** at the default thresholds (top-3, p ≥ 0.25, hands in ≥ 40% of frames):
  - When the target sign is made, the true-accept rate is 81.9%. Many GISLR clips are cropped, so hands show in fewer than 40% of their frames. Without the hand gate the true-accept rate is 94.6% (92.2% under phone-sim).
  - When a different sign from the same pack is made, the false-accept rate is 0.1–0.5% per pack.

**Adding the Play and Feelings & needs packs (2026-10-22) did not meaningfully change the first 4 packs.** Mealtime and Family moved by less than half a point, and Bedtime and Bath went up. Same rerun clips, in-pack top-1 / top-3:

| Pack | 40-sign model, as recorded | 61-sign model, as recorded | 40-sign model, phone-sim | 61-sign model, phone-sim |
|---|---|---|---|---|
| Mealtime | 97.6% / 98.4% | 97.2% / 98.5% | 96.0% / 97.3% | 95.4% / 97.6% |
| Bedtime | 94.5% / 97.6% | 94.7% / 97.5% | 91.8% / 95.8% | 92.6% / 96.2% |
| Bath time | 93.4% / 97.0% | 95.2% / 98.0% | 90.6% / 95.4% | 92.8% / 96.6% |
| Family | 92.3% / 97.6% | 92.1% / 97.5% | 89.8% / 95.9% | 89.5% / 95.8% |
| **The 4 packs together** | 94.4% / 97.7% | 94.6% / 97.8% | 92.0% / 96.1% | 92.4% / 96.5% |

**What the model gets wrong.** These are the main in-pack confusions on the unseen signers:
- **dad** is predicted as grandpa (16%), and **mom** as grandma (12%). These signs use the same hand and differ only by a forward hop.
- **up** is predicted as look (8%) or where (5%): all three are a raised index finger near the face.
- **cat** is predicted as bird (6%): both are a pinch at the face.
- **brother** is predicted as cry (4%), and **dog** as car (4%).

**What these numbers are not.** They come from GISLR's own phone recordings. They are **not** a measurement on First Signs' live phone camera, at a different distance and with different lighting, made by hearing learners. Learners will sign less cleanly than fluent Deaf signers. Measure live before claiming accuracy, and publish whatever that measurement shows.

<details><summary>Per-sign in-pack accuracy on the unseen signers (as recorded)</summary>

| Sign | Pack | Top-1 | Top-3 | Clips |
|---|---|---|---|---|
| mom | family | 83% | 98% | 160 |
| dad | family | 84% | 99% | 178 |
| up | feelings | 86% | 96% | 170 |
| airplane | play | 87% | 95% | 163 |
| fish | play | 87% | 94% | 159 |
| grandma | family | 90% | 99% | 138 |
| cat | play | 90% | 94% | 174 |
| bed | bedtime | 90% | 95% | 155 |
| book | bedtime | 90% | 96% | 156 |
| dog | play | 91% | 95% | 163 |
| bath | bath | 91% | 96% | 160 |
| bye | family | 91% | 98% | 163 |
| hello | family | 92% | 96% | 165 |
| night | bedtime | 92% | 96% | 140 |
| hungry | mealtime | 93% | 98% | 170 |
| thirsty | mealtime | 93% | 95% | 129 |
| open | feelings | 93% | 97% | 158 |
| outside | play | 93% | 97% | 151 |
| brother | family | 93% | 97% | 167 |
| dirty | bath | 94% | 96% | 173 |
| pajamas | bedtime | 94% | 98% | 168 |
| jump | play | 94% | 97% | 172 |
| cry | family | 94% | 95% | 173 |
| sad | family | 94% | 97% | 173 |
| potty | bath | 94% | 97% | 159 |
| sleep | bedtime | 94% | 96% | 178 |
| morning | bedtime | 94% | 98% | 162 |
| wait | feelings | 95% | 97% | 152 |
| yes | family | 95% | 97% | 172 |
| clean | bath | 95% | 99% | 155 |
| owie | feelings | 95% | 99% | 148 |
| happy | family | 95% | 98% | 172 |
| balloon | play | 95% | 98% | 173 |
| dry | bath | 96% | 99% | 172 |
| look | feelings | 96% | 97% | 154 |
| shower | bath | 96% | 97% | 103 |
| sick | feelings | 96% | 98% | 160 |
| car | play | 96% | 98% | 134 |
| where | feelings | 96% | 99% | 170 |
| grandpa | family | 96% | 99% | 142 |
| wet | bath | 97% | 99% | 157 |
| like | feelings | 97% | 98% | 163 |
| no | family | 97% | 99% | 165 |
| water | mealtime | 97% | 98% | 166 |
| bird | play | 97% | 98% | 172 |
| kiss | bedtime | 97% | 99% | 142 |
| shhh | bedtime | 97% | 99% | 179 |
| hot | feelings | 98% | 100% | 166 |
| food | mealtime | 98% | 98% | 168 |
| drink | mealtime | 98% | 99% | 170 |
| please | mealtime | 98% | 99% | 176 |
| wake | bedtime | 98% | 98% | 177 |
| cow | play | 98% | 99% | 168 |
| moon | bedtime | 98% | 100% | 170 |
| mad | feelings | 98% | 99% | 171 |
| milk | mealtime | 98% | 98% | 174 |
| thankyou | mealtime | 99% | 100% | 143 |
| finish | mealtime | 99% | 99% | 168 |
| horse | play | 99% | 99% | 180 |
| toothbrush | bath | 99% | 100% | 150 |
| apple | mealtime | 99% | 100% | 173 |
</details>

## Vocabulary

| Pack | Signs |
|---|---|
| Mealtime | milk, drink, water, food, hungry, thirsty, apple, finish, please, thank you |
| Bedtime | sleep, bed, pajamas, book, night, kiss, moon, shhh, wake, morning |
| Bath time | bath, wet, dry, toothbrush, potty, shower, clean, dirty |
| Family | mom, dad, grandma, grandpa, brother, hello, bye, yes, no, happy, sad, cry |
| Play | dog, cat, bird, fish, cow, horse, car, outside, jump, balloon, airplane |
| Feelings & needs | owie, sick, mad, like, wait, up, open, hot, look, where |

**How the first 40 were chosen.** There were 64 candidates, all of them GISLR signs (`vocab_candidates.txt`). We ran a 5-fold signer cross-validation on all 64 (`data/candidate_cv_metrics.json`) and kept the signs that were distinct within their pack. This used only the train set; the rerun test set played no part in the choice. The dropped signs:

- **Too confusable:**
  - awake: 67% of awake clips were predicted as wake, and the sources treat them as one sign.
  - nap and sleepy: predicted as sleep 24% and 21% of the time.
  - quiet: signed like shhh.
  - lamp: confused with shhh.
- **No dedicated sign:** snack. Signers use EAT with a "small" face, or fingerspell it.
- **Weak or unverified:** child (52% top-1), all, yucky, cereal, napkin, empty and underwear.
- **To keep packs at about 10:** story, read, ice cream, duck, hair, tooth, aunt, uncle, boy and girl.

mom/grandma and dad/grandpa were kept even though they are the main confusion. Families need them, and top-3 still holds them at 97% or more.

**How Play and Feelings & needs were chosen (2026-10-22).** Same method. The 40 shipped signs plus 36 candidates (`vocab.py` `CANDIDATE_PACKS_V2`, `vocab_candidates_v2.txt`), every one a GISLR sign that the reference-video signer (PopSign 8037) also recorded, went through a 5-fold signer cross-validation on the train set only (`runs/cand2`). With every candidate in its pack, Play was 85.3% / 92.6% in-pack top-1 / top-3 and Feelings & needs 86.1% / 93.5%; the old packs stayed where they were. The dropped candidates:

- **No settled sign, or usually fingerspelled:** toy (both sources say it is usually spelled T-O-Y) and puzzle (Lifeprint: no widely recognised sign; 65% top-1).
- **Too confusable:** ride (60% top-1; 14% predicted as jump), give (77%; mixed up with owie), dance (the same two-finger "legs" as jump).
- **Description could not be verified:** blow and down (no fetched Lifeprint/HandSpeak page describes them in text).
- **To keep packs at about 10:** duck (BIRD is nearly the same sign), frog, pig (close to dirty), stay, fine, bad (close to thank you), listen, smile.

up stays even though it is the weakest new sign (86% top-1 on the unseen signers): "up" is one of the requests toddlers make most, and top-3 holds it at 96%.

**Descriptions** (`data/sign_descriptions.json`, copied into signs.json) are written in our own words from Lifeprint/ASL University and HandSpeak pages, fetched on 2026-10-17 for the first 40 and on 2026-10-22 for the 21 new signs, with the URLs listed for each sign. 59 of the 61 are `"verified": true`. **pajamas** and **toothbrush** are `"verified": false`: no reliable source had a text description, and the notes say why. The descriptions are memory aids. They are not lessons, and they are no substitute for a Deaf teacher.

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

**Refs.** The first 40 signs keep the references chosen on 2026-10-17 by the 40-sign run, so their skeleton replays did not change; the 21 new signs' references come from the 61-sign run. Each reference is chosen automatically: a clip that the held-out-signer model recognised with p ≥ 0.85, with hands in at least 60% of its frames, from a right-hand-dominant signer, and with a length close to the sign's 75th percentile. Clips are trimmed to the signing, with 3 frames of margin.
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

# 2b. second round (2026-10-22): 36 more candidates for Play and Feelings & needs, then the 61-sign model.
#     Same fetch commands with model/vocab_candidates_v2.txt; caches are built for the 76 signs of CANDIDATE_PACKS_V2
#     (one id per line in signs76.txt, e.g. from vocab.labels_of(vocab.CANDIDATE_PACKS_V2)).
$PY model/data/build_cache.py --signs signs76.txt --name train_v2
$PY model/data/build_cache.py --signs signs76.txt --name rerun_v2 --csv rerun.csv
$PY model/train.py --vocab candidates2 --cache D:/datasets/gislr/cache/train_v2.npz --cv 5 --epochs 40 --out D:/datasets/gislr/runs/cand2
$PY model/evaluate.py --run D:/datasets/gislr/runs/cand2 --cache_dir D:/datasets/gislr/cache/train_v2
$PY model/train.py --vocab final --cache D:/datasets/gislr/cache/train_v2.npz --cv 5 --all --epochs 60 \
    --out D:/datasets/gislr/runs/final2                                                   # ~35 min on a GTX 1660

# 3. metrics, bundle, export, checks (the shipped 61-sign model is runs/final2)
$PY model/evaluate.py --run D:/datasets/gislr/runs/final2 --cache_dir D:/datasets/gislr/cache/train_v2 --metrics model/export/metrics.json
$PY model/test_rerun.py --ckpt D:/datasets/gislr/runs/final2/model_all.pt --cache D:/datasets/gislr/cache/rerun_v2.npz --metrics model/export/metrics.json
$PY model/make_bundle.py --run D:/datasets/gislr/runs/final2 --cache D:/datasets/gislr/cache/train_v2.npz   # then restore the first 40 refs (see Refs)
$PY model/export_onnx.py --ckpt D:/datasets/gislr/runs/final2/model_all.pt     # also checks onnxruntime vs torch
$PY model/tests/test_parity.py                                                  # Python vs JS preprocess
(cd D:/node-ortweb && npm i onnxruntime-web@1.20.1)
ORT_WEB_DIR=D:/node-ortweb/node_modules/onnxruntime-web node model/tests/ort_web_check.mjs
```

Note that `metrics.json` is written by evaluate.py, then extended by test_rerun.py. The `summary`, `model` and `dataset` blocks were added by a short script. They restate numbers that are already in the file, plus three computed from the same rerun predictions: the verdict rate without the hand gate, the first 40 signs scored on their own, and the previous 40-sign model's numbers for comparison.

**Checks run on 2026-10-22 (61-sign model):**
- onnxruntime (Python) matches PyTorch to 1.3e-6.
- onnxruntime-web 1.20.1 (wasm, the build the phone loads) under node runs preprocess.js on the reference clips and matches PyTorch to 3.3e-6.
- Python and JS preprocessing agree, as described under Parity above.

## Data, credit and licence

**GISLR**, the Isolated Sign Language Recognition corpus v1.0 (Kaggle competition `asl-signs`, 2023). It holds MediaPipe Holistic landmarks for about 100k clips of 250 signs, recorded by 21 Deaf signers recruited by the **Deaf Professional Arts Network (D-PAN)**. The clips were reviewed by researchers at the **Georgia Institute of Technology**, and the dataset was released by **Google** on Kaggle. Its licence is **CC BY 4.0**: the competition's Acknowledgements say "The dataset provided by Deaf Professional Arts Network and the Georgia Institute of Technology is licensed under CC-BY 4.0", and the rules say "DATA ACCESS AND USE: CC-BY 4.0".

Where our copy came from:
- **Train files:** the public Kaggle mirror `carolineyyy/merged-islr-data`, folder `asl-signs/`. It has the original layout and `train.csv`. Spot-checked files are byte-identical (SHA-1) to an independent mirror, `najaf456ali/asl-100-google-slr`.
- **Test files:** `sohier/461054610546105`, Kaggle's public "ASL Isolated Sign Recognition Rerun Set", which is linked from the competition's data page.

Dataset terms we follow:
- The landmarks must not be used to identify anyone. We never use or ship face landmarks.
- The dataset card says the corpus is for educational sign-learning games, "not appropriate for ... ASL-to-English translation". First Signs is a learning game for hearing families.
