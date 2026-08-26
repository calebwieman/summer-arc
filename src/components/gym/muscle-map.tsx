"use client";

import type { MuscleKey } from "@/lib/exercise-info";

/**
 * The body, as a blueprint.
 *
 * Two schematic figures — front and back — built from labelled segments
 * rather than anatomy: this app draws instruments, not illustrations, and a
 * rounded-rect torso in the house monochrome reads as *designed* where a
 * traced anatomical figure would read as pasted in. Primary movers fill at
 * full ink, assisting muscles at half strength, everything else stays at the
 * line tone — the same three-level emphasis the record uses for done, partial
 * and missed. Original artwork, hand-placed on an 8-unit grid.
 */

type Seg = {
  key: MuscleKey;
  kind: "rect" | "circle";
  /** rect: x y w h rx · circle: cx cy r */
  d: number[];
};

const FRONT: Seg[] = [
  { key: "delts", kind: "circle", d: [17.5, 24, 4.5] },
  { key: "delts", kind: "circle", d: [46.5, 24, 4.5] },
  { key: "chest", kind: "rect", d: [22, 19.5, 20, 11, 3] },
  { key: "biceps", kind: "rect", d: [12, 30, 7, 13, 3.5] },
  { key: "biceps", kind: "rect", d: [45, 30, 7, 13, 3.5] },
  { key: "forearms", kind: "rect", d: [10.5, 45, 7, 15, 3.5] },
  { key: "forearms", kind: "rect", d: [46.5, 45, 7, 15, 3.5] },
  { key: "obliques", kind: "rect", d: [21.5, 33.5, 3.5, 16, 1.75] },
  { key: "obliques", kind: "rect", d: [39, 33.5, 3.5, 16, 1.75] },
  { key: "abs", kind: "rect", d: [25.5, 32.5, 13, 19, 3] },
  { key: "quads", kind: "rect", d: [21.5, 56, 9.5, 26, 4.5] },
  { key: "quads", kind: "rect", d: [33, 56, 9.5, 26, 4.5] },
  { key: "calves", kind: "rect", d: [22.5, 87, 7.5, 18, 3.75] },
  { key: "calves", kind: "rect", d: [34, 87, 7.5, 18, 3.75] },
];

const BACK: Seg[] = [
  { key: "traps", kind: "rect", d: [24, 14, 16, 8, 3] },
  { key: "rear-delts", kind: "circle", d: [17.5, 24, 4.5] },
  { key: "rear-delts", kind: "circle", d: [46.5, 24, 4.5] },
  { key: "upper-back", kind: "rect", d: [24, 23, 16, 9, 3] },
  { key: "lats", kind: "rect", d: [20, 33, 9, 15, 4] },
  { key: "lats", kind: "rect", d: [35, 33, 9, 15, 4] },
  { key: "triceps", kind: "rect", d: [12, 30, 7, 13, 3.5] },
  { key: "triceps", kind: "rect", d: [45, 30, 7, 13, 3.5] },
  { key: "forearms", kind: "rect", d: [10.5, 45, 7, 15, 3.5] },
  { key: "forearms", kind: "rect", d: [46.5, 45, 7, 15, 3.5] },
  { key: "lower-back", kind: "rect", d: [26.5, 48, 11, 8, 3] },
  { key: "glutes", kind: "rect", d: [23, 57, 18, 11, 5] },
  { key: "hamstrings", kind: "rect", d: [22.5, 69, 8.5, 20, 4] },
  { key: "hamstrings", kind: "rect", d: [33, 69, 8.5, 20, 4] },
  { key: "calves", kind: "rect", d: [23, 91, 7.5, 18, 3.75] },
  { key: "calves", kind: "rect", d: [33.5, 91, 7.5, 18, 3.75] },
];

function Figure({
  segs,
  caption,
  primary,
  secondary,
}: {
  segs: Seg[];
  caption: string;
  primary: Set<MuscleKey>;
  secondary: Set<MuscleKey>;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox="0 0 64 112"
        className="h-[104px] w-[60px]"
        aria-hidden
      >
        {/* The head is context, not a muscle. */}
        <circle
          cx={32}
          cy={8}
          r={5.5}
          fill="none"
          stroke="var(--line-mid)"
          strokeWidth={1.25}
        />
        {segs.map((s, i) => {
          const fill = primary.has(s.key)
            ? "var(--ink)"
            : secondary.has(s.key)
              ? "var(--ink)"
              : "var(--line-soft)";
          const opacity = primary.has(s.key)
            ? 1
            : secondary.has(s.key)
              ? 0.4
              : 1;
          return s.kind === "circle" ? (
            <circle
              key={i}
              cx={s.d[0]}
              cy={s.d[1]}
              r={s.d[2]}
              fill={fill}
              opacity={opacity}
            />
          ) : (
            <rect
              key={i}
              x={s.d[0]}
              y={s.d[1]}
              width={s.d[2]}
              height={s.d[3]}
              rx={s.d[4]}
              fill={fill}
              opacity={opacity}
            />
          );
        })}
      </svg>
      <span className="mono-xs text-ink-4">{caption}</span>
    </div>
  );
}

export function MuscleMap({
  primary,
  secondary = [],
}: {
  primary: MuscleKey[];
  secondary?: MuscleKey[];
}) {
  if (primary.length === 0 && secondary.length === 0) return null;
  const p = new Set(primary);
  const s = new Set(secondary);
  return (
    <div
      className="flex items-start gap-4"
      role="img"
      aria-label={`Works ${primary.join(", ")}${
        secondary.length ? `, assisted by ${secondary.join(", ")}` : ""
      }`}
    >
      <Figure segs={FRONT} caption="front" primary={p} secondary={s} />
      <Figure segs={BACK} caption="back" primary={p} secondary={s} />
    </div>
  );
}
