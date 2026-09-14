import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CloudUpload, FileText, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/labsight/glass-card";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/upload")({
  head: () => ({
    meta: [
      { title: "Upload Report — LABSIGHT AI" },
      {
        name: "description",
        content:
          "Upload a PDF, CSV or TXT lab report and LABSIGHT AI extracts values, compares history and analyzes patterns.",
      },
      { property: "og:title", content: "Upload Report — LABSIGHT AI" },
      {
        property: "og:description",
        content: "Upload a lab report to extract values and compare it against your history.",
      },
    ],
  }),
  component: UploadPage,
});

const STEPS = [
  "Uploading…",
  "Extracting laboratory values…",
  "Comparing historical results…",
  "Analyzing patterns…",
];

function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [step, setStep] = useState(-1);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function start(name: string) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFileName(name);
    setDone(false);
    setStep(0);
    STEPS.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => setStep(i + 1), (i + 1) * 1100),
      );
    });
    timers.current.push(
      setTimeout(() => {
        setDone(true);
        toast.success("Report ready for analysis", {
          description: "5 patterns detected across your reports.",
        });
      }, STEPS.length * 1100),
    );
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const ok = /\.(pdf|csv|txt)$/i.test(file.name);
    if (!ok) {
      toast.error("Unsupported file", { description: "Upload a PDF, CSV or TXT report." });
      return;
    }
    start(file.name);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Upload Report</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Add a new lab report and LABSIGHT AI will compare it against your history.
        </p>
      </header>

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
            handleFiles(e.dataTransfer.files);
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
            or click to browse — PDF, CSV or TXT, up to 20 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.csv,.txt"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </GlassCard>

      {fileName && (
        <GlassCard>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-primary">
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                {done ? "Processing complete" : "Processing…"}
              </p>
            </div>
          </div>

          <ol className="mt-5 space-y-3">
            {STEPS.map((label, i) => {
              const state = step > i ? "done" : step === i ? "active" : "idle";
              return (
                <li key={label} className="flex items-center gap-3">
                  <span className="shrink-0">
                    {state === "done" ? (
                      <CheckCircle2 className="h-5 w-5 text-stable" />
                    ) : state === "active" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <span className="block h-5 w-5 rounded-full border border-white/15" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      state === "idle" ? "text-muted-foreground" : "font-medium text-foreground",
                    )}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-700"
              style={{ width: `${Math.min(100, (Math.max(step, 0) / STEPS.length) * 100)}%` }}
            />
          </div>

          {done && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-stable/25 bg-stable/[0.07] p-4">
              <Sparkles className="h-5 w-5 shrink-0 text-stable" aria-hidden />
              <p className="min-w-0 flex-1 text-sm font-semibold">Report ready for analysis</p>
              <Button asChild className="font-semibold">
                <Link to="/analysis">View Analysis</Link>
              </Button>
            </div>
          )}
        </GlassCard>
      )}

      <GlassCard className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Files stay in this demo session only. Nothing is transmitted to a server and no report is
          stored beyond your browser.
        </p>
      </GlassCard>

      <MedicalDisclaimer />
    </div>
  );
}
