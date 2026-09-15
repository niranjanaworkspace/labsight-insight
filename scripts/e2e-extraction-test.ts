import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://oeeognkuucwrigcsyhzz.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZW9nbmt1dWN3cmlnY3N5aHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NDYyNTIsImV4cCI6MjEwNTAyMjI1Mn0.NhadNxlFc1EK1_I6xbJCEdJxNq3bNoEkKfQC8BIFgMQ";

// Construct a valid clinical PDF laboratory report buffer
function createSampleLabPdf(): Buffer {
  const content = `BT
/F1 18 Tf
50 720 Td
(METROPOLITAN CLINICAL LABORATORY - COMPREHENSIVE LAB REPORT) Tj
/F1 12 Tf
0 -30 Td
(Report Date: 2026-04-18) Tj
0 -20 Td
(Patient Name: Niranjana A R       Sample ID: LAB-2026-8891) Tj
0 -40 Td
(TEST NAME                      RESULT     UNITS        REFERENCE INTERVAL) Tj
0 -20 Td
(Hemoglobin                     14.6       g/dL         13.2 - 17.5) Tj
0 -18 Td
(White Blood Cell Count (WBC)   7.2        10^3/uL      4.5 - 11.0) Tj
0 -18 Td
(Platelet Count                 265        10^3/uL      150 - 450) Tj
0 -18 Td
(Fasting Blood Glucose          92.0       mg/dL        70.0 - 99.0) Tj
0 -18 Td
(Thyroid Stimulating Hormone    2.15       uIU/mL       0.45 - 4.50) Tj
0 -18 Td
(Total Cholesterol              182        mg/dL        125 - 200) Tj
0 -18 Td
(Serum Creatinine               0.95       mg/dL        0.70 - 1.30) Tj
ET`;

  const streamLength = Buffer.byteLength(content, "utf-8");

  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${streamLength} >>
stream
${content}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000318 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${420 + streamLength}
%%EOF`;

  return Buffer.from(pdfString, "utf-8");
}

async function runEndToEndTest() {
  console.log("=== STARTING END-TO-END PDF EXTRACTION PIPELINE TEST ===");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 1. Authenticate user session
  console.log("\n[Step 1] Authenticating user session with Supabase...");
  const testEmail = `e2e_tester_${Date.now()}@labsight.ai`;
  const testPassword = `E2eSecurePass_${Date.now()}!`;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: { full_name: "E2E Test User" },
    },
  });

  if (authError || !authData.user || !authData.session) {
    throw new Error(`Auth failed: ${authError?.message || "No session returned"}`);
  }

  const userId = authData.user.id;
  const token = authData.session.access_token;
  console.log(`[Step 1 PASS] Authenticated User UUID: ${userId}`);

  // Create authenticated Supabase client for this user session
  const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // 2. Upload PDF to private bucket "lab-reports" in user's folder
  console.log("\n[Step 2] Uploading clinical laboratory PDF to private bucket 'lab-reports'...");
  const pdfBuffer = createSampleLabPdf();
  const fileName = `${Date.now()}_clinical_report.pdf`;
  const storagePath = `${userId}/${fileName}`;

  const { error: uploadError } = await userSupabase.storage
    .from("lab-reports")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload to storage failed: ${uploadError.message}`);
  }
  console.log(`[Step 2 PASS] Uploaded PDF to: ${storagePath} (${pdfBuffer.length} bytes)`);

  // 3. Locate the uploaded PDF inside that user's folder
  console.log("\n[Step 3] Locating uploaded PDF in user's private folder...");
  const { data: listedFiles, error: listError } = await userSupabase.storage
    .from("lab-reports")
    .list(userId);

  if (listError) {
    throw new Error(`Listing folder failed: ${listError.message}`);
  }

  const foundFile = (listedFiles || []).find((f) => f.name === fileName);
  if (!foundFile) {
    throw new Error(`Uploaded file ${fileName} was not found in listing!`);
  }
  console.log(`[Step 3 PASS] Located file in vault: ${fileName}`);

  // 4. Test Security Isolation: attempt to extract a path outside user's folder (must fail with 403)
  console.log("\n[Step 4a] Testing Security Isolation (forbidden folder check)...");
  const forbiddenRes = await fetch("http://localhost:3000/api/extract-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      storagePath: "other-user-uuid-1234/report.pdf",
    }),
  });
  const forbiddenJson = await forbiddenRes.json();
  console.log(`[Step 4a result] Status: ${forbiddenRes.status}, Error: ${forbiddenJson.error}`);
  if (forbiddenRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden, got ${forbiddenRes.status}`);
  }
  console.log("[Step 4a PASS] Security isolation verified: Cross-folder access blocked.");

  // 5. Test Authentication enforcement: attempt without token (must fail with 401)
  console.log("\n[Step 4b] Testing Authentication Enforcement (unauthenticated request)...");
  const unauthRes = await fetch("http://localhost:3000/api/extract-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ storagePath }),
  });
  const unauthJson = await unauthRes.json();
  console.log(`[Step 4b result] Status: ${unauthRes.status}, Error: ${unauthJson.error}`);
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 Unauthorized, got ${unauthRes.status}`);
  }
  console.log("[Step 4b PASS] Authentication enforcement verified: Token required.");

  // 6. Call the /api/extract-report endpoint with the real uploaded PDF
  console.log("\n[Step 5] Calling /api/extract-report for authenticated user...");
  const startTime = Date.now();
  const extractRes = await fetch("http://localhost:3000/api/extract-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ storagePath }),
  });

  const durationMs = Date.now() - startTime;
  console.log(`[Step 5 response] HTTP status: ${extractRes.status} (took ${durationMs}ms)`);

  const extractJson = await extractRes.json();

  if (!extractRes.ok || !extractJson.success || !extractJson.data) {
    console.error("Extraction error response:", extractJson);
    throw new Error(`Extraction failed: ${extractJson.error || "Unknown error"}`);
  }

  const { data } = extractJson;
  console.log("\n=== ACTUAL GEMINI EXTRACTION JSON RESPONSE ===");
  console.log(JSON.stringify(data, null, 2));

  // 7. Verify extraction results
  console.log("\n[Step 6] Verifying extracted laboratory results structure...");
  console.log(`- Extracted Report Date: ${data.report_date}`);
  console.log(`- Parameters Count: ${data.laboratory_results?.length}`);

  if (!data.laboratory_results || data.laboratory_results.length === 0) {
    throw new Error("No laboratory results extracted!");
  }

  for (let i = 0; i < data.laboratory_results.length; i++) {
    const r = data.laboratory_results[i];
    console.log(
      `  [${i + 1}] ${r.test_name.padEnd(30)} | Standardized: ${r.standardized_name.padEnd(25)} | Value: ${String(r.value).padEnd(6)} | Unit: ${String(r.unit).padEnd(8)} | Ref: ${r.reference_min} - ${r.reference_max}`,
    );

    if (!r.test_name || !r.standardized_name) {
      throw new Error(`Result #${i + 1} missing test name or standardized name`);
    }
  }

  // 8. Verify database constraints: no rows inserted in reports, lab_results, analysis, anomalies
  console.log("\n[Step 7] Verifying database schema preservation (no rows inserted)...");
  const reportsQuery = await userSupabase.from("reports").select("id");
  const labResultsQuery = await userSupabase.from("lab_results").select("id");
  const analysisQuery = await userSupabase.from("analysis").select("id");
  const anomaliesQuery = await userSupabase.from("anomalies").select("id");

  console.log(`- reports count: ${reportsQuery.data?.length ?? 0}`);
  console.log(`- lab_results count: ${labResultsQuery.data?.length ?? 0}`);
  console.log(`- analysis count: ${analysisQuery.data?.length ?? 0}`);
  console.log(`- anomalies count: ${anomaliesQuery.data?.length ?? 0}`);

  if (
    (reportsQuery.data?.length ?? 0) > 0 ||
    (labResultsQuery.data?.length ?? 0) > 0 ||
    (analysisQuery.data?.length ?? 0) > 0 ||
    (anomaliesQuery.data?.length ?? 0) > 0
  ) {
    throw new Error("Safety check failed: Rows were inserted into database!");
  }
  console.log("[Step 7 PASS] Database schema perfectly preserved with 0 rows inserted.");

  console.log("\n========================================================");
  console.log("=== ALL END-TO-END PDF EXTRACTION TESTS PASSED! ===");
  console.log("========================================================");
}

runEndToEndTest().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
