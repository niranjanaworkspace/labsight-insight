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
