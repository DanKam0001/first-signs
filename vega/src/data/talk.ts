// "Talk with Baby": short everyday scenes the family answers by signing one word.
// Each scene belongs to one pack (the phone masks the model to that pack), lists the signs that make sense
// as an answer, and has a warm reply for each. The TV replies to what the recogniser actually reported;
// it never claims to know what anyone "meant".
//
// Scenes are validated against the sign data at load: a sign id that doesn't exist, or isn't in the scene's
// pack (so the masked model could never report it), is dropped, and a scene left with no answers is skipped.
// That way new or renamed packs in src/generated never break this mode.
import { SIGNS, signById, thresholds } from './signs';

export type SceneArt =
  | 'highchair'
  | 'cup'
  | 'bowl'
  | 'apple'
  | 'sun'
  | 'clock'
  | 'eyes'
  | 'moon'
  | 'book'
  | 'cot'
  | 'tub'
  | 'drop'
  | 'towel'
  | 'toothbrush'
  | 'shower'
  | 'door'
  | 'heart'
  | 'wave'
  | 'tear'
  | 'smile'
  | 'photo'
  | 'ball';

export type Scene = {
  id: string;
  pack: string;
  art: SceneArt;
  prompt: string;
  /** Signs that make sense as an answer, best suggestion first ("Show me" plays the first one). */
  accept: string[];
  /** The TV's reply per accepted sign. */
  replies: Record<string, string>;
};

const RAW: Scene[] = [
  // ---- Mealtime ----
  {
    id: 'meal-reach',
    pack: 'mealtime',
    art: 'highchair',
    prompt: 'Baby is reaching for the table. What do they want?',
    accept: ['food', 'apple', 'milk', 'water', 'drink', 'hungry', 'please'],
    replies: {
      food: 'Food? Coming right up. Here’s your plate!',
      apple: 'Apple? Here’s a crunchy slice, just for you.',
      milk: 'Milk? Here’s your cup of milk.',
      water: 'Water? Here you go!',
      drink: 'A drink? Here’s your cup.',
      hungry: 'Hungry? Let’s get you something yummy.',
      please: 'Such lovely manners! Here you go.',
    },
  },
  {
    id: 'meal-cup',
    pack: 'mealtime',
    art: 'cup',
    prompt: 'Baby is holding up an empty cup.',
    accept: ['water', 'milk', 'drink', 'thirsty', 'please'],
    replies: {
      water: 'More water? Here you go!',
      milk: 'Milk? Let’s fill it up.',
      drink: 'Another drink? Coming right up.',
      thirsty: 'Thirsty? Let’s fill that cup.',
      please: 'You asked so nicely. One more cup!',
    },
  },
  {
    id: 'meal-done',
    pack: 'mealtime',
    art: 'bowl',
    prompt: 'Baby pushes the bowl away and wipes their mouth.',
    accept: ['finish', 'thankyou'],
    replies: {
      finish: 'All finished? Great eating! Let’s wipe those hands.',
      thankyou: 'Thank you for a lovely lunch, little one.',
    },
  },
  {
    id: 'meal-gift',
    pack: 'mealtime',
    art: 'apple',
    prompt: 'Grandma hands baby a slice of apple. What do we say?',
    accept: ['thankyou', 'apple'],
    replies: {
      thankyou: 'Thank you, Grandma! She’s smiling from ear to ear.',
      apple: 'Apple! A crunchy slice from Grandma.',
    },
  },
  {
    id: 'meal-tummy',
    pack: 'mealtime',
    art: 'smile',
    prompt: 'After a busy morning of play, baby pats their tummy.',
    accept: ['hungry', 'food', 'apple', 'milk'],
    replies: {
      hungry: 'Hungry? Let’s make lunch together.',
      food: 'Food time! Let’s see what’s in the fridge.',
      apple: 'An apple? A perfect little snack.',
      milk: 'Milk? Let’s warm some up.',
    },
  },
  {
    id: 'meal-park',
    pack: 'mealtime',
    art: 'sun',
    prompt: 'A hot day at the park, and baby is puffing.',
    accept: ['thirsty', 'water', 'drink'],
    replies: {
      thirsty: 'Thirsty? Here’s your water bottle.',
      water: 'Water? Here you go! Nice and cool.',
      drink: 'A drink? Let’s sit in the shade and sip.',
    },
  },
  {
    id: 'meal-more',
    pack: 'mealtime',
    art: 'highchair',
    prompt: 'Baby wants another spoonful. What’s the magic word?',
    accept: ['please', 'food', 'hungry'],
    replies: {
      please: 'Please! What lovely manners. One more spoonful.',
      food: 'More food? Here comes the spoon!',
      hungry: 'Still hungry? Here’s another spoonful.',
    },
  },
  {
    id: 'meal-bottle',
    pack: 'mealtime',
    art: 'cup',
    prompt: 'It’s bottle time. Baby is smacking their lips.',
    accept: ['milk', 'drink', 'hungry', 'thirsty'],
    replies: {
      milk: 'Milk? Here’s your bottle, nice and warm.',
      drink: 'A drink? Here’s your bottle.',
      hungry: 'Hungry? Your bottle is ready.',
      thirsty: 'Thirsty? Your bottle is ready.',
    },
  },
  {
    id: 'meal-snack',
    pack: 'mealtime',
    art: 'apple',
    prompt: 'Baby points at the fruit bowl. Something crunchy...',
    accept: ['apple', 'food', 'please'],
    replies: {
      apple: 'Apple? Good choice! Let’s cut it up.',
      food: 'A snack? Let’s pick something from the bowl.',
      please: 'Please! Here’s a slice of apple.',
    },
  },

  // ---- Bedtime ----
  {
    id: 'bed-7pm',
    pack: 'bedtime',
    art: 'clock',
    prompt: 'It’s 7pm and bath is done. What comes next?',
    accept: ['pajamas', 'book', 'bed', 'sleep'],
    replies: {
      pajamas: 'Pajamas? Arms up, here they come!',
      book: 'A story? Let’s pick one together.',
      bed: 'Bed? Let’s get snuggled in.',
      sleep: 'Sleepy time? Let’s dim the lights.',
    },
  },
  {
    id: 'bed-yawn',
    pack: 'bedtime',
    art: 'eyes',
    prompt: 'Baby rubs their eyes and gives a big yawn.',
    accept: ['sleep', 'bed', 'night'],
    replies: {
      sleep: 'Sleepy? Let’s get you cosy.',
      bed: 'Bed? Off we go, little one.',
      night: 'Night night already? Let’s tuck you in.',
    },
  },
  {
    id: 'bed-window',
    pack: 'bedtime',
    art: 'moon',
    prompt: 'Look out the window. What’s up in the sky tonight?',
    accept: ['moon', 'night'],
    replies: {
      moon: 'The moon! Can you see it shining?',
      night: 'Night time! The sky is all dark now.',
    },
  },
  {
    id: 'bed-story',
    pack: 'bedtime',
    art: 'book',
    prompt: 'Baby toddles over carrying their favourite story.',
    accept: ['book', 'sleep'],
    replies: {
      book: 'A book? Let’s read it one more time.',
      sleep: 'A sleepy story? Let’s snuggle up and read.',
    },
  },
  {
    id: 'bed-lights',
    pack: 'bedtime',
    art: 'heart',
    prompt: 'Lights out. Time for one last goodnight...',
    accept: ['kiss', 'night', 'sleep'],
    replies: {
      kiss: 'A kiss! Mwah. Goodnight, sweetheart.',
      night: 'Night night. See you in the morning.',
      sleep: 'Sleep tight, little one.',
    },
  },
  {
    id: 'bed-quiet',
    pack: 'bedtime',
    art: 'cot',
    prompt: 'Baby’s little sister is asleep in the next room.',
    accept: ['shhh', 'sleep'],
    replies: {
      shhh: 'Shhh... tiptoe, tiptoe. Nice and quiet.',
      sleep: 'She’s sleeping. Let’s use our quiet hands.',
    },
  },
  {
    id: 'bed-sunrise',
    pack: 'bedtime',
    art: 'sun',
    prompt: 'The sun is peeking through the curtains.',
    accept: ['morning', 'wake'],
    replies: {
      morning: 'Good morning, sunshine!',
      wake: 'Wake up, sleepyhead! A brand new day.',
    },
  },
  {
    id: 'bed-cot',
    pack: 'bedtime',
    art: 'cot',
    prompt: 'Baby is wriggling in the cot, eyes wide open.',
    accept: ['wake', 'morning'],
    replies: {
      wake: 'You’re awake! Come here for a cuddle.',
      morning: 'Morning already? Hello, you!',
    },
  },
  {
    id: 'bed-towel',
    pack: 'bedtime',
    art: 'towel',
    prompt: 'Out of the bath, wrapped in a towel. What goes on?',
    accept: ['pajamas', 'bed'],
    replies: {
      pajamas: 'Pajamas! The soft ones with the stars.',
      bed: 'Straight to bed? Pajamas first, then snuggles.',
    },
  },
  {
    id: 'bed-stars',
    pack: 'bedtime',
    art: 'moon',
    prompt: 'It’s dark outside and the stars are twinkling.',
    accept: ['night', 'moon', 'sleep'],
    replies: {
      night: 'Night time! The stars say goodnight too.',
      moon: 'The moon is out with all the stars.',
      sleep: 'Even the stars are getting sleepy.',
    },
  },

  // ---- Bath ----
  {
    id: 'bath-mud',
    pack: 'bath',
    art: 'drop',
    prompt: 'Baby has been splashing in mud puddles all afternoon.',
    accept: ['dirty', 'bath', 'shower', 'wet'],
    replies: {
      dirty: 'Dirty? You sure are! Muddy from head to toe.',
      bath: 'Bath time! Let’s wash off all that mud.',
      shower: 'A quick shower? Good idea!',
      wet: 'Wet and muddy! Let’s get you cleaned up.',
    },
  },
  {
    id: 'bath-tub',
    pack: 'bath',
    art: 'tub',
    prompt: 'The tub is full of warm bubbles. Where are we going?',
    accept: ['bath', 'wet'],
    replies: {
      bath: 'Bath! In you hop.',
      wet: 'Wet and bubbly! Splash, splash.',
    },
  },
  {
    id: 'bath-splash',
    pack: 'bath',
    art: 'drop',
    prompt: 'Splash! Baby’s hair is dripping everywhere.',
    accept: ['wet', 'dry'],
    replies: {
      wet: 'Wet? Very wet! What a splash.',
      dry: 'Let’s get you dry. Here’s the towel.',
    },
  },
  {
    id: 'bath-towel',
    pack: 'bath',
    art: 'towel',
    prompt: 'Out of the bath and onto a big fluffy towel.',
    accept: ['dry', 'clean'],
    replies: {
      dry: 'Dry! Rub-a-dub, all dry now.',
      clean: 'Squeaky clean! Look at you.',
    },
  },
  {
    id: 'bath-teeth',
    pack: 'bath',
    art: 'toothbrush',
    prompt: 'One more thing at the sink before bed...',
    accept: ['toothbrush', 'clean'],
    replies: {
      toothbrush: 'Toothbrush time! Brush, brush, brush.',
      clean: 'Clean teeth! Show me that sparkly smile.',
    },
  },
  {
    id: 'bath-wiggle',
    pack: 'bath',
    art: 'eyes',
    prompt: 'Baby does a wiggle dance and tugs at their nappy.',
    accept: ['potty', 'wet', 'dirty'],
    replies: {
      potty: 'Potty? Quick, let’s go!',
      wet: 'Wet nappy? Let’s get you changed.',
      dirty: 'Dirty nappy? Let’s get you changed.',
    },
  },
  {
    id: 'bath-showerhead',
    pack: 'bath',
    art: 'shower',
    prompt: 'Water is pouring down from above. What’s this?',
    accept: ['shower', 'wet'],
    replies: {
      shower: 'The shower! Pitter-patter goes the water.',
      wet: 'Wet! The water goes drip, drip, drip.',
    },
  },
  {
    id: 'bath-yoghurt',
    pack: 'bath',
    art: 'bowl',
    prompt: 'Oops! Yoghurt all down baby’s front.',
    accept: ['dirty', 'clean', 'bath'],
    replies: {
      dirty: 'Dirty? What a mess! Let’s wipe it up.',
      clean: 'Let’s get you clean again. Wipe, wipe.',
      bath: 'Maybe an early bath tonight!',
    },
  },
  {
    id: 'bath-fresh',
    pack: 'bath',
    art: 'smile',
    prompt: 'All washed and dried. How is baby now?',
    accept: ['clean', 'dry'],
    replies: {
      clean: 'Clean! You smell lovely.',
      dry: 'All dry and cosy. Well done!',
    },
  },

  // ---- Family ----
  {
    id: 'fam-door',
    pack: 'family',
    art: 'door',
    prompt: 'Someone’s at the door!',
    accept: ['hello', 'grandma', 'grandpa', 'mom', 'dad', 'brother'],
    replies: {
      hello: 'Hello! Come on in.',
      grandma: 'Grandma? Hooray, Grandma’s here!',
      grandpa: 'Grandpa? Big hugs for Grandpa!',
      mom: 'Mom’s home! Big hugs.',
      dad: 'Dad’s home! Run and say hi.',
      brother: 'Big brother is back! Hi, buddy.',
    },
  },
  {
    id: 'fam-coat',
    pack: 'family',
    art: 'wave',
    prompt: 'Grandpa is putting on his coat to go home.',
    accept: ['bye', 'grandpa', 'sad'],
    replies: {
      bye: 'Bye-bye, Grandpa! See you soon.',
      grandpa: 'Grandpa’s heading home. Let’s wave goodbye.',
      sad: 'A little sad? Grandpa will be back soon.',
    },
  },
  {
    id: 'fam-keys',
    pack: 'family',
    art: 'door',
    prompt: 'Keys jingle in the front door. Who’s home from work?',
    accept: ['mom', 'dad', 'hello'],
    replies: {
      mom: 'Mom! She’s home from work.',
      dad: 'Dad! He’s home from work.',
      hello: 'Hello! Welcome home.',
    },
  },
  {
    id: 'fam-ball',
    pack: 'family',
    art: 'ball',
    prompt: 'Someone rolls a ball to baby. Who’s playing?',
    accept: ['brother', 'dad', 'mom', 'grandpa', 'grandma', 'happy'],
    replies: {
      brother: 'Big brother wants to play! Roll it back.',
      dad: 'Dad’s playing! Roll it back to Dad.',
      mom: 'Mom’s playing! Roll it back to Mom.',
      grandpa: 'Grandpa’s playing! Roll it back.',
      grandma: 'Grandma’s playing! Roll it back.',
      happy: 'Happy? Ball games are the best!',
    },
  },
  {
    id: 'fam-cuddle',
    pack: 'family',
    art: 'heart',
    prompt: 'Would baby like a cuddle?',
    accept: ['yes', 'no', 'happy'],
    replies: {
      yes: 'Yes? Come here, big squeeze!',
      no: 'No? That’s okay. Maybe later.',
      happy: 'Happy cuddles!',
    },
  },
  {
    id: 'fam-tumble',
    pack: 'family',
    art: 'tear',
    prompt: 'Baby took a tumble and their lip is wobbling.',
    accept: ['sad', 'cry', 'mom', 'dad'],
    replies: {
      sad: 'Sad? Oh, sweetheart. Let’s have a cuddle.',
      cry: 'It’s okay to cry. I’ve got you.',
      mom: 'Mom’s here. Everything is okay.',
      dad: 'Dad’s here. Everything is okay.',
    },
  },
  {
    id: 'fam-peekaboo',
    pack: 'family',
    art: 'smile',
    prompt: 'Peekaboo! Baby is giggling and kicking their feet.',
    accept: ['happy', 'yes'],
    replies: {
      happy: 'Happy! What a giggle.',
      yes: 'Yes? Again! Peekaboo!',
    },
  },
  {
    id: 'fam-call',
    pack: 'family',
    art: 'photo',
    prompt: 'Grandma is on a video call, waving at the screen.',
    accept: ['hello', 'grandma', 'bye'],
    replies: {
      hello: 'Hello, Grandma! She’s waving back.',
      grandma: 'Grandma! She can see you.',
      bye: 'Bye-bye, Grandma! Blow her a kiss.',
    },
  },
  {
    id: 'fam-hat',
    pack: 'family',
    art: 'eyes',
    prompt: 'Baby keeps pulling off the itchy wool hat.',
    accept: ['no', 'sad'],
    replies: {
      no: 'No hat? Okay, we’ll find a softer one.',
      sad: 'Sad face? The hat can come off.',
    },
  },
  {
    id: 'fam-photo',
    pack: 'family',
    art: 'photo',
    prompt: 'Flipping through the photo album. Who’s that?',
    accept: ['grandpa', 'grandma', 'mom', 'dad', 'brother'],
    replies: {
      grandpa: 'Grandpa! Look at his big smile.',
      grandma: 'Grandma! That’s her garden.',
      mom: 'That’s Mom! When she was little.',
      dad: 'That’s Dad! Look at that hair.',
      brother: 'Big brother! On his first day of school.',
    },
  },

  // ---- Play / Feelings & needs ----
  // Written ahead of these packs' sign data, using likely sign ids (GISLR vocabulary). Validation keeps only
  // the ids that turn up in each pack, and skips a scene until at least one of its answers exists.
  {
    id: 'play-woof',
    pack: 'play',
    art: 'ball',
    prompt: 'Woof woof! Who’s wagging their tail at the park?',
    accept: ['dog', 'puppy'],
    replies: { dog: 'A dog! Can you pat him gently?', puppy: 'A puppy! Look at that waggy tail.' },
  },
  {
    id: 'play-meow',
    pack: 'play',
    art: 'smile',
    prompt: 'Meow! Something furry is curled up on the couch.',
    accept: ['cat', 'kitty'],
    replies: { cat: 'A cat! Soft, gentle strokes.', kitty: 'A kitty! She’s purring.' },
  },
  {
    id: 'play-pond',
    pack: 'play',
    art: 'drop',
    prompt: 'Quack quack! Who’s swimming in the pond?',
    accept: ['duck', 'fish', 'bird'],
    replies: {
      duck: 'A duck! Quack, quack, quack.',
      fish: 'A fish! Swish, swish.',
      bird: 'A bird! Look at it bob on the water.',
    },
  },
  {
    id: 'play-farm',
    pack: 'play',
    art: 'sun',
    prompt: 'We’re visiting the farm. Who says moo?',
    accept: ['cow', 'horse', 'pig', 'duck'],
    replies: {
      cow: 'A cow! Moooo.',
      horse: 'A horse! Neigh! Clip-clop.',
      pig: 'A pig! Oink, oink.',
      duck: 'A duck! Quack, quack.',
    },
  },
  {
    id: 'play-toybox',
    pack: 'play',
    art: 'ball',
    prompt: 'Baby is pointing at the toy box.',
    accept: ['toy', 'doll', 'puzzle', 'balloon', 'book'],
    replies: {
      toy: 'A toy? Let’s pick one out.',
      doll: 'Your doll? Here she is.',
      puzzle: 'A puzzle? Let’s do it together.',
      balloon: 'The balloon? Up, up, up!',
      book: 'A book? Let’s read on the rug.',
    },
  },
  {
    id: 'play-door',
    pack: 'play',
    art: 'door',
    prompt: 'Baby is standing at the back door, shoes in hand.',
    accept: ['outside', 'go', 'shoe', 'ride'],
    replies: {
      outside: 'Outside? Let’s go play in the yard!',
      go: 'Go? Okay, let’s go!',
      shoe: 'Shoes on first! Left foot, right foot.',
      ride: 'A ride? Let’s get the bike.',
    },
  },
  {
    id: 'play-music',
    pack: 'play',
    art: 'smile',
    prompt: 'The music is on and baby is bouncing.',
    accept: ['dance', 'jump', 'happy'],
    replies: { dance: 'Dance! Let’s wiggle together.', jump: 'Jump! Boing, boing, boing.', happy: 'Happy dancing!' },
  },
  {
    id: 'play-sky',
    pack: 'play',
    art: 'sun',
    prompt: 'Look up! Something is flying over the trees.',
    accept: ['bird', 'airplane', 'helicopter', 'balloon'],
    replies: {
      bird: 'A bird! Tweet tweet.',
      airplane: 'An airplane! Zoom, way up high.',
      helicopter: 'A helicopter! Whirr, whirr.',
      balloon: 'A balloon floating away!',
    },
  },
  {
    id: 'feel-bump',
    pack: 'feelings',
    art: 'tear',
    prompt: 'Baby bumped their knee on the table.',
    accept: ['owie', 'cry', 'sad', 'hurt'],
    replies: {
      owie: 'An owie? Let me kiss it better.',
      cry: 'It’s okay to cry. I’ve got you.',
      sad: 'Sad? Big cuddle coming.',
      hurt: 'Does it hurt? Let’s have a look.',
    },
  },
  {
    id: 'feel-tower',
    pack: 'feelings',
    art: 'tear',
    prompt: 'The block tower fell down... again.',
    accept: ['mad', 'sad', 'cry', 'stuck'],
    replies: {
      mad: 'Mad? That’s frustrating. Let’s build it again.',
      sad: 'Sad? It was a great tower.',
      cry: 'It’s okay. We can build it together.',
      stuck: 'Stuck? Let me help.',
    },
  },
  {
    id: 'feel-lunch',
    pack: 'feelings',
    art: 'bowl',
    prompt: 'Baby tries broccoli and scrunches up their face.',
    accept: ['yucky', 'no', 'more'],
    replies: {
      yucky: 'Yucky? Okay, maybe next time.',
      no: 'No thank you? That’s okay.',
      more: 'More? Oh, you liked it after all!',
    },
  },
  {
    id: 'feel-hot',
    pack: 'feelings',
    art: 'sun',
    prompt: 'Baby is pink and sweaty in a thick jumper.',
    accept: ['hot', 'thirsty', 'sick'],
    replies: {
      hot: 'Hot? Let’s take that jumper off.',
      thirsty: 'Thirsty? Some cool water will help.',
      sick: 'Feeling sick? Let’s check your temperature.',
    },
  },
  {
    id: 'feel-pickup',
    pack: 'feelings',
    art: 'heart',
    prompt: 'Baby is holding their arms up high to you.',
    accept: ['up', 'more', 'happy'],
    replies: { up: 'Up you come! Big hug.', more: 'More cuddles? Of course.', happy: 'Happy hugs!' },
  },
  {
    id: 'feel-cookie',
    pack: 'feelings',
    art: 'apple',
    prompt: 'Big sister has the last cracker. Baby wants a turn.',
    accept: ['wait', 'mine', 'sad', 'mad'],
    replies: {
      wait: 'Waiting so patiently! Your turn is next.',
      mine: 'Yours? Let’s share it, half each.',
      sad: 'Sad? We’ll find another one.',
      mad: 'Mad? Let’s ask for a turn.',
    },
  },
];

const knownPacks = new Set(SIGNS.flatMap((sg) => sg.packs));

function validate(raw: Scene[]): Scene[] {
  const out: Scene[] = [];
  for (const sc of raw) {
    if (!knownPacks.has(sc.pack)) continue;
    const accept = sc.accept.filter((id) => {
      const sg = signById(id);
      return !!sg && sg.packs.includes(sc.pack) && !!sc.replies[id];
    });
    if (!accept.length) {
      console.warn(`[talk] skipping scene ${sc.id}: no answers exist in pack ${sc.pack}`);
      continue;
    }
    out.push({ ...sc, accept });
  }
  return out;
}

export const SCENES: Scene[] = validate(RAW);
export const SESSION_LEN = 5;

export function scenesFor(packId: string): Scene[] {
  return packId === 'all' ? SCENES : SCENES.filter((sc) => sc.pack === packId);
}

/** Packs that have at least one playable scene, in sign-data order. */
export function talkPacks(): string[] {
  return [...knownPacks].filter((p) => SCENES.some((sc) => sc.pack === p));
}

/** A session: up to SESSION_LEN scenes, shuffled, at most one scene per pack in a row when mixing. */
export function pickSession(packId: string, n = SESSION_LEN): Scene[] {
  const pool = [...scenesFor(packId)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  if (packId !== 'all') return pool.slice(0, n);
  const out: Scene[] = [];
  while (out.length < n && pool.length) {
    const last = out[out.length - 1];
    const k = pool.findIndex((sc) => !last || sc.pack !== last.pack);
    out.push(pool.splice(k < 0 ? 0 : k, 1)[0]);
  }
  return out;
}

export type TalkMatch = { id: string; p: number } | null;

/**
 * The best acceptable answer in the phone's ranking: accepted if it is top-1, or in the top-K with
 * p >= minProb (signs.json `_thresholds`, the same numbers as the lesson verdict).
 */
export function matchAnswer(scene: Scene, top: [string, number][]): TalkMatch {
  const k = (thresholds as any).topK ?? thresholds.top ?? 3;
  const minP = thresholds.minProb ?? 0.25;
  for (let i = 0; i < Math.min(top.length, k); i++) {
    const [id, p] = top[i];
    if (!scene.accept.includes(id)) continue;
    if (i === 0 || p >= minP) return { id, p };
  }
  return null;
}

export const minHandFrac = (): number => thresholds.minHandFrac ?? 0.4;

/** "water, milk or drink" */
export function optionList(ids: string[], max = 3): string {
  const labels = ids.slice(0, max).map((id) => signById(id)?.label || id);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
}
