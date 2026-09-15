import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Code,
  Copy,
  FileCheck,
  FileText,
  FlaskConical,
  Loader2,
  Lock,
  LogIn,
  RotateCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/labsight/glass-card";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ExtractReportApiResponse, ExtractedReportData } from "@/types/lab-report";

export const Route = createFileRoute("/_shell/upload")({
  head: () => ({
    meta: [
      { title: "Upload Report — LABSIGHT AI" },
      {
        name: "description",
        content:
          "Upload a PDF lab report to your private storage vault for automated extraction and longitudinal analysis.",
      },
      { property: "og:title", content: "Upload Report — LABSIGHT AI" },
      {
        property: "og:description",
        content: "Upload a PDF lab report to your secure private storage vault.",
      },
    ],
  }),
  component: UploadPage,
});

interface PipelineStage {
  title: string;
  description: string;
  status: "idle" | "active" | "done" | "error" | "pending_pipeline";
}

interface VaultFileItem {
  name: string;
  id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
}

export function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedReportData | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [showJsonInspector, setShowJsonInspector] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [locatedVaultFiles, setLocatedVaultFiles] = useState<VaultFileItem[]>([]);
  const [scanningVault, setScanningVault] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scan the authenticated user's private folder in 'lab-reports' bucket
  async function scanUserVault(userId: string) {
    if (!supabase) return;
    setScanningVault(true);
    try {
      const { data: files, error } = await supabase.storage.from("lab-reports").list(userId, {
        sortBy: { column: "created_at", order: "desc" },
      });

      if (error) {
        console.warn("Could not list vault files:", error.message);
        return;
      }

      const pdfFiles = (files || []).filter(
        (f) =>
          f.name.toLowerCase().endsWith(".pdf") &&
          !f.name.startsWith(".") &&
          f.name !== ".emptyFolderPlaceholder",
      );

      setLocatedVaultFiles(pdfFiles);

      // If user has uploaded files in their vault and no file is currently selected,
      // pick the most recent uploaded PDF and automatically initiate extraction
      if (pdfFiles.length > 0) {
        const latestFile = pdfFiles[0];
        const latestStoragePath = `${userId}/${latestFile.name}`;
        setUploadedPath(latestStoragePath);
        // Automatically trigger extraction on the real uploaded PDF
        await triggerExtraction(latestStoragePath);
      }
    } catch (scanErr) {
      console.warn("Exception scanning vault:", scanErr);
    } finally {
      setScanningVault(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      if (!supabase) {
        if (isMounted) setAuthChecked(true);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isMounted) {
        setCurrentUserId(user?.id ?? null);
        setCurrentUserEmail(user?.email ?? null);
        setAuthChecked(true);
      }

      if (user?.id) {
        await scanUserVault(user.id);
      }
    }
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleFileSelection(selectedFile: File | null) {
    if (!selectedFile) return;

    // Reset previous error/success state
    setUploadError(null);
    setUploadedPath(null);
    setExtractedData(null);
    setExtractionError(null);
    setExtracting(false);

    // Rule 2: Allow PDF files only
    const isPdf =
      selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      toast.error("PDF format required", {
        description: "Only PDF laboratory reports are supported. Please select a .pdf file.",
      });
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error("File exceeds limit", {
        description: "Please select a PDF file smaller than 20 MB.",
      });
      return;
    }

    setFile(selectedFile);

    // Rule 3: Require an authenticated Supabase user before uploading
    if (!supabase) {
      const msg = "Supabase client is not configured.";
      setUploadError(msg);
      toast.error("Configuration Error", { description: msg });
      return;
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      const authMessage = "Authentication required. Please sign in to upload lab reports.";
      setUploadError(authMessage);
      toast.error("Authentication required", {
        description: "You must be signed in to upload files to your private storage vault.",
      });
      return;
    }

    setCurrentUserId(user.id);
    setCurrentUserEmail(user.email ?? null);

    // Rule 4: Upload the file to this path: <authenticated-user-uuid>/<unique-file-name>.pdf
    const timestamp = Date.now();
    const randomSuffix =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    const sanitizedBase =
      selectedFile.name
        .replace(/\.pdf$/i, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 40) || "report";
    const uniqueFileName = `${timestamp}_${randomSuffix}_${sanitizedBase}.pdf`;
    const targetStoragePath = `${user.id}/${uniqueFileName}`;

    setUploading(true);

    try {
      // Upload directly to private bucket 'lab-reports' using authenticated user's client
      const { error: storageError } = await supabase.storage
        .from("lab-reports")
        .upload(targetStoragePath, selectedFile, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (storageError) {
        throw storageError;
      }

      setUploading(false);
      setUploadedPath(targetStoragePath);
      toast.success("PDF uploaded successfully", {
        description: "Your report has been stored securely in your private vault.",
      });

      // Automatically initiate the backend Gemini extraction pipeline
      await triggerExtraction(targetStoragePath);
      // Refresh vault list
      await scanUserVault(user.id);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : "Failed to upload file to storage.";
      setUploading(false);
      setUploadError(errMessage);
      toast.error("Upload failed", {
        description: errMessage,
      });
    }
  }

  async function triggerExtraction(storagePath: string) {
    if (!supabase) {
      setExtractionError("Supabase client is unavailable.");
      return;
    }

    setExtracting(true);
    setExtractionError(null);
    setExtractedData(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Active session token not found. Please log in again.");
      }

      const response = await fetch("/api/extract-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storagePath }),
      });

      const result: ExtractReportApiResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        const errorMsg = result.error || `Server extraction failed with status ${response.status}`;
        throw new Error(errorMsg);
      }

      setExtractedData(result.data);
      setExtracting(false);
      toast.success("Extraction successful", {
        description: `Gemini extracted ${result.data.laboratory_results.length} laboratory test results.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to extract laboratory values.";
      setExtracting(false);
      setExtractionError(msg);
      toast.error("Extraction failed", {
        description: msg,
      });
    }
  }

  function copyJsonToClipboard() {
    if (!extractedData) return;
    navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2));
    setCopiedJson(true);
    toast.success("JSON copied to clipboard");
    setTimeout(() => setCopiedJson(false), 2000);
  }

  const pipelineStages: PipelineStage[] = [
    {
      title: "Upload to private vault",
      description: uploading
        ? "Uploading PDF to private storage vault…"
        : uploadedPath
          ? "Successfully stored in private vault (lab-reports)"
          : uploadError
            ? "Upload failed"
            : "Store PDF in private bucket (lab-reports)",
      status: uploading ? "active" : uploadedPath ? "done" : uploadError ? "error" : "idle",
    },
    {
      title: "Extracting laboratory values",
      description: extracting
        ? "Downloading PDF from private vault and extracting structured biomarkers with Gemini AI…"
        : extractedData
          ? `Extraction successful · ${extractedData.laboratory_results.length} tests · Date: ${extractedData.report_date || "Not detected"}`
          : extractionError
            ? `Extraction failed: ${extractionError}`
            : uploadedPath
              ? "Ready for Gemini extraction"
              : "Pending PDF upload",
      status: extracting
        ? "active"
        : extractedData
          ? "done"
          : extractionError
            ? "error"
            : uploadedPath
              ? "idle"
              : "pending_pipeline",
    },
    {
      title: "Comparing historical results",
      description: "Pipeline stage not yet connected (database insertion pending)",
      status: "pending_pipeline",
    },
    {
      title: "Analyzing patterns",
      description: "Pipeline stage not yet connected (database insertion pending)",
      status: "pending_pipeline",
    },
  ];

  const hasVaultOrUpload = Boolean(
    file || uploadedPath || locatedVaultFiles.length > 0 || extractedData || extractionError,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Upload Report</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Upload your PDF laboratory report to your private vault for secure storage and automated
          AI biomarker extraction.
        </p>
      </header>

      {authChecked && !currentUserId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
            <div>
              <p className="font-semibold text-foreground">Authentication required</p>
              <p className="text-xs text-muted-foreground">
                You must be logged in to upload and extract files in your private storage vault.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="gap-2 font-semibold">
            <Link to="/login">
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>
          </Button>
        </div>
      )}

      {currentUserId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>
              Authenticated Session:{" "}
              <span className="font-mono text-foreground/90 font-medium">
                {currentUserEmail || currentUserId}
              </span>
            </span>
          </div>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px]">
            User UUID: {currentUserId}
          </span>
        </div>
      )}

      {/* Located files in private vault */}
      {currentUserId && locatedVaultFiles.length > 0 && (
        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Located in Private Vault ({locatedVaultFiles.length}{" "}
                {locatedVaultFiles.length === 1 ? "document" : "documents"})
              </p>
            </div>
            {scanningVault && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Scanning vault…
              </span>
            )}
          </div>
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-black/20">
            {locatedVaultFiles.map((vf) => {
              const fullPath = `${currentUserId}/${vf.name}`;
              const isCurrent = uploadedPath === fullPath;
              return (
                <div
                  key={vf.name}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{vf.name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground break-all">
                        Path: {fullPath}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Active Target
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant={isCurrent ? "default" : "outline"}
                      disabled={extracting}
                      onClick={() => {
                        setUploadedPath(fullPath);
                        triggerExtraction(fullPath);
                      }}
                      className="h-7 text-xs font-semibold gap-1.5"
                    >
                      {extracting && isCurrent ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Extracting…
                        </>
                      ) : (
                        <>
                          <RotateCw className="h-3 w-3" />
                          {extractedData && isCurrent ? "Re-extract" : "Extract with Gemini"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Drag & Drop Upload Zone */}
      <GlassCard className="p-0">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const droppedFile = e.dataTransfer.files?.[0] ?? null;
            handleFileSelection(droppedFile);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className={cn(
            "m-4 cursor-pointer rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors sm:m-6 sm:py-16",
            dragging
              ? "border-primary/60 bg-primary/[0.07]"
              : "border-white/15 hover:border-primary/40 hover:bg-white/[0.03]",
          )}
        >
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
            <CloudUpload className="h-7 w-7" aria-hidden />
          </span>
          <p className="mt-4 text-base font-semibold">Drag & drop your lab report here</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            or click to browse — PDF reports only, up to 20 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const pickedFile = e.target.files?.[0] ?? null;
              handleFileSelection(pickedFile);
            }}
          />
        </div>
      </GlassCard>

      {/* Document Pipeline & Extraction Results Card */}
      {hasVaultOrUpload && (
        <GlassCard>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-primary">
                <FileText className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {file?.name || (uploadedPath ? uploadedPath.split("/").pop() : "Report Document")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · ` : ""}
                  {uploading
                    ? "Uploading to private storage…"
                    : uploadedPath
                      ? "Stored in private vault"
                      : uploadError
                        ? "Upload error"
                        : "Ready"}
                </p>
              </div>
            </div>

            {/* Clear Status Badges */}
            <div>
              {extractedData && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Extraction successful</span>
                </div>
              )}
              {extractionError && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-alert/30 bg-alert/10 px-3 py-1 text-xs font-semibold text-alert">
                  <AlertCircle className="h-4 w-4" />
                  <span>Extraction failed</span>
                </div>
              )}
              {extracting && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Extracting with Gemini…</span>
                </div>
              )}
            </div>
          </div>

          <ol className="mt-5 space-y-3">
            {pipelineStages.map((stage) => {
              return (
                <li key={stage.title} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0">
                      {stage.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-stable" />
                      ) : stage.status === "active" ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : stage.status === "error" ? (
                        <AlertCircle className="h-5 w-5 text-alert" />
                      ) : (
                        <span className="block h-5 w-5 rounded-full border border-white/15" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate font-medium",
                          stage.status === "pending_pipeline" || stage.status === "idle"
                            ? "text-muted-foreground"
                            : "text-foreground",
                        )}
                      >
                        {stage.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{stage.description}</p>
                    </div>
                  </div>

                  {stage.status === "pending_pipeline" && (
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Pipeline pending
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500"
              style={{
                width: uploadError
                  ? "10%"
                  : uploading
                    ? "25%"
                    : extracting
                      ? "65%"
                      : extractedData
                        ? "100%"
                        : uploadedPath
                          ? "50%"
                          : "0%",
              }}
            />
          </div>

          {uploadedPath && (
            <div className="mt-5 flex flex-wrap items-start gap-3 rounded-2xl border border-stable/25 bg-stable/[0.07] p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-stable" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  PDF verified in private storage vault
                </p>
                <p className="text-xs text-muted-foreground break-all">
                  Vault Path: <span className="font-mono text-foreground/80">{uploadedPath}</span>
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Bucket: lab-reports
                  </span>
                  {extracting ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Gemini extraction in progress…
                    </span>
                  ) : extractedData ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                      <Sparkles className="h-3 w-3" />
                      Extracted {extractedData.laboratory_results.length} tests
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                      Extraction pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {extracting && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Analyzing document with Gemini AI…
                </p>
                <p className="text-xs text-muted-foreground">
                  Reading PDF tables, clinical markers, reference intervals, and report date.
                </p>
              </div>
            </div>
          )}

          {/* Failure state with explicit error details - strictly NO mock fallback */}
          {extractionError && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-alert/25 bg-alert/[0.07] p-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-alert" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-alert">Extraction failed</p>
                    <span className="rounded-full border border-alert/30 bg-alert/20 px-2 py-0.5 text-[10px] font-semibold text-alert">
                      No mock substitution
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground break-words">
                    {extractionError}
                  </p>
                </div>
              </div>
              {uploadedPath && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerExtraction(uploadedPath)}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Retry Extraction
                </Button>
              )}
            </div>
          )}

          {/* ACTUAL Gemini Extraction Results Display */}
          {extractedData && (
            <div className="mt-5 space-y-4 rounded-2xl border border-primary/25 bg-primary/[0.03] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary">
                    <FlaskConical className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">
                        Actual Gemini Extraction Results
                      </p>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        Extraction successful
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Structured biomarkers parsed directly from the uploaded PDF document
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Extracted Report Date */}
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-foreground/90 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>Report Date:</span>
                    <span className="font-semibold text-foreground">
                      {extractedData.report_date || "Not detected"}
                    </span>
                  </div>
                  <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                    {extractedData.laboratory_results.length} parameters extracted
                  </span>
                </div>
              </div>

              {/* Informative stage notice: no database rows inserted */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Schema Safeguard Active:</span> Raw
                PDF extraction verified. In strict compliance with guidelines, no rows have been
                inserted into <code className="font-mono text-primary">reports</code>,{" "}
                <code className="font-mono text-primary">lab_results</code>,{" "}
                <code className="font-mono text-primary">analysis</code>, or{" "}
                <code className="font-mono text-primary">anomalies</code>.
              </div>

              {/* Extracted Laboratory Results Table: exactly displays Test name, Standardized name, Value, Unit, Reference min, Reference max */}
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-muted-foreground">
                      <th className="px-3 py-2.5 font-semibold">Test Name</th>
                      <th className="px-3 py-2.5 font-semibold">Standardized Name</th>
                      <th className="px-3 py-2.5 font-semibold">Value</th>
                      <th className="px-3 py-2.5 font-semibold">Unit</th>
                      <th className="px-3 py-2.5 font-semibold">Reference Min</th>
                      <th className="px-3 py-2.5 font-semibold">Reference Max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {extractedData.laboratory_results.map((result, idx) => {
                      return (
                        <tr
                          key={`${result.standardized_name}-${idx}`}
                          className="hover:bg-white/[0.02]"
                        >
                          {/* Test name */}
                          <td className="px-3 py-2 font-medium text-foreground">
                            {result.test_name}
                          </td>
                          {/* Standardized name */}
                          <td className="px-3 py-2">
                            <span className="font-mono text-[11px] text-primary/90">
                              {result.standardized_name}
                            </span>
                          </td>
                          {/* Value */}
                          <td className="px-3 py-2 font-semibold text-foreground font-mono">
                            {result.value !== null ? result.value : "—"}
                          </td>
                          {/* Unit */}
                          <td className="px-3 py-2 text-muted-foreground font-mono">
                            {result.unit || "—"}
                          </td>
                          {/* Reference minimum */}
                          <td className="px-3 py-2 text-muted-foreground font-mono">
                            {result.reference_min !== null ? result.reference_min : "—"}
                          </td>
                          {/* Reference maximum */}
                          <td className="px-3 py-2 text-muted-foreground font-mono">
                            {result.reference_max !== null ? result.reference_max : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Strict JSON Output Inspector */}
              <div className="pt-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowJsonInspector((prev) => !prev)}
                    className="gap-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Code className="h-3.5 w-3.5" />
                    {showJsonInspector ? "Hide Strict JSON Output" : "Inspect Strict JSON Output"}
                    {showJsonInspector ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>

                  {showJsonInspector && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyJsonToClipboard}
                      className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedJson ? "Copied" : "Copy JSON"}
                    </Button>
                  )}
                </div>

                {showJsonInspector && (
                  <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {JSON.stringify(extractedData, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {uploadError && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-alert/25 bg-alert/[0.07] p-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-alert" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-alert">Upload failed</p>
                  <p className="mt-0.5 text-xs text-muted-foreground break-words">{uploadError}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                className="text-xs font-semibold"
              >
                Try Again
              </Button>
            </div>
          )}
        </GlassCard>
      )}

      <GlassCard className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">Private Vault Security</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            All uploaded reports are stored in your private storage vault (
            <code className="font-mono text-xs text-foreground/80">lab-reports</code>) inside your
            authenticated user UUID path. Access is strictly protected by row-level security
            policies.
          </p>
        </div>
      </GlassCard>

      <MedicalDisclaimer />
    </div>
  );
}
