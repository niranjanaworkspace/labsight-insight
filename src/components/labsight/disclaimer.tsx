import { ShieldAlert } from "lucide-react";
import { DISCLAIMER } from "@/lib/labsight-data";
import { cn } from "@/lib/utils";

export function MedicalDisclaimer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "glass flex items-start gap-3 rounded-2xl border-review/25 bg-review/[0.06] p-4 sm:p-5",
        className,
      )}
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-review" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">Medical disclaimer</p>
        <p className="mt-1 text-sm text-muted-foreground">{DISCLAIMER}</p>
      </div>
    </div>
  );
}
