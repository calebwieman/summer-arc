import { format, addDays } from "date-fns";
import { createServiceClient } from "@/lib/supabase/server";
import { PROFILE_ID, type DailyLog } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { ARC_START, ARC_TOTAL_DAYS, getArcStatus } from "@/lib/arc";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ArcPage() {
  const arc = getArcStatus(new Date());
  const supabase = createServiceClient();
  const startStr = format(ARC_START, "yyyy-MM-dd");

  let logs: Pick<DailyLog, "date" | "woke_by_target" | "ran" | "lifted" | "bible" | "doomscroll_under">[] = [];
  try {
    const { data } = await supabase
      .from("daily_log")
      .select("date,woke_by_target,ran,lifted,bible,doomscroll_under")
      .eq("user_id", PROFILE_ID)
      .gte("date", startStr);
    if (data) logs = data;
  } catch {}

  const logMap = new Map(logs.map((l) => [l.date, l]));

  // Build cells for all 108 days
  const cells = Array.from({ length: ARC_TOTAL_DAYS }, (_, i) => {
    const date = addDays(ARC_START, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const log = logMap.get(dateStr);
    const completed = log
      ? [log.woke_by_target, log.ran, log.lifted, log.bible, log.doomscroll_under].filter(Boolean).length
      : 0;
    const isFuture = i + 1 > arc.dayNumber;
    const isToday = i + 1 === arc.dayNumber;
    return { date, dateStr, completed, isFuture, isToday, dayNum: i + 1 };
  });

  return (
    <div>
      <PageHeader title={`Day ${Math.max(0, arc.dayNumber)} / ${arc.totalDays}`} subtitle="THE ARC" />

      <Card className="mx-5 my-3">
        <CardBody className="py-4">
          <div className="flex items-center justify-between mb-3 text-xs text-[var(--text-muted)]">
            <span className="tabular">{format(arc.startDate, "MMM d")}</span>
            <span className="tabular">{format(arc.endDate, "MMM d")}</span>
          </div>
          <div className="grid grid-cols-12 gap-1.5">
            {cells.map((c) => (
              <div
                key={c.dateStr}
                title={`${format(c.date, "MMM d")} — ${c.completed}/5`}
                className={cn(
                  "aspect-square rounded-md transition-all",
                  c.isFuture
                    ? "bg-[var(--surface-2)] border border-[var(--border)]"
                    : c.completed === 5
                    ? "bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]"
                    : c.completed === 0
                    ? "bg-[var(--surface-3)] border border-[var(--border)]"
                    : "bg-[var(--accent)]",
                  c.isToday && "ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--bg)]"
                )}
                style={{
                  opacity: c.isFuture ? 1 : 0.3 + (c.completed / 5) * 0.7,
                }}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            <Legend color="var(--surface-3)" label="0/5" opacity={0.3} />
            <Legend color="var(--accent)" label="3/5" opacity={0.7} />
            <Legend color="var(--accent)" label="5/5" opacity={1} />
          </div>
        </CardBody>
      </Card>

      <Card className="mx-5 my-3">
        <CardBody className="py-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-2">PROGRESS</div>
          <div className="display text-3xl font-bold text-[var(--accent)] tabular">
            {arc.percentComplete.toFixed(1)}%
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1 tabular">
            {arc.daysRemaining} days remaining · {format(arc.endDate, "EEEE, MMM d")}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Legend({ color, label, opacity }: { color: string; label: string; opacity: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded-sm" style={{ background: color, opacity }} />
      <span>{label}</span>
    </div>
  );
}
