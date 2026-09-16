import { GoogleGenAI, Type } from "@google/genai";
import type { LaboratoryResultItem, ExtractedReportData } from "../types/lab-report";

export type { LaboratoryResultItem, ExtractedReportData };

let geminiClientInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (geminiClientInstance) return geminiClientInstance;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not configured. Please ensure your Gemini API key is set in Settings > Secrets.",
    );
  }

  geminiClientInstance = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  return geminiClientInstance;
}

const laboratoryResultSchema = {
  type: Type.OBJECT,
  properties: {
    test_name: {
      type: Type.STRING,
      description:
        "Exact test name as printed on the laboratory report (e.g., 'TSH, 3rd Generation', 'Hemoglobin A1c', 'Total Cholesterol', 'ALT (SGPT)', 'Platelet Count').",
    },
    standardized_name: {
      type: Type.STRING,
      description:
        "Standardized canonical biomarker name in lowercase snake_case (e.g., 'tsh', 'hemoglobin_a1c', 'total_cholesterol', 'alt', 'platelets', 'glucose', 'creatinine', 'bun', 'sodium', 'potassium', 'calcium', 'wbc', 'rbc', 'hematocrit', 'mcv', 'triglycerides', 'hdl', 'ldl', 'estimated_gfr', 'vitamin_d').",
    },
    value: {
      type: Type.NUMBER,
      nullable: true,
      description:
        "Numeric test value. If a value includes an inequality boundary like '< 0.05' or '> 100', record the numeric threshold (0.05 or 100). If the result is strictly textual/qualitative (e.g., 'Negative', 'Non-reactive', 'Normal'), set value to null.",
    },
    unit: {
      type: Type.STRING,
      description:
        "Unit of measurement as given (e.g., 'mg/dL', 'mIU/L', '%', 'g/dL', 'fL', 'pg', 'K/uL', 'M/uL', 'ng/mL', 'mL/min/1.73m2'). Use empty string if no unit is stated.",
    },
    reference_min: {
      type: Type.NUMBER,
      nullable: true,
      description:
        "Lower bound of the normal reference range as a number. For example, if the range is '13.2 - 17.5', reference_min is 13.2. Provide null if the reference range has no lower bound (e.g., '< 150') or is not stated.",
    },
    reference_max: {
      type: Type.NUMBER,
      nullable: true,
      description:
        "Upper bound of the normal reference range as a number. For example, if the range is '13.2 - 17.5', reference_max is 17.5. Provide null if the reference range has no upper bound (e.g., '> 60') or is not stated.",
    },
  },
  required: ["test_name", "standardized_name", "value", "unit", "reference_min", "reference_max"],
};

const reportExtractionSchema = {
  type: Type.OBJECT,
  properties: {
    report_date: {
      type: Type.STRING,
      description:
        "The primary date associated with the specimen collection, draw, or report in YYYY-MM-DD format (e.g., '2025-10-14'). If unknown or absent, return empty string.",
    },
    laboratory_results: {
      type: Type.ARRAY,
      description: "Array of all clinical laboratory test results parsed from the document.",
      items: laboratoryResultSchema,
    },
  },
  required: ["report_date", "laboratory_results"],
};

const SYSTEM_INSTRUCTION = `You are a clinical laboratory document parsing expert.
Your mission is to read clinical laboratory reports (PDFs) and extract structured biomarker test results with high fidelity.

Extraction Rules:
1. Report Date:
   - Identify the collection date, specimen draw date, or report date.
   - Format strictly as YYYY-MM-DD.
   - If not found or ambiguous, output "".

2. Laboratory Results:
   - Extract every analyte, lab test, and biomarker listed in the report (panels, CBCs, metabolic panels, lipids, urinalysis, thyroid, hormones, etc.).
   - Handle complex layouts: tables, columns, rows, multi-page flows, and section groupings.
   - For each test:
     * test_name: exact label from the report.
     * standardized_name: clean canonical snake_case string (e.g. 'tsh', 'glucose', 'hemoglobin').
     * value: numeric value as a float/integer. If inequality like "< 0.1", use 0.1. If purely textual like "Negative", use null.
     * unit: measurement unit (e.g. "mg/dL", "mIU/L", "%", etc.).
     * reference_min: numeric lower bound of normal range, or null.
     * reference_max: numeric upper bound of normal range, or null.

3. Integrity:
   - Do NOT invent or hallucinate test results not present in the document.
   - If the document is unreadable or does not contain lab test results, return an empty array for laboratory_results.`;

function isHighDemandError(error: unknown): boolean {
  if (!error) return false;
  const str = error instanceof Error ? error.message : String(error);
  const errObj = error as { status?: string | number; code?: number };
  if (errObj.status === "UNAVAILABLE" || errObj.status === 503 || errObj.code === 503) {
    return true;
  }
  const lower = str.toLowerCase();
  return (
    lower.includes("503") ||
    lower.includes("unavailable") ||
    lower.includes("high demand") ||
    lower.includes("spikes in demand")
  );
}

function isTransientGeminiError(error: unknown): boolean {
  if (!error) return false;
  const str = error instanceof Error ? error.message : String(error);
  const errObj = error as { status?: string | number; code?: number };
  if (errObj.status === "UNAVAILABLE" || errObj.status === 503 || errObj.code === 503) {
    return true;
  }
  if (errObj.status === "RESOURCE_EXHAUSTED" || errObj.status === 429 || errObj.code === 429) {
    return true;
  }
  const lower = str.toLowerCase();
  return (
    lower.includes("503") ||
    lower.includes("429") ||
    lower.includes("unavailable") ||
    lower.includes("high demand") ||
    lower.includes("resource_exhausted") ||
    lower.includes("spikes in demand") ||
    lower.includes("overloaded") ||
    lower.includes("rate limit") ||
    lower.includes("quota exceeded") ||
    lower.includes("try again later")
  );
}

function parseGeminiErrorMessage(error: unknown): string {
  if (!error) return "Unknown Gemini API error";
  const raw = error instanceof Error ? error.message : String(error);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*"error"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
    }
  } catch {
    // Ignore JSON parse failure
  }

  if (isTransientGeminiError(error)) {
    return "The Gemini AI model is currently experiencing temporary high demand spikes. Please wait a few moments and try again.";
  }

  return raw;
}

export async function extractLaboratoryDataFromPdf(
  pdfBuffer: Buffer,
): Promise<ExtractedReportData> {
  const ai = getGeminiClient();

  const base64Pdf = pdfBuffer.toString("base64");

  let response;
  // Prioritize stable, high-throughput models with schema support, falling back to other models
  const modelsToTry = [
    "gemini-3.1-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
  ];
  let lastError: unknown = null;

  modelLoop: for (const modelName of modelsToTry) {
    const maxRetriesPerModel = 1; // 2 attempts per model for transient network issues
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Pdf,
              },
            },
            {
              text: "Analyze this laboratory report PDF. Extract the report collection date and all laboratory test results in strict JSON conforming to the schema.",
            },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: reportExtractionSchema,
            temperature: 0.1,
          },
        });
        if (response?.text) {
          break modelLoop;
        }
      } catch (apiError: unknown) {
        lastError = apiError;
        const highDemand = isHighDemandError(apiError);
        const transient = isTransientGeminiError(apiError);

        // When a model experiences a high-demand capacity spike (503), do not hammer it with retries.
        // Immediately failover to the next candidate model in the pool.
        if (highDemand) {
          console.warn(
            `Gemini model ${modelName} is experiencing high demand (503). Immediately switching to next model candidate...`,
          );
          break; // Move immediately to next model candidate
        }

        if (transient && attempt < maxRetriesPerModel) {
          const baseDelay = (attempt + 1) * 800;
          const jitter = Math.floor(Math.random() * 300);
          const backoffDelay = baseDelay + jitter;
          console.warn(
            `Gemini extraction with ${modelName} encountered transient error (attempt ${attempt + 1}/${maxRetriesPerModel + 1}). Retrying in ${backoffDelay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }

        console.warn(
          `Gemini extraction with ${modelName} failed after ${attempt + 1} attempt(s), trying next fallback model if available...`,
          apiError,
        );
        break; // Move to next model candidate
      }
    }
  }

  if (!response) {
    const message = parseGeminiErrorMessage(lastError);
    throw new Error(`Gemini API error during PDF extraction: ${message}`);
  }

  const responseText = response.text;
  if (!responseText || !responseText.trim()) {
    throw new Error("Gemini returned an empty extraction response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error(`Malformed JSON returned by Gemini: ${responseText.slice(0, 200)}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid extraction structure: expected an object.");
  }

  const rawObj = parsed as Record<string, unknown>;
  const report_date = typeof rawObj.report_date === "string" ? rawObj.report_date.trim() : "";
  const rawResults = Array.isArray(rawObj.laboratory_results) ? rawObj.laboratory_results : [];

  const laboratory_results: LaboratoryResultItem[] = rawResults.map(
    (item: unknown, index: number) => {
      if (!item || typeof item !== "object") {
        throw new Error(`Invalid test item at index ${index}.`);
      }
      const itemObj = item as Record<string, unknown>;

      const test_name =
        typeof itemObj.test_name === "string" && itemObj.test_name.trim()
          ? itemObj.test_name.trim()
          : `Test ${index + 1}`;

      const standardized_name =
        typeof itemObj.standardized_name === "string" && itemObj.standardized_name.trim()
          ? itemObj.standardized_name
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, "_")
          : test_name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

      let value: number | null = null;
      if (typeof itemObj.value === "number" && !isNaN(itemObj.value)) {
        value = itemObj.value;
      } else if (typeof itemObj.value === "string") {
        const parsedFloat = parseFloat(itemObj.value.replace(/[^0-9.-]/g, ""));
        if (!isNaN(parsedFloat)) {
          value = parsedFloat;
        }
      }

      const unit = typeof itemObj.unit === "string" ? itemObj.unit.trim() : "";

      let reference_min: number | null = null;
      if (typeof itemObj.reference_min === "number" && !isNaN(itemObj.reference_min)) {
        reference_min = itemObj.reference_min;
      } else if (typeof itemObj.reference_min === "string") {
        const parsedFloat = parseFloat(itemObj.reference_min.replace(/[^0-9.-]/g, ""));
        if (!isNaN(parsedFloat)) {
          reference_min = parsedFloat;
        }
      }

      let reference_max: number | null = null;
      if (typeof itemObj.reference_max === "number" && !isNaN(itemObj.reference_max)) {
        reference_max = itemObj.reference_max;
      } else if (typeof itemObj.reference_max === "string") {
        const parsedFloat = parseFloat(itemObj.reference_max.replace(/[^0-9.-]/g, ""));
        if (!isNaN(parsedFloat)) {
          reference_max = parsedFloat;
        }
      }

      return {
        test_name,
        standardized_name,
        value,
        unit,
        reference_min,
        reference_max,
      };
    },
  );

  return {
    report_date,
    laboratory_results,
  };
}
