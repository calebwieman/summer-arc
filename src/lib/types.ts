// Domain types — match the Supabase schema in docs/schema.sql

export interface Profile {
  id: string;
  display_name: string;
  wake_time: string; // 'HH:MM'
  doomscroll_ceiling_min: number;
  arc_start: string; // ISO date
  arc_end: string;
  summit_mrr_target_cents: number;
  created_at: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  date: string; // ISO date
  woke_by_target: boolean;
  ran: boolean;
  lifted: boolean;
  bible: boolean;
  doomscroll_under: boolean;
  screen_time_min: number | null;
  notes: string | null;
  created_at: string;
}

export interface RunLog {
  id: string;
  user_id: string;
  date: string;
  distance_mi: number | null;
  duration_min: number | null;
  pace: string | null;
  source: "manual" | "garmin";
  garmin_activity_id: string | null;
  notes: string | null;
}

export interface LiftLog {
  id: string;
  user_id: string;
  date: string;
  workout_name: string | null;
  duration_min: number | null;
  notes: string | null;
}

export interface BibleLog {
  id: string;
  user_id: string;
  date: string;
  reference: string | null; // e.g. "John 3"
  notes: string | null;
}

export type MoneySource =
  | "aigentic"
  | "plasma"
  | "doordash"
  | "other";

export interface MoneyLog {
  id: string;
  user_id: string;
  date: string;
  source: MoneySource;
  amount_cents: number;
  is_recurring: boolean; // counts toward MRR
  client_id: string | null;
  notes: string | null;
}

export type AigenticStage =
  | "lead"
  | "contacted"
  | "discovery"
  | "proposal"
  | "closed"
  | "lost";

export interface AigenticClient {
  id: string;
  user_id: string;
  name: string;
  stage: AigenticStage;
  mrr_potential_cents: number | null;
  mrr_actual_cents: number;
  notes: string | null;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachLog {
  id: string;
  user_id: string;
  date: string;
  count: number;
  channel: "cold_email" | "dm" | "in_person" | "referral" | null;
  notes: string | null;
}

// For v0: hardcoded profile id since we're skipping auth
export const PROFILE_ID = "caleb-001";
