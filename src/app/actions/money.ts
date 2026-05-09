"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { PROFILE_ID, type MoneySource } from "@/lib/types";
import { revalidatePath } from "next/cache";

interface LogMoneyInput {
  date: string;
  source: MoneySource;
  amount_cents: number;
  is_recurring?: boolean;
  client_id?: string | null;
  notes?: string | null;
}

export async function logMoney(input: LogMoneyInput) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("money_log").insert({
    user_id: PROFILE_ID,
    ...input,
    is_recurring: input.is_recurring ?? false,
  });
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/money");
}

export async function logOutreach(
  date: string,
  count: number,
  channel: "cold_email" | "dm" | "in_person" | "referral" | null,
  notes?: string | null
) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("outreach_log").insert({
    user_id: PROFILE_ID,
    date,
    count,
    channel,
    notes: notes ?? null,
  });
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/aigentic");
}
