import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, HelpCircle, LineChart, Loader2, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { findings as demoFindings, REPORT_DATES as demoReportDates } from "@/lib/labsight-data";
import { getCurrentUser, isDemoMode } from "@/lib/mock-auth";
import { getRealAnalysisData, type RealAnalysisFinding } from "@/lib/supabase-data";

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
        <p className="text-sm font-semibold">
          {value >= 85 ? "High" : value >= 70 ? "Moderate" : "Low"}
        </p>
      </div>
    </div>
  );
}

interface DisplayFinding {
  id: string;
  parameter: string;
  headline: string;
  status: "stable" | "review" | "significant";
  changeLabel: string;
  reasons: string[];
  recommendation: string;
  confidence: number;
  steps?: string[];
  unit?: string;
}

function AnalysisPage() {
  const [findingsList, setFindingsList] = useState<DisplayFinding[]>([]);
  const [reportDates, setReportDates] = useState<string[]>([]);
  const [reportsCount, setReportsCount] = useState<number>(0);
  const [parametersCount, setParametersCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAnalysis() {
      try {
        const user = await getCurrentUser();
        const demo = isDemoMode();

        if (user) {
          // Real authenticated user: Query ONLY real Supabase data
          const realData = await getRealAnalysisData();
          if (!active) return;

          const formatted: DisplayFinding[] = realData.findings.map((f: RealAnalysisFinding) => ({
            id: f.id,
            parameter: f.parameter_name,
            headline: f.headline,
            status: f.status,
            changeLabel: f.change_label,
            reasons:
              f.reasons.length > 0
                ? f.reasons
                : ["Measurement flagged based on laboratory reference interval."],
            recommendation: f.recommendation,
            confidence: f.confidence,
          }));

          setFindingsList(formatted);
          setReportDates(realData.reportDates);
          setReportsCount(realData.reportsCount);
          setParametersCount(realData.parametersCount);
        } else if (demo) {
          // Explicit demo mode only
          if (!active) return;
          const formatted: DisplayFinding[] = demoFindings.map((f) => ({
            id: f.id,
            parameter: f.parameter,
            headline: f.headline,
            status: f.status,
            changeLabel: f.changeLabel,
            reasons: f.reasons,
            recommendation: f.recommendation,
            confidence: f.confidence,
            steps: f.steps,
            unit: f.unit,
          }));
          setFindingsList(formatted);
          setReportDates(demoReportDates);
          setReportsCount(3);
          setParametersCount(24);
        } else {
          // Unauthenticated non-demo
          if (!active) return;
          setFindingsList([]);
          setReportDates([]);
          setReportsCount(0);
          setParametersCount(0);
        }
      } catch {
        if (active) {
          setFindingsList([]);
          setReportDates([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAnalysis();

    return () => {
      active = false;
    };
  }, []);

  const significantCount = findingsList.filter((f) => f.status === "significant").length;
  const reviewCount = findingsList.filter((f) => f.status === "review").length;
  const stableCount = findingsList.filter((f) => f.status === "stable").length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">AI Analysis</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {loading
            ? "Analyzing reports…"
            : reportsCount > 0
              ? `Comparing ${parametersCount} parameters across ${reportsCount} ${reportsCount === 1 ? "report" : "reports"}.`
              : "No laboratory reports available for cross-report analysis."}
        </p>
      </header>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : findingsList.length === 0 ? (
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <Brain className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="text-lg font-bold">No analysis yet</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Upload your first laboratory report to start tracking changes over time.
            </p>
            <Link
              to="/upload"
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Upload Report
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </GlassCard>
      ) : (
        <>
          <GlassCard strong className="overflow-hidden">
            <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
                <Brain className="h-7 w-7" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-display text-2xl font-bold sm:text-3xl">
                  <span className="text-gradient">
                    {findingsList.length} {findingsList.length === 1 ? "pattern" : "patterns"}{" "}
                    detected
                  </span>
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {significantCount > 0 && `${significantCount} significant change, `}
                  {reviewCount > 0 && `${reviewCount} review recommended, `}
                  {stableCount > 0 && `${stableCount} stable parameters.`} Nothing here is a
                  diagnosis — discuss findings with a qualified healthcare professional.
                </p>
              </div>
            </div>

            {reportDates.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {reportDates.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    {d}
                  </span>
                ))}
              </div>
            )}
          </GlassCard>

          <div className="space-y-5">
            {findingsList.map((f) => (
              <GlassCard key={f.id} hover>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{f.parameter}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{f.headline}</p>
                  </div>
                  <StatusBadge status={f.status} />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {f.steps && f.steps.length > 0
                    ? f.steps.map((s, i) => (
                        <span key={i} className="flex items-center gap-3">
                          <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 font-display text-base font-bold text-foreground">
                            {s}
                          </span>
                          {i < f.steps!.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-primary" aria-hidden />
                          )}
                        </span>
                      ))
                    : null}
                  {f.unit && <span className="text-sm text-muted-foreground">{f.unit}</span>}
                  {f.changeLabel && (
                    <span className="ml-auto font-display text-xl font-bold">{f.changeLabel}</span>
                  )}
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <HelpCircle className="h-4 w-4 text-primary" aria-hidden />
                      Why was this flagged?
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {f.reasons.map((r, i) => (
                        <li key={i} className="flex gap-2">
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
        </>
      )}

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
