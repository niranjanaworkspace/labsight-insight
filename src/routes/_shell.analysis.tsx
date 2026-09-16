import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  FileStack,
  HelpCircle,
  LineChart,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { findings as demoFindings, REPORT_DATES as demoReportDates } from "@/lib/labsight-data";
import { getCurrentUser, isDemoMode } from "@/lib/mock-auth";
import {
  getRealAnalysisData,
  runRealLongitudinalAnalysis,
  type RealAnalysisFinding,
  type RealAnalysisRecord,
} from "@/lib/supabase-data";

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
  previousValue?: number | null;
  currentValue?: number | null;
  percentageChange?: number | null;
  anomalyType?: string | null;
}

function AnalysisPage() {
  const [findingsList, setFindingsList] = useState<DisplayFinding[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<RealAnalysisRecord | null>(null);
  const [reportDates, setReportDates] = useState<string[]>([]);
  const [reportsCount, setReportsCount] = useState<number>(0);
  const [parametersCount, setParametersCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      const demo = isDemoMode();

      if (user) {
        // Real authenticated user: Query ONLY real Supabase data
        const realData = await getRealAnalysisData();

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
          previousValue: f.previous_value,
          currentValue: f.current_value,
          percentageChange: f.percentage_change,
          anomalyType: f.anomaly_type,
        }));

        setFindingsList(formatted);
        setLatestAnalysis(realData.latestAnalysis);
        setReportDates(realData.reportDates);
        setReportsCount(realData.reportsCount);
        setParametersCount(realData.parametersCount);
      } else if (demo) {
        // Explicit demo mode only
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
        setFindingsList([]);
        setReportDates([]);
        setReportsCount(0);
        setParametersCount(0);
      }
    } catch (err: unknown) {
      console.error("Error loading analysis data:", err);
      setFindingsList([]);
      setReportDates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const triggerLongitudinalAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      await runRealLongitudinalAnalysis();
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to run longitudinal analysis.";
      setAnalysisError(msg);
    } finally {
      setAnalyzing(false);
    }
  }, [loadData]);

  const significantCount = findingsList.filter((f) => f.status === "significant").length;
  const reviewCount = findingsList.filter((f) => f.status === "review").length;
  const stableCount = findingsList.filter((f) => f.status === "stable").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Longitudinal AI Analysis</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {loading
              ? "Checking laboratory records…"
              : reportsCount >= 2
                ? `Cross-report biomarker trajectory comparison across ${reportsCount} reports and ${parametersCount} parameters.`
                : reportsCount === 1
                  ? "1 report uploaded. Longitudinal analysis requires at least 2 reports to detect trends."
                  : "No lab reports uploaded yet."}
          </p>
        </div>

        {reportsCount >= 2 && (
          <button
            type="button"
            onClick={triggerLongitudinalAnalysis}
            disabled={analyzing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing Reports…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {latestAnalysis ? "Re-run Longitudinal Analysis" : "Run Longitudinal Analysis"}
              </>
            )}
          </button>
        )}
      </header>

      {analysisError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Analysis Notice
          </div>
          <p className="mt-1">{analysisError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : reportsCount < 2 ? (
        <GlassCard>
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <FileStack className="h-7 w-7" aria-hidden />
            </span>
            <div className="max-w-md space-y-2">
              <h2 className="text-xl font-bold">At Least 2 Reports Required</h2>
              <p className="text-sm text-muted-foreground">
                Longitudinal analysis deterministically compares matching laboratory parameters
                across different dates to identify sudden shifts, persistent out-of-range
                deviations, and unusual fluctuations.
              </p>
              <p className="text-xs font-medium text-amber-300">
                You currently have <span className="font-bold">{reportsCount}</span> uploaded{" "}
                {reportsCount === 1 ? "report" : "reports"}. Upload at least 1 more report to run
                longitudinal analysis.
              </p>
            </div>
            <Link
              to="/upload"
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              Upload Another Report
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </GlassCard>
      ) : analyzing ? (
        <GlassCard>
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
              <Loader2 className="h-7 w-7 animate-spin" />
            </span>
            <div className="max-w-md space-y-1.5">
              <h2 className="text-lg font-bold">Running Longitudinal Analysis</h2>
              <p className="text-sm text-muted-foreground">
                Matching laboratory parameters across dates, calculating deltas and statistical
                thresholds, and generating cautious AI explanations...
              </p>
            </div>
          </div>
        </GlassCard>
      ) : (
        <>
          {/* Overview Summary Card */}
          <GlassCard strong className="overflow-hidden">
            <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
                <Brain className="h-7 w-7" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-display text-2xl font-bold sm:text-3xl">
                    <span className="text-gradient">
                      {findingsList.length} {findingsList.length === 1 ? "Pattern" : "Patterns"}{" "}
                      Detected
                    </span>
                  </p>
                  {latestAnalysis?.overall_status && (
                    <StatusBadge status={latestAnalysis.overall_status} />
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {latestAnalysis?.summary || (
                    <>
                      {significantCount > 0 && `${significantCount} significant shift, `}
                      {reviewCount > 0 && `${reviewCount} review recommended, `}
                      {stableCount > 0 && `${stableCount} stable parameters.`} Discuss findings with
                      your physician for clinical correlation.
                    </>
                  )}
                </p>
              </div>
            </div>

            {reportDates.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                <span className="text-xs font-medium text-muted-foreground mr-1">
                  Report Dates Analyzed:
                </span>
                {reportDates.map((d, i) => (
                  <span
                    key={`${d}-${i}`}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    {d}
                  </span>
                ))}
                {latestAnalysis?.analysis_date && (
                  <span className="ml-auto text-xs text-muted-foreground/80">
                    Last analyzed: {new Date(latestAnalysis.analysis_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </GlassCard>

          {findingsList.length === 0 ? (
            <GlassCard>
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                <h3 className="text-lg font-bold">Stable Longitudinal Profile</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  No sudden shifts, persistent out-of-range deviations, or unusual fluctuations were
                  detected across your matching laboratory parameters.
                </p>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-5">
              {findingsList.map((f) => (
                <GlassCard key={f.id} hover>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-lg font-bold">{f.parameter}</h2>
                        {f.anomalyType && (
                          <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                            {f.anomalyType.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{f.headline}</p>
                    </div>
                    <StatusBadge status={f.status} />
                  </div>

                  {/* Numerical progression display */}
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {f.previousValue !== undefined &&
                      f.previousValue !== null &&
                      f.currentValue !== undefined &&
                      f.currentValue !== null && (
                        <div className="flex items-center gap-3">
                          <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 font-display text-base font-bold text-foreground">
                            Prior: {f.previousValue}
                          </span>
                          <ArrowRight className="h-4 w-4 text-primary" aria-hidden />
                          <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 font-display text-base font-bold text-foreground">
                            Current: {f.currentValue}
                          </span>
                        </div>
                      )}

                    {f.percentageChange !== undefined && f.percentageChange !== null && (
                      <span
                        className={`flex items-center gap-1 font-display text-base font-bold px-3 py-1.5 rounded-xl border ${
                          f.percentageChange > 0
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                            : "border-sky-500/30 bg-sky-500/10 text-sky-400"
                        }`}
                      >
                        {f.percentageChange > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {f.percentageChange > 0 ? "+" : ""}
                        {f.percentageChange}%
                      </span>
                    )}

                    {f.changeLabel && !f.percentageChange && (
                      <span className="ml-auto font-display text-base font-bold">
                        {f.changeLabel}
                      </span>
                    )}
                  </div>

                  {/* Why Flagged & Confidence */}
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

                  {/* AI Explanation / Context */}
                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/90">
                    <p className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span>{f.recommendation}</span>
                    </p>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
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
