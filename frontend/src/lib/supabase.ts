import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("Supabase env vars not set — DB features disabled.");
}

export const supabase = url && key ? createClient(url, key) : null;

export type Project = {
  id: string;
  name: string;
  status: "pending" | "enriching" | "complete" | "failed";
  total_leads: number;
  created_at: string;
  updated_at: string;
};
