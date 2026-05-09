"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { PROFILE_ID } from "@/lib/types";
import { revalidatePath } from "next/cache";

type DailyKey =
  | "woke_by_target"
  | "ran"
  | "lifted"
  | "bible"
  | "doomscroll_under";

export async function toggleDaily(date: string, key: DailyKey, value: boolean) {
  const supabase = createServiceClient();

  // Upsert today's row
  const { data: existing } = await supabase
    .from("daily_log")
    .select("id")
    .eq("user_id", PROFILE_ID)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("daily_log")
      .update({ [key]: value })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("daily_log").insert({
      user_id: PROFILE_ID,
      date,
      [key]: value,
    });
    if (error) throw error;
  }

  revalidatePath("/");
}

export async function setScreenTime(date: string, minutes: number) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("daily_log")
    .upsert(
      { user_id: PROFILE_ID, date, screen_time_min: minutes },
      { onConflict: "user_id,date" }
    );
  if (error) throw error;
  revalidatePath("/");
}
