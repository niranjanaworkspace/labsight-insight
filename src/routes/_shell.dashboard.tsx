import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  FileStack,
  Layers,
  Loader2,
  Minus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { TrendChart } from "@/components/labsight/trend-chart";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { DEMO_USER, getCurrentUser } from "@/lib/mock-auth";
import type { MockUser } from "@/lib/mock-auth";
import { fetchDashboardData, type DashboardData } from "@/lib/dashboard-data";
import type { Status } from "@/lib/labsight-data";
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

const STAT_DEFS = [
  { label: "Reports Analyzed", icon: FileStack, tone: "text-primary" },
  { label: "Parameters Tracked", icon: Layers, tone: "text-accent" },
  { label: "Changes Detected", icon: Sparkles, tone: "text-review" },
  { label: "Stable Parameters", icon: ShieldCheck, tone: "text-stable" },
] as const;

function Dashboard() {
  const [user, setUser] = useState<MockUser | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [u, d] = await Promise.all([getCurrentUser(), fetchDashboardData()]);
        if (cancelled) return;
        setUser(u ?? DEMO_USER);
        setData(d);
        const firstTwo = d.parameters.slice(0, 2).map((p) => p.key);
        setActive(firstTwo.length > 0 ? firstTwo : ["tsh", "hemoglobin"]);
        setOpen(d.findings[0]?.id ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load your dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (key: string) =>
    setActive((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key],
    );

  const statValues = data
    ? [
        data.stats.reportsCount,
        data.stats.parametersTracked,
        data.stats.changesDetected,
        data.stats.stableParameters,
      ]
    : [0, 0, 0, 0];

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">Good morning 👋</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {loading
              ? "Loading your dashboard…"
              : data?.latestReportDate
                ? `${user?.name.split(" ")[0] ?? "User"} — last analyzed on ${data.latestReportDate}`
                : `${user?.name.split(" ")[0] ?? "User"} — no reports analyzed yet`}
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
        {STAT_DEFS.map(({ label, icon: Icon, tone }, i) => (
          <GlassCard key={label} hover className="p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
              </p>
              <Icon className={cn("h-[18px] w-[18px] shrink-0", tone)} aria-hidden />
            </div>
            <p className="mt-3 font-display text-3xl font-bold">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                statValues[i]
              )}
            </p>
          </GlassCard>
        ))}
      </div>

      {error && (
        <GlassCard className="border-alert/30">
          <p className="text-sm font-semibold text-alert">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try refreshing the page. If the problem persists, check your connection.
          </p>
        </GlassCard>
      )}

      {!loading && !error && data && data.stats.reportsCount === 0 && (
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <FileStack className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="text-lg font-bold">No reports yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Upload your first lab report to see your dashboard come to life with tracked
              parameters, detected changes, and trend analysis.
            </p>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Upload your first report
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </GlassCard>
      )}

      {!loading && !error && data && data.stats.reportsCount > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <GlassCard className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Latest Analysis</h2>
              <Link to="/analysis" className="text-sm font-semibold text-primary hover:underline">
                View full analysis
              </Link>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.findings.length > 0
                ? `${data.findings.length} ${data.findings.length === 1 ? "pattern" : "patterns"} detected across your ${data.stats.reportsCount} ${data.stats.reportsCount === 1 ? "report" : "reports"}.`
                : "No patterns detected yet."}
            </p>

            {data.findings.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No analysis findings yet. Upload a report to see detected patterns.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {data.findings.map((f) => {
                  const isOpen = open === f.id;
                  return (
                    <div
                      key={f.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-primary/25"
                    >
                      <button
                        onClick={() => setOpen(isOpen ? null : f.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                        aria-expanded={isOpen}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {f.parameter_name || f.headline}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{f.headline}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-foreground">
                          {f.change_label}
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
                          {f.reasons.length > 0 && (
                            <ul className="space-y-1.5 text-sm text-muted-foreground">
                              {f.reasons.map((r, idx) => (
                                <li key={idx} className="flex gap-2">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          )}
                          {f.recommendation && (
                            <p className="text-sm font-medium text-foreground">{f.recommendation}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          <div className="min-w-0 space-y-6">
            <GlassCard>
              <h2 className="text-lg font-bold">Parameter trend preview</h2>
              {data.parameters.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No lab results yet. Upload a report to see parameter trends.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.parameters.map((p) => {
                      const on = active.includes(p.key);
                      return (
                        <button
                          key={p.key}
                          onClick={() => toggle(p.key)}
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
                    <TrendChart
                      keys={active}
                      height={260}
                      area
                      data={data.trendRows}
                      paramMeta={data.parameters}
                    />
                  </div>
                </>
              )}
            </GlassCard>

            <GlassCard>
              <h2 className="text-lg font-bold">Patterns Detected</h2>
              {data.anomalies.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No anomalies detected. All tracked parameters are within expected ranges.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.anomalies.map((a) => (
                    <li key={a.id} className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5">
                        {a.severity === "stable" ? (
                          <Minus className="h-4 w-4 text-stable" />
                        ) : a.severity === "review" ? (
                          <ArrowDownRight className="h-4 w-4 text-review" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-alert" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{a.parameter_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.description ?? a.anomaly_type ?? "Anomaly detected"}
                        </p>
                      </div>
                      <StatusBadge status={a.severity} />
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </div>
        </div>
      )}

      <MedicalDisclaimer />
    </div>
  );
}
