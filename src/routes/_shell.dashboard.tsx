import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  FileStack,
  Layers,
  Minus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { TrendChart } from "@/components/labsight/trend-chart";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { findings, patternCategories, byKey } from "@/lib/labsight-data";
import { DEMO_USER, getUser } from "@/lib/mock-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — LABSIGHT AI" },
      {
        name: "description",
        content:
          "Your lab report overview: parameters tracked, changes detected and the latest patterns found across reports.",
      },
      { property: "og:title", content: "Dashboard — LABSIGHT AI" },
      {
        property: "og:description",
        content: "Your lab report overview with tracked parameters, detected changes and trends.",
      },
    ],
  }),
  component: Dashboard,
});

const STATS = [
  { label: "Reports Analyzed", value: "3", icon: FileStack, tone: "text-primary" },
  { label: "Parameters Tracked", value: "24", icon: Layers, tone: "text-accent" },
  { label: "Changes Detected", value: "5", icon: Sparkles, tone: "text-review" },
  { label: "Stable Parameters", value: "19", icon: ShieldCheck, tone: "text-stable" },
];

const TOGGLES = ["tsh", "hemoglobin", "vitaminD", "wbc"];

function Dashboard() {
  const user = getUser() ?? DEMO_USER;
  const [active, setActive] = useState<string[]>(["tsh", "hemoglobin"]);
  const [open, setOpen] = useState<string | null>(findings[0]!.key);

  const toggle = (key: string) =>
    setActive((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key],
    );

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">Good morning 👋</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {user.name.split(" ")[0]} — last analyzed on Sep 13, 2026
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Upload report
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map(({ label, value, icon: Icon, tone }) => (
          <GlassCard key={label} hover className="p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
              </p>
              <Icon className={cn("h-[18px] w-[18px] shrink-0", tone)} aria-hidden />
            </div>
            <p className="mt-3 font-display text-3xl font-bold">{value}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <GlassCard className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Latest Analysis</h2>
            <Link to="/analysis" className="text-sm font-semibold text-primary hover:underline">
              View full analysis
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            5 patterns detected across your three reports.
          </p>

          <div className="mt-4 space-y-3">
            {findings.map((f) => {
              const isOpen = open === f.key;
              return (
                <div
                  key={f.key}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-primary/25"
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : f.key)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{f.parameter}</p>
                      <p className="truncate text-xs text-muted-foreground">{f.headline}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {f.changeLabel}
                    </span>
                    <StatusBadge status={f.status} className="hidden sm:inline-flex" />
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="space-y-2 border-t border-white/10 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {f.steps.map((s, i) => (
                          <span key={i} className="flex items-center gap-2">
                            <span className="rounded-lg bg-white/5 px-2 py-1 font-semibold">{s}</span>
                            {i < f.steps.length - 1 && (
                              <ArrowRight className="h-3.5 w-3.5 text-primary" />
                            )}
                          </span>
                        ))}
                        {f.unit && <span className="text-xs text-muted-foreground">{f.unit}</span>}
                      </div>
                      <ul className="space-y-1.5 text-sm text-muted-foreground">
                        {f.reasons.map((r) => (
                          <li key={r} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            {r}
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm font-medium text-foreground">{f.recommendation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>

        <div className="min-w-0 space-y-6">
          <GlassCard>
            <h2 className="text-lg font-bold">Parameter trend preview</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {TOGGLES.map((k) => {
                const p = byKey(k);
                const on = active.includes(k);
                return (
                  <button
                    key={k}
                    onClick={() => toggle(k)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      on
                        ? "border-primary/40 bg-primary/12 text-primary"
                        : "border-white/10 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <TrendChart keys={active} height={260} area />
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="text-lg font-bold">Patterns Detected</h2>
            <ul className="mt-4 space-y-3">
              {patternCategories.map((c) => (
                <li key={c.label} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5">
                    {c.status === "stable" ? (
                      <Minus className="h-4 w-4 text-stable" />
                    ) : c.status === "review" ? (
                      <ArrowDownRight className="h-4 w-4 text-review" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-alert" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>

      <MedicalDisclaimer />
    </div>
  );
}
