import { getTodayString } from "./today";

export interface Verse {
  ref: string;
  text: string;
}

interface VerseBank {
  translation: string;
  verses: Verse[];
}

let cache: VerseBank | null = null;
let inFlight: Promise<VerseBank> | null = null;

async function load(): Promise<VerseBank> {
  if (cache) return cache;
  if (inFlight) return inFlight;
  inFlight = fetch("/verses.json", { cache: "default" })
    .then((r) => r.json() as Promise<VerseBank>)
    .then((bank) => {
      cache = bank;
      inFlight = null;
      return bank;
    })
    .catch(() => {
      inFlight = null;
      throw new Error("verse load failed");
    });
  return inFlight;
}

/** Stable daily index from yyyy-mm-dd → integer. */
function dayHash(date: string): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) {
    h = (h * 31 + date.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export async function getVerseOfTheDay(date: string = getTodayString()): Promise<Verse | null> {
  try {
    const bank = await load();
    if (!bank.verses.length) return null;
    const idx = dayHash(date) % bank.verses.length;
    return bank.verses[idx];
  } catch {
    return null;
  }
}
