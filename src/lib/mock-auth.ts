import { supabase } from "@/lib/supabase";

const USER_KEY = "labsight-user";
const DEMO_MODE_KEY = "labsight-demo-mode";

export interface MockUser {
  id?: string;
  name: string;
  email: string;
}

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEMO_MODE_KEY) === "true";
}

export function setDemoMode(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) {
    localStorage.setItem(DEMO_MODE_KEY, "true");
  } else {
    localStorage.removeItem(DEMO_MODE_KEY);
  }
}

export function enterDemoMode() {
  setDemoMode(true);
  signIn(DEMO_USER);
}

export function exitDemoMode() {
  setDemoMode(false);
  signOut();
}

export function signIn(user: MockUser) {
  if (typeof window !== "undefined") localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function signOut() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(DEMO_MODE_KEY);
  }
}

export function getUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as MockUser) : null;
  } catch {
    return null;
  }
}

export const DEMO_USER: MockUser = {
  id: "demo-user",
  name: "Niranjana A R",
  email: "niranjana@labsight.ai",
};

export async function supabaseSignUp(email: string, password: string, fullName: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  setDemoMode(false);
  if (data.user) {
    try {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
      });
    } catch {
      // Profile permissions may restrict writing, continue without throwing
    }
  }
  return data;
}

export async function supabaseSignIn(email: string, password: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  setDemoMode(false);
  return data;
}

export async function supabaseSignOut() {
  if (!supabase) return;
  setDemoMode(false);
  signOut();
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<MockUser | null> {
  if (!supabase) {
    return isDemoMode() ? (getUser() ?? DEMO_USER) : null;
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    if (isDemoMode()) {
      return getUser() ?? DEMO_USER;
    }
    return null;
  }

  // Active authenticated user detected: DEMO MODE IS NEVER ENABLED
  setDemoMode(false);

  let fullName = data.user.user_metadata?.full_name;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.full_name) {
      fullName = profile.full_name;
    }
  } catch {
    // Gracefully handle if profiles table is not accessible
  }

  return {
    id: data.user.id,
    name: fullName || data.user.email?.split("@")[0] || "User",
    email: data.user.email || "",
  };
}
