import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, FlaskConical, Layers } from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { reports } from "@/lib/labsight-data";

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

function ReportsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">My Reports</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {reports.length} reports analyzed between Jan 12, 2026 and Sep 13, 2026.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
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

      <MedicalDisclaimer />
    </div>
  );
}
