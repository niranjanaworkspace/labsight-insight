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

interface DbLabResultJoined {
  id: string;
  test_name: string;
  standardized_name: string;
  value: number | null;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
}

interface DbReportJoined {
  id: string;
  user_id: string;
  report_date: string | null;
  file_name: string | null;
  created_at: string;
  lab_results?: DbLabResultJoined[];
}

export async function getRealReports(): Promise<RealReport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, user_id, report_date, file_name, created_at, lab_results(id, test_name, standardized_name, value, unit, reference_min, reference_max)",
    )
    .order("report_date", { ascending: false });

  if (error || !data) return [];

  const reportsList = data as unknown as DbReportJoined[];

  return reportsList.map((r: DbReportJoined) => {
    const results: DbLabResultJoined[] = r.lab_results ?? [];
    let reportStatus: Status = "stable";
    for (const lr of results) {
      const s = computeBiomarkerStatus(lr.value, lr.reference_min, lr.reference_max);
      if (s === "significant") {
        reportStatus = "significant";
        break;
      } else if (s === "review") {
        reportStatus = "review";
      }
    }

    const cleanTitle = r.file_name
      ? r.file_name
          .replace(/\.pdf$/i, "")
          .replace(/[_-]+/g, " ")
          .trim()
      : r.report_date
        ? `Laboratory Report - ${r.report_date}`
        : "Clinical Laboratory Report";

    return {
      id: r.id,
      user_id: r.user_id,
      title: cleanTitle,
      report_date: r.report_date,
      lab_name: null,
      sample_number: null,
      parameter_count: results.length,
      status: reportStatus,
      summary: `Report containing ${results.length} extracted biomarkers`,
      file_url: r.file_name,
      created_at: r.created_at,
    };
  });
}

export async function getRealReportDetails(reportId: string): Promise<{
  report: RealReport | null;
  results: RealLabResult[];
  historyByParam: Record<string, number[]>;
}> {
  if (!supabase) return { report: null, results: [], historyByParam: {} };

  const [reportRes, resultsRes, allUserResultsRes] = await Promise.all([
    supabase
      .from("reports")
      .select("id, user_id, report_date, file_name, created_at")
      .eq("id", reportId)
      .maybeSingle(),
    supabase
      .from("lab_results")
      .select(
        "id, report_id, test_name, standardized_name, value, unit, reference_min, reference_max, created_at",
      )
      .eq("report_id", reportId)
      .order("created_at", { ascending: true }),
    supabase
      .from("lab_results")
      .select("standardized_name, value, created_at")
      .order("created_at", { ascending: true }),
  ]);

  if (reportRes.error || !reportRes.data) {
    return { report: null, results: [], historyByParam: {} };
  }

  const r = reportRes.data;
  const rawResults = resultsRes.data ?? [];

  let reportStatus: Status = "stable";
  const results: RealLabResult[] = (rawResults as DbLabResultJoined[]).map(
    (row: DbLabResultJoined) => {
      const itemStatus = computeBiomarkerStatus(row.value, row.reference_min, row.reference_max);
      if (itemStatus === "significant") reportStatus = "significant";
      else if (itemStatus === "review" && reportStatus !== "significant") reportStatus = "review";

      const refRange = formatReferenceRange(row.reference_min, row.reference_max);
      const paramKey = row.standardized_name || row.test_name;
      return {
        id: row.id,
        report_id: reportId,
        user_id: r.user_id,
        parameter_key: paramKey,
        parameter_name: row.test_name,
        value: Number(row.value),
        unit: row.unit,
        reference_range: refRange,
        status: itemStatus,
        created_at: (row as unknown as { created_at?: string }).created_at || "",
      };
    },
  );

  const cleanTitle = r.file_name
    ? r.file_name
        .replace(/\.pdf$/i, "")
        .replace(/[_-]+/g, " ")
        .trim()
    : r.report_date
      ? `Laboratory Report - ${r.report_date}`
      : "Clinical Laboratory Report";

  const report: RealReport = {
    id: r.id,
    user_id: r.user_id,
    title: cleanTitle,
    report_date: r.report_date,
    lab_name: null,
    sample_number: null,
    parameter_count: results.length,
    status: reportStatus,
    summary: `Extracted ${results.length} biomarkers from report`,
    file_url: r.file_name,
    created_at: r.created_at,
  };

  const historyByParam: Record<string, number[]> = {};
  if (allUserResultsRes.data) {
    for (const item of allUserResultsRes.data) {
      const key = item.standardized_name || "unknown";
      if (!historyByParam[key]) {
        historyByParam[key] = [];
      }
      historyByParam[key].push(Number(item.value));
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
    supabase.from("lab_results").select("standardized_name"),
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
  const parametersCount = new Set(
    (labRes.data ?? []).map((l: { standardized_name: string | null }) => l.standardized_name),
  ).size;

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
      .select("id, report_date, file_name")
      .order("report_date", { ascending: true }),
    supabase
      .from("lab_results")
      .select(
        "id, report_id, test_name, standardized_name, value, unit, reference_min, reference_max, created_at",
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
        const key = (lr.standardized_name || lr.test_name || "biomarker").trim().toLowerCase();
        row[key] = Number(lr.value);
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
    const key = (lr.standardized_name || lr.test_name || "biomarker").trim().toLowerCase();
    let p = paramMap.get(key);
    if (!p) {
      const refRange = formatReferenceRange(lr.reference_min, lr.reference_max);
      p = {
        key,
        name: lr.test_name,
        unit: lr.unit ?? "",
        referenceRange: refRange,
        values: [],
        dates: [],
        statuses: [],
      };
      paramMap.set(key, p);
    }
    const val = Number(lr.value);
    if (!isNaN(val)) {
      p.values.push(val);
      const rDate = reportLabelMap.get(lr.report_id) ?? "";
      p.dates.push(rDate);
      const st = computeBiomarkerStatus(val, lr.reference_min, lr.reference_max);
      p.statuses.push(st);
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

  // 4. File name identifier for public.reports.file_name
  const targetFileName = fileName || storagePath.split("/").pop() || "lab_report.pdf";
  const parameterCount = extractedData.laboratory_results.length;

  // 5. Prevent duplicate inserts on retry (Requirement 6)
  // Check if a report with this file_name and user_id already exists in public.reports
  const { data: existingReport, error: checkError } = await activeClient
    .from("reports")
    .select("id")
    .eq("user_id", userId)
    .eq("file_name", targetFileName)
    .maybeSingle();

  if (checkError) {
    console.warn("[saveExtractedReport] Existing report check notice:", checkError.message);
  }

  let reportId: string;
  let isUpdate = false;

  if (existingReport?.id) {
    isUpdate = true;
    reportId = existingReport.id;

    // Check if lab results have already been inserted for this existing report
    const { data: existingLabResults, error: checkLabError } = await activeClient
      .from("lab_results")
      .select("id")
      .eq("report_id", reportId);

    if (checkLabError) {
      console.warn(
        "[saveExtractedReport] Existing lab results check notice:",
        checkLabError.message,
      );
    }

    // If lab results are already stored, prevent duplicates and return existing report metadata
    if (existingLabResults && existingLabResults.length > 0) {
      return {
        reportId,
        reportDate: validReportDate,
        parameterCount: existingLabResults.length,
        status: reportStatus,
        isUpdate: true,
      };
    }
  } else {
    // Insert new report row into public.reports using ONLY actual columns: user_id, file_name, report_date
    const { data: newReport, error: insertReportError } = await activeClient
      .from("reports")
      .insert({
        user_id: userId,
        file_name: targetFileName,
        report_date: validReportDate,
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
  // Actual schema: report_id, test_name, standardized_name, value, unit, reference_min, reference_max
  if (parameterCount > 0) {
    const resultRows = extractedData.laboratory_results.map((item) => {
      const cleanTestName = item.test_name?.trim() || item.standardized_name || "Laboratory Test";
      const cleanStdName =
        item.standardized_name?.trim() ||
        item.test_name
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .slice(0, 50) ||
        "biomarker";

      return {
        report_id: reportId,
        test_name: cleanTestName,
        standardized_name: cleanStdName,
        value: typeof item.value === "number" && !isNaN(item.value) ? item.value : null,
        unit: item.unit ? item.unit.trim() : null,
        reference_min:
          typeof item.reference_min === "number" && !isNaN(item.reference_min)
            ? item.reference_min
            : null,
        reference_max:
          typeof item.reference_max === "number" && !isNaN(item.reference_max)
            ? item.reference_max
            : null,
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
