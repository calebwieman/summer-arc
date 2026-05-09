"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addClient } from "@/app/actions/aigentic";
import { PageHeader } from "@/components/page-header";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function NewClientPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [stage, setStage] = useState<"lead" | "contacted" | "discovery" | "proposal" | "closed">("lead");
  const [mrrPotential, setMrrPotential] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      await addClient({
        name: name.trim(),
        stage,
        mrr_potential_cents: mrrPotential
          ? Math.round(parseFloat(mrrPotential) * 100)
          : undefined,
        next_action: nextAction.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      router.push("/aigentic");
    });
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title="New Client" subtitle="AIGENTIC" back="/aigentic" />
      <div className="px-5 space-y-5">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Vet Clinic"
            required
          />
        </div>
        <div>
          <Label htmlFor="stage">Stage</Label>
          <Select id="stage" value={stage} onChange={(e) => setStage(e.target.value as typeof stage)}>
            <option value="lead">Lead</option>
            <option value="contacted">Contacted</option>
            <option value="discovery">Discovery</option>
            <option value="proposal">Proposal</option>
            <option value="closed">Closed</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="mrr">MRR potential (USD/month)</Label>
          <Input
            id="mrr"
            type="number"
            inputMode="decimal"
            step="50"
            value={mrrPotential}
            onChange={(e) => setMrrPotential(e.target.value)}
            placeholder="1500"
          />
        </div>
        <div>
          <Label htmlFor="next">Next action</Label>
          <Input
            id="next"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="Send proposal Tuesday"
          />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lead source, contact info, anything useful..."
          />
        </div>
        <Button type="submit" variant="accent" size="lg" disabled={pending} className="w-full">
          {pending ? "Adding..." : "Add Client"}
        </Button>
      </div>
    </form>
  );
}
