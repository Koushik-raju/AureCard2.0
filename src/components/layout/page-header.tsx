import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  filters,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-6 sm:mb-8", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {filters ? (
        <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1">{filters}</div>
      ) : null}
    </header>
  );
}
