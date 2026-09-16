import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/mock-auth";
import {
  findings as demoFindings,
  parameters as demoParameters,
  trendRows as demoTrendRows,
  type Status,
} from "@/lib/labsight-data";

export interface DashboardStats {
  reportsCount: number;
  parametersTracked: number;
  changesDetected: number;
  stableParameters: number;
}

export interface AnalysisFinding {
  id: string;
  headline: string;
  status: Status;
  change_label: string;
  reasons: string[];
  recommendation: string;
  parameter_name: string;
}

export interface AnomalyItem {
  id: string;
  parameter_key: string;
  parameter_name: string;
  anomaly_type: string | null;
  severity: Status;
  description: string | null;
}

export interface TrendPoint {
  date: string;
  fullDate: string;
  [key: string]: string | number;
}

export interface ParameterMeta {
  key: string;
  name: string;
  unit: string;
}

export interface DashboardData {
  stats: DashboardStats;
  findings: AnalysisFinding[];
  anomalies: AnomalyItem[];
  trendRows: TrendPoint[];
  parameters: ParameterMeta[];
  latestReportDate: string | null;
}

function normalizeStatus(value: string | null): Status {
  if (value === "significant") return "significant";
  if (value === "review") return "review";
  return "stable";
}

const EMPTY_DASHBOARD: DashboardData = {
  stats: { reportsCount: 0, parametersTracked: 0, changesDetected: 0, stableParameters: 0 },
  findings: [],
  anomalies: [],
  trendRows: [],
  parameters: [],
  latestReportDate: null,
};

export async function fetchDashboardData(): Promise<DashboardData> {
  if (!supabase) {
    if (isDemoMode()) return getDemoDashboardData();
    return EMPTY_DASHBOARD;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isDemoMode()) return getDemoDashboardData();
    return EMPTY_DASHBOARD;
  }

  const [reportsRes, labResultsRes, analysisRes] = await Promise.all([
    supabase
      .from("reports")
      .select("id, report_date, file_name")
      .order("report_date", { ascending: true }),
    supabase
      .from("lab_results")
      .select(
        "id, report_id, test_name, standardized_name, value, unit, reference_min, reference_max, created_at",
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("analysis")
      .select("id, user_id, analysis_date, overall_status, summary")
      .order("analysis_date", { ascending: false })
      .limit(1),
  ]);

  const reports = reportsRes.data ?? [];
  const labResults = labResultsRes.data ?? [];
  const latestAnalysis = analysisRes.data?.[0];

  let anomalyRows: Array<{
    id: string;
    analysis_id: string;
    test_name: string;
    anomaly_type: string | null;
    severity: string | null;
    previous_value: number | null;
    current_value: number | null;
    percentage_change: number | null;
    ai_explanation: string | null;
    created_at: string;
  }> = [];

  if (latestAnalysis?.id) {
    const anomaliesRes = await supabase
      .from("anomalies")
      .select(
        "id, analysis_id, test_name, anomaly_type, severity, previous_value, current_value, percentage_change, ai_explanation, created_at",
      )
      .eq("analysis_id", latestAnalysis.id)
      .order("created_at", { ascending: false });
    anomalyRows = (anomaliesRes.data ?? []) as typeof anomalyRows;
  }

  const reportsCount = reports.length;
  const parametersTracked = new Set(
    labResults.map((r) => (r.standardized_name || r.test_name || "").trim().toLowerCase()),
  ).size;
  const changesDetected = anomalyRows.length;
  const anomalousNames = new Set(anomalyRows.map((a) => a.test_name.trim().toLowerCase()));
  const allParamKeys = new Set(
    labResults.map((r) => (r.standardized_name || r.test_name || "").trim().toLowerCase()),
  );
  const stableParameters = Array.from(allParamKeys).filter((k) => !anomalousNames.has(k)).length;

  const findings: AnalysisFinding[] = anomalyRows.map((a) => {
    const pctStr =
      a.percentage_change !== null
        ? ` (${a.percentage_change > 0 ? "+" : ""}${a.percentage_change}%)`
        : "";
    const headline = `${a.test_name}: ${(a.anomaly_type || "trend").replace(/_/g, " ")}${pctStr}`;

    const reasons: string[] = [];
    if (a.previous_value !== null && a.current_value !== null) {
      reasons.push(`Previous: ${a.previous_value} → Current: ${a.current_value}`);
    }
    if (a.ai_explanation) {
      reasons.push(a.ai_explanation);
    }

    return {
      id: a.id,
      headline,
      status: normalizeStatus(a.severity),
      change_label:
        a.percentage_change !== null
          ? `${a.percentage_change > 0 ? "+" : ""}${a.percentage_change}%`
          : "Shift",
      reasons,
      recommendation:
        a.ai_explanation || "Discuss findings with a qualified healthcare professional.",
      parameter_name: a.test_name,
    };
  });

  const anomalies: AnomalyItem[] = anomalyRows.map((a) => ({
    id: a.id,
    parameter_key: a.test_name.trim().toLowerCase(),
    parameter_name: a.test_name,
    anomaly_type: a.anomaly_type,
    severity: normalizeStatus(a.severity),
    description: a.ai_explanation,
  }));

  const reportDateMap = new Map(reports.map((r) => [r.id, r.report_date]));
  const reportLabelMap = new Map<string, string>();
  for (const r of reports) {
    if (r.report_date) {
      const d = new Date(r.report_date);
      reportLabelMap.set(r.id, d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    }
  }

  const parameters: ParameterMeta[] = [];
  const paramKeySet = new Set<string>();
  for (const lr of labResults) {
    const k = (lr.standardized_name || lr.test_name || "biomarker").trim().toLowerCase();
    if (!paramKeySet.has(k)) {
      paramKeySet.add(k);
      parameters.push({ key: k, name: lr.test_name, unit: lr.unit ?? "" });
    }
  }

  const reportIds = reports.map((r) => r.id);
  const trendRows: TrendPoint[] = reportIds.map((reportId) => {
    const row: TrendPoint = {
      date: reportLabelMap.get(reportId) ?? "",
      fullDate: reportDateMap.get(reportId) ?? "",
    };
    for (const lr of labResults) {
      if (lr.report_id === reportId) {
        const k = (lr.standardized_name || lr.test_name || "biomarker").trim().toLowerCase();
        row[k] = Number(lr.value);
      }
    }
    return row;
  });

  const latestReport = reports.length > 0 ? reports[reports.length - 1] : null;
  let latestReportDate: string | null = null;
  if (latestReport?.report_date) {
    latestReportDate = new Date(latestReport.report_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return {
    stats: { reportsCount, parametersTracked, changesDetected, stableParameters },
    findings,
    anomalies,
    trendRows,
    parameters,
    latestReportDate,
  };
}

function getDemoDashboardData(): DashboardData {
  const anomalies: AnomalyItem[] = demoParameters
    .filter((p) => p.status !== "stable")
    .map((p, idx) => ({
      id: `demo-anomaly-${idx}`,
      parameter_key: p.key,
      parameter_name: p.name,
      anomaly_type: `${p.direction === "up" ? "+" : "-"}${Math.abs(p.changePct)}%`,
      severity: p.status,
      description: p.note,
    }));

  return {
    stats: {
      reportsCount: 3,
      parametersTracked: demoParameters.length,
      changesDetected: anomalies.length,
      stableParameters: demoParameters.length - anomalies.length,
    },
    findings: demoFindings.map((f, idx) => ({
      id: `demo-finding-${idx}`,
      headline: f.headline,
      status: f.status,
      change_label: f.changeLabel,
      reasons: f.reasons,
      recommendation: f.recommendation,
      parameter_name: f.parameter,
    })),
    anomalies,
    trendRows: demoTrendRows,
    parameters: demoParameters.map((p) => ({
      key: p.key,
      name: p.name,
      unit: p.unit,
    })),
    latestReportDate: "Sep 13, 2026",
  };
}
