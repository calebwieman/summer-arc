import Link from "next/link";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { createServiceClient } from "@/lib/supabase/server";
import { PROFILE_ID, type MoneyLog } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { formatMoneyFull } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  aigentic: "Aigentic",
  plasma: "Plasma Bionics",
  doordash: "DoorDash",
  other: "Other",
};

const SOURCE_EMOJI: Record<string, string> = {
  aigentic: "⚡",
  plasma: "🧪",
  doordash: "🚗",
  other: "💵",
};

export default async function MoneyPage() {
  const supabase = createServiceClient();
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");

  let entries: MoneyLog[] = [];
  try {
    const { data } = await supabase
      .from("money_log")
      .select("*")
      .eq("user_id", PROFILE_ID)
      .order("date", { ascending: false })
      .limit(50);
    if (data) entries = data as MoneyLog[];
  } catch {}

  const week = entries.filter((e) => e.date >= weekStart);
  const month = entries.filter((e) => e.date >= monthStart);
  const weekTotal = week.reduce((s, e) => s + e.amount_cents, 0);
  const monthTotal = month.reduce((s, e) => s + e.amount_cents, 0);
  const allTotal = entries.reduce((s, e) => s + e.amount_cents, 0);

  const bySource = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.source] = (acc[e.source] || 0) + e.amount_cents;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Money"
        subtitle="EARNED"
        right={
          <Link
            href="/money/new"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[var(--accent)] text-black text-sm font-semibold"
          >
            <Plus size={16} strokeWidth={2.5} />
            Log
          </Link>
        }
      />

      <div className="px-5 grid grid-cols-3 gap-3">
        <Card>
          <CardBody className="py-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Week</div>
            <div className="display text-xl font-bold text-[var(--text)] tabular mt-1">
              {formatMoneyFull(weekTotal)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Month</div>
            <div className="display text-xl font-bold text-[var(--text)] tabular mt-1">
              {formatMoneyFull(monthTotal)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Arc</div>
            <div className="display text-xl font-bold text-[var(--accent)] tabular mt-1">
              {formatMoneyFull(allTotal)}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="px-5 mt-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-dim)] font-semibold mb-3">
          BY SOURCE · ALL TIME
        </div>
        <Card>
          <CardBody className="space-y-2 py-4">
            {Object.entries(SOURCE_LABEL).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <span>{SOURCE_EMOJI[key]}</span>
                  {label}
                </span>
                <span className="tabular text-sm text-[var(--text)] font-semibold">
                  {formatMoneyFull(bySource[key] || 0)}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="px-5 mt-6 pb-6">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-dim)] font-semibold mb-3">
          RECENT
        </div>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--text-dim)]">
            No entries yet. Tap <span className="text-[var(--accent)] font-semibold">+ Log</span> to start.
          </div>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 30).map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{SOURCE_EMOJI[e.source]}</span>
                  <div>
                    <div className="text-sm font-medium text-[var(--text)]">
                      {SOURCE_LABEL[e.source]}
                      {e.is_recurring && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--accent)] font-bold">
                          MRR
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-dim)] tabular">
                      {format(new Date(e.date), "MMM d")}
                      {e.notes ? ` · ${e.notes}` : ""}
                    </div>
                  </div>
                </div>
                <div className="text-base tabular text-[var(--text)] font-bold">
                  {formatMoneyFull(e.amount_cents)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
