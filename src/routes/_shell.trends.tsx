import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { TrendChart } from "@/components/labsight/trend-chart";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { byKey } from "@/lib/labsight-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/trends")({
  head: () => ({
    meta: [
      { title: "Lab Trends — LABSIGHT AI" },
      {
        name: "description",
        content:
          "Interactive trend analytics for TSH, hemoglobin, vitamin D, glucose, WBC and platelets across your reports.",
      },
      { property: "og:title", content: "Lab Trends — LABSIGHT AI" },
      {
        property: "og:description",
        content: "Interactive charts showing how each lab parameter moved over time.",
      },
    ],
  }),
  component: TrendsPage,
});

const CHIPS = ["tsh", "hemoglobin", "vitaminD", "glucose", "wbc", "platelets"];
const RANGES = ["All reports", "Last 6 months", "Last 3 months"] as const;

function TrendsPage() {
  const [selected, setSelected] = useState<string[]>(["tsh", "glucose"]);
  const [range, setRange] = useState<(typeof RANGES)[number]>("All reports");

  const toggle = (key: string) =>
    setSelected((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key],
    );

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">Lab Trends</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Follow each parameter across its full measurement history.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                range === r
                  ? "border-accent/40 bg-accent/12 text-accent"
                  : "border-white/10 text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </header>

      <GlassCard>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((k) => {
            const p = byKey(k);
            const on = selected.includes(k);
            return (
              <button
                key={k}
                onClick={() => toggle(k)}
                aria-pressed={on}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors",
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

        <div className="mt-5">
          <TrendChart keys={selected} height={360} area />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {range} · Baseline reference is the Jan 12, 2026 report. Hover a point for exact values.
        </p>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {selected.map((k) => {
          const p = byKey(k);
          const min = Math.min(...p.values);
          const max = Math.max(...p.values);
          const current = p.values[2]!;
          const Icon =
            p.direction === "up" ? ArrowUpRight : p.direction === "down" ? ArrowDownRight : Minus;
          return (
            <GlassCard key={k} hover>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold">{p.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    Reference {p.referenceRange} {p.unit}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Min", value: min },
                  { label: "Current", value: current },
                  { label: "Max", value: max },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {s.label}
                    </p>
                    <p className="mt-1 font-display text-sm font-bold">{s.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 flex items-center gap-2 text-sm">
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    p.status === "significant"
                      ? "text-alert"
                      : p.status === "review"
                        ? "text-review"
                        : "text-stable",
                  )}
                  aria-hidden
                />
                <span className="font-semibold">
                  {p.changePct > 0 ? "+" : ""}
                  {p.changePct}%
                </span>
                <span className="min-w-0 truncate text-muted-foreground">since baseline</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{p.note}</p>
            </GlassCard>
          );
        })}
      </div>

      <MedicalDisclaimer />
    </div>
  );
}
