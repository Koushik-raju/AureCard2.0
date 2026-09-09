import { ReactNode } from "react";

type SectionPlaceholderProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
};

export function SectionPlaceholder({
  title,
  description,
  icon,
}: SectionPlaceholderProps) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <div className="flex items-center gap-3 text-primary">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Coming in a later phase
        </span>
      </div>
      <h1 className="mt-6 font-serif text-3xl font-medium tracking-tight sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
