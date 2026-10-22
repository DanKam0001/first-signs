# Demo video plan (under 3:00, aim for 2:45; judges may stop at any point, so the best part goes first)

**Voiceover:** the user's cloned ElevenLabs voice "Danish", about 350 words (~2.3k characters).
**Music:** none, or a track that is verifiably royalty-free (CC0). No copyrighted music.
**Captions:** burned in. Every number on screen comes from FACTS.md.
**Upload:** public on YouTube. The link goes into the Devpost form.

| # | Time | Picture | Voice (draft) | Source |
|---|---|---|---|---|
| 1 | 0:00-0:12 | A calm living room, the TV switches on. Text cards: "6 months", "9 in 10" | "At six months, babies already understand words. Nine in ten Deaf babies are born to hearing parents. Their first words have to be signed, by parents who are just starting to learn." | iPhone shot of the user's TV + text cards |
| 2 | 0:12-0:25 | The problem: someone squints at a phone held in one hand, trying to sign with the other | "Phone apps mean a tiny screen, one hand, one person, and nobody to tell you when your sign is wrong." | User films themselves holding a phone (5 s) |
| 3 | 0:25-0:35 | The phone goes on a stand, the QR code is scanned, "Phone connected" | "First Signs turns your Fire TV into a family sign class. Your phone is just the camera, so both hands are free." | iPhone shot + TV capture |
| 4 | 0:35-1:20 | **The money shot.** Mealtime -> "milk": the real Deaf signer's video, life-size. The user signs. "Almost!" plus a coaching tip. Retry. Green celebration | "Learn from real Deaf signers. Then it's your turn: First Signs watches your hands and tells you what to fix, and when you've got it." | `adb screenrecord` of the TV + picture-in-picture of the user signing |
| 5 | 1:20-1:40 | Family round: turns, score, streak (cut if there's no second person) | "Take turns as a family. Everyone sees the feedback." | TV capture |
| 6 | 1:40-2:10 | Animated diagram: phone (hand tracking runs on the phone, no video sent) -> server -> Fire TV; AWS Polly + Bedrock; a metrics card | "Hand tracking runs on the phone, and video never leaves it. Our model was trained on 21 Deaf signers and checked on 10 it had never seen: 94% right within a pack." | Built by Claude (code-rendered) |
| 7 | 2:10-2:35 | Respect and impact: the implants line, credits, "Learn with Deaf teachers too", next steps (Auslan, Echo Show, more packs) | "With or without an implant, signing means your baby always has a language. First Signs is built on recordings by Deaf signers, and it points families to Deaf-led classes." | Text + TV About screen |
| 8 | 2:35-2:45 | Logo + tagline | "First Signs. Your baby's first words, together." | Built by Claude |

## Who does what
- **User (about 30-40 min total, with the stick on the TV):**
  - shot 1: the TV switching on, 10 s
  - shot 2: the "phone problem" clip, 5 s
  - shot 3: putting the phone on the stand and scanning the QR
  - shot 4: signing 3-4 signs, including one deliberate miss
  - shot 5: the family round (if possible)
- **Claude:**
  - the final script
  - generating the voiceover
  - capturing the TV screen over adb
  - the diagram and metrics cards
  - the edit, captions and thumbnail
  - a draft cut for the user to review before upload

## Open choices
- Is a second person available for the family round?
- Face on camera, or framed from the chin down?
