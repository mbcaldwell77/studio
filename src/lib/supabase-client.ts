// src/lib/supabase-client.ts
import { createClient } from "@supabase/supabase-js";
import type { Book, Copy } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and/or anonymous key are not defined in .env");
}

// Note: The generic types here are for convenience and may not cover all database functions.
// We will primarily be interacting with the 'books' and 'inventory' tables.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
