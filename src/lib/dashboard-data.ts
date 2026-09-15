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

  const [reportsRes, labResultsRes, analysisRes, anomaliesRes] = await Promise.all([
    supabase
      .from("reports")
      .select("id, title, report_date, status, summary")
      .order("report_date", { ascending: true }),
    supabase
      .from("lab_results")
      .select(
        "id, report_id, parameter_key, parameter_name, value, unit, reference_range, status, created_at",
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("analysis")
      .select(
        "id, headline, status, change_label, confidence, reasons, recommendation, parameter_name, report_id",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("anomalies")
      .select("id, parameter_key, parameter_name, anomaly_type, severity, description, report_id")
      .order("created_at", { ascending: false }),
  ]);

  const reports = reportsRes.data ?? [];
  const labResults = labResultsRes.data ?? [];
  const analysisRows = analysisRes.data ?? [];
  const anomalyRows = anomaliesRes.data ?? [];

  const reportsCount = reports.length;
  const parametersTracked = new Set(labResults.map((r) => r.parameter_key)).size;
  const changesDetected = anomalyRows.length;
  const anomalousKeys = new Set(anomalyRows.map((a) => a.parameter_key));
  const allParamKeys = new Set(labResults.map((r) => r.parameter_key));
  const stableParameters = Array.from(allParamKeys).filter((k) => !anomalousKeys.has(k)).length;

  const findings: AnalysisFinding[] = analysisRows.map((a) => ({
    id: a.id,
    headline: a.headline,
    status: normalizeStatus(a.status),
    change_label: a.change_label ?? "",
    reasons: Array.isArray(a.reasons) ? a.reasons : [],
    recommendation: a.recommendation ?? "",
    parameter_name: a.parameter_name ?? "",
  }));

  const anomalies: AnomalyItem[] = anomalyRows.map((a) => ({
    id: a.id,
    parameter_key: a.parameter_key,
    parameter_name: a.parameter_name,
    anomaly_type: a.anomaly_type,
    severity: normalizeStatus(a.severity),
    description: a.description,
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
    const k = lr.parameter_key;
    if (!paramKeySet.has(k)) {
      paramKeySet.add(k);
      parameters.push({ key: k, name: lr.parameter_name, unit: lr.unit ?? "" });
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
        row[lr.parameter_key] = Number(lr.value);
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
