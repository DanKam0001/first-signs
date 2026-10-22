# PopSign signer coverage for the 40 First Signs signs

Generated 2026-10-22, read-only analysis. Sources: `D:/datasets/popsign/index/test.json` (full member list of every
`game/test/<sign>.tar`), `D:/datasets/popsign/rank_all.json` (quality scores from `rank_sheets.py`, 2 local clips per
signer per sign), `D:/datasets/popsign/scores_clean_all.json` (all 154 CLEAN clips), and `selection.json`.

## Summary

- 8 signers in the game/test split (all IDs `gtsignstudy4a.80xx`): 8031, 8032, 8033, 8035, 8036, 8037, 8038, 8039.
- **Signer 8037 covers all 40 signs**, both remotely (15-20 clips per sign, 784 clips, 1.42 GB) and locally (2 scored clips per sign; SHOWER is 8037-only).
- Coverage of the others: 8032 39 and 8038 39 (no SHOWER); 8033, 8035, 8036, 8039 38 (no SHOWER, BROTHER); 8031 35 (no KISS, WET, SHOWER, GRANDMA, GRANDPA).
- Minimum cover: {8037} alone. Without 8037, nobody else has SHOWER at all.

| Signer | Signs | Mean best q | Best clip q >= 1.5 | Best clip has no quality flags | #1 ranked for a sign | Worst best-clip q |
|---|---|---|---|---|---|---|
| 8037 | 40 | 1.84 | 38 | 39 | 8 | 1.06 (thirsty, hand at edge) |
| 8039 | 38 | 1.95 | 35 | 32 | 15 | 0.47 |
| 8038 | 39 | 1.80 | 36 | 0 | 5 | -0.33 |
| 8033 | 38 | 1.79 | 31 | 26 | 10 | -0.21 |
| 8031 | 35 | 1.24 | 10 | 29 | 1 | 0.10 |
| 8032 | 39 | 1.21 | 14 | 23 | 1 | -1.04 |
| 8035 | 38 | 0.80 | 2 | 4 | 0 | -0.32 |
| 8036 | 38 | 0.44 | 1 | 7 | 0 | -1.14 |

`q` is `quality()` in `rank_sheets.py` (hands in frame, no edge clipping, frontal, framing/shoulder width, brightness,
complete sign). Flags are its notes ("hand at edge", "hands at start", "too close", ...).

## Two-handed signs

Every PopSign game clip is filmed by the signer holding the phone, so two-handed signs are signed one-handed for all
signers: `two_hand_frac` (share of frames with 2 hands detected) is <= 0.15 for every candidate of the 11 two-handed
signs, the one exception being a single 8032 CLEAN clip (0.50). 8037's best CLEAN by this measure is
`gtsignstudy4a.8037-clean-2023_01_25_17_21_52.325-0.mp4` (0.23, comparable to the current 8036 pick at 0.22).
Switching to 8037 doesn't make two-handedness worse: the existing "signed one-handed (holding a phone)" notes still
apply to the same 10 signs.

## Per-sign table (signer 8037 = proposed single signer)

2H = two-handed in standard ASL (from the signs.json descriptions). "Current" = the signer now used, with its q; `*` = it
already carries the one-handed/phone note. "Rank" = position of 8037's best clip among all scored local candidates
for that sign. "Remote" = 8037 clips available in the test tar. "Local signers" = Y/- for 8031,8032,8033,8035,8036,8037,8038,8039.

| Sign | Hands | Current (q) | 8037 best local clip | 8037 q | Rank | 2-hand frac | Flags | Remote 8037 clips | Local signers |
|---|---|---|---|---|---|---|---|---|---|
| milk | 1H | 8033 (2.469) | `gtsignstudy4a.8037-milk-2023_01_28_15_14_35.062-0.mp4` | 1.596 | 6/16 | 0.0 | - | 20 | YYYYYYYY |
| drink | 1H | 8037 (1.883) | `gtsignstudy4a.8037-drink-2023_01_28_13_34_11.834-0.mp4` | 1.883 | 2/16 | 0.0 | - | 20 | YYYYYYYY |
| water | 1H | 8039 (1.836) | `gtsignstudy4a.8037-water-2023_01_28_15_03_43.894-0.mp4` | 1.823 | 5/16 | 0.0 | - | 19 | YYYYYYYY |
| food | 1H | 8038 (1.955) | `gtsignstudy4a.8037-food-2023_01_28_13_19_34.314-0.mp4` | 1.775 | 6/16 | 0.0 | - | 20 | YYYYYYYY |
| hungry | 1H | 8035 (0.894) | `gtsignstudy4a.8037-hungry-2023_01_28_14_50_39.978-0.mp4` | 1.903 | 1/16 | 0.037 | - | 18 | YYYYYYYY |
| thirsty | 1H | 8033 (1.763) | `gtsignstudy4a.8037-thirsty-2023_01_28_14_46_18.798-0.mp4` | 1.06 | 11/16 | 0.04 | hand at edge | 18 | YYYYYYYY |
| apple | 1H | 8037 (2.029) | `gtsignstudy4a.8037-apple-2023_01_28_13_44_21.778-0.mp4` | 2.029 | 5/16 | 0.0 | - | 20 | YYYYYYYY |
| finish | 2H | 8037 (2.111) * | `gtsignstudy4a.8037-finish-2023_01_28_13_39_23.429-0.mp4` | 2.111 | 1/16 | 0.0 | - | 20 | YYYYYYYY |
| please | 1H | 8037 (2.117) | `gtsignstudy4a.8037-please-2023_01_28_15_15_39.970-0.mp4` | 2.117 | 2/16 | 0.031 | - | 20 | YYYYYYYY |
| thankyou | 1H | 8039 (1.911) | `gtsignstudy4a.8037-thankyou-2023_01_28_15_07_29.461-0.mp4` | 1.778 | 5/16 | 0.0 | - | 20 | YYYYYYYY |
| sleep | 1H | 8039 (1.706) | `gtsignstudy4a.8037-sleep-2023_01_28_13_44_52.854-0.mp4` | 1.722 | 3/16 | 0.0 | - | 20 | YYYYYYYY |
| bed | 1H | 8033 (2.503) | `gtsignstudy4a.8037-bed-2023_01_28_13_18_52.858-0.mp4` | 2.037 | 2/16 | 0.029 | - | 20 | YYYYYYYY |
| pajamas | 2H | 8031 (1.972) * | `gtsignstudy4a.8037-pajamas-2023_01_28_13_42_24.337-0.mp4` | 2.754 | 1/16 | 0.0 | - | 20 | YYYYYYYY |
| book | 2H | 8039 (2.043) * | `gtsignstudy4a.8037-book-2023_01_28_15_04_19.300-0.mp4` | 1.617 | 5/16 | 0.0 | - | 20 | YYYYYYYY |
| night | 2H | 8038 (1.832) * | `gtsignstudy4a.8037-night-2023_01_28_13_04_53.613-0.mp4` | 1.318 | 7/16 | 0.0 | - | 19 | YYYYYYYY |
| kiss | 1H | 8037 (1.912) | `gtsignstudy4a.8037-kiss-2023_01_28_13_17_10.098-0.mp4` | 1.912 | 2/14 | 0.032 | - | 20 | -YYYYYYY |
| moon | 1H | 8039 (2.917) | `gtsignstudy4a.8037-moon-2023_01_28_13_39_23.429-0.mp4` | 1.862 | 4/16 | 0.0 | - | 20 | YYYYYYYY |
| shhh | 1H | 8033 (1.959) | `gtsignstudy4a.8037-shhh-2023_01_28_15_18_06.773-0.mp4` | 2.122 | 1/16 | 0.03 | - | 20 | YYYYYYYY |
| wake | 2H | 8033 (2.182) * | `gtsignstudy4a.8037-wake-2023_01_28_13_41_51.203-0.mp4` | 1.575 | 5/16 | 0.061 | - | 20 | YYYYYYYY |
| morning | 2H | 8031 (1.826) * | `gtsignstudy4a.8037-morning-2023_01_28_13_37_26.760-0.mp4` | 2.016 | 1/16 | 0.029 | - | 20 | YYYYYYYY |
| bath | 2H | 8039 (2.153) * | `gtsignstudy4a.8037-bath-2023_01_28_15_10_49.932-0.mp4` | 1.88 | 3/16 | 0.0 | - | 20 | YYYYYYYY |
| wet | 2H | 8038 (2.027) * | `gtsignstudy4a.8037-wet-2023_01_28_14_43_47.136-0.mp4` | 1.536 | 6/14 | 0.071 | - | 15 | -YYYYYYY |
| dry | 1H | 8039 (1.869) | `gtsignstudy4a.8037-dry-2023_01_28_15_15_06.783-0.mp4` | 1.706 | 6/16 | 0.0 | - | 20 | YYYYYYYY |
| toothbrush | 1H | 8033 (2.28) | `gtsignstudy4a.8037-toothbrush-2023_01_28_15_12_56.883-0.mp4` | 1.889 | 6/14 | 0.0 | - | 20 | YYYYYYYY |
| potty | 1H | 8033 (1.879) | `gtsignstudy4a.8037-potty-2023_01_28_13_38_50.984-0.mp4` | 1.859 | 5/16 | 0.0 | - | 20 | YYYYYYYY |
| shower | 1H | 8037 (2.022) | `gtsignstudy4a.8037-shower-2023_01_28_15_18_06.773-0.mp4` | 2.022 | 1/2 | 0.027 | - | 19 | -----Y-- |
| clean | 2H | 8036 (n/a) | `gtsignstudy4a.8037-clean-2023_01_28_13_40_43.052-0.mp4` | 1.902 | 5/16 | 0.059 | - | 20 | YYYYYYYY |
| dirty | 1H | 8039 (2.155) | `gtsignstudy4a.8037-dirty-2023_01_28_13_43_50.212-0.mp4` | 1.923 | 3/16 | 0.0 | - | 20 | YYYYYYYY |
| mom | 1H | 8039 (1.983) | `gtsignstudy4a.8037-mom-2023_01_28_15_04_49.677-0.mp4` | 1.816 | 5/16 | 0.0 | - | 20 | YYYYYYYY |
| dad | 1H | 8031 (2.244) | `gtsignstudy4a.8037-dad-2023_01_28_13_17_10.098-0.mp4` | 1.578 | 6/16 | 0.128 | - | 20 | YYYYYYYY |
| grandma | 1H | 8039 (1.692) | `gtsignstudy4a.8037-grandma-2023_01_28_15_12_56.883-0.mp4` | 1.921 | 1/14 | 0.0 | - | 20 | -YYYYYYY |
| grandpa | 1H | 8037 (2.012) | `gtsignstudy4a.8037-grandpa-2023_01_28_13_19_34.314-0.mp4` | 2.012 | 1/14 | 0.0 | - | 20 | -YYYYYYY |
| brother | 2H | 8031 (1.537) * | `gtsignstudy4a.8037-brother-2023_01_28_15_15_06.783-0.mp4` | 1.853 | 2/7 | 0.036 | - | 19 | YY---YY- |
| hello | 1H | 8031 (1.742) | `gtsignstudy4a.8037-hello-2023_01_28_13_40_43.052-0.mp4` | 1.698 | 4/16 | 0.103 | - | 20 | YYYYYYYY |
| bye | 1H | 8032 (1.884) | `gtsignstudy4a.8037-bye-2023_01_28_13_37_26.760-0.mp4` | 1.821 | 6/16 | 0.0 | - | 20 | YYYYYYYY |
| yes | 1H | 8033 (2.197) | `gtsignstudy4a.8037-yes-2023_01_28_13_44_21.778-0.mp4` | 1.724 | 6/16 | 0.0 | - | 20 | YYYYYYYY |
| no | 1H | 8037 (1.619) | `gtsignstudy4a.8037-no-2023_01_28_13_42_57.161-0.mp4` | 1.619 | 5/16 | 0.0 | - | 20 | YYYYYYYY |
| happy | 1H | 8037 (1.998) | `gtsignstudy4a.8037-happy-2023_01_28_13_44_52.854-0.mp4` | 1.998 | 4/16 | 0.0 | - | 20 | YYYYYYYY |
| sad | 2H | 8033 (2.002) * | `gtsignstudy4a.8037-sad-2023_01_28_13_07_33.784-1.mp4` | 1.929 | 4/16 | 0.0 | - | 17 | YYYYYYYY |
| cry | 1H | 8039 (2.041) | `gtsignstudy4a.8037-cry-2023_01_28_15_16_50.609-0.mp4` | 1.719 | 6/16 | 0.0 | - | 20 | YYYYYYYY |

## Added 2026-10-22: Play and Feelings & needs (21 signs, still signer 8037 only)

Indexed with `index_tars.py` (`game/test`), then 5 of 8037's clips per sign fetched and scored with `fetch_score.py` and ranked with
`rank_sheets.py` (`D:/datasets/popsign/scores_8037_v2.json`, `rank_8037_v2.json`, `sheets_8037_v2/`). Every candidate sign had 8037 clips.
The top-ranked clip was used except for jump (#0 is dark and flagged "hands at start/end", so #1).

| Sign | Chosen clip | q | 2-hand frac | Remote 8037 clips |
|---|---|---|---|---|
| dog | `gtsignstudy4a.8037-dog-2023_01_28_13_42_24.337-0.mp4` | 1.444 | 0.0 | 19 |
| cat | `gtsignstudy4a.8037-cat-2023_01_28_19_27_57.964-0.mp4` | 1.876 | 0.036 | 20 |
| bird | `gtsignstudy4a.8037-bird-2023_01_28_15_12_56.883-0.mp4` | 1.913 | 0.0 | 20 |
| fish | `gtsignstudy4a.8037-fish-2023_01_25_17_18_33.013-0.mp4` | 1.808 | 0.0 | 15 |
| cow | `gtsignstudy4a.8037-cow-2023_01_29_14_12_57.445-0.mp4` | 1.938 | 0.0 | 18 |
| horse | `gtsignstudy4a.8037-horse-2023_01_25_17_28_04.592-0.mp4` | 2.117 | 0.0 | 20 |
| car | `gtsignstudy4a.8037-car-2023_01_28_12_52_00.888-0.mp4` | 2.385 | 0.0 | 18 |
| outside | `gtsignstudy4a.8037-outside-2023_01_28_15_18_06.773-0.mp4` | 2.003 | 0.0 | 20 |
| jump | `gtsignstudy4a.8037-jump-2023_01_28_15_01_27.840-0.mp4` | 1.655 | 0.067 | 19 |
| balloon | `gtsignstudy4a.8037-balloon-2023_01_29_13_59_03.432-0.mp4` | 2.034 | 0.0 | 19 |
| airplane | `gtsignstudy4a.8037-airplane-2023_01_28_15_04_49.677-0.mp4` | 2.036 | 0.0 | 20 |
| owie | `gtsignstudy4a.8037-owie-2023_01_28_15_12_15.919-0.mp4` | 2.094 | 0.0 | 19 |
| sick | `gtsignstudy4a.8037-sick-2023_01_28_13_44_52.854-0.mp4` | 1.736 | 0.033 | 20 |
| mad | `gtsignstudy4a.8037-mad-2023_01_28_19_19_04.027-0.mp4` | 1.779 | 0.0 | 20 |
| like | `gtsignstudy4a.8037-like-2023_01_28_15_12_56.883-0.mp4` | 1.796 | 0.0 | 20 |
| wait | `gtsignstudy4a.8037-wait-2023_01_25_17_31_25.739-0.mp4` | 1.819 | 0.0 | 19 |
| up | `gtsignstudy4a.8037-up-2023_01_25_17_21_52.325-0.mp4` | 1.74 | 0.0 | 19 |
| open | `gtsignstudy4a.8037-open-2023_01_28_13_19_34.314-0.mp4` | 1.865 | 0.032 | 20 |
| hot | `gtsignstudy4a.8037-hot-2023_01_28_18_48_10.465-0.mp4` | 1.562 | 0.0 | 18 |
| look | `gtsignstudy4a.8037-look-2023_01_28_13_44_21.778-0.mp4` | 1.878 | 0.0 | 19 |
| where | `gtsignstudy4a.8037-where-2023_01_28_15_16_50.609-0.mp4` | 1.829 | 0.0 | 20 |
