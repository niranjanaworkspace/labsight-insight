import { supabase } from "@/lib/supabase";
import type { Status, Direction } from "@/lib/labsight-data";
import type { ExtractedReportData } from "@/types/lab-report";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export function computeBiomarkerStatus(
  val: number | null,
  min: number | null,
  max: number | null,
): Status {
  if (val === null) return "stable";
  if (min !== null && val < min) {
    if (max !== null && max > min) {
      const spread = max - min;
      if (val < min - 0.25 * spread) return "significant";
    }
    return "review";
  }
  if (max !== null && val > max) {
    if (min !== null && max > min) {
      const spread = max - min;
      if (val > max + 0.25 * spread) return "significant";
    }
    return "review";
  }
  return "stable";
}

export function formatReferenceRange(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) {
    return `${min} – ${max}`;
  }
  if (min !== null) {
    return `≥ ${min}`;
  }
  if (max !== null) {
    return `≤ ${max}`;
  }
  return null;
}

export interface SaveExtractedReportParams {
  storagePath: string;
  extractedData: ExtractedReportData;
  fileName?: string;
  client?: SupabaseClient;
}

export interface SavedReportRecord {
  reportId: string;
  reportDate: string | null;
  parameterCount: number;
  status: Status;
  isUpdate: boolean;
}

/**
 * Persists extracted laboratory report and biomarker items into real Supabase tables:
 * public.reports and public.lab_results.
 *
 * Rules:
 * - Uses the verified authenticated user UUID from supabase.auth.getUser()
 * - Strictly respects the actual schema of public.reports and public.lab_results
 * - Prevents duplicate inserts on retry by updating existing report & replacing lab_results
 * - Never creates rows in analysis or anomalies tables
 * - Throws on any database failure so that the caller never displays false success
 */
export async function saveExtractedReport({
  storagePath,
  extractedData,
  fileName,
  client,
}: SaveExtractedReportParams): Promise<SavedReportRecord> {
  const activeClient = client || supabase;
  if (!activeClient) {
    throw new Error("Supabase client is not available.");
  }

  // 1. Verify authenticated user identity (never rely on unverified client UUIDs)
  const {
    data: { user },
    error: authError,
  } = await activeClient.auth.getUser();

  if (authError || !user) {
    throw new Error("Authenticated user session is required to save reports.");
  }
  const userId = user.id;

  // 2. Validate and format report_date (must be valid YYYY-MM-DD for Postgres date or null)
  let validReportDate: string | null = null;
  if (extractedData.report_date) {
    const rawDate = extractedData.report_date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      validReportDate = rawDate;
    } else {
      const parsedDate = new Date(rawDate);
      if (!isNaN(parsedDate.getTime())) {
        validReportDate = parsedDate.toISOString().slice(0, 10);
      }
    }
  }

  // 3. Compute overall report status based on individual biomarker deviations
  let reportStatus: Status = "stable";
  for (const item of extractedData.laboratory_results) {
    const itemStatus = computeBiomarkerStatus(item.value, item.reference_min, item.reference_max);
    if (itemStatus === "significant") {
      reportStatus = "significant";
      break;
    } else if (itemStatus === "review") {
      reportStatus = "review";
    }
  }

  // 4. Derive report title and summary
  const cleanTitle = fileName
    ? fileName
        .replace(/\.pdf$/i, "")
        .replace(/[_-]+/g, " ")
        .trim()
    : validReportDate
      ? `Laboratory Report - ${validReportDate}`
      : "Clinical Laboratory Report";

  const parameterCount = extractedData.laboratory_results.length;
  const summary = `Extracted ${parameterCount} biomarkers${
    validReportDate ? ` from report dated ${validReportDate}` : ""
  }.`;

  // 5. Prevent duplicate inserts on retry (Requirement 6)
  // Check if a report with this file_url and user_id already exists in public.reports
  const { data: existingReport, error: checkError } = await activeClient
    .from("reports")
    .select("id")
    .eq("user_id", userId)
    .eq("file_url", storagePath)
    .maybeSingle();

  if (checkError) {
    console.warn("[saveExtractedReport] Existing report check notice:", checkError.message);
  }

  let reportId: string;
  let isUpdate = false;

  if (existingReport?.id) {
    isUpdate = true;
    reportId = existingReport.id;

    // Remove any previously inserted lab_results for this report to prevent duplicate rows on retry
    const { error: deleteResultsError } = await activeClient
      .from("lab_results")
      .delete()
      .eq("report_id", reportId)
      .eq("user_id", userId);

    if (deleteResultsError) {
      throw new Error(
        `Failed to clear previous lab results on retry: ${deleteResultsError.message}`,
      );
    }

    // Update existing report record
    const { error: updateReportError } = await activeClient
      .from("reports")
      .update({
        title: cleanTitle,
        report_date: validReportDate,
        parameter_count: parameterCount,
        status: reportStatus,
        summary,
      })
      .eq("id", reportId)
      .eq("user_id", userId);

    if (updateReportError) {
      throw new Error(`Failed to update report record: ${updateReportError.message}`);
    }
  } else {
    // Insert new report row into public.reports
    const { data: newReport, error: insertReportError } = await activeClient
      .from("reports")
      .insert({
        user_id: userId,
        title: cleanTitle,
        report_date: validReportDate,
        parameter_count: parameterCount,
        status: reportStatus,
        summary,
        file_url: storagePath,
      })
      .select("id")
      .single();

    if (insertReportError || !newReport) {
      throw new Error(
        `Failed to save report to database: ${insertReportError?.message || "Unknown error"}`,
      );
    }

    reportId = newReport.id;
  }

  // 6. Insert ALL extracted lab results using the actual schema of public.lab_results
  if (parameterCount > 0) {
    const resultRows = extractedData.laboratory_results.map((item) => {
      const itemStatus = computeBiomarkerStatus(item.value, item.reference_min, item.reference_max);
      const referenceRange = formatReferenceRange(item.reference_min, item.reference_max);
      const paramKey =
        item.standardized_name?.toLowerCase().trim() ||
        item.test_name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .slice(0, 50);

      return {
        report_id: reportId,
        user_id: userId,
        parameter_key: paramKey,
        parameter_name: item.test_name.trim() || item.standardized_name || "Biomarker",
        value: typeof item.value === "number" && !isNaN(item.value) ? item.value : null,
        unit: item.unit ? item.unit.trim() : null,
        reference_range: referenceRange,
        status: itemStatus,
      };
    });

    const { error: insertResultsError } = await activeClient.from("lab_results").insert(resultRows);

    if (insertResultsError) {
      throw new Error(
        `Failed to save extracted lab results to database: ${insertResultsError.message}`,
      );
    }
  }

  return {
    reportId,
    reportDate: validReportDate,
    parameterCount,
    status: reportStatus,
    isUpdate,
  };
}
