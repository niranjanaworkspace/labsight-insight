import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, HelpCircle, LineChart, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { findings, REPORT_DATES } from "@/lib/labsight-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/analysis")({
  head: () => ({
    meta: [
      { title: "AI Analysis — LABSIGHT AI" },
      {
        name: "description",
        content:
          "Detailed pattern analysis across your lab reports: step-by-step changes, why each was flagged and confidence levels.",
      },
      { property: "og:title", content: "AI Analysis — LABSIGHT AI" },
      {
        property: "og:description",
        content: "See which patterns were detected across your reports and why they were flagged.",
      },
    ],
  }),
  component: AnalysisPage,
});

function ConfidenceGauge({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex shrink-0 items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--teal)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
          transform="rotate(-90 32 32)"
        />
        <text
          x="32"
          y="36"
          textAnchor="middle"
          fill="var(--foreground)"
          fontSize="14"
          fontWeight="700"
        >
          {value}
        </text>
      </svg>
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Pattern confidence
        </p>
        <p className="text-sm font-semibold">{value >= 85 ? "High" : value >= 70 ? "Moderate" : "Low"}</p>
      </div>
    </div>
  );
}

function AnalysisPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">AI Analysis</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Comparing 24 parameters across 3 reports, Jan 12 – Sep 13, 2026.
        </p>
      </header>

      <GlassCard strong className="overflow-hidden">
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Brain className="h-7 w-7" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-display text-2xl font-bold sm:text-3xl">
              <span className="text-gradient">5 patterns detected</span>
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              1 significant change, 3 review recommended, 1 low-range plateau. Nothing here is a
              diagnosis — discuss findings with a qualified healthcare professional.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {REPORT_DATES.map((d) => (
            <span
              key={d}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-muted-foreground"
            >
              {d}
            </span>
          ))}
        </div>
      </GlassCard>

      <div className="space-y-5">
        {findings.map((f) => (
          <GlassCard key={f.key} hover>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{f.parameter}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{f.headline}</p>
              </div>
              <StatusBadge status={f.status} />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {f.steps.map((s, i) => (
                <span key={i} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-xl border px-3.5 py-2 font-display text-base font-bold",
                      i === f.steps.length - 1
                        ? f.status === "significant"
                          ? "border-alert/35 bg-alert/10 text-alert"
                          : f.status === "review"
                            ? "border-review/35 bg-review/10 text-review"
                            : "border-stable/35 bg-stable/10 text-stable"
                        : "border-white/10 bg-white/[0.04] text-foreground",
                    )}
                  >
                    {s}
                  </span>
                  {i < f.steps.length - 1 && <ArrowRight className="h-4 w-4 text-primary" aria-hidden />}
                </span>
              ))}
              {f.unit && <span className="text-sm text-muted-foreground">{f.unit}</span>}
              <span className="ml-auto font-display text-xl font-bold">{f.changeLabel}</span>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <HelpCircle className="h-4 w-4 text-primary" aria-hidden />
                  Why was this flagged?
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {f.reasons.map((r) => (
                    <li key={r} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <ConfidenceGauge value={f.confidence} />
            </div>

            <p className="mt-4 flex items-start gap-2 text-sm font-medium">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              {f.recommendation}
            </p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="flex flex-wrap items-center gap-4">
        <LineChart className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Want to see the full timeline for each parameter?
        </p>
        <Link
          to="/trends"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Open Lab Trends <ArrowRight className="h-4 w-4" />
        </Link>
      </GlassCard>

      <MedicalDisclaimer />
    </div>
  );
}
