import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight, LineChart, Loader2, Minus } from "lucide-react";
import { GlassCard } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { TrendChart } from "@/components/labsight/trend-chart";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { byKey as demoByKey, trendRows as demoTrendRows, type Status } from "@/lib/labsight-data";
import { getCurrentUser, isDemoMode } from "@/lib/mock-auth";
import { getRealTrendsData, type RealTrendParameter } from "@/lib/supabase-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/trends")({
  head: () => ({
    meta: [
      { title: "Lab Trends — LABSIGHT AI" },
      {
        name: "description",
        content: "Interactive trend analytics across your laboratory measurement history.",
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

const DEMO_CHIPS = ["tsh", "hemoglobin", "vitaminD", "glucose", "wbc", "platelets"];
const RANGES = ["All reports", "Last 6 months", "Last 3 months"] as const;

interface ParameterView {
  key: string;
  name: string;
  unit: string;
  referenceRange: string;
  status: Status;
  values: number[];
  current: number;
  min: number;
  max: number;
  changePct: number;
  direction: "up" | "down" | "flat";
  note?: string;
}

function TrendsPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [range, setRange] = useState<(typeof RANGES)[number]>("All reports");
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const [availableParams, setAvailableParams] = useState<RealTrendParameter[]>([]);
  const [chartRows, setChartRows] = useState<Record<string, string | number>[]>([]);
  const [baselineLabel, setBaselineLabel] = useState<string>("");

  useEffect(() => {
    let active = true;

    async function loadTrends() {
      try {
        const user = await getCurrentUser();
        const demo = isDemoMode();

        if (user) {
          // Real authenticated user: Query ONLY real Supabase data
          const data = await getRealTrendsData();
          if (!active) return;

          setAvailableParams(data.parameters);
          setChartRows(data.trendRows);
          setBaselineLabel(
            data.baselineDate
              ? `Baseline reference is the ${new Date(data.baselineDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} report.`
              : "",
          );

          if (data.parameters.length > 0) {
            const initial = data.parameters.slice(0, 2).map((p) => p.key);
            setSelected(initial);
          } else {
            setSelected([]);
          }
          setIsDemo(false);
        } else if (demo) {
          // Explicit demo mode only
          if (!active) return;
          setIsDemo(true);
          const demoParamList: RealTrendParameter[] = DEMO_CHIPS.map((k) => {
            const p = demoByKey(k);
            return {
              key: p.key,
              name: p.name,
              unit: p.unit,
              reference_range: p.referenceRange,
              status: p.status,
              values: p.values,
            };
          });
          setAvailableParams(demoParamList);
          setChartRows(demoTrendRows);
          setBaselineLabel("Baseline reference is the Jan 12, 2026 report.");
          setSelected(["tsh", "glucose"]);
        } else {
          // Unauthenticated non-demo
          if (!active) return;
          setAvailableParams([]);
          setChartRows([]);
          setSelected([]);
          setIsDemo(false);
        }
      } catch {
        if (active) {
          setAvailableParams([]);
          setChartRows([]);
          setSelected([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTrends();

    return () => {
      active = false;
    };
  }, []);

  const toggle = (key: string) =>
    setSelected((prev) =>
      prev.includes(key)
        ? prev.length > 1
          ? prev.filter((k) => k !== key)
          : prev
        : [...prev, key],
    );

  const selectedDetails: ParameterView[] = selected
    .map((key) => {
      if (isDemo) {
        const p = demoByKey(key);
        const min = Math.min(...p.values);
        const max = Math.max(...p.values);
        const current = p.values[p.values.length - 1] ?? 0;
        return {
          key: p.key,
          name: p.name,
          unit: p.unit,
          referenceRange: p.referenceRange,
          status: p.status,
          values: p.values,
          current,
          min,
          max,
          changePct: p.changePct,
          direction: p.direction,
          note: p.note,
        };
      }

      const p = availableParams.find((ap) => ap.key === key);
      if (!p || p.values.length === 0) return null;

      const min = Math.min(...p.values);
      const max = Math.max(...p.values);
      const current = p.values[p.values.length - 1];
      const first = p.values[0];
      const changePct = first !== 0 ? Math.round(((current - first) / first) * 100) : 0;
      const direction: "up" | "down" | "flat" =
        changePct > 2 ? "up" : changePct < -2 ? "down" : "flat";

      return {
        key: p.key,
        name: p.name,
        unit: p.unit,
        referenceRange: p.reference_range ?? "Standard reference range",
        status: p.status,
        values: p.values,
        current,
        min,
        max,
        changePct,
        direction,
        note:
          p.values.length > 1
            ? `Measured across ${p.values.length} laboratory assessments.`
            : "Single recorded baseline measurement.",
      };
    })
    .filter((p): p is ParameterView => Boolean(p));

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">Lab Trends</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {loading
              ? "Loading trend metrics…"
              : availableParams.length > 0
                ? "Follow each parameter across its full measurement history."
                : "No recorded parameters to visualize."}
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

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : availableParams.length === 0 ? (
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <LineChart className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="text-lg font-bold">No trend data yet</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Upload your first laboratory report to start tracking parameter trends over time.
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
          <GlassCard>
            <div className="flex flex-wrap gap-2">
              {availableParams.map((p) => {
                const on = selected.includes(p.key);
                return (
                  <button
                    key={p.key}
                    onClick={() => toggle(p.key)}
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
              <TrendChart
                keys={selected}
                height={360}
                area
                data={chartRows}
                paramMeta={availableParams}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {range}
              {baselineLabel ? ` · ${baselineLabel}` : ""} Hover a point for exact values.
            </p>
          </GlassCard>

          {selectedDetails.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {selectedDetails.map((p) => {
                const Icon =
                  p.direction === "up"
                    ? ArrowUpRight
                    : p.direction === "down"
                      ? ArrowDownRight
                      : Minus;
                return (
                  <GlassCard key={p.key} hover>
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
                        { label: "Min", value: p.min },
                        { label: "Current", value: p.current },
                        { label: "Max", value: p.max },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                        >
                          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            {s.label}
                          </p>
                          <p className="mt-1 font-display text-sm font-bold">
                            {s.value.toLocaleString()}
                          </p>
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
                    {p.note && <p className="mt-2 text-sm text-muted-foreground">{p.note}</p>}
                  </GlassCard>
                );
              })}
            </div>
          )}
        </>
      )}

      <MedicalDisclaimer />
    </div>
  );
}
