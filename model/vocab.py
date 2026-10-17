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

PACKS = None  # filled in after selection


def labels_of(packs):
    seen, out = set(), []
    for ids in packs.values():
        for s in ids:
            if s not in seen:
                seen.add(s)
                out.append(s)
    return out
