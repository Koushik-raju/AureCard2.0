"use client";

import { cn } from "@/lib/utils";

export type ResponsiveTab = {
  value: string;
  label: string;
};

type ResponsiveTabsProps = {
  tabs: ResponsiveTab[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
};

export function ResponsiveTabs({
  tabs,
  value,
  onChange,
  ariaLabel = "Sections",
  className,
}: ResponsiveTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0",
        className
      )}
    >
      <div className="flex min-w-max gap-1 rounded-lg bg-muted p-1 sm:min-w-0 sm:flex-wrap">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => onChange(tab.value)}
              className={cn(
                "min-h-11 flex-1 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors",
                "sm:min-h-9 sm:flex-none",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
