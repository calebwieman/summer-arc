import { type ArcStatus } from "@/lib/arc";
import { cn } from "@/lib/utils";

interface Props {
  arc: ArcStatus;
}

export function DayCounter({ arc }: Props) {
  const { dayNumber, totalDays, phase, formattedToday } = arc;

  let phaseLabel = "";
  if (phase === "pre") phaseLabel = `T-MINUS ${Math.abs(dayNumber - 1)} DAYS`;
  else if (phase === "summit") phaseLabel = "SUMMIT DAY";
  else if (phase === "post") phaseLabel = "ARC COMPLETE";
  else if (dayNumber === 1) phaseLabel = "THE ARC HAS BEGUN";
  else phaseLabel = `${formattedToday.toUpperCase()}`;

  const displayDay = phase === "pre" ? 0 : Math.min(dayNumber, totalDays);

  return (
    <div className="px-5 pt-8 pb-2">
      <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-dim)] font-medium mb-3">
        SUMMER ARC · 2026
      </div>
      <div className="flex items-baseline gap-2 tabular">
        <span
          className={cn(
            "display font-bold text-[7rem] leading-none",
            phase === "pre"
              ? "text-[var(--text-dim)]"
              : "text-[var(--accent)]"
          )}
        >
          {displayDay}
        </span>
        <span className="display font-medium text-3xl text-[var(--text-dim)]">
          / {totalDays}
        </span>
      </div>
      <div className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-semibold">
        {phaseLabel}
      </div>
    </div>
  );
}
