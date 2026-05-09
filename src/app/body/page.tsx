import Link from "next/link";
import { format, subDays } from "date-fns";
import { createServiceClient } from "@/lib/supabase/server";
import { PROFILE_ID, type RunLog, type LiftLog, type BibleLog } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardLabel } from "@/components/ui/card";
import { Footprints, Dumbbell, BookOpen, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BodyPage() {
  const supabase = createServiceClient();
  const since = format(subDays(new Date(), 14), "yyyy-MM-dd");

  let runs: RunLog[] = [];
  let lifts: LiftLog[] = [];
  let bible: BibleLog[] = [];

  try {
    const [r, l, b] = await Promise.all([
      supabase.from("run_log").select("*").eq("user_id", PROFILE_ID).gte("date", since).order("date", { ascending: false }),
      supabase.from("lift_log").select("*").eq("user_id", PROFILE_ID).gte("date", since).order("date", { ascending: false }),
      supabase.from("bible_log").select("*").eq("user_id", PROFILE_ID).gte("date", since).order("date", { ascending: false }),
    ]);
    runs = (r.data as RunLog[]) || [];
    lifts = (l.data as LiftLog[]) || [];
    bible = (b.data as BibleLog[]) || [];
  } catch {}

  return (
    <div>
      <PageHeader title="Body & Soul" subtitle="LAST 14 DAYS" />

      <div className="px-5 grid grid-cols-3 gap-3">
        <Stat icon={<Footprints size={14} />} label="Runs" count={runs.length} href="/body/run" />
        <Stat icon={<Dumbbell size={14} />} label="Lifts" count={lifts.length} href="/body/lift" />
        <Stat icon={<BookOpen size={14} />} label="Bible" count={bible.length} href="/body/bible" />
      </div>

      <Section title="Recent Runs" href="/body/run" empty="No runs logged">
        {runs.slice(0, 5).map((r) => (
          <Row key={r.id} date={r.date} title={`${r.distance_mi || "?"} mi`} sub={r.pace || (r.duration_min ? `${r.duration_min} min` : "")} />
        ))}
      </Section>

      <Section title="Recent Lifts" href="/body/lift" empty="No lifts logged">
        {lifts.slice(0, 5).map((l) => (
          <Row key={l.id} date={l.date} title={l.workout_name || "Workout"} sub={l.duration_min ? `${l.duration_min} min` : ""} />
        ))}
      </Section>

      <Section title="Bible Log" href="/body/bible" empty="No reading logged">
        {bible.slice(0, 5).map((b) => (
          <Row key={b.id} date={b.date} title={b.reference || "Reading"} sub={b.notes || ""} />
        ))}
      </Section>
    </div>
  );
}

function Stat({ icon, label, count, href }: { icon: React.ReactNode; label: string; count: number; href: string }) {
  return (
    <Link href={href}>
      <Card>
        <CardBody className="py-3">
          <div className="flex items-center gap-1 text-[var(--text-dim)]">
            {icon}
            <span className="text-[9px] uppercase tracking-wider font-medium">{label}</span>
          </div>
          <div className="display text-2xl font-bold text-[var(--text)] tabular mt-1">{count}</div>
        </CardBody>
      </Card>
    </Link>
  );
}

function Section({
  title,
  href,
  empty,
  children,
}: {
  title: string;
  href: string;
  empty: string;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const hasContent = arr.flat().filter(Boolean).length > 0;
  return (
    <div className="px-5 mt-6">
      <div className="flex items-center justify-between mb-3">
        <CardLabel>{title}</CardLabel>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--accent)] font-semibold"
        >
          <Plus size={12} /> Log
        </Link>
      </div>
      {!hasContent ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] py-5 text-center text-xs text-[var(--text-dim)]">
          {empty}
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function Row({ date, title, sub }: { date: string; title: string; sub: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
      <div>
        <div className="text-sm font-medium text-[var(--text)]">{title}</div>
        {sub && <div className="text-xs text-[var(--text-dim)] tabular">{sub}</div>}
      </div>
      <div className="text-xs text-[var(--text-dim)] tabular">{format(new Date(date), "MMM d")}</div>
    </div>
  );
}
