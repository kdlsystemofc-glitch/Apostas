import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://juajunyfksnagqiatlvk.supabase.co";
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1YWp1bnlma3NuYWdxaWF0bHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODk0OTAsImV4cCI6MjEwMTM2NTQ5MH0.Pwrb2xOzhlqmHoSbgd1pyeGtqoMHtRWNPk8gAbVcD2A";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL ou Key não configurados no .env");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
