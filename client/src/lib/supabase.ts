import { createClient } from "@supabase/supabase-js";

// These are the existing public browser credentials from the imported app.
// Vite environment variables can override them without changing the backend.
const existingSupabaseUrl = "https://sksrqwtzwibrrijfpqcy.supabase.co";
const existingSupabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrc3Jxd3R6d2licnJpamZwcWN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjIwNzYsImV4cCI6MjA5NzEzODA3Nn0.UO6_GSuLxFaXTAuI8jdby2I1ZncxZVguFqMUcW8NOpE";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || existingSupabaseUrl;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || existingSupabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});
