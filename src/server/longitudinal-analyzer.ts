import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

export type AnomalyType =
  | "sudden_change"
  | "persistent_abnormal"
  | "unusual_fluctuation"
  | "elevated_trend"
  | "declining_trend";

export type AnomalySeverity = "stable" | "review" | "significant";

export interface LabMeasurement {
  id: string;
  reportId: string;
  reportDate: string; // YYYY-MM-DD or date string
  testName: string;
  standardizedName: string;
  value: number;
  unit: string | null;
  referenceMin: number | null;
  referenceMax: number | null;
}

export interface DetectedAnomaly {
  testName: string;
  standardizedName: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  previousValue: number | null;
  currentValue: number;
  unit: string | null;
  referenceMin: number | null;
  referenceMax: number | null;
  percentageChange: number | null;
  measurementDates: string[];
  historicalValues: number[];
  aiExplanation?: string;
}

export interface LongitudinalAnalysisResult {
  overallStatus: "stable" | "review" | "significant";
  summary: string;
  anomalies: DetectedAnomaly[];
  reportsAnalyzedCount: number;
  parametersComparedCount: number;
}

/**
 * Deterministically checks if a value is outside its laboratory reference interval.
 */
function isAbnormal(
  val: number,
  min: number | null,
  max: number | null,
): { abnormal: boolean; isHigh: boolean; isLow: boolean; deviationRatio: number } {
  if (min === null && max === null) {
    return { abnormal: false, isHigh: false, isLow: false, deviationRatio: 0 };
  }

  const isLow = min !== null && val < min;
  const isHigh = max !== null && val > max;
  const abnormal = isLow || isHigh;

  let deviationRatio = 0;
  if (isHigh && max !== null && max > 0) {
    deviationRatio = (val - max) / max;
  } else if (isLow && min !== null && min > 0) {
    deviationRatio = (min - val) / min;
  }

  return { abnormal, isHigh, isLow, deviationRatio };
}

/**
 * Performs deterministic and statistical anomaly detection across chronological lab measurements.
 */
export function detectLongitudinalAnomalies(
  measurementsByParameter: Map<string, LabMeasurement[]>,
): {
  anomalies: DetectedAnomaly[];
  overallStatus: "stable" | "review" | "significant";
  parametersComparedCount: number;
} {
  const anomalies: DetectedAnomaly[] = [];
  let parametersComparedCount = 0;

  for (const [, measurements] of measurementsByParameter.entries()) {
    // Only analyze parameters with at least 2 reports/measurements
    if (measurements.length < 2) continue;
    parametersComparedCount++;

    // Sort measurements chronologically by report date
    const sorted = [...measurements].sort((a, b) => {
      const dateA = a.reportDate || "";
      const dateB = b.reportDate || "";
      const timeA = dateA ? new Date(dateA).getTime() : 0;
      const timeB = dateB ? new Date(dateB).getTime() : 0;
      return isNaN(timeA) || isNaN(timeB) ? dateA.localeCompare(dateB) : timeA - timeB;
    });

    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    const baseline = sorted[0];

    const currentVal = latest.value;
    const prevVal = previous.value;
    const refMin = latest.referenceMin ?? previous.referenceMin;
    const refMax = latest.referenceMax ?? previous.referenceMax;
    const unit = latest.unit ?? previous.unit;
    const testName = latest.testName || latest.standardizedName;
    const standardizedName = latest.standardizedName || latest.testName;

    const allValues = sorted.map((m) => m.value);
    const allDates = sorted.map((m) => m.reportDate);

    // Calculate percentage change between consecutive reports
    let pctChange: number | null = null;
    if (prevVal !== 0 && !isNaN(prevVal) && !isNaN(currentVal)) {
      pctChange = Number((((currentVal - prevVal) / Math.abs(prevVal)) * 100).toFixed(2));
    }

    // Evaluate reference range status
    const currentStatus = isAbnormal(currentVal, refMin, refMax);
    const prevStatus = isAbnormal(prevVal, refMin, refMax);

    // 1. Check for Sudden Changes (>= 20% shift between consecutive reports)
    const absChange = pctChange !== null ? Math.abs(pctChange) : 0;
    const crossedThreshold =
      (prevStatus.abnormal && !currentStatus.abnormal) ||
      (!prevStatus.abnormal && currentStatus.abnormal);

    if (absChange >= 20 || (crossedThreshold && absChange >= 15)) {
      const isExtreme = absChange >= 35 || currentStatus.deviationRatio >= 0.25;
      anomalies.push({
        testName,
        standardizedName,
        anomalyType: "sudden_change",
        severity: isExtreme || currentStatus.abnormal ? "significant" : "review",
        previousValue: prevVal,
        currentValue: currentVal,
        unit,
        referenceMin: refMin,
        referenceMax: refMax,
        percentageChange: pctChange,
        measurementDates: allDates,
        historicalValues: allValues,
      });
      continue; // Move to next parameter
    }

    // 2. Check for Persistent Abnormal Values (abnormal across 2+ consecutive reports)
    if (currentStatus.abnormal && prevStatus.abnormal) {
      const isSevere = currentStatus.deviationRatio >= 0.3 || prevStatus.deviationRatio >= 0.3;
      anomalies.push({
        testName,
        standardizedName,
        anomalyType: "persistent_abnormal",
        severity: isSevere ? "significant" : "review",
        previousValue: prevVal,
        currentValue: currentVal,
        unit,
        referenceMin: refMin,
        referenceMax: refMax,
        percentageChange: pctChange,
        measurementDates: allDates,
        historicalValues: allValues,
      });
      continue;
    }

    // 3. Check for Unusual Fluctuations (for 3+ reports, sharp direction reversal or volatility)
    if (sorted.length >= 3) {
      const mean = allValues.reduce((sum, v) => sum + v, 0) / allValues.length;
      if (mean > 0) {
        const variance =
          allValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / allValues.length;
        const stdDev = Math.sqrt(variance);
        const cv = (stdDev / mean) * 100; // Coefficient of Variation

        const delta1 = sorted[1].value - sorted[0].value;
        const delta2 = sorted[2].value - sorted[1].value;
        const reversedDirection =
          delta1 * delta2 < 0 && Math.abs(delta1 / mean) > 0.15 && Math.abs(delta2 / mean) > 0.15;

        if (cv > 25 || reversedDirection) {
          anomalies.push({
            testName,
            standardizedName,
            anomalyType: "unusual_fluctuation",
            severity: currentStatus.abnormal ? "significant" : "review",
            previousValue: prevVal,
            currentValue: currentVal,
            unit,
            referenceMin: refMin,
            referenceMax: refMax,
            percentageChange: pctChange,
            measurementDates: allDates,
            historicalValues: allValues,
          });
          continue;
        }
      }
    }

    // 4. Check for Progressive Trends (Elevated or Declining)
    if (sorted.length >= 2 && pctChange !== null) {
      if (pctChange >= 12 && (currentStatus.abnormal || currentVal > (refMax ?? Infinity) * 0.9)) {
        anomalies.push({
          testName,
          standardizedName,
          anomalyType: "elevated_trend",
          severity: currentStatus.abnormal ? "significant" : "review",
          previousValue: prevVal,
          currentValue: currentVal,
          unit,
          referenceMin: refMin,
          referenceMax: refMax,
          percentageChange: pctChange,
          measurementDates: allDates,
          historicalValues: allValues,
        });
        continue;
      }

      if (pctChange <= -12 && (currentStatus.abnormal || currentVal < (refMin ?? 0) * 1.1)) {
        anomalies.push({
          testName,
          standardizedName,
          anomalyType: "declining_trend",
          severity: currentStatus.abnormal ? "significant" : "review",
          previousValue: prevVal,
          currentValue: currentVal,
          unit,
          referenceMin: refMin,
          referenceMax: refMax,
          percentageChange: pctChange,
          measurementDates: allDates,
          historicalValues: allValues,
        });
        continue;
      }
    }
  }

  // Determine overall status based on highest anomaly severity detected
  let overallStatus: "stable" | "review" | "significant" = "stable";
  if (anomalies.some((a) => a.severity === "significant")) {
    overallStatus = "significant";
  } else if (anomalies.some((a) => a.severity === "review")) {
    overallStatus = "review";
  }

  return {
    anomalies,
    overallStatus,
    parametersComparedCount,
  };
}

/**
 * Uses Gemini server-side to generate clear, cautious explanations for detected patterns.
 * Never invents values. Never diagnoses or recommends medication changes.
 */
export async function generateGeminiExplanations(
  anomalies: DetectedAnomaly[],
  reportsCount = 2,
  reportDates: string[] = [],
): Promise<{
  overallSummary: string;
  explanations: Map<string, string>;
}> {
  const explanationsMap = new Map<string, string>();
  const safeDates = reportDates && reportDates.length > 0 ? reportDates : ["historical dates"];
  const defaultSummary = `Longitudinal comparison of ${reportsCount} laboratory reports across ${safeDates.join(", ")}.`;

  if (anomalies.length === 0) {
    return {
      overallSummary: `Longitudinal analysis across ${reportsCount} reports (${safeDates.join(" to ")}) demonstrated stable laboratory parameters within expected reference ranges, with no sudden shifts or persistent out-of-range deviations detected. Continued routine health monitoring with your physician is advised.`,
      explanations: explanationsMap,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Graceful fallback if no API key is configured
    for (const a of anomalies) {
      const changeStr =
        a.percentageChange !== null
          ? ` (${a.percentageChange > 0 ? "+" : ""}${a.percentageChange}%)`
          : "";
      explanationsMap.set(
        a.testName,
        `${a.testName} shifted from ${a.previousValue ?? "baseline"} to ${a.currentValue} ${a.unit ?? ""}${changeStr}. Review this laboratory pattern with your healthcare provider.`,
      );
    }
    return {
      overallSummary: `Longitudinal comparison identified ${anomalies.length} laboratory pattern(s) across ${reportsCount} reports requiring clinical correlation. Consult a healthcare provider for personalized medical context.`,
      explanations: explanationsMap,
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  // Prepare factual prompt payload with EXACT observed values only
  const anomaliesPayload = anomalies.map((a) => ({
    test_name: a.testName,
    anomaly_type: a.anomalyType,
    severity: a.severity,
    previous_value: a.previousValue,
    current_value: a.currentValue,
    unit: a.unit,
    reference_min: a.referenceMin,
    reference_max: a.referenceMax,
    percentage_change: a.percentageChange,
    dates: a.measurementDates,
  }));

  const systemInstruction = `You are a clinical laboratory data explainer assisting in longitudinal biomarker reporting.

MANDATORY RULES:
1. NEVER invent, extrapolate, or alter any numerical values. Use ONLY the exact numbers provided in the input payload.
2. NEVER diagnose any clinical disease or condition (do NOT say "the patient has diabetes", "indicates anemia", etc.). Instead describe the biological and laboratory observation cautiously (e.g., "fasting glucose increased above the standard reference limit").
3. NEVER recommend, alter, or prescribe medications, supplements, or dosages.
4. Always maintain clear, cautious, objective clinical language and explicitly recommend reviewing findings with a qualified physician.
5. Return your response as a valid JSON object matching this exact schema:
{
  "overall_summary": "A 2-paragraph cohesive, objective summary of the longitudinal dataset, highlighting notable stable or shifting trajectories across the reports.",
  "items": [
    {
      "test_name": "Exact test_name from payload",
      "explanation": "A 1-2 sentence cautious explanation explaining the specific numerical change, reference interval context, and advising discussion with a doctor."
    }
  ]
}`;

  const promptText = `Here are the exact detected laboratory anomalies and trends across ${reportsCount} reports dated ${reportDates.join(", ")}:
${JSON.stringify(anomaliesPayload, null, 2)}

Provide clear, cautious explanations for each item adhering strictly to all medical integrity rules.`;

  const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"];

  for (const modelName of candidateModels) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.1, // Low temperature for factual precision
        },
      });

      const responseText = response.text;
      if (!responseText) continue;

      const parsed = JSON.parse(responseText) as {
        overall_summary?: string;
        items?: Array<{ test_name: string; explanation: string }>;
      };

      if (parsed.items && Array.isArray(parsed.items)) {
        for (const item of parsed.items) {
          if (item.test_name && item.explanation) {
            explanationsMap.set(item.test_name, item.explanation.trim());
          }
        }
      }

      const overallSummary = parsed.overall_summary?.trim() || defaultSummary;

      // Ensure every anomaly has at least a factual explanation fallback
      for (const a of anomalies) {
        if (!explanationsMap.has(a.testName)) {
          const changeStr =
            a.percentageChange !== null
              ? ` (${a.percentageChange > 0 ? "+" : ""}${a.percentageChange}%)`
              : "";
          explanationsMap.set(
            a.testName,
            `${a.testName} shifted from ${a.previousValue ?? "baseline"} to ${a.currentValue} ${a.unit ?? ""}${changeStr}. Pattern warrants evaluation by a physician.`,
          );
        }
      }

      return {
        overallSummary,
        explanations: explanationsMap,
      };
    } catch (err) {
      console.warn(`[Gemini longitudinal analysis] Model ${modelName} encountered error:`, err);
      // Attempt next fallback model
    }
  }

  // Fallback if all Gemini models encounter network errors
  for (const a of anomalies) {
    const changeStr =
      a.percentageChange !== null
        ? ` (${a.percentageChange > 0 ? "+" : ""}${a.percentageChange}%)`
        : "";
    explanationsMap.set(
      a.testName,
      `${a.testName} measured ${a.currentValue} ${a.unit ?? ""} compared to ${a.previousValue ?? "prior"} ${a.unit ?? ""}${changeStr}. Discuss these laboratory changes with your healthcare provider.`,
    );
  }

  return {
    overallSummary: `Longitudinal analysis across ${reportsCount} reports detected ${anomalies.length} laboratory pattern(s) requiring clinical discussion with your physician.`,
    explanations: explanationsMap,
  };
}
