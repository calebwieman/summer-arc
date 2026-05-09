import { Card, CardBody } from "@/components/ui/card";
import { formatMoneyFull } from "@/lib/utils";
import { type ArcStatus } from "@/lib/arc";

interface Props {
  currentMrrCents: number;
  targetMrrCents: number;
  arc: ArcStatus;
}

export function SummitRing({ currentMrrCents, targetMrrCents, arc }: Props) {
  const pct = Math.min(100, (currentMrrCents / targetMrrCents) * 100);
  const expectedPct = Math.max(0, Math.min(100, arc.percentComplete));
  const onPace = pct >= expectedPct;
  const gap = pct - expectedPct;

  // Ring geometry
  const size = 220;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const expectedDash = (expectedPct / 100) * c;

  return (
    <Card className="mx-5 my-4 overflow-hidden">
      <CardBody className="flex flex-col items-center pt-7 pb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-dim)] font-medium mb-1">
          SUMMIT · MRR
        </div>

        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            {/* track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--surface-3)"
              strokeWidth={stroke}
            />
            {/* expected pace marker (subtle) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth={2}
              strokeDasharray={`${expectedDash} ${c}`}
              strokeLinecap="round"
              opacity={0.6}
            />
            {/* progress */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${c}`}
              strokeLinecap="round"
              style={{
                filter: pct > 0 ? "drop-shadow(0 0 8px var(--accent-glow))" : undefined,
                transition: "stroke-dasharray 600ms cubic-bezier(.2,.9,.3,1)",
              }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[var(--text)] display font-bold text-4xl tabular">
              {formatMoneyFull(currentMrrCents)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1 tabular">
              of {formatMoneyFull(targetMrrCents)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-dim)] mt-1">
              MONTHLY RECURRING
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 text-xs">
          <span className="tabular text-[var(--text)] font-semibold">
            {pct.toFixed(1)}%
          </span>
          <span className="text-[var(--text-dim)]">·</span>
          <span
            className="tabular font-semibold"
            style={{
              color: onPace ? "var(--success)" : "var(--warn)",
            }}
          >
            {onPace ? "+" : ""}
            {gap.toFixed(1)}% {onPace ? "ahead" : "behind"} pace
          </span>
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-1 tabular">
          {arc.phase === "pre"
            ? `Arc begins in ${Math.abs(arc.dayNumber - 1)} day${Math.abs(arc.dayNumber - 1) === 1 ? "" : "s"}`
            : arc.phase === "post"
            ? "Arc complete"
            : `${arc.daysRemaining} days remaining`}
        </div>
      </CardBody>
    </Card>
  );
}
