import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const KEY = "labsight-user";

export interface MockUser {
  name: string;
  email: string;
}

export function signIn(user: MockUser) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(user));
}

export function signOut() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

export function getUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MockUser) : null;
  } catch {
    return null;
  }
}

export const DEMO_USER: MockUser = { name: "Niranjana A R", email: "niranjana@labsight.ai" };

export async function supabaseSignUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
    });
  }
  return data;
}

export async function supabaseSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function supabaseSignOut() {
  await supabase.auth.signOut();
}

export function getSupabaseUser(): User | null {
  return supabase.auth.getUser().then(({ data }) => data.user).catch(() => null) as unknown as User | null;
}

export async function getCurrentUser(): Promise<MockUser | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    name: profile?.full_name || data.user.email?.split("@")[0] || "User",
    email: data.user.email || "",
  };
}
