/**
 * What each exercise *is* — the knowledge half of the gym.
 *
 * The logger records numbers; this file answers the two questions that come
 * up standing at the rack: "how do I do this right" and "what is it for".
 * Cues are deliberately three lines and not an essay — a phone between sets
 * gets glanced at, not studied. Muscles key into the schematic in
 * `muscle-map.tsx`. `bar` marks lifts loaded on a 45-lb barbell, which is
 * what turns a target weight into a per-side plate readout. `rest` is the
 * seconds a set of this movement earns before the next one is honest work.
 */

export type MuscleKey =
  | "chest"
  | "delts"
  | "rear-delts"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "obliques"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "lats"
  | "traps"
  | "upper-back"
  | "lower-back";

export interface ExerciseInfo {
  primary: MuscleKey[];
  secondary: MuscleKey[];
  /** Three short coaching cues, glanceable between sets. */
  cues: string[];
  /** Loaded on a 45-lb bar — enables the per-side plate readout. */
  bar?: boolean;
  /** Seconds of rest a set earns. Heavy compounds 180, accessories 90. */
  rest: number;
}

const INFO: Record<string, ExerciseInfo> = {
  /* ------------------------------------------------ Monday · Lower */
  "back squat": {
    primary: ["quads", "glutes"],
    secondary: ["hamstrings", "lower-back", "abs"],
    bar: true,
    rest: 180,
    cues: [
      "brace before you bend — big breath into the belt line",
      "knees track over toes, whole foot planted",
      "hit depth, then drive the floor apart on the way up",
    ],
  },
  "romanian deadlift": {
    primary: ["hamstrings", "glutes"],
    secondary: ["lower-back", "forearms"],
    bar: true,
    rest: 150,
    cues: [
      "push the hips back — the bar slides down the thighs",
      "soft knees, long spine, lats pinned to keep the bar close",
      "stop where the hamstrings end the argument, not the floor",
    ],
  },
  "bulgarian split squat": {
    primary: ["quads", "glutes"],
    secondary: ["hamstrings", "abs"],
    rest: 90,
    cues: [
      "rear foot laces-down on the bench, front shin vertical",
      "drop straight down between the hips, not forward",
      "drive through the front heel — the back leg is a kickstand",
    ],
  },
  "leg press": {
    primary: ["quads", "glutes"],
    secondary: ["hamstrings"],
    rest: 120,
    cues: [
      "feet mid-platform, hip width",
      "lower until the knees near the chest without the tailbone curling",
      "press through mid-foot; never lock the knees hard",
    ],
  },
  "standing calf raise": {
    primary: ["calves"],
    secondary: [],
    rest: 60,
    cues: [
      "full stretch at the bottom — two-second pause",
      "drive to the very top of the toes",
      "no bouncing; the stretch is the rep",
    ],
  },
  "hanging leg raise": {
    primary: ["abs"],
    secondary: ["obliques", "forearms"],
    rest: 90,
    cues: [
      "dead hang, shoulders packed",
      "curl the pelvis — knees to chest, not feet to floor",
      "lower slow; swinging is the set ending early",
    ],
  },

  /* ------------------------------------------- Tuesday · Upper push */
  "bench press": {
    primary: ["chest"],
    secondary: ["triceps", "delts"],
    bar: true,
    rest: 180,
    cues: [
      "shoulder blades pinched and down into the bench",
      "bar touches at the sternum, forearms vertical",
      "feet planted — leg drive finishes the press",
    ],
  },
  "incline db press": {
    primary: ["chest", "delts"],
    secondary: ["triceps"],
    rest: 120,
    cues: [
      "bench at 30° — higher turns it into shoulders",
      "elbows about 45° from the torso",
      "press up and slightly back, dumbbells nearly touching",
    ],
  },
  "seated db press": {
    primary: ["delts"],
    secondary: ["triceps"],
    rest: 120,
    cues: [
      "back flat on the pad, ribs down",
      "start at ear height, press to lockout overhead",
      "lower with control to a full stretch",
    ],
  },
  "weighted dip": {
    primary: ["chest", "triceps"],
    secondary: ["delts"],
    rest: 150,
    cues: [
      "slight forward lean keeps it on the chest",
      "down until upper arms hit parallel",
      "lock out without shrugging the shoulders up",
    ],
  },
  "lateral raise": {
    primary: ["delts"],
    secondary: ["traps"],
    rest: 60,
    cues: [
      "lead with the elbows, slight bend held",
      "raise to shoulder height, pinkies a touch high",
      "lower slower than you lifted — no swing",
    ],
  },
  "triceps pushdown": {
    primary: ["triceps"],
    secondary: [],
    rest: 60,
    cues: [
      "elbows pinned to the ribs the whole set",
      "full lockout, one-second squeeze",
      "let the cable stretch the triceps at the top",
    ],
  },

  /* ----------------------------------------------- Wednesday · Engine */
  "sled push": {
    primary: ["quads", "glutes"],
    secondary: ["calves", "abs"],
    rest: 90,
    cues: [
      "low arms, flat back, 45° body angle",
      "short driving steps — the sled never stops moving",
      "race pace effort, tall finish",
    ],
  },
  "sled pull": {
    primary: ["lats", "hamstrings"],
    secondary: ["biceps", "forearms", "glutes"],
    rest: 90,
    cues: [
      "hips low, arms long to start",
      "row and step back in one rhythm",
      "keep tension on the strap the whole length",
    ],
  },
  skierg: {
    primary: ["lats", "abs"],
    secondary: ["triceps", "hamstrings"],
    rest: 60,
    cues: [
      "reach tall, drive down through the core",
      "arms finish past the hips — it is a crunch, not a curl",
      "long strokes beat fast ones",
    ],
  },
  "wall balls": {
    primary: ["quads", "delts"],
    secondary: ["glutes", "chest"],
    rest: 60,
    cues: [
      "full squat every rep — race standard",
      "the legs throw the ball; arms just guide it",
      "catch it into the next squat, no reset",
    ],
  },
  "farmer carry": {
    primary: ["forearms", "traps"],
    secondary: ["abs", "obliques"],
    rest: 90,
    cues: [
      "stand fully tall before stepping off",
      "quick flat steps, ribs stacked over hips",
      "grip like it owes you money — no straps",
    ],
  },
  "burpee broad jump": {
    primary: ["quads", "glutes"],
    secondary: ["chest", "abs"],
    rest: 60,
    cues: [
      "chest to floor, snap the hips up",
      "jump long, land soft with bent knees",
      "steady rhythm beats sprint-and-die",
    ],
  },

  /* ------------------------------------------- Thursday · Upper pull */
  "weighted pull-up": {
    primary: ["lats"],
    secondary: ["biceps", "upper-back", "forearms"],
    rest: 180,
    cues: [
      "dead hang start, shoulders packed down",
      "drive the elbows to the hips — chin clears by pulling, not reaching",
      "control the descent to a full hang",
    ],
  },
  "barbell row": {
    primary: ["lats", "upper-back"],
    secondary: ["biceps", "lower-back", "rear-delts"],
    bar: true,
    rest: 150,
    cues: [
      "hinge to ~45°, spine long, and hold it there",
      "pull the bar to the lower ribs",
      "squeeze the blades together; no bounce off the thighs",
    ],
  },
  "lat pulldown": {
    primary: ["lats"],
    secondary: ["biceps", "rear-delts"],
    rest: 90,
    cues: [
      "lean back a touch, chest proud",
      "pull the bar to the collarbone, elbows down and back",
      "let the lats stretch fully at the top",
    ],
  },
  "face pull": {
    primary: ["rear-delts", "upper-back"],
    secondary: ["traps"],
    rest: 60,
    cues: [
      "rope at face height, thumbs back",
      "pull apart, not just back — elbows high",
      "finish like a double biceps pose",
    ],
  },
  "ez-bar curl": {
    primary: ["biceps"],
    secondary: ["forearms"],
    rest: 60,
    cues: [
      "elbows at the ribs, and they stay there",
      "curl to full squeeze, no shoulder swing",
      "three seconds down — the negative is the growth",
    ],
  },
  "hammer curl": {
    primary: ["biceps", "forearms"],
    secondary: [],
    rest: 60,
    cues: [
      "palms facing in the whole rep",
      "strict up, controlled down",
      "no leaning back to finish reps",
    ],
  },

  /* --------------------------------------------- Friday · Full body */
  deadlift: {
    primary: ["hamstrings", "glutes", "lower-back"],
    secondary: ["lats", "traps", "forearms", "quads"],
    bar: true,
    rest: 180,
    cues: [
      "bar over mid-foot, shins touch it, lats loaded",
      "push the floor away — hips and chest rise together",
      "lock out tall; drop the ego before the back rounds",
    ],
  },
  "front squat": {
    primary: ["quads"],
    secondary: ["glutes", "abs", "upper-back"],
    bar: true,
    rest: 180,
    cues: [
      "elbows high, bar resting on the shoulders not the wrists",
      "sit straight down between the heels",
      "the torso stays a pillar — if the elbows drop, the set is over",
    ],
  },
  "push press": {
    primary: ["delts"],
    secondary: ["triceps", "quads", "abs"],
    bar: true,
    rest: 150,
    cues: [
      "shallow, fast dip — knees out, torso vertical",
      "drive the legs, then punch the bar to lockout",
      "finish with biceps by the ears, ribs down",
    ],
  },
  "chin-up": {
    primary: ["lats", "biceps"],
    secondary: ["upper-back", "abs"],
    rest: 120,
    cues: [
      "underhand grip, shoulder width",
      "chest to the bar, not chin over it",
      "full hang between reps — half reps are half a set",
    ],
  },
  "db row": {
    primary: ["lats", "upper-back"],
    secondary: ["biceps", "rear-delts"],
    rest: 90,
    cues: [
      "knee and hand on the bench, back flat",
      "row to the hip pocket, elbow close",
      "let the shoulder blade slide at the bottom stretch",
    ],
  },
  "ab wheel": {
    primary: ["abs"],
    secondary: ["obliques", "lats"],
    rest: 90,
    cues: [
      "tuck the pelvis before you roll — no sag, ever",
      "roll out only as far as the brace holds",
      "pull back with the abs, not the arms",
    ],
  },
};

const DEFAULT_INFO: ExerciseInfo = {
  primary: [],
  secondary: [],
  rest: 120,
  cues: [
    "control the weight both directions",
    "full range beats extra plates",
    "stop the set when form goes, not when ego does",
  ],
};

/** Case-insensitive lookup; unknown exercises get honest generic guidance. */
export function infoFor(name: string): ExerciseInfo {
  return INFO[name.trim().toLowerCase()] ?? DEFAULT_INFO;
}

/**
 * A barbell load as the plates that build it, per side, on a 45-lb bar.
 * "185" is a number; "45 · 25" is what you actually rack. Null when the
 * lift isn't bar-loaded or the math has nothing to say.
 */
export function plateReadout(name: string, weight: number): string | null {
  if (!infoFor(name).bar) return null;
  if (!Number.isFinite(weight) || weight <= 45) return null;
  let side = (weight - 45) / 2;
  const out: string[] = [];
  for (const p of [45, 35, 25, 10, 5, 2.5]) {
    while (side >= p - 1e-9) {
      out.push(p % 1 === 0 ? String(p) : String(p));
      side -= p;
    }
  }
  if (out.length === 0) return null;
  // A remainder means change plates smaller than 2.5 — say so honestly.
  const rem = side > 1e-9 ? " +" : "";
  return `${out.join(" · ")} /side${rem}`;
}
