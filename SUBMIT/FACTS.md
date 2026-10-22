# Facts we may state (checked 2026-10-17). Use the wording given here, nothing stronger.

| Claim (on-screen wording) | Source | Confidence |
|---|---|---|
| "Babies understand common words from about 6 months." | Bergelson & Swingley 2012, PNAS (PMC3295309) | High |
| "Most babies say a first word or two around their first birthday." | NIDCD speech & language; CDC 1-year milestones | High |
| "Early access to language matters: signed or spoken, the earlier the better." | NIDCD American Sign Language page (it also mentions "critical periods") | High |
| "9 in 10 children born deaf have hearing parents." | NIDCD quick statistics, citing Mitchell & Karchmer 2004 ("more than 90%") | High |
| "About 1.7 per 1,000 babies screened had hearing loss (US, 2022)." | CDC EHDI data | High |
| "Cochlear implants are FDA-approved from 9 months." | NIDCD cochlear implants page (updated June 2024) | High |
| "Median age at implant: 16 months (US children born profoundly deaf, implanted 2015-19)." | Nassiri et al. 2023, Otology & Neurotology | High |
| "Implant results vary widely." | Humphries et al. 2012; NIDCD says early implantation "may" lead to near-typical language | Medium-high |
| "Learning to sign has not been shown to hold back spoken words." | Pontecorvo et al. 2023, JSLHR. Geers et al. 2017 (Pediatrics) found no advantage. The question is contested. | Medium (contested) |
| Language deprivation causes problems "beyond strictly language" | Humphries et al. 2012, Harm Reduction Journal (a position paper) | Medium |

## Do NOT say
- "Signing babies sign earlier than speaking babies talk." The evidence is contested.
- "~50 words by 12 months." No authoritative source.
- "Most hearing parents don't know any sign." Likely true, but nothing sources it.
- Any US implant price. No authoritative source.
- "Experts recommend signing alongside implants." The evidence is contested. Use the "not shown to hold back" wording instead.
- Who isn't a candidate for an implant. No primary source found.

## Hook candidates
- A: "Babies start understanding words at 6 months. Nine in ten Deaf babies are born to hearing parents."
- B: "Language learning starts in infancy. For a Deaf baby, it has to be seen, not heard."
- C: "Hearing babies understand words at 6 months. The typical cochlear implant comes at 16 months."

## Recognition accuracy we may state (measured 2026-10-22, from `model/export/metrics.json`)
Shipped model: 61 signs in 6 packs (Mealtime, Bedtime, Bath time, Family, Play, Feelings & needs). Test set: GISLR rerun
set, 10 Deaf signers the model never saw, 9,882 clips. "In-pack" = only the current pack's signs are candidates, as in the app.

| Claim (on-screen wording) | Number | Confidence |
|---|---|---|
| "Tested on 10 Deaf signers it never saw: right first time 94.5% of the time, in its top 3 97.7%, within a pack." | in-pack top-1 0.945, top-3 0.977 | High (measured) |
| "On clips made to look like the phone's window: 92.4% first time, 96.3% in the top 3." | phone-sim in-pack top-1 0.924, top-3 0.963 | High (measured) |
| "Every pack scores at least 96.7% top-3 on unseen signers." | lowest pack top-3: Play 0.967 | High (measured) |
| "Adding the two new packs did not meaningfully change the first four: 94.6% / 97.8% now, 94.4% / 97.7% before." | first 40 signs, same clips, both models | High (measured) |

Do NOT say: any accuracy for learners or for the live phone camera (not measured yet); "61 signs at 97.7%" without "within a pack"
(all 61 at once is 89.3% top-1 / 94.6% top-3).
