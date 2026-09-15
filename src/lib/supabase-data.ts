import { supabase } from "@/lib/supabase";
import type { Status, Direction } from "@/lib/labsight-data";

export interface RealReport {
  id: string;
  user_id: string;
  title: string;
  report_date: string | null;
  lab_name: string | null;
  sample_number: string | null;
  parameter_count: number;
  status: Status;
  summary: string | null;
  file_url: string | null;
  created_at: string;
}

export interface RealLabResult {
  id: string;
  report_id: string;
  user_id: string;
  parameter_key: string;
  parameter_name: string;
  value: number;
  unit: string | null;
  reference_range: string | null;
  status: Status;
  created_at: string;
}

export interface RealAnalysisFinding {
  id: string;
  report_id: string | null;
  headline: string;
  status: Status;
  change_label: string;
  confidence: number;
  reasons: string[];
  recommendation: string;
  parameter_name: string;
  created_at: string;
}

export interface RealAnomaly {
  id: string;
  report_id: string | null;
  parameter_key: string;
  parameter_name: string;
  anomaly_type: string | null;
  severity: Status;
  description: string | null;
  created_at: string;
}

export interface ParameterTrendMeta {
  key: string;
  name: string;
  unit: string;
  referenceRange: string;
  values: number[];
  dates: string[];
  min: number;
  current: number;
  max: number;
  changePct: number;
  status: Status;
  direction: Direction;
}

function normalizeStatus(val: string | null | undefined): Status {
  if (val === "significant") return "significant";
  if (val === "review") return "review";
  return "stable";
}

export async function getRealReports(): Promise<RealReport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, user_id, title, report_date, lab_name, sample_number, parameter_count, status, summary, file_url, created_at",
    )
    .order("report_date", { ascending: false });

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    report_date: r.report_date,
    lab_name: r.lab_name,
    sample_number: r.sample_number,
    parameter_count: r.parameter_count ?? 0,
    status: normalizeStatus(r.status),
    summary: r.summary,
    file_url: r.file_url,
    created_at: r.created_at,
  }));
}

export async function getRealReportDetails(reportId: string): Promise<{
  report: RealReport | null;
  results: RealLabResult[];
  historyByParam: Record<string, number[]>;
}> {
  if (!supabase) return { report: null, results: [], historyByParam: {} };

  const [reportRes, resultsRes, allUserResultsRes] = await Promise.all([
    supabase.from("reports").select("*").eq("id", reportId).maybeSingle(),
    supabase
      .from("lab_results")
      .select("*")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true }),
    supabase
      .from("lab_results")
      .select("parameter_key, value, created_at")
      .order("created_at", { ascending: true }),
  ]);

  if (reportRes.error || !reportRes.data) {
    return { report: null, results: [], historyByParam: {} };
  }

  const r = reportRes.data;
  const report: RealReport = {
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    report_date: r.report_date,
    lab_name: r.lab_name,
    sample_number: r.sample_number,
    parameter_count: r.parameter_count ?? 0,
    status: normalizeStatus(r.status),
    summary: r.summary,
    file_url: r.file_url,
    created_at: r.created_at,
  };

  const results: RealLabResult[] = (resultsRes.data ?? []).map((row) => ({
    id: row.id,
    report_id: row.report_id,
    user_id: row.user_id,
    parameter_key: row.parameter_key,
    parameter_name: row.parameter_name,
    value: Number(row.value),
    unit: row.unit,
    reference_range: row.reference_range,
    status: normalizeStatus(row.status),
    created_at: row.created_at,
  }));

  const historyByParam: Record<string, number[]> = {};
  if (allUserResultsRes.data) {
    for (const item of allUserResultsRes.data) {
      if (!historyByParam[item.parameter_key]) {
        historyByParam[item.parameter_key] = [];
      }
      historyByParam[item.parameter_key].push(Number(item.value));
    }
  }

  return { report, results, historyByParam };
}

export async function getRealAnalysisData(): Promise<{
  findings: RealAnalysisFinding[];
  anomalies: RealAnomaly[];
  reportDates: string[];
  reportsCount: number;
  parametersCount: number;
}> {
  if (!supabase) {
    return { findings: [], anomalies: [], reportDates: [], reportsCount: 0, parametersCount: 0 };
  }

  const [analysisRes, anomaliesRes, reportsRes, labRes] = await Promise.all([
    supabase
      .from("analysis")
      .select(
        "id, report_id, headline, status, change_label, confidence, reasons, recommendation, parameter_name, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("anomalies")
      .select(
        "id, report_id, parameter_key, parameter_name, anomaly_type, severity, description, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("reports").select("id, report_date").order("report_date", { ascending: true }),
    supabase.from("lab_results").select("parameter_key"),
  ]);

  const findings: RealAnalysisFinding[] = (analysisRes.data ?? []).map((a) => ({
    id: a.id,
    report_id: a.report_id,
    headline: a.headline,
    status: normalizeStatus(a.status),
    change_label: a.change_label ?? "",
    confidence: a.confidence ?? 80,
    reasons: Array.isArray(a.reasons)
      ? a.reasons
      : typeof a.reasons === "string"
        ? [a.reasons]
        : [],
    recommendation:
      a.recommendation ?? "Discuss findings with a qualified healthcare professional.",
    parameter_name: a.parameter_name ?? a.headline,
    created_at: a.created_at,
  }));

  const anomalies: RealAnomaly[] = (anomaliesRes.data ?? []).map((an) => ({
    id: an.id,
    report_id: an.report_id,
    parameter_key: an.parameter_key,
    parameter_name: an.parameter_name,
    anomaly_type: an.anomaly_type,
    severity: normalizeStatus(an.severity),
    description: an.description,
    created_at: an.created_at,
  }));

  const reportDates = (reportsRes.data ?? [])
    .map((r) => r.report_date)
    .filter((d): d is string => Boolean(d))
    .map((d) =>
      new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    );

  const reportsCount = reportsRes.data?.length ?? 0;
  const parametersCount = new Set((labRes.data ?? []).map((l) => l.parameter_key)).size;

  return { findings, anomalies, reportDates, reportsCount, parametersCount };
}

export async function getRealTrendsData(): Promise<{
  parameters: ParameterTrendMeta[];
  trendRows: Array<{ date: string; fullDate: string; [key: string]: string | number }>;
  reportsCount: number;
}> {
  if (!supabase) return { parameters: [], trendRows: [], reportsCount: 0 };

  const [reportsRes, labResultsRes] = await Promise.all([
    supabase
      .from("reports")
      .select("id, title, report_date")
      .order("report_date", { ascending: true }),
    supabase
      .from("lab_results")
      .select(
        "id, report_id, parameter_key, parameter_name, value, unit, reference_range, status, created_at",
      )
      .order("created_at", { ascending: true }),
  ]);

  const reports = reportsRes.data ?? [];
  const labResults = labResultsRes.data ?? [];

  if (reports.length === 0 || labResults.length === 0) {
    return { parameters: [], trendRows: [], reportsCount: reports.length };
  }

  const reportDateMap = new Map<string, string>();
  const reportLabelMap = new Map<string, string>();
  for (const r of reports) {
    if (r.report_date) {
      const d = new Date(r.report_date);
      reportLabelMap.set(r.id, d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
      reportDateMap.set(r.id, r.report_date);
    }
  }

  const trendRows = reports.map((r) => {
    const row: { date: string; fullDate: string; [key: string]: string | number } = {
      date: reportLabelMap.get(r.id) ?? "Report",
      fullDate: reportDateMap.get(r.id) ?? "",
    };
    for (const lr of labResults) {
      if (lr.report_id === r.id) {
        row[lr.parameter_key] = Number(lr.value);
      }
    }
    return row;
  });

  const paramMap = new Map<
    string,
    {
      key: string;
      name: string;
      unit: string;
      referenceRange: string;
      values: number[];
      dates: string[];
      statuses: Status[];
    }
  >();

  for (const lr of labResults) {
    let p = paramMap.get(lr.parameter_key);
    if (!p) {
      p = {
        key: lr.parameter_key,
        name: lr.parameter_name,
        unit: lr.unit ?? "",
        referenceRange: lr.reference_range ?? "Normal",
        values: [],
        dates: [],
        statuses: [],
      };
      paramMap.set(lr.parameter_key, p);
    }
    const val = Number(lr.value);
    if (!isNaN(val)) {
      p.values.push(val);
      const rDate = reportLabelMap.get(lr.report_id) ?? "";
      p.dates.push(rDate);
      p.statuses.push(normalizeStatus(lr.status));
    }
  }

  const parameters: ParameterTrendMeta[] = [];
  for (const [, p] of paramMap.entries()) {
    if (p.values.length === 0) continue;
    const min = Math.min(...p.values);
    const max = Math.max(...p.values);
    const current = p.values[p.values.length - 1];
    const first = p.values[0];
    let changePct = 0;
    if (first !== 0 && p.values.length > 1) {
      changePct = Number((((current - first) / first) * 100).toFixed(1));
    }
    const direction: Direction = changePct > 2 ? "up" : changePct < -2 ? "down" : "flat";
    const status = p.statuses[p.statuses.length - 1] ?? "stable";

    parameters.push({
      key: p.key,
      name: p.name,
      unit: p.unit,
      referenceRange: p.referenceRange,
      values: p.values,
      dates: p.dates,
      min,
      current,
      max,
      changePct,
      status,
      direction,
    });
  }

  return { parameters, trendRows, reportsCount: reports.length };
}
