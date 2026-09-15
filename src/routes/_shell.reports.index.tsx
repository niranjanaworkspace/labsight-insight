import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, FileStack, FlaskConical, Layers, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { reports as demoReports } from "@/lib/labsight-data";
import { getCurrentUser, isDemoMode } from "@/lib/mock-auth";
import { getRealReports, type RealReport } from "@/lib/supabase-data";

export const Route = createFileRoute("/_shell/reports/")({
  head: () => ({
    meta: [
      { title: "My Reports — LABSIGHT AI" },
      {
        name: "description",
        content:
          "All your uploaded lab reports with dates, parameter counts and the status detected in each one.",
      },
      { property: "og:title", content: "My Reports — LABSIGHT AI" },
      {
        property: "og:description",
        content: "Browse your uploaded lab reports and open a full parameter breakdown.",
      },
    ],
  }),
  component: ReportsPage,
});

interface DisplayReport {
  id: string;
  title: string;
  lab: string;
  date: string;
  parameterCount: number;
  status: "stable" | "review" | "significant";
  summary: string;
}

function ReportsPage() {
  const [reportsList, setReportsList] = useState<DisplayReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRangeText, setDateRangeText] = useState<string>("");

  useEffect(() => {
    let active = true;

    async function loadReports() {
      try {
        const user = await getCurrentUser();
        const demo = isDemoMode();

        if (user) {
          // Real authenticated user: Query ONLY real Supabase data
          const realReports = await getRealReports();
          if (!active) return;

          const formatted: DisplayReport[] = realReports.map((r: RealReport) => ({
            id: r.id,
            title: r.title,
            lab: r.lab_name ?? "Diagnostic Laboratory",
            date: r.report_date
              ? new Date(r.report_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Recent",
            parameterCount: r.parameter_count,
            status: r.status,
            summary: r.summary ?? "Complete laboratory assessment.",
          }));

          setReportsList(formatted);

          if (formatted.length > 0) {
            const dates = realReports
              .map((r) => r.report_date)
              .filter((d): d is string => Boolean(d))
              .sort();
            if (dates.length > 1) {
              const start = new Date(dates[0]).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const end = new Date(dates[dates.length - 1]).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              setDateRangeText(`${formatted.length} reports analyzed between ${start} and ${end}.`);
            } else if (dates.length === 1) {
              const dt = new Date(dates[0]).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              setDateRangeText(`1 report analyzed on ${dt}.`);
            } else {
              setDateRangeText(`${formatted.length} reports in record.`);
            }
          }
        } else if (demo) {
          // Explicit demo mode only
          if (!active) return;
          setReportsList(demoReports);
          setDateRangeText(
            `${demoReports.length} reports analyzed between Jan 12, 2026 and Sep 13, 2026 (Demo).`,
          );
        } else {
          // Unauthenticated non-demo: no reports
          if (!active) return;
          setReportsList([]);
          setDateRangeText("");
        }
      } catch {
        if (!active) return;
        setReportsList([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReports();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">My Reports</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {loading
              ? "Loading reports…"
              : reportsList.length > 0
                ? dateRangeText
                : "No laboratory reports recorded yet."}
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Upload Report
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : reportsList.length === 0 ? (
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <FileStack className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="text-lg font-bold">No reports yet</h2>
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportsList.map((r) => (
            <GlassCard key={r.id} hover className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
                  <FlaskConical className="h-5 w-5" aria-hidden />
                </span>
                <StatusBadge status={r.status} />
              </div>

              <h2 className="mt-4 text-base font-bold">{r.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{r.lab}</p>

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {r.date}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" aria-hidden /> {r.parameterCount} parameters
                </span>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">{r.summary}</p>

              <Link
                to="/reports/$id"
                params={{ id: r.id }}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
              >
                View Details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </GlassCard>
          ))}
        </div>
      )}

      <MedicalDisclaimer />
    </div>
  );
}
