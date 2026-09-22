import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ContentWrap({
  children,
  wide = false,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 sm:py-8",
        wide ? "max-w-7xl" : "max-w-5xl",
        className
      )}
    >
      {children}
    </div>
  );
}
