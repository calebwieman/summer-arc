"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { logOutreach } from "@/app/actions/money";
import { PageHeader } from "@/components/page-header";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function OutreachPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = format(new Date(), "yyyy-MM-dd");

  const [date, setDate] = useState(today);
  const [count, setCount] = useState("10");
  const [channel, setChannel] = useState<"cold_email" | "dm" | "in_person" | "referral">("cold_email");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(count, 10);
    if (!n || n < 1) return;
    startTransition(async () => {
      await logOutreach(date, n, channel, notes.trim() || null);
      router.push("/aigentic");
    });
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title="Log Outreach" subtitle="AIGENTIC" back="/aigentic" />
      <div className="px-5 space-y-5">
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="count">Count</Label>
          <Input
            id="count"
            type="number"
            inputMode="numeric"
            value={count}
            autoFocus
            onChange={(e) => setCount(e.target.value)}
            placeholder="10"
            required
          />
        </div>
        <div>
          <Label htmlFor="channel">Channel</Label>
          <Select id="channel" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
            <option value="cold_email">Cold email</option>
            <option value="dm">DM</option>
            <option value="in_person">In person</option>
            <option value="referral">Referral</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        <Button type="submit" variant="accent" size="lg" disabled={pending} className="w-full">
          {pending ? "Logging..." : "Log Outreach"}
        </Button>
      </div>
    </form>
  );
}
