import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { PROFILE_ID, type AigenticClient, type AigenticStage } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Plus, Zap } from "lucide-react";
import { formatMoneyFull } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STAGES: { key: AigenticStage; label: string; color: string }[] = [
  { key: "lead", label: "Leads", color: "var(--text-dim)" },
  { key: "contacted", label: "Contacted", color: "var(--text-muted)" },
  { key: "discovery", label: "Discovery", color: "#60a5fa" },
  { key: "proposal", label: "Proposal", color: "#a78bfa" },
  { key: "closed", label: "Closed", color: "var(--accent)" },
];

export default async function AigenticPage() {
  const supabase = createServiceClient();
  let clients: AigenticClient[] = [];
  try {
    const { data } = await supabase
      .from("aigentic_client")
      .select("*")
      .eq("user_id", PROFILE_ID)
      .neq("stage", "lost")
      .order("updated_at", { ascending: false });
    if (data) clients = data as AigenticClient[];
  } catch {}

  const totalMrr = clients
    .filter((c) => c.stage === "closed")
    .reduce((s, c) => s + (c.mrr_actual_cents || 0), 0);

  const pipelineMrr = clients
    .filter((c) => c.stage !== "closed" && c.mrr_potential_cents)
    .reduce((s, c) => s + (c.mrr_potential_cents || 0), 0);

  return (
    <div>
      <PageHeader
        title="Aigentic"
        subtitle="CRM"
        right={
          <Link
            href="/aigentic/new"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[var(--accent)] text-black text-sm font-semibold"
          >
            <Plus size={16} strokeWidth={2.5} />
            Client
          </Link>
        }
      />

      <div className="px-5 grid grid-cols-2 gap-3">
        <Card>
          <CardBody className="py-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
              Closed MRR
            </div>
            <div className="display text-2xl font-bold text-[var(--accent)] tabular mt-1">
              {formatMoneyFull(totalMrr)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
              Pipeline
            </div>
            <div className="display text-2xl font-bold text-[var(--text)] tabular mt-1">
              {formatMoneyFull(pipelineMrr)}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4">
        <Link
          href="/aigentic/outreach"
          className="mx-5 flex items-center justify-between p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent-dim)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--accent-glow)] text-[var(--accent)] flex items-center justify-center">
              <Zap size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">
                Log outreach
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Cold emails, DMs, in-person
              </div>
            </div>
          </div>
          <Plus size={18} className="text-[var(--text-muted)]" />
        </Link>
      </div>

      <div className="mt-6 space-y-5 pb-6">
        {STAGES.map(({ key, label, color }) => {
          const inStage = clients.filter((c) => c.stage === key);
          return (
            <div key={key}>
              <div className="px-5 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-dim)] font-semibold">
                    {label}
                  </span>
                </div>
                <span className="text-[10px] tabular text-[var(--text-dim)]">
                  {inStage.length}
                </span>
              </div>
              {inStage.length === 0 ? (
                <div className="mx-5 py-4 px-4 rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--text-dim)] text-center">
                  No clients
                </div>
              ) : (
                <div className="space-y-2 px-5">
                  {inStage.map((c) => (
                    <Link
                      key={c.id}
                      href={`/aigentic/${c.id}`}
                      className="block p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-bright)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--text)] truncate">
                            {c.name}
                          </div>
                          {c.next_action && (
                            <div className="text-xs text-[var(--text-muted)] mt-1 truncate">
                              → {c.next_action}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {c.stage === "closed" ? (
                            <div className="text-sm font-bold tabular text-[var(--accent)]">
                              {formatMoneyFull(c.mrr_actual_cents)}
                              <span className="text-[10px] text-[var(--text-dim)] font-normal">
                                /mo
                              </span>
                            </div>
                          ) : c.mrr_potential_cents ? (
                            <div className="text-sm tabular text-[var(--text-muted)]">
                              {formatMoneyFull(c.mrr_potential_cents)}
                              <span className="text-[10px] text-[var(--text-dim)]">
                                /mo
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
