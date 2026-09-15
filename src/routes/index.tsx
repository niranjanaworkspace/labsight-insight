import { createFileRoute, Link } from "@tanstack/react-router";
import { enterDemoMode } from "@/lib/mock-auth";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Eye,
  FileSearch,
  GitCompareArrows,
  Lightbulb,
  Lock,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { GlassCard, SectionHeading } from "@/components/labsight/glass-card";
import { StatusBadge } from "@/components/labsight/status-badge";
import { TrendChart } from "@/components/labsight/trend-chart";
import { MedicalDisclaimer } from "@/components/labsight/disclaimer";
import { BrandMark } from "@/components/labsight/app-shell";
import { findings } from "@/lib/labsight-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LABSIGHT AI — See the change, not just the number" },
      {
        name: "description",
        content:
          "LABSIGHT AI compares your lab reports over time, detects patterns and significant changes, and explains what to review with your doctor.",
      },
      { property: "og:title", content: "LABSIGHT AI — See the change, not just the number" },
      {
        property: "og:description",
        content:
          "Compare lab reports across time, detect patterns and significant changes, and know what to discuss with a healthcare professional.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: ScanLine,
    title: "Detect",
    body: "Values are extracted from every report and matched to the parameter they belong to, whichever lab produced them.",
  },
  {
    icon: GitCompareArrows,
    title: "Compare",
    body: "Each result is placed next to its own history so movement across months becomes visible, not just today's number.",
  },
  {
    icon: Lightbulb,
    title: "Understand",
    body: "Every flagged pattern comes with a plain-language reason, a confidence level and what to review with a professional.",
  },
];

const COMPARISON = [
  ["A single report read in isolation", "Every report read against your own history"],
  ["Values marked only high or low", "Direction, magnitude and rate of change"],
  ["Slow drifts inside range go unnoticed", "Gradual patterns surfaced before they cross a limit"],
  ["Dense terminology, little context", "Plain-language reasons for every flag"],
  ["Manual comparison across PDFs", "Automatic timeline across all uploads"],
];

const STEPS = [
  {
    icon: Upload,
    title: "Upload your reports",
    body: "Add PDF, CSV or TXT lab reports from any laboratory.",
  },
  {
    icon: FileSearch,
    title: "Values extracted",
    body: "Parameters, units and reference ranges are read from each report.",
  },
  {
    icon: GitCompareArrows,
    title: "History compared",
    body: "Each parameter is aligned across every date you've uploaded.",
  },
  {
    icon: Sparkles,
    title: "Patterns detected",
    body: "Directional movement and significant changes are identified.",
  },
  {
    icon: Eye,
    title: "Review with your doctor",
    body: "Take a clear summary into your next appointment.",
  },
];

function Landing() {
  return (
    <div className="ambient-glow min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link to="/">
          <BrandMark />
        </Link>
        <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {/* Hero */}
        <section className="grid gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Clinical decision support, not diagnosis
            </span>
            <h1 className="mt-5 font-display text-4xl leading-[1.05] font-bold sm:text-5xl lg:text-6xl">
              See the change,
              <br />
              <span className="text-gradient">not just the number.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              LABSIGHT AI lines up every lab report you've ever had, tracks how each parameter moves
              over time, and highlights the patterns worth reviewing with a qualified healthcare
              professional.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Analyze My Reports <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/dashboard"
                onClick={enterDemoMode}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold transition-colors hover:border-primary/35 hover:bg-white/[0.07]"
              >
                Explore Demo
              </Link>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              No diagnostic claims · Patterns and changes only · Your data stays yours
            </p>
          </div>

          <GlassCard strong className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Live preview
                </p>
                <p className="truncate text-sm font-bold">TSH & Hemoglobin timeline</p>
              </div>
              <StatusBadge status="significant" />
            </div>
            <div className="mt-4">
              <TrendChart keys={["tsh", "hemoglobin"]} height={230} area />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {findings.slice(0, 2).map((f) => (
                <div key={f.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    {f.parameter}
                    <ArrowUpRight className="h-3 w-3 text-primary" />
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">{f.changeLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{f.headline}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        {/* Features */}
        <section className="py-12">
          <SectionHeading
            eyebrow="How LABSIGHT reads your labs"
            title="Detect. Compare. Understand."
            description="Three steps that turn a stack of reports into one readable story."
          />
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <GlassCard key={title} hover>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section className="py-12">
          <SectionHeading
            eyebrow="The difference"
            title="Traditional reports vs LABSIGHT AI"
            description="Same values. A completely different amount of context."
          />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <GlassCard className="border-white/10">
              <h3 className="text-base font-bold text-muted-foreground">Traditional lab report</h3>
              <ul className="mt-4 space-y-3">
                {COMPARISON.map(([left]) => (
                  <li key={left} className="flex gap-3 text-sm text-muted-foreground">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden />
                    {left}
                  </li>
                ))}
              </ul>
            </GlassCard>
            <GlassCard hover className="border-primary/25">
              <h3 className="text-base font-bold">
                LABSIGHT <span className="text-primary">AI</span>
              </h3>
              <ul className="mt-4 space-y-3">
                {COMPARISON.map(([, right]) => (
                  <li key={right} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-stable" aria-hidden />
                    {right}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>
        </section>

        {/* How it works */}
        <section className="py-12">
          <SectionHeading
            eyebrow="How it works"
            title="From upload to conversation in five steps"
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <GlassCard key={title} hover className="p-5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-xs font-bold text-primary">0{i + 1}</span>
                  <Icon className="h-4 w-4 text-accent" aria-hidden />
                </div>
                <h3 className="mt-3 text-sm font-bold">{title}</h3>
                <p className="mt-1.5 text-xs text-muted-foreground">{body}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section className="py-12">
          <GlassCard strong className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <SectionHeading
                eyebrow="Privacy"
                title="Your lab history stays private"
                description="Health data deserves stricter handling than most software gives it."
              />
            </div>
            <ul className="space-y-4">
              {[
                {
                  icon: Lock,
                  text: "Reports are processed for your account only and never sold or shared.",
                },
                {
                  icon: ShieldCheck,
                  text: "Encrypted in transit and at rest, with access limited to you.",
                },
                {
                  icon: Eye,
                  text: "Export or delete your full history at any time from Settings.",
                },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-sm">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 pt-2 text-muted-foreground">{text}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </section>

        <section className="py-6">
          <MedicalDisclaimer />
        </section>

        <section className="py-12">
          <GlassCard strong className="text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Ready to see your own timeline?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Load the demo dataset and explore three reports, 24 parameters and five detected
              patterns.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Analyze My Reports <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/dashboard"
                onClick={enterDemoMode}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold transition-colors hover:border-primary/35"
              >
                Explore Demo
              </Link>
            </div>
          </GlassCard>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <BrandMark />
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Pattern detection across your lab history. Clinical decision support — never a
              diagnosis.
            </p>
          </div>
          <div>
            <p className="text-sm font-bold">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/dashboard" className="hover:text-foreground">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/trends" className="hover:text-foreground">
                  Lab Trends
                </Link>
              </li>
              <li>
                <Link to="/analysis" className="hover:text-foreground">
                  AI Analysis
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold">Account</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/login" className="hover:text-foreground">
                  Log in
                </Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-foreground">
                  Create account
                </Link>
              </li>
              <li>
                <Link to="/settings" className="hover:text-foreground">
                  Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">
          © 2026 LABSIGHT AI · Not a diagnostic device. Always discuss results with a qualified
          healthcare professional.
        </div>
      </footer>
    </div>
  );
}
