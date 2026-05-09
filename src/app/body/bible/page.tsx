"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_ID } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function NewBiblePage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = format(new Date(), "yyyy-MM-dd");

  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("bible_log").insert({
        user_id: PROFILE_ID,
        date,
        reference: reference || null,
        notes: notes.trim() || null,
      });
      const { data: existing } = await supabase
        .from("daily_log")
        .select("id")
        .eq("user_id", PROFILE_ID)
        .eq("date", date)
        .maybeSingle();
      if (existing) {
        await supabase.from("daily_log").update({ bible: true }).eq("id", existing.id);
      } else {
        await supabase.from("daily_log").insert({ user_id: PROFILE_ID, date, bible: true });
      }
      router.push("/body");
    });
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title="Log Bible" subtitle="SOUL" back="/body" />
      <div className="px-5 space-y-5">
        <div>
          <Label htmlFor="ref">Reference</Label>
          <Input
            id="ref"
            autoFocus
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="John 3, Proverbs 16:3, etc."
          />
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="notes">Reflection</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What stood out today?" />
        </div>
        <Button type="submit" variant="accent" size="lg" disabled={pending} className="w-full">
          {pending ? "Logging..." : "Log Reading"}
        </Button>
      </div>
    </form>
  );
}
