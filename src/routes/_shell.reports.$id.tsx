import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Building2, CalendarDays, Search } from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { Sparkline } from "@/components/labsight/trend-chart";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { Input } from "@/components/ui/input";
import { parameters, reportById, statusLabel, type Status } from "@/lib/labsight-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/reports/$id")({
  loader: ({ params }) => {
    const report = reportById(params.id);
    if (!report) throw notFound();
    return { report };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Report unavailable — LABSIGHT AI" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.report.title} · ${loaderData.report.date} — LABSIGHT AI`;
    const description = `Full parameter breakdown for the ${loaderData.report.title} from ${loaderData.report.date}, with reference ranges and detected changes.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
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

function ReportDetails() {
  const { report } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");

  const rows = useMemo(
    () =>
      parameters
        .slice(0, report.parameterCount)
        .filter((p) => (filter === "all" ? true : p.status === filter))
        .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [report.parameterCount, filter, query],
  );

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
            <h1 className="truncate text-2xl font-bold">{report.title}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> {report.date}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{report.lab}</span>
              </span>
            </div>
          </div>
          <StatusBadge status={report.status} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{report.summary}</p>
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
              {rows.map((p) => (
                <tr key={p.key} className="border-t border-white/8 transition-colors hover:bg-white/[0.03]">
                  <td className="px-5 py-4">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category}</p>
                  </td>
                  <td className="px-5 py-4 font-semibold">
                    {p.values[report.index].toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{p.unit}</td>
                  <td className="px-5 py-4 text-muted-foreground">{p.referenceRange}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Sparkline values={p.values} color={TONE[p.status]} />
                      <span className="text-xs text-muted-foreground">
                        {p.changePct > 0 ? "+" : ""}
                        {p.changePct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No parameters match this search.
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
