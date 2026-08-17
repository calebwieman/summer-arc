import {
  Bike,
  BookOpen,
  Brain,
  Camera,
  Check,
  Clock,
  Coffee,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Leaf,
  Moon,
  Music,
  PenLine,
  Smartphone,
  Sparkles,
  Sun,
  Sunrise,
  Target,
  Users,
  Wallet,
  Waves,
} from "lucide-react";

/**
 * The icons a habit can wear.
 *
 * Keyed by a stable short name rather than by habit id, because the set of
 * habits is now open — the latch used to hold a `Record<HabitKey, Icon>` map,
 * which could only ever draw the five built-ins and had nothing to render for
 * anything the user created. `HabitDef.icon` stores one of these keys.
 */
export type IconName = keyof typeof ICONS;

export const ICONS = {
  sunrise: Sunrise,
  sun: Sun,
  moon: Moon,
  phone: Smartphone,
  run: Footprints,
  bike: Bike,
  lift: Dumbbell,
  target: Target,
  book: BookOpen,
  pen: PenLine,
  brain: Brain,
  coffee: Coffee,
  water: Droplet,
  heart: Heart,
  leaf: Leaf,
  flame: Flame,
  music: Music,
  camera: Camera,
  people: Users,
  money: Wallet,
  swim: Waves,
  spark: Sparkles,
  clock: Clock,
  check: Check,
} as const;

/** Order shown in the icon picker. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** Never throws on an unknown name — a renamed icon must not blank the latch. */
export function iconFor(name: string) {
  return ICONS[name as IconName] ?? Check;
}
