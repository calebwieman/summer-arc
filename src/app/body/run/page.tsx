"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_ID } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function NewRunPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = format(new Date(), "yyyy-MM-dd");

  const [date, setDate] = useState(today);
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [pace, setPace] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("run_log").insert({
        user_id: PROFILE_ID,
        date,
        distance_mi: distance ? parseFloat(distance) : null,
        duration_min: duration ? parseFloat(duration) : null,
        pace: pace || null,
        source: "manual",
        notes: notes.trim() || null,
      });
      // also tick today's "ran" toggle
      const { data: existing } = await supabase
        .from("daily_log")
        .select("id")
        .eq("user_id", PROFILE_ID)
        .eq("date", date)
        .maybeSingle();
      if (existing) {
        await supabase.from("daily_log").update({ ran: true }).eq("id", existing.id);
      } else {
        await supabase.from("daily_log").insert({ user_id: PROFILE_ID, date, ran: true });
      }
      router.push("/body");
    });
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title="Log Run" subtitle="BODY" back="/body" />
      <div className="px-5 space-y-5">
        <div>
          <Label htmlFor="distance">Distance (mi)</Label>
          <Input
            id="distance"
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.1"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="3.1"
          />
        </div>
        <div>
          <Label htmlFor="duration">Duration (min)</Label>
          <Input
            id="duration"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="22"
          />
        </div>
        <div>
          <Label htmlFor="pace">Pace</Label>
          <Input
            id="pace"
            value={pace}
            onChange={(e) => setPace(e.target.value)}
            placeholder="7:05/mi"
          />
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        <Button type="submit" variant="accent" size="lg" disabled={pending} className="w-full">
          {pending ? "Logging..." : "Log Run"}
        </Button>
      </div>
    </form>
  );
}
