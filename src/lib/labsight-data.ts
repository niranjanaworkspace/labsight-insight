export type Status = "stable" | "review" | "significant";
export type Direction = "up" | "down" | "flat";

export interface ParameterSeries {
  key: string;
  name: string;
  unit: string;
  referenceRange: string;
  values: [number, number, number];
  changePct: number;
  status: Status;
  direction: Direction;
  category: "Thyroid" | "Hematology" | "Metabolic" | "Vitamins" | "Renal" | "Electrolytes";
  note: string;
}

export const REPORT_DATES = ["Jan 12, 2026", "Apr 18, 2026", "Sep 13, 2026"] as const;
export const SHORT_DATES = ["Jan 12", "Apr 18", "Sep 13"] as const;

export const parameters: ParameterSeries[] = [
  {
    key: "tsh",
    name: "TSH",
    unit: "mIU/L",
    referenceRange: "0.4 – 4.0",
    values: [3.2, 4.1, 5.8],
    changePct: 81.3,
    status: "significant",
    direction: "up",
    category: "Thyroid",
    note: "Progressive upward pattern across all three reports.",
  },
  {
    key: "hemoglobin",
    name: "Hemoglobin",
    unit: "g/dL",
    referenceRange: "12.0 – 15.5",
    values: [12.8, 12.5, 11.2],
    changePct: -12.5,
    status: "review",
    direction: "down",
    category: "Hematology",
    note: "Gradual downward movement, latest value below reference range.",
  },
  {
    key: "vitaminD",
    name: "Vitamin D",
    unit: "ng/mL",
    referenceRange: "30 – 100",
    values: [24, 25, 26],
    changePct: 8.3,
    status: "stable",
    direction: "up",
    category: "Vitamins",
    note: "Slow improvement, still under the reference range.",
  },
  {
    key: "wbc",
    name: "WBC",
    unit: "cells/µL",
    referenceRange: "4,000 – 11,000",
    values: [6800, 7100, 7300],
    changePct: 7.4,
    status: "stable",
    direction: "up",
    category: "Hematology",
    note: "Within range across the full timeline.",
  },
  {
    key: "platelets",
    name: "Platelets",
    unit: "cells/µL",
    referenceRange: "150,000 – 450,000",
    values: [240000, 245000, 238000],
    changePct: -0.8,
    status: "stable",
    direction: "flat",
    category: "Hematology",
    note: "Minor fluctuation, no meaningful trend.",
  },
  {
    key: "glucose",
    name: "Glucose (Fasting)",
    unit: "mg/dL",
    referenceRange: "70 – 99",
    values: [92, 104, 118],
    changePct: 28.3,
    status: "review",
    direction: "up",
    category: "Metabolic",
    note: "Consistent upward deviation beyond the reference range.",
  },
  {
    key: "creatinine",
    name: "Creatinine",
    unit: "mg/dL",
    referenceRange: "0.6 – 1.2",
    values: [0.9, 0.92, 0.95],
    changePct: 5.6,
    status: "stable",
    direction: "up",
    category: "Renal",
    note: "Stable within range.",
  },
  {
    key: "sodium",
    name: "Sodium",
    unit: "mmol/L",
    referenceRange: "135 – 145",
    values: [140, 139, 141],
    changePct: 0.7,
    status: "stable",
    direction: "flat",
    category: "Electrolytes",
    note: "No change of note.",
  },
  {
    key: "potassium",
    name: "Potassium",
    unit: "mmol/L",
    referenceRange: "3.5 – 5.1",
    values: [4.2, 4.3, 4.1],
    changePct: -2.4,
    status: "stable",
    direction: "flat",
    category: "Electrolytes",
    note: "No change of note.",
  },
];

export const byKey = (key: string) => parameters.find((p) => p.key === key)!;

export interface LabReport {
  id: string;
  title: string;
  date: string;
  lab: string;
  parameterCount: number;
  status: Status;
  index: 0 | 1 | 2;
  summary: string;
}

export const reports: LabReport[] = [
  {
    id: "rpt-2026-09",
    title: "Complete Blood Count (CBC)",
    date: "Sep 13, 2026",
    lab: "Meridian Diagnostics · Sample #MD-99271",
    parameterCount: 9,
    status: "significant",
    index: 2,
    summary: "Two parameters moved beyond their reference range since the previous report.",
  },
  {
    id: "rpt-2026-04",
    title: "Thyroid Panel",
    date: "Apr 18, 2026",
    lab: "Meridian Diagnostics · Sample #MD-71104",
    parameterCount: 8,
    status: "review",
    index: 1,
    summary: "Early upward movement detected in thyroid and metabolic markers.",
  },
  {
    id: "rpt-2026-01",
    title: "Annual Health Screening",
    date: "Jan 12, 2026",
    lab: "Northline Health Labs · Sample #NL-40388",
    parameterCount: 7,
    status: "stable",
    index: 0,
    summary: "Baseline report. All tracked parameters within reference ranges.",
  },
];

export const reportById = (id: string) => reports.find((r) => r.id === id);

/** Chart-friendly timeline rows. */
export const trendRows = SHORT_DATES.map((label, i) => {
  const row: Record<string, string | number> = { date: label, fullDate: REPORT_DATES[i]! };
  for (const p of parameters) row[p.key] = p.values[i]!;
  return row;
});

export interface Finding {
  key: string;
  parameter: string;
  headline: string;
  status: Status;
  changeLabel: string;
  steps: string[];
  unit: string;
  confidence: number;
  reasons: string[];
  recommendation: string;
}

export const findings: Finding[] = [
  {
    key: "tsh",
    parameter: "TSH",
    headline: "Progressive upward pattern detected",
    status: "significant",
    changeLabel: "+81.3%",
    steps: ["3.2", "4.1", "5.8"],
    unit: "mIU/L",
    confidence: 92,
    reasons: [
      "Increase observed in every consecutive report across 8 months.",
      "Latest value sits above the stated reference range (0.4 – 4.0 mIU/L).",
      "Rate of change accelerated between the second and third report.",
    ],
    recommendation: "Review recommended. Discuss with a qualified healthcare professional.",
  },
  {
    key: "hemoglobin",
    parameter: "Hemoglobin",
    headline: "Sustained downward movement",
    status: "review",
    changeLabel: "-12.5%",
    steps: ["12.8", "12.5", "11.2"],
    unit: "g/dL",
    confidence: 84,
    reasons: [
      "Consistent decline across three time points.",
      "Latest value falls below the reference range (12.0 – 15.5 g/dL).",
      "Largest single-interval drop recorded in the most recent report.",
    ],
    recommendation: "Review recommended alongside related hematology markers.",
  },
  {
    key: "glucose",
    parameter: "Fasting Glucose",
    headline: "Upward deviation beyond reference range",
    status: "review",
    changeLabel: "+28.3%",
    steps: ["92", "104", "118"],
    unit: "mg/dL",
    confidence: 88,
    reasons: [
      "Two consecutive increases of similar magnitude.",
      "Values crossed the upper reference limit (99 mg/dL) at the second report.",
      "Pattern is directionally consistent, not an isolated fluctuation.",
    ],
    recommendation: "Discuss with a qualified healthcare professional.",
  },
  {
    key: "vitaminD",
    parameter: "Vitamin D",
    headline: "Low-range plateau with slight improvement",
    status: "stable",
    changeLabel: "+8.3%",
    steps: ["24", "25", "26"],
    unit: "ng/mL",
    confidence: 71,
    reasons: [
      "Small positive movement across all reports.",
      "All values remain under the reference range (30 – 100 ng/mL).",
      "Change magnitude is within normal measurement variability.",
    ],
    recommendation: "Continue monitoring at the usual interval.",
  },
  {
    key: "cluster",
    parameter: "Metabolic & thyroid cluster",
    headline: "Correlated movement across two categories",
    status: "review",
    changeLabel: "2 categories",
    steps: ["Jan", "Apr", "Sep"],
    unit: "",
    confidence: 76,
    reasons: [
      "TSH and fasting glucose rose in the same intervals.",
      "Hemoglobin declined over the same period.",
      "Combined pattern is worth reviewing together rather than parameter by parameter.",
    ],
    recommendation: "Review recommended. Discuss with a qualified healthcare professional.",
  },
];

export const patternCategories = [
  {
    label: "Thyroid markers",
    detail: "1 significant change",
    status: "significant" as Status,
    count: 1,
  },
  { label: "Metabolic markers", detail: "1 review recommended", status: "review" as Status, count: 1 },
  { label: "Hematology", detail: "1 review, 2 stable", status: "review" as Status, count: 3 },
  { label: "Vitamins & minerals", detail: "Low-range plateau", status: "stable" as Status, count: 1 },
  { label: "Renal & electrolytes", detail: "All stable", status: "stable" as Status, count: 3 },
];

export const DISCLAIMER =
  "LABSIGHT AI is a clinical decision support tool. It highlights patterns and changes across your lab reports and does not provide a diagnosis. Always discuss results with a qualified healthcare professional.";

export const statusLabel: Record<Status, string> = {
  stable: "Stable",
  review: "Review",
  significant: "Significant change",
};

export function statusForValue(p: ParameterSeries): Status {
  return p.status;
}
