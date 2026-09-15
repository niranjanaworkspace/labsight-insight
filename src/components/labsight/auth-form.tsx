import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Lock, Mail, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/labsight/app-shell";
import { enterDemoMode, supabaseSignIn, supabaseSignUp } from "@/lib/mock-auth";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      if (isSignup) {
        await supabaseSignUp(email.trim(), password, name.trim());
        toast.success("Account created", { description: "Opening your personal dashboard." });
      } else {
        await supabaseSignIn(email.trim(), password);
        toast.success("Welcome back", { description: "Opening your personal dashboard." });
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      toast.error(isSignup ? "Could not create account" : "Could not log in", {
        description: message,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleExploreDemo() {
    enterDemoMode();
    toast.info("Demo Mode active", { description: "Exploring with sample laboratory data." });
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="ambient-glow flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Link to="/">
            <BrandMark />
          </Link>
        </div>

        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup
              ? "Start tracking how your real lab values change over time."
              : "Log in to review the patterns detected in your real reports."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="pl-9"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={busy} className="w-full font-semibold" size="lg">
              {busy ? "Signing in…" : isSignup ? "Create account" : "Log in"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={handleExploreDemo}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-white/[0.08] hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Explore sample reports in Demo Mode
            </button>

            <p className="text-center text-sm text-muted-foreground">
              {isSignup ? "Already have an account? " : "New to LABSIGHT AI? "}
              <Link
                to={isSignup ? "/login" : "/signup"}
                className="font-semibold text-primary hover:underline"
              >
                {isSignup ? "Log in" : "Create one"}
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Clinical decision support tool · Not a diagnostic substitute · Always consult a physician.
        </p>
      </div>
    </div>
  );
}
