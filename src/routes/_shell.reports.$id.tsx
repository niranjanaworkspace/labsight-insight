import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, CalendarDays, Loader2, Search } from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { Sparkline } from "@/components/labsight/trend-chart";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { Input } from "@/components/ui/input";
import {
  parameters as demoParams,
  reportById as demoReportById,
  statusLabel,
  type Status,
} from "@/lib/labsight-data";
import { getCurrentUser, isDemoMode } from "@/lib/mock-auth";
import { getRealReportDetails, type RealLabResult, type RealReport } from "@/lib/supabase-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/reports/$id")({
  component: ReportDetails,
});

const FILTERS: Array<{ key: "all" | Status; label: string }> = [
  { key: "all", label: "All" },
  { key: "significant", label: statusLabel.significant },
  { key: "review", label: statusLabel.review },
  { key: "stable", label: statusLabel.stable },
];

const TONE: Record<Status, string> = {
  stable: "var(--stable)",
  review: "var(--review)",
  significant: "var(--alert)",
};

interface ParameterRow {
  key: string;
  name: string;
  category: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: Status;
  history: number[];
  changeLabel: string;
}

function ReportDetails() {
  const { id } = Route.useParams();
  const [report, setReport] = useState<RealReport | null>(null);
  const [demoReport, setDemoReport] = useState<ReturnType<typeof demoReportById> | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [paramRows, setParamRows] = useState<ParameterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const user = await getCurrentUser();
        const demoActive = isDemoMode();

        if (user) {
          // Authenticated: Query real report and lab_results
          const {
            report: realReport,
            results: realResults,
            historyByParam,
          } = await getRealReportDetails(id);

          if (!active) return;

          if (!realReport) {
            setNotFoundState(true);
            return;
          }

          setReport(realReport);
          setIsDemo(false);

          const rows: ParameterRow[] = realResults.map((lr: RealLabResult) => {
            const hist = historyByParam[lr.parameter_key] ?? [lr.value];
            let changeLabel = "Baseline";
            if (hist.length > 1) {
              const first = hist[0];
              const latest = hist[hist.length - 1];
              if (first !== 0) {
                const pct = (((latest - first) / first) * 100).toFixed(1);
                changeLabel = `${Number(pct) > 0 ? "+" : ""}${pct}%`;
              }
            }
            return {
              key: lr.parameter_key,
              name: lr.parameter_name,
              category: "Laboratory Panel",
              value: lr.value,
              unit: lr.unit ?? "",
              referenceRange: lr.reference_range ?? "Normal range",
              status: lr.status,
              history: hist,
              changeLabel,
            };
          });

          setParamRows(rows);
        } else if (demoActive) {
          // Explicit demo mode
          const dReport = demoReportById(id);
          if (!active) return;

          if (!dReport) {
            setNotFoundState(true);
            return;
          }

          setDemoReport(dReport);
          setIsDemo(true);

          const dRows: ParameterRow[] = demoParams.slice(0, dReport.parameterCount).map((p) => ({
            key: p.key,
            name: p.name,
            category: p.category,
            value: p.values[dReport.index],
            unit: p.unit,
            referenceRange: p.referenceRange,
            status: p.status,
            history: p.values,
            changeLabel: `${p.changePct > 0 ? "+" : ""}${p.changePct}%`,
          }));

          setParamRows(dRows);
        } else {
          if (!active) return;
          setNotFoundState(true);
        }
      } catch {
        if (active) setNotFoundState(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [id]);

  const filteredRows = useMemo(() => {
    return paramRows
      .filter((p) => (filter === "all" ? true : p.status === filter))
      .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  }, [paramRows, filter, query]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFoundState || (!report && !demoReport)) {
    return (
      <div className="space-y-6">
        <Link
          to="/reports"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to reports
        </Link>
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <h2 className="text-lg font-bold">Report not found</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              The requested laboratory report could not be found in your account records.
            </p>
            <Link
              to="/reports"
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Back to My Reports
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  const title = isDemo ? demoReport?.title : report?.title;
  const dateFormatted = isDemo
    ? demoReport?.date
    : report?.report_date
      ? new Date(report.report_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Unknown Date";
  const lab = isDemo ? demoReport?.lab : (report?.lab_name ?? "Diagnostic Laboratory");
  const status = isDemo ? (demoReport?.status ?? "stable") : (report?.status ?? "stable");
  const summary = isDemo
    ? demoReport?.summary
    : (report?.summary ?? "Comprehensive laboratory breakdown.");

  return (
    <div className="space-y-6">
      <Link
        to="/reports"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to reports
      </Link>

      <GlassCard>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{title}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> {dateFormatted}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{lab}</span>
              </span>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{summary}</p>
      </GlassCard>

      <GlassCard className="p-0">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search parameters"
              className="pl-9"
              aria-label="Search parameters"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === f.key
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-white/10 text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="px-5 py-3 font-semibold">Parameter</th>
                <th className="px-5 py-3 font-semibold">Result</th>
                <th className="px-5 py-3 font-semibold">Unit</th>
                <th className="px-5 py-3 font-semibold">Reference range</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Trend</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((p) => (
                <tr
                  key={p.key}
                  className="border-t border-white/8 transition-colors hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-4">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category}</p>
                  </td>
                  <td className="px-5 py-4 font-semibold">{p.value.toLocaleString()}</td>
                  <td className="px-5 py-4 text-muted-foreground">{p.unit}</td>
                  <td className="px-5 py-4 text-muted-foreground">{p.referenceRange}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Sparkline values={p.history} color={TONE[p.status]} />
                      <span className="text-xs text-muted-foreground">{p.changeLabel}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {paramRows.length === 0
                      ? "No parameters recorded in this laboratory report."
                      : "No parameters match this search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <MedicalDisclaimer />
    </div>
  );
}
