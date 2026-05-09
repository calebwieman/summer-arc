"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { PROFILE_ID, type AigenticStage } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function addClient(input: {
  name: string;
  stage?: AigenticStage;
  mrr_potential_cents?: number;
  notes?: string;
  next_action?: string;
  next_action_date?: string;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("aigentic_client").insert({
    user_id: PROFILE_ID,
    name: input.name,
    stage: input.stage ?? "lead",
    mrr_potential_cents: input.mrr_potential_cents ?? null,
    notes: input.notes ?? null,
    next_action: input.next_action ?? null,
    next_action_date: input.next_action_date ?? null,
  });
  if (error) throw error;
  revalidatePath("/aigentic");
  revalidatePath("/");
}

export async function updateClientStage(id: string, stage: AigenticStage) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("aigentic_client")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/aigentic");
  revalidatePath("/");
}

export async function setClientMrr(id: string, mrr_actual_cents: number) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("aigentic_client")
    .update({
      mrr_actual_cents,
      stage: mrr_actual_cents > 0 ? "closed" : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/aigentic");
  revalidatePath("/");
}
