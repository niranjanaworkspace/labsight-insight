import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env["VITE_SUPABASE_URL"]
    : process.env.VITE_SUPABASE_URL) || "https://oeeognkuucwrigcsyhzz.supabase.co";

const supabaseAnonKey =
  (typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env["VITE_SUPABASE_ANON_KEY"]
    : process.env.VITE_SUPABASE_ANON_KEY) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZW9nbmt1dWN3cmlnY3N5aHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NDYyNTIsImV4cCI6MjEwNTAyMjI1Mn0.NhadNxlFc1EK1_I6xbJCEdJxNq3bNoEkKfQC8BIFgMQ";

// The prototype runs fully on local demo data. A real client is only created
// when credentials are present, so the app never crashes without a backend.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;

export type { Session, User } from "@supabase/supabase-js";
