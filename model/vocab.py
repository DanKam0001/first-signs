"""Vocabulary and routine packs. Every id is a GISLR sign name (sign_to_prediction_index_map.json).

CANDIDATE_PACKS: the 64-sign superset used for selection (train on all, look at held-out-signer
confusions, keep the signs that are distinct within their pack).
PACKS: the shipped vocabulary (set after selection; see README "Vocabulary").
"""

CANDIDATE_PACKS = {
    "mealtime": ["milk", "drink", "water", "food", "hungry", "thirsty", "snack", "finish", "please", "thankyou",
                 "yucky", "apple", "cereal", "hot", "all", "empty", "napkin", "icecream"],
    "bedtime": ["sleep", "sleepy", "nap", "bed", "pajamas", "book", "story", "night", "kiss", "moon", "quiet",
                "shhh", "read", "wake", "awake", "morning", "lamp"],
    "bath": ["bath", "wet", "dry", "toothbrush", "tooth", "potty", "shower", "clean", "dirty", "hair", "duck",
             "underwear"],
    "family": ["mom", "dad", "grandma", "grandpa", "brother", "aunt", "uncle", "boy", "girl", "child", "hello",
               "bye", "yes", "no", "happy", "sad", "cry"],
}

# Chosen 2026-10-17 from the 64-candidate 5-fold signer CV (runs/cand). Dropped and why:
#   awake (signed like wake: 67% predicted as wake), nap and sleepy (24% / 21% predicted as sleep),
#   quiet (shhh-like), lamp (confused with shhh; description unverified), snack (no dedicated ASL sign),
#   child (52% top-1), all, yucky, cereal, napkin, empty, underwear (weak and/or unverified descriptions),
#   story (overlaps book/read), read, icecream, duck, hair, tooth, aunt, uncle, boy, girl (to keep packs ~10).
PACKS = {
    "mealtime": ["milk", "drink", "water", "food", "hungry", "thirsty", "apple", "finish", "please", "thankyou"],
    "bedtime": ["sleep", "bed", "pajamas", "book", "night", "kiss", "moon", "shhh", "wake", "morning"],
    "bath": ["bath", "wet", "dry", "toothbrush", "potty", "shower", "clean", "dirty"],
    "family": ["mom", "dad", "grandma", "grandpa", "brother", "hello", "bye", "yes", "no", "happy", "sad", "cry"],
    # Added 2026-10-22 from the 76-sign signer CV (runs/cand2); see README "Vocabulary" for what was dropped and why.
    "play": ["dog", "cat", "bird", "fish", "cow", "horse", "car", "outside", "jump", "balloon", "airplane"],
    "feelings": ["owie", "sick", "mad", "like", "wait", "up", "open", "hot", "look", "where"],
}


# Second selection round (2026-10-22): the 40 shipped signs plus candidates for two new packs, all GISLR signs
# with PopSign clips from Deaf signer 8037. Same method: 5-fold signer CV on the train set only, keep signs
# that are distinct within their pack. The 40 existing signs are fixed.
CANDIDATE_PACKS_V2 = {
    **{k: list(v) for k, v in PACKS.items() if k not in ("play", "feelings")},
    "play": ["toy", "dog", "cat", "bird", "fish", "cow", "horse", "duck", "car", "outside", "jump", "dance",
             "puzzle", "balloon", "airplane", "frog", "pig", "blow", "ride"],
    "feelings": ["owie", "sick", "mad", "like", "wait", "look", "up", "down", "open", "hot", "give", "where",
                 "stay", "fine", "bad", "listen", "smile"],
}


def labels_of(packs):
    seen, out = set(), []
    for ids in packs.values():
        for s in ids:
            if s not in seen:
                seen.add(s)
                out.append(s)
    return out
