import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  hover = false,
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        hover && "glass-hover",
        "rounded-2xl p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      {description ? (
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{description}</p>
      ) : null}
    </div>
  );
}
