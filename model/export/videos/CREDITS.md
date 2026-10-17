# Sign videos: credits and licence

The 40 short clips in this folder (`<id>.mp4`, plus a poster still `<id>.jpg`) show Deaf signers performing each First Signs sign.

## Source
**PopSign ASL v1.0**, published by the Georgia Institute of Technology and the Deaf Professional Arts Network (DPAN), 2023.
- Dataset page: https://signdata.cc.gatech.edu/view/datasets/popsign_v1_0/
- Paper: Thad Starner, Sean Forbes, Matthew So, et al., "PopSign ASL v1.0: An Isolated American Sign Language Dataset Collected via Smartphones", NeurIPS 2023 Datasets and Benchmarks. https://signdata.cc.gatech.edu/res/doc/popsign_v1_0/popsign_v1_0.pdf
- Licence: **Creative Commons Attribution 4.0 International (CC BY 4.0)**, https://creativecommons.org/licenses/by/4.0/
  - The dataset page says: "Popsign v1.0 is licensed under CC BY 4.0."

The signers are Deaf ASL users recruited by DPAN. They are identified only by the dataset's anonymous participant IDs, and we don't try to identify them.

## Changes we made (CC BY 4.0 §3(a)(1)(B))
Each clip is taken from the `game/test` split. We:
- trimmed it to the sign, keeping about 0.27 s of rest before and after
- scaled it to 720 px tall
- converted it to 30 fps H.264 (Main profile, limited range) with no audio, using `+faststart`
- extracted one poster still per clip

We did not change the signing itself.

## Attribution text
Short version, for the app's About/credits screen and the YouTube description:

> Sign videos: PopSign ASL v1.0 by Georgia Tech and the Deaf Professional Arts Network (DPAN), performed by Deaf signers, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Clips trimmed and re-encoded. https://signdata.cc.gatech.edu

The sign landmark model is credited separately (GISLR, CC BY 4.0, see `../signs.json` `_credits`).

No endorsement: Georgia Tech, DPAN and the signers do not endorse First Signs.

## Clips
| Sign | Signer ID | Source file (inside `popsign_v1_0/game/test/<sign>.tar`) | Length | Size |
|---|---|---|---|---|
| milk | 8033 | `gtsignstudy4a.8033-milk-2023_01_29_11_36_38.120-0.mp4` | 1.57 s | 129 KB |
| drink | 8037 | `gtsignstudy4a.8037-drink-2023_01_28_13_34_11.834-0.mp4` | 1.53 s | 79 KB |
| water | 8039 | `gtsignstudy4a.8039-water-2023_01_23_10_56_46.984-0.mp4` | 1.63 s | 82 KB |
| food | 8038 | `gtsignstudy4a.8038-food-2023_01_25_19_18_52.327-0.mp4` | 2.0 s | 105 KB |
| hungry | 8035 | `gtsignstudy4a.8035-hungry-2023_01_31_10_46_18.188-0.mp4` | 1.3 s | 75 KB |
| thirsty | 8033 | `gtsignstudy4a.8033-thirsty-2023_01_29_12_44_39.948-0.mp4` | 1.17 s | 92 KB |
| apple | 8037 | `gtsignstudy4a.8037-apple-2023_01_28_13_44_21.778-0.mp4` | 1.4 s | 69 KB |
| finish | 8037 | `gtsignstudy4a.8037-finish-2023_01_28_13_39_23.429-0.mp4` | 1.4 s | 78 KB |
| please | 8037 | `gtsignstudy4a.8037-please-2023_01_28_15_15_39.970-0.mp4` | 1.6 s | 92 KB |
| thankyou | 8039 | `gtsignstudy4a.8039-thankyou-2023_01_24_14_25_44.756-0.mp4` | 1.6 s | 88 KB |
| sleep | 8039 | `gtsignstudy4a.8039-sleep-2023_01_23_10_59_02.102-0.mp4` | 1.4 s | 85 KB |
| bed | 8033 | `gtsignstudy4a.8033-bed-2023_01_29_11_42_29.576-0.mp4` | 1.63 s | 160 KB |
| pajamas | 8031 | `gtsignstudy4a.8031-pajamas-2023_01_25_18_27_51.259-0.mp4` | 1.5 s | 87 KB |
| book | 8039 | `gtsignstudy4a.8039-book-2023_01_25_13_43_29.777-0.mp4` | 1.97 s | 96 KB |
| night | 8038 | `gtsignstudy4a.8038-night-2023_01_25_19_55_42.774-0.mp4` | 1.93 s | 97 KB |
| kiss | 8037 | `gtsignstudy4a.8037-kiss-2023_01_28_13_17_10.098-0.mp4` | 1.4 s | 76 KB |
| moon | 8039 | `gtsignstudy4a.8039-moon-2023_01_23_10_58_33.259-0.mp4` | 1.63 s | 102 KB |
| shhh | 8033 | `gtsignstudy4a.8033-shhh-2023_01_29_12_44_19.994-0.mp4` | 1.3 s | 98 KB |
| wake | 8033 | `gtsignstudy4a.8033-wake-2023_01_29_11_45_52.980-0.mp4` | 1.43 s | 130 KB |
| morning | 8031 | `gtsignstudy4a.8031-morning-2023_01_25_13_48_49.012-0.mp4` | 1.37 s | 83 KB |
| bath | 8039 | `gtsignstudy4a.8039-bath-2023_01_23_10_54_02.096-0.mp4` | 2.07 s | 108 KB |
| wet | 8038 | `gtsignstudy4a.8038-wet-2023_01_26_11_21_59.367-0.mp4` | 1.8 s | 86 KB |
| dry | 8039 | `gtsignstudy4a.8039-dry-2023_01_25_13_42_18.159-0.mp4` | 1.6 s | 89 KB |
| toothbrush | 8033 | `gtsignstudy4a.8033-toothbrush-2023_01_29_13_38_54.616-0.mp4` | 1.63 s | 130 KB |
| potty | 8033 | `gtsignstudy4a.8033-potty-2023_01_29_11_39_36.860-0.mp4` | 1.37 s | 127 KB |
| shower | 8037 | `gtsignstudy4a.8037-shower-2023_01_28_15_18_06.773-0.mp4` | 1.73 s | 105 KB |
| clean | 8036 | `gtsignstudy4a.8036-clean-2023_01_28_13_53_28.643-0.mp4` | 1.8 s | 259 KB |
| dirty | 8039 | `gtsignstudy4a.8039-dirty-2023_01_23_10_59_02.102-0.mp4` | 1.73 s | 92 KB |
| mom | 8039 | `gtsignstudy4a.8039-mom-2023_01_25_13_46_59.907-0.mp4` | 1.67 s | 84 KB |
| dad | 8031 | `gtsignstudy4a.8031-dad-2023_01_25_13_37_07.599-0.mp4` | 1.57 s | 89 KB |
| grandma | 8039 | `gtsignstudy4a.8039-grandma-2023_01_24_14_24_09.913-0.mp4` | 1.53 s | 93 KB |
| grandpa | 8037 | `gtsignstudy4a.8037-grandpa-2023_01_28_13_19_34.314-0.mp4` | 1.6 s | 97 KB |
| brother | 8031 | `gtsignstudy4a.8031-brother-2023_01_25_13_42_50.735-0.mp4` | 1.3 s | 77 KB |
| hello | 8031 | `gtsignstudy4a.8031-hello-2023_01_25_13_45_22.998-0.mp4` | 1.1 s | 76 KB |
| bye | 8032 | `gtsignstudy4a.8032-bye-2023_01_25_21_11_53.095-0.mp4` | 1.37 s | 86 KB |
| yes | 8033 | `gtsignstudy4a.8033-yes-2023_01_29_12_44_19.994-0.mp4` | 1.5 s | 139 KB |
| no | 8037 | `gtsignstudy4a.8037-no-2023_01_28_13_42_57.161-0.mp4` | 1.2 s | 73 KB |
| happy | 8037 | `gtsignstudy4a.8037-happy-2023_01_28_13_44_52.854-0.mp4` | 1.47 s | 83 KB |
| sad | 8033 | `gtsignstudy4a.8033-sad-2023_01_29_11_38_35.852-0.mp4` | 1.37 s | 139 KB |
| cry | 8039 | `gtsignstudy4a.8039-cry-2023_01_25_13_47_25.292-0.mp4` | 2.2 s | 104 KB |
