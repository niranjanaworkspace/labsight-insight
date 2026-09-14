import { cn } from "@/lib/utils";
import { statusLabel, type Status } from "@/lib/labsight-data";
import { CheckCircle2, AlertTriangle, ActivitySquare } from "lucide-react";

const styles: Record<Status, string> = {
  stable: "bg-stable/12 text-stable border-stable/30",
  review: "bg-review/12 text-review border-review/30",
  significant: "bg-alert/12 text-alert border-alert/35",
};

const icons: Record<Status, typeof CheckCircle2> = {
  stable: CheckCircle2,
  review: AlertTriangle,
  significant: ActivitySquare,
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: Status;
  label?: string;
  className?: string;
}) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        styles[status],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label ?? statusLabel[status]}
    </span>
  );
}
