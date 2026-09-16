import { createClient } from "@supabase/supabase-js";
import {
  detectLongitudinalAnomalies,
  generateGeminiExplanations,
  type LabMeasurement,
} from "./longitudinal-analyzer";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://oeeognkuucwrigcsyhzz.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZW9nbmt1dWN3cmlnY3N5aHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NDYyNTIsImV4cCI6MjEwNTAyMjI1Mn0.NhadNxlFc1EK1_I6xbJCEdJxNq3bNoEkKfQC8BIFgMQ";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export async function handleRunLongitudinalAnalysis(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed. Use POST." }, 405);
  }

  // 1. Extract bearer token
  const authHeader = request.headers.get("authorization") || "";
  let token = "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    try {
      const body = (await request.json()) as { accessToken?: string };
      if (body.accessToken) token = body.accessToken.trim();
    } catch {
      // Body may not be JSON
    }
  }

  if (!token) {
    return jsonResponse(
      {
        success: false,
        error: "Authentication required. Please provide a valid Supabase Bearer token.",
      },
      401,
    );
  }

  // 2. Validate user identity with Supabase using their token
  const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await userSupabase.auth.getUser(token);

  if (authError || !user) {
    return jsonResponse(
      {
        success: false,
        error: `Authentication failed: ${authError?.message || "Invalid user session"}`,
      },
      401,
    );
  }

  const userId = user.id;

  // 3. Query existing reports and lab_results for this authenticated user
  const { data: reports, error: reportsError } = await userSupabase
    .from("reports")
    .select(
      "id, user_id, report_date, file_name, created_at, lab_results(id, test_name, standardized_name, value, unit, reference_min, reference_max, created_at)",
    )
    .order("report_date", { ascending: true });

  if (reportsError) {
    return jsonResponse(
      {
        success: false,
        error: `Database query error: ${reportsError.message}`,
      },
      500,
    );
  }

  const reportsList = reports || [];

  // 4. Require at least 2 reports for longitudinal analysis
  if (reportsList.length < 2) {
    return jsonResponse(
      {
        success: false,
        error: `Longitudinal analysis requires at least 2 reports. You currently have ${reportsList.length} report(s) in your profile.`,
        reportsCount: reportsList.length,
      },
      400,
    );
  }

  // 5. Group matching laboratory parameters across reports
  const measurementsByParam = new Map<string, LabMeasurement[]>();
  const reportDates: string[] = [];

  for (const r of reportsList) {
    const reportDate = r.report_date || r.created_at?.slice(0, 10) || "Unknown Date";
    reportDates.push(reportDate);

    const results =
      (r.lab_results as Array<{
        id: string;
        test_name: string;
        standardized_name: string;
        value: number | null;
        unit: string | null;
        reference_min: number | null;
        reference_max: number | null;
      }>) || [];

    for (const item of results) {
      if (item.value === null || isNaN(Number(item.value))) continue;

      const normKey = (item.standardized_name || item.test_name || "param").trim().toLowerCase();
      const measurement: LabMeasurement = {
        id: item.id,
        reportId: r.id,
        reportDate,
        testName: item.test_name || item.standardized_name || "Biomarker",
        standardizedName: item.standardized_name || item.test_name,
        value: Number(item.value),
        unit: item.unit,
        referenceMin: item.reference_min !== null ? Number(item.reference_min) : null,
        referenceMax: item.reference_max !== null ? Number(item.reference_max) : null,
      };

      const existing = measurementsByParam.get(normKey) || [];
      existing.push(measurement);
      measurementsByParam.set(normKey, existing);
    }
  }

  // 6. Run deterministic & statistical anomaly detection
  const { anomalies, overallStatus, parametersComparedCount } =
    detectLongitudinalAnomalies(measurementsByParam);

  // 7. Generate cautious explanations with Gemini (strictly preserving real values)
  const { overallSummary, explanations } = await generateGeminiExplanations(
    anomalies,
    reportsList.length,
    reportDates,
  );

  // Attach Gemini explanations to each anomaly
  for (const an of anomalies) {
    an.aiExplanation =
      explanations.get(an.testName) ||
      `${an.testName} demonstrated a shift from ${an.previousValue} to ${an.currentValue} ${an.unit ?? ""}. Review with a physician.`;
  }

  // 8. Persist findings into public.analysis and public.anomalies using the ACTUAL schema
  // public.analysis: id, user_id, analysis_date, overall_status, summary
  const { data: analysisRow, error: insertAnalysisError } = await userSupabase
    .from("analysis")
    .insert({
      user_id: userId,
      analysis_date: new Date().toISOString(),
      overall_status: overallStatus,
      summary: overallSummary,
    })
    .select("id, user_id, analysis_date, overall_status, summary")
    .single();

  if (insertAnalysisError || !analysisRow) {
    return jsonResponse(
      {
        success: false,
        error: `Failed to persist analysis record: ${insertAnalysisError?.message || "Unknown error"}`,
      },
      500,
    );
  }

  const analysisId = analysisRow.id;

  // Insert anomalies linked to analysisId
  // public.anomalies: id, analysis_id, test_name, anomaly_type, severity, previous_value, current_value, percentage_change, ai_explanation, created_at
  let savedAnomaliesCount = 0;
  if (anomalies.length > 0) {
    const anomalyRows = anomalies.map((a) => ({
      analysis_id: analysisId,
      test_name: a.testName,
      anomaly_type: a.anomalyType,
      severity: a.severity,
      previous_value: a.previousValue,
      current_value: a.currentValue,
      percentage_change: a.percentageChange,
      ai_explanation: a.aiExplanation || null,
    }));

    const { data: insertedAnomalies, error: insertAnomaliesError } = await userSupabase
      .from("anomalies")
      .insert(anomalyRows)
      .select();

    if (insertAnomaliesError) {
      console.error("[handleRunLongitudinalAnalysis] Anomaly insert error:", insertAnomaliesError);
      return jsonResponse(
        {
          success: false,
          error: `Failed to persist anomaly items: ${insertAnomaliesError.message}`,
        },
        500,
      );
    }
    savedAnomaliesCount = insertedAnomalies?.length ?? 0;
  }

  return jsonResponse({
    success: true,
    analysisId,
    overallStatus,
    summary: overallSummary,
    reportsAnalyzed: reportsList.length,
    parametersCompared: parametersComparedCount,
    anomaliesCount: savedAnomaliesCount,
    anomalies: anomalies.map((a) => ({
      testName: a.testName,
      anomalyType: a.anomalyType,
      severity: a.severity,
      previousValue: a.previousValue,
      currentValue: a.currentValue,
      percentageChange: a.percentageChange,
      aiExplanation: a.aiExplanation,
      unit: a.unit,
    })),
  });
}
