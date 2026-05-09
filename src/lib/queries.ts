import { createServiceClient } from "@/lib/supabase/server";
import { PROFILE_ID, type Profile, type DailyLog } from "@/lib/types";
import { format, startOfWeek } from "date-fns";

export interface TodayData {
  profile: Profile;
  todayLog: Pick<
    DailyLog,
    "woke_by_target" | "ran" | "lifted" | "bible" | "doomscroll_under" | "screen_time_min"
  >;
  currentMrrCents: number;
  outreachThisWeek: number;
  closedThisWeek: number;
  earnedThisWeek: number;
  schemaReady: boolean;
}

const DEFAULT_PROFILE: Profile = {
  id: PROFILE_ID,
  display_name: "Caleb",
  wake_time: "06:00",
  doomscroll_ceiling_min: 30,
  arc_start: "2026-05-16",
  arc_end: "2026-08-31",
  summit_mrr_target_cents: 1000000,
  created_at: new Date().toISOString(),
};

const EMPTY_LOG = {
  woke_by_target: false,
  ran: false,
  lifted: false,
  bible: false,
  doomscroll_under: false,
  screen_time_min: null as number | null,
};

export async function getTodayData(now: Date = new Date()): Promise<TodayData> {
  const supabase = createServiceClient();
  const today = format(now, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  // 1. Profile (or default if missing/error)
  let profile: Profile = DEFAULT_PROFILE;
  let schemaReady = true;
  try {
    const { data, error } = await supabase
      .from("profile")
      .select("*")
      .eq("id", PROFILE_ID)
      .maybeSingle();
    if (error) {
      schemaReady = false;
    } else if (data) {
      profile = data as Profile;
    }
  } catch {
    schemaReady = false;
  }

  if (!schemaReady) {
    return {
      profile: DEFAULT_PROFILE,
      todayLog: EMPTY_LOG,
      currentMrrCents: 0,
      outreachThisWeek: 0,
      closedThisWeek: 0,
      earnedThisWeek: 0,
      schemaReady: false,
    };
  }

  // 2. Today's daily_log
  let todayLog = EMPTY_LOG;
  try {
    const { data } = await supabase
      .from("daily_log")
      .select("woke_by_target,ran,lifted,bible,doomscroll_under,screen_time_min")
      .eq("user_id", PROFILE_ID)
      .eq("date", today)
      .maybeSingle();
    if (data) todayLog = { ...EMPTY_LOG, ...data };
  } catch {}

  // 3. Current MRR (sum of mrr_actual_cents from closed clients)
  let currentMrrCents = 0;
  try {
    const { data } = await supabase
      .from("aigentic_client")
      .select("mrr_actual_cents")
      .eq("user_id", PROFILE_ID)
      .eq("stage", "closed");
    if (data) currentMrrCents = data.reduce((s, r) => s + (r.mrr_actual_cents || 0), 0);
  } catch {}

  // 4. Outreach this week
  let outreachThisWeek = 0;
  try {
    const { data } = await supabase
      .from("outreach_log")
      .select("count")
      .eq("user_id", PROFILE_ID)
      .gte("date", weekStart);
    if (data) outreachThisWeek = data.reduce((s, r) => s + (r.count || 0), 0);
  } catch {}

  // 5. Closed deals this week
  let closedThisWeek = 0;
  try {
    const { data } = await supabase
      .from("aigentic_client")
      .select("id")
      .eq("user_id", PROFILE_ID)
      .eq("stage", "closed")
      .gte("updated_at", `${weekStart}T00:00:00Z`);
    if (data) closedThisWeek = data.length;
  } catch {}

  // 6. Earned this week (one-off + recurring)
  let earnedThisWeek = 0;
  try {
    const { data } = await supabase
      .from("money_log")
      .select("amount_cents")
      .eq("user_id", PROFILE_ID)
      .gte("date", weekStart);
    if (data) earnedThisWeek = data.reduce((s, r) => s + (r.amount_cents || 0), 0);
  } catch {}

  return {
    profile,
    todayLog,
    currentMrrCents,
    outreachThisWeek,
    closedThisWeek,
    earnedThisWeek,
    schemaReady,
  };
}
