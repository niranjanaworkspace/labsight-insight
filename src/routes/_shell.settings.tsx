import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, FlaskConical, LogOut, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { DEMO_USER, getUser, signOut, supabaseSignOut } from "@/lib/mock-auth";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LABSIGHT AI" },
      {
        name: "description",
        content:
          "Manage your LABSIGHT AI profile, analysis notifications, alert thresholds and privacy preferences.",
      },
      { property: "og:title", content: "Settings — LABSIGHT AI" },
      {
        property: "og:description",
        content: "Profile, notification, threshold and privacy preferences for LABSIGHT AI.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const user = getUser() ?? DEMO_USER;
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [notify, setNotify] = useState(true);
  const [weekly, setWeekly] = useState(false);
  const [threshold, setThreshold] = useState([15]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Profile, notifications and data preferences.
        </p>
      </header>

      <GlassCard>
        <h2 className="text-lg font-bold">Profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="s-name">Full name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-email">Email</Label>
            <Input
              id="s-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="mt-4 font-semibold"
          onClick={() =>
            toast.success("Profile updated", {
              description: "Changes saved for this demo session.",
            })
          }
        >
          Save changes
        </Button>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-bold">Preferences</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Analysis notifications</p>
              <p className="text-xs text-muted-foreground">
                Notify me when a new pattern is detected in an uploaded report.
              </p>
            </div>
            <Switch
              checked={notify}
              onCheckedChange={setNotify}
              aria-label="Analysis notifications"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Weekly trend summary</p>
              <p className="text-xs text-muted-foreground">A short recap of parameter movement.</p>
            </div>
            <Switch
              checked={weekly}
              onCheckedChange={setWeekly}
              aria-label="Weekly trend summary"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold">Alert threshold</p>
              <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs font-semibold text-primary">
                {threshold[0]}% change
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Flag a parameter once it moves more than this between reports.
            </p>
            <Slider
              className="mt-4"
              value={threshold}
              onValueChange={setThreshold}
              min={5}
              max={50}
              step={5}
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-bold">Privacy & data</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Reports in this demo stay in your browser session. Nothing is shared with third parties.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() =>
              toast.success("Export prepared", { description: "Your demo data bundle is ready." })
            }
          >
            <Download className="h-4 w-4" /> Export my data
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() =>
              toast("Demo data cleared", { description: "Sample reports will reload on refresh." })
            }
          >
            <Trash2 className="h-4 w-4" /> Delete all reports
          </Button>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
            <FlaskConical className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold">About LABSIGHT AI</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Version 1.0 (demo). LABSIGHT AI compares laboratory values across time and surfaces
              patterns and significant changes for review. It does not diagnose conditions or
              replace clinical judgment.
            </p>
          </div>
        </div>
      </GlassCard>

      <Button
        variant="outline"
        className="w-full font-semibold sm:w-auto"
        onClick={async () => {
          await supabaseSignOut();
          signOut();
          toast.success("Signed out");
          navigate({ to: "/" });
        }}
      >
        <LogOut className="h-4 w-4" /> Log out
      </Button>

      <MedicalDisclaimer />
    </div>
  );
}
