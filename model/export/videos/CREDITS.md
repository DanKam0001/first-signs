# Sign videos: credits and licence

The 40 short clips in this folder (`<id>.mp4`, plus a poster still `<id>.jpg`) show one Deaf signer performing every First Signs sign: PopSign participant **8037** (published ID `gtsignstudy4a.8037`), the only signer in the `game/test` split who recorded all 40 signs.

## Source
**PopSign ASL v1.0**, published by the Georgia Institute of Technology and the Deaf Professional Arts Network (DPAN), 2023.
- Dataset page: https://signdata.cc.gatech.edu/view/datasets/popsign_v1_0/
- Paper: Thad Starner, Sean Forbes, Matthew So, et al., "PopSign ASL v1.0: An Isolated American Sign Language Dataset Collected via Smartphones", NeurIPS 2023 Datasets and Benchmarks. https://signdata.cc.gatech.edu/res/doc/popsign_v1_0/popsign_v1_0.pdf
- Licence: **Creative Commons Attribution 4.0 International (CC BY 4.0)**, https://creativecommons.org/licenses/by/4.0/
  - The dataset page says: "Popsign v1.0 is licensed under CC BY 4.0."

The signer is a Deaf ASL user recruited by DPAN. They are identified only by the dataset's anonymous participant ID (8037, as published), and we don't try to identify them.

## Changes we made (CC BY 4.0 §3(a)(1)(B))
Each clip is taken from the `game/test` split. We:
- trimmed it to the sign, keeping about 0.27 s of rest before and after
- scaled it to 720 px tall
- converted it to 30 fps H.264 (Main profile, limited range) with no audio, using `+faststart`
- extracted one poster still per clip

PopSign game clips were filmed by the signer holding the phone, so two-handed signs (finish, book, night, wake, morning, bath, wet, clean, brother, sad) are signed one-handed; each of those carries a caption note saying so.

We did not change the signing itself.

## Attribution text
Short version, for the app's About/credits screen and the YouTube description:

> Sign videos: PopSign ASL v1.0 by Georgia Tech and the Deaf Professional Arts Network (DPAN), performed by a Deaf signer (participant 8037), licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Clips trimmed and re-encoded. https://signdata.cc.gatech.edu

The sign landmark model is credited separately (GISLR, CC BY 4.0, see `../signs.json` `_credits`).

No endorsement: Georgia Tech, DPAN and the signer do not endorse First Signs.

## Clips
| Sign | Signer ID | Source file (inside `popsign_v1_0/game/test/<sign>.tar`) | Length | Size |
|---|---|---|---|---|
| milk | 8037 | `gtsignstudy4a.8037-milk-2023_01_28_15_14_35.062-0.mp4` | 1.27 s | 67 KB |
| drink | 8037 | `gtsignstudy4a.8037-drink-2023_01_28_13_34_11.834-0.mp4` | 1.53 s | 79 KB |
| water | 8037 | `gtsignstudy4a.8037-water-2023_01_28_15_03_43.894-0.mp4` | 1.27 s | 71 KB |
| food | 8037 | `gtsignstudy4a.8037-food-2023_01_28_13_19_34.314-0.mp4` | 1.33 s | 67 KB |
| hungry | 8037 | `gtsignstudy4a.8037-hungry-2023_01_28_14_50_39.978-0.mp4` | 1.27 s | 77 KB |
| thirsty | 8037 | `gtsignstudy4a.8037-thirsty-2023_01_28_15_05_48.659-0.mp4` | 1.4 s | 75 KB |
| apple | 8037 | `gtsignstudy4a.8037-apple-2023_01_28_13_44_21.778-0.mp4` | 1.4 s | 69 KB |
| finish | 8037 | `gtsignstudy4a.8037-finish-2023_01_28_13_39_23.429-0.mp4` | 1.4 s | 78 KB |
| please | 8037 | `gtsignstudy4a.8037-please-2023_01_28_15_15_39.970-0.mp4` | 1.6 s | 93 KB |
| thankyou | 8037 | `gtsignstudy4a.8037-thankyou-2023_01_28_15_07_29.461-0.mp4` | 1.27 s | 86 KB |
| sleep | 8037 | `gtsignstudy4a.8037-sleep-2023_01_28_13_44_52.854-0.mp4` | 1.2 s | 73 KB |
| bed | 8037 | `gtsignstudy4a.8037-bed-2023_01_28_13_18_52.858-0.mp4` | 1.53 s | 83 KB |
| pajamas | 8037 | `gtsignstudy4a.8037-pajamas-2023_01_28_13_42_24.337-0.mp4` | 1.77 s | 93 KB |
| book | 8037 | `gtsignstudy4a.8037-book-2023_01_28_15_04_19.300-0.mp4` | 1.27 s | 74 KB |
| night | 8037 | `gtsignstudy4a.8037-night-2023_01_28_13_44_52.854-0.mp4` | 1.33 s | 80 KB |
| kiss | 8037 | `gtsignstudy4a.8037-kiss-2023_01_28_13_17_10.098-0.mp4` | 1.4 s | 76 KB |
| moon | 8037 | `gtsignstudy4a.8037-moon-2023_01_28_13_39_23.429-0.mp4` | 1.33 s | 79 KB |
| shhh | 8037 | `gtsignstudy4a.8037-shhh-2023_01_28_15_18_06.773-0.mp4` | 1.67 s | 87 KB |
| wake | 8037 | `gtsignstudy4a.8037-wake-2023_01_28_13_41_51.203-0.mp4` | 1.2 s | 71 KB |
| morning | 8037 | `gtsignstudy4a.8037-morning-2023_01_28_13_37_26.760-0.mp4` | 1.87 s | 95 KB |
| bath | 8037 | `gtsignstudy4a.8037-bath-2023_01_28_15_10_49.932-0.mp4` | 1.33 s | 73 KB |
| wet | 8037 | `gtsignstudy4a.8037-wet-2023_01_28_14_43_47.136-0.mp4` | 1.27 s | 72 KB |
| dry | 8037 | `gtsignstudy4a.8037-dry-2023_01_28_15_15_06.783-0.mp4` | 1.13 s | 67 KB |
| toothbrush | 8037 | `gtsignstudy4a.8037-toothbrush-2023_01_28_15_12_56.883-0.mp4` | 1.33 s | 78 KB |
| potty | 8037 | `gtsignstudy4a.8037-potty-2023_01_28_13_38_50.984-0.mp4` | 1.33 s | 70 KB |
| shower | 8037 | `gtsignstudy4a.8037-shower-2023_01_28_15_18_06.773-0.mp4` | 1.73 s | 105 KB |
| clean | 8037 | `gtsignstudy4a.8037-clean-2023_01_28_15_36_02.621-0.mp4` | 1.47 s | 80 KB |
| dirty | 8037 | `gtsignstudy4a.8037-dirty-2023_01_28_13_43_50.212-0.mp4` | 1.27 s | 67 KB |
| mom | 8037 | `gtsignstudy4a.8037-mom-2023_01_28_15_04_49.677-0.mp4` | 1.13 s | 63 KB |
| dad | 8037 | `gtsignstudy4a.8037-dad-2023_01_28_13_17_10.098-0.mp4` | 1.33 s | 71 KB |
| grandma | 8037 | `gtsignstudy4a.8037-grandma-2023_01_28_15_12_56.883-0.mp4` | 1.33 s | 69 KB |
| grandpa | 8037 | `gtsignstudy4a.8037-grandpa-2023_01_28_13_19_34.314-0.mp4` | 1.6 s | 98 KB |
| brother | 8037 | `gtsignstudy4a.8037-brother-2023_01_28_15_15_06.783-0.mp4` | 1.33 s | 80 KB |
| hello | 8037 | `gtsignstudy4a.8037-hello-2023_01_28_13_40_43.052-0.mp4` | 1.33 s | 76 KB |
| bye | 8037 | `gtsignstudy4a.8037-bye-2023_01_28_13_37_26.760-0.mp4` | 1.33 s | 76 KB |
| yes | 8037 | `gtsignstudy4a.8037-yes-2023_01_28_13_44_21.778-0.mp4` | 1.2 s | 72 KB |
| no | 8037 | `gtsignstudy4a.8037-no-2023_01_28_13_42_57.161-0.mp4` | 1.2 s | 74 KB |
| happy | 8037 | `gtsignstudy4a.8037-happy-2023_01_28_13_44_52.854-0.mp4` | 1.47 s | 84 KB |
| sad | 8037 | `gtsignstudy4a.8037-sad-2023_01_28_13_07_33.784-1.mp4` | 1.53 s | 82 KB |
| cry | 8037 | `gtsignstudy4a.8037-cry-2023_01_28_15_16_50.609-0.mp4` | 1.13 s | 63 KB |
