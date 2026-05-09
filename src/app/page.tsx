import { format } from "date-fns";
import { getArcStatus } from "@/lib/arc";
import { getTodayData } from "@/lib/queries";
import { DayCounter } from "@/components/today/day-counter";
import { SummitRing } from "@/components/today/summit-ring";
import { DailyFive } from "@/components/today/daily-five";
import { QuickLog } from "@/components/today/quick-log";
import { QuickStats } from "@/components/today/quick-stats";
import { SchemaWarning } from "@/components/today/schema-warning";

export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const arc = getArcStatus(now);
  const data = await getTodayData(now);
  const today = format(now, "yyyy-MM-dd");

  // Outreach target derived: 50/wk default
  const outreachTarget = 50;

  return (
    <div>
      {!data.schemaReady && <SchemaWarning />}
      <DayCounter arc={arc} />
      <SummitRing
        currentMrrCents={data.currentMrrCents}
        targetMrrCents={data.profile.summit_mrr_target_cents}
        arc={arc}
      />
      <DailyFive
        date={today}
        initial={data.todayLog}
        wakeTime={data.profile.wake_time.slice(0, 5)}
        doomscrollMin={data.profile.doomscroll_ceiling_min}
      />
      <QuickStats
        outreachThisWeek={data.outreachThisWeek}
        outreachTarget={outreachTarget}
        closedThisWeek={data.closedThisWeek}
        earnedThisWeek={data.earnedThisWeek}
      />
      <QuickLog />
    </div>
  );
}
