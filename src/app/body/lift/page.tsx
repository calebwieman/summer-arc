"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_ID } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function NewLiftPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = format(new Date(), "yyyy-MM-dd");

  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("lift_log").insert({
        user_id: PROFILE_ID,
        date,
        workout_name: name || null,
        duration_min: duration ? parseInt(duration, 10) : null,
        notes: notes.trim() || null,
      });
      const { data: existing } = await supabase
        .from("daily_log")
        .select("id")
        .eq("user_id", PROFILE_ID)
        .eq("date", date)
        .maybeSingle();
      if (existing) {
        await supabase.from("daily_log").update({ lifted: true }).eq("id", existing.id);
      } else {
        await supabase.from("daily_log").insert({ user_id: PROFILE_ID, date, lifted: true });
      }
      router.push("/body");
    });
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title="Log Lift" subtitle="BODY" back="/body" />
      <div className="px-5 space-y-5">
        <div>
          <Label htmlFor="name">Workout</Label>
          <Input
            id="name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Push day, legs, full body…"
          />
        </div>
        <div>
          <Label htmlFor="duration">Duration (min)</Label>
          <Input
            id="duration"
            type="number"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="45"
          />
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="PRs, how it felt…" />
        </div>
        <Button type="submit" variant="accent" size="lg" disabled={pending} className="w-full">
          {pending ? "Logging..." : "Log Lift"}
        </Button>
      </div>
    </form>
  );
}
