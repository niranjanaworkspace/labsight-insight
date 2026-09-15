import { createClient } from "@supabase/supabase-js";
import { extractLaboratoryDataFromPdf, type ExtractedReportData } from "./gemini-extractor";

interface ExtractReportRequestBody {
  storagePath?: string;
  accessToken?: string;
}

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://oeeognkuucwrigcsyhzz.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZW9nbmt1dWN3cmlnY3N5aHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NDYyNTIsImV4cCI6MjEwNTAyMjI1Mn0.NhadNxlFc1EK1_I6xbJCEdJxNq3bNoEkKfQC8BIFgMQ";

function jsonResponse(
  body: {
    success: boolean;
    error?: string;
    data?: ExtractedReportData;
    details?: string;
  },
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export async function handleExtractReportRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed. Use POST." }, 405);
  }

  // 1. Extract authentication token
  const authHeader = request.headers.get("authorization") || "";
  let token = "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7).trim();
  }

  let body: ExtractReportRequestBody = {};
  try {
    body = (await request.json()) as ExtractReportRequestBody;
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON request body." }, 400);
  }

  if (!token && body.accessToken) {
    token = body.accessToken.trim();
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

  const storagePath = body.storagePath?.trim();
  if (!storagePath) {
    return jsonResponse(
      {
        success: false,
        error: "Missing required parameter: storagePath.",
      },
      400,
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
    console.warn("[api/extract-report] Authentication failed:", authError?.message);
    return jsonResponse(
      {
        success: false,
        error: "Unauthorized: Invalid or expired Supabase user session.",
        details: authError?.message,
      },
      401,
    );
  }

  console.log(
    `[api/extract-report] Authenticated user: ${user.id} (${user.email ?? "no-email"}), requested path: ${storagePath}`,
  );

  // 3. Ensure security isolation: user can only access files in their own folder
  const userPrefix = `${user.id}/`;
  if (!storagePath.startsWith(userPrefix)) {
    console.warn(
      `[api/extract-report] Security check failed: path "${storagePath}" does not start with user prefix "${userPrefix}"`,
    );
    return jsonResponse(
      {
        success: false,
        error:
          "Forbidden: Access denied. You can only extract files located within your private user folder.",
      },
      403,
    );
  }

  // 4. Download PDF file from Supabase Storage bucket 'lab-reports' using authenticated client
  let pdfBuffer: Buffer;
  try {
    console.log(
      `[api/extract-report] Downloading private PDF from bucket "lab-reports": ${storagePath}`,
    );
    const { data: fileData, error: downloadError } = await userSupabase.storage
      .from("lab-reports")
      .download(storagePath);

    if (downloadError || !fileData) {
      console.warn(`[api/extract-report] Download error:`, downloadError);
      return jsonResponse(
        {
          success: false,
          error: `Could not retrieve file from private storage vault: ${
            downloadError?.message || "File not found"
          }`,
        },
        404,
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    pdfBuffer = Buffer.from(arrayBuffer);
    console.log(`[api/extract-report] Downloaded PDF successfully: ${pdfBuffer.length} bytes`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to read storage response";
    console.error(`[api/extract-report] Storage access exception:`, err);
    return jsonResponse(
      {
        success: false,
        error: `Error accessing storage vault: ${message}`,
      },
      502,
    );
  }

  // 5. Validate PDF file size and header
  if (!pdfBuffer || pdfBuffer.length === 0) {
    return jsonResponse(
      {
        success: false,
        error: "The uploaded file is empty (0 bytes).",
      },
      400,
    );
  }

  if (pdfBuffer.length > 25 * 1024 * 1024) {
    return jsonResponse(
      {
        success: false,
        error: "The file exceeds the 25 MB maximum supported document size.",
      },
      413,
    );
  }

  // Check PDF magic bytes (%PDF-)
  const pdfHeader = pdfBuffer.subarray(0, 5).toString("utf-8");
  if (!pdfHeader.startsWith("%PDF-")) {
    return jsonResponse(
      {
        success: false,
        error:
          "Invalid file format: The document does not contain a valid PDF signature (%PDF-). Please upload a valid PDF.",
      },
      400,
    );
  }

  // 6. Invoke Gemini extraction pipeline
  try {
    console.log(
      `[api/extract-report] Sending PDF (${pdfBuffer.length} bytes) to Gemini extractor...`,
    );
    const extracted = await extractLaboratoryDataFromPdf(pdfBuffer);

    console.log(
      `[api/extract-report] Gemini extraction completed: ${extracted.laboratory_results.length} laboratory parameters, report date: "${extracted.report_date || "not found"}"`,
    );

    if (!extracted.laboratory_results || extracted.laboratory_results.length === 0) {
      console.warn("[api/extract-report] 0 laboratory results extracted from PDF");
      return jsonResponse(
        {
          success: false,
          error:
            "No laboratory test results could be identified in the uploaded PDF. Please verify that the document is a readable clinical laboratory report.",
          data: extracted,
        },
        422,
      );
    }

    return jsonResponse({
      success: true,
      data: extracted,
    });
  } catch (extractionError: unknown) {
    const message =
      extractionError instanceof Error ? extractionError.message : "Extraction failed";

    console.error("[api/extract-report] PDF laboratory extraction error:", extractionError);

    return jsonResponse(
      {
        success: false,
        error: `Laboratory extraction pipeline failed: ${message}`,
      },
      500,
    );
  }
}
