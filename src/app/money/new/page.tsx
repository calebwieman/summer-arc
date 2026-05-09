"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { logMoney } from "@/app/actions/money";
import { PageHeader } from "@/components/page-header";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SOURCES: Array<{ key: "aigentic" | "plasma" | "doordash" | "other"; label: string; emoji: string }> = [
  { key: "aigentic", label: "Aigentic", emoji: "⚡" },
  { key: "plasma", label: "Plasma", emoji: "🧪" },
  { key: "doordash", label: "DoorDash", emoji: "🚗" },
  { key: "other", label: "Other", emoji: "💵" },
];

export default function NewMoneyPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = format(new Date(), "yyyy-MM-dd");

  const [date, setDate] = useState(today);
  const [source, setSource] = useState<"aigentic" | "plasma" | "doordash" | "other">("aigentic");
  const [amount, setAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) return;
    startTransition(async () => {
      await logMoney({
        date,
        source,
        amount_cents: cents,
        is_recurring: isRecurring,
        notes: notes.trim() || null,
      });
      router.push("/money");
    });
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title="Log Money" subtitle="EARNED" back="/money" />
      <div className="px-5 space-y-5">
        <div>
          <Label>Source</Label>
          <div className="grid grid-cols-4 gap-2">
            {SOURCES.map((s) => (
              <button
                type="button"
                key={s.key}
                onClick={() => {
                  setSource(s.key);
                  // recurring auto-on for aigentic
                  if (s.key !== "aigentic") setIsRecurring(false);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 rounded-xl border transition-all",
                  source === s.key
                    ? "bg-[var(--accent-glow)] border-[var(--accent-dim)] text-[var(--text)]"
                    : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)]"
                )}
              >
                <span className="text-xl">{s.emoji}</span>
                <span className="text-[10px] uppercase tracking-wider font-medium">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="amount">Amount (USD)</Label>
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            autoFocus
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        {source === "aigentic" && (
          <button
            type="button"
            onClick={() => setIsRecurring((v) => !v)}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
              isRecurring
                ? "bg-[var(--accent-glow)] border-[var(--accent-dim)]"
                : "bg-[var(--surface-2)] border-[var(--border)]"
            )}
          >
            <div className="text-left">
              <div className="text-sm font-semibold text-[var(--text)]">
                Recurring (counts as MRR)
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                Toggle on if this is monthly retainer revenue
              </div>
            </div>
            <div
              className={cn(
                "w-10 h-6 rounded-full transition-colors flex-shrink-0",
                isRecurring ? "bg-[var(--accent)]" : "bg-[var(--surface-3)]"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full bg-black transition-transform mt-0.5",
                  isRecurring ? "translate-x-[1.125rem]" : "translate-x-0.5"
                )}
              />
            </div>
          </button>
        )}

        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <Button type="submit" variant="accent" size="lg" disabled={pending} className="w-full">
          {pending ? "Logging..." : "Log Money"}
        </Button>
      </div>
    </form>
  );
}
