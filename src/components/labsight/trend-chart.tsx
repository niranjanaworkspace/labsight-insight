import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { byKey, trendRows } from "@/lib/labsight-data";

export const SERIES_COLORS = [
  "var(--teal)",
  "var(--blue)",
  "var(--review)",
  "var(--stable)",
  "var(--alert)",
  "var(--muted-foreground)",
];

function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      <div className="space-y-1">
        {payload.map((item: any) => {
          const p = byKey(item.dataKey);
          return (
            <div key={item.dataKey} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="text-muted-foreground">{p?.name ?? item.dataKey}</span>
              <span className="ml-auto font-semibold text-foreground">
                {Number(item.value).toLocaleString()} {p?.unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TrendChart({
  keys,
  height = 300,
  area = false,
}: {
  keys: string[];
  height?: number;
  area?: boolean;
}) {
  const axis = { stroke: "var(--muted-foreground)", fontSize: 12 };
  // Parameters live on very different scales (TSH ~5 vs platelets ~240k), so
  // small-magnitude series are plotted against a secondary right-hand axis.
  const maxOf = (k: string) => Math.max(...byKey(k).values);
  const globalMax = Math.max(...keys.map(maxOf));
  const axisIdFor = (k: string) => (maxOf(k) < globalMax / 8 ? "right" : "left");
  const hasRight = keys.some((k) => axisIdFor(k) === "right");

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {area ? (
          <AreaChart data={trendRows} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
            <defs>
              {keys.map((k, i) => (
                <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={SERIES_COLORS[i % SERIES_COLORS.length]}
                    stopOpacity={0.45}
                  />
                  <stop
                    offset="100%"
                    stopColor={SERIES_COLORS[i % SERIES_COLORS.length]}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} {...axis} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} width={54} {...axis} />
            {hasRight && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={48}
                {...axis}
              />
            )}
            <Tooltip content={<GlassTooltip />} />
            {keys.map((k, i) => (
              <Area
                yAxisId={axisIdFor(k)}
                key={k}
                type="monotone"
                dataKey={k}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={2.5}
                fill={`url(#fill-${k})`}
                animationDuration={900}
                dot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }}
                activeDot={{ r: 6 }}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={trendRows} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} {...axis} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} width={54} {...axis} />
            {hasRight && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={48}
                {...axis}
              />
            )}
            <Tooltip content={<GlassTooltip />} />
            {keys.map((k, i) => (
              <Line
                yAxisId={axisIdFor(k)}
                key={k}
                type="monotone"
                dataKey={k}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={2.5}
                animationDuration={900}
                dot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 60},${20 - ((v - min) / span) * 16 - 2}`)
    .join(" ");
  return (
    <svg width="62" height="22" viewBox="0 0 62 22" aria-hidden className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
