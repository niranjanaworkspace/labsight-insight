export interface LaboratoryResultItem {
  test_name: string;
  standardized_name: string;
  value: number | null;
  unit: string;
  reference_min: number | null;
  reference_max: number | null;
}

export interface ExtractedReportData {
  report_date: string;
  laboratory_results: LaboratoryResultItem[];
}

export interface ExtractReportApiResponse {
  success: boolean;
  data?: ExtractedReportData;
  error?: string;
  details?: string;
}
