export type AccentKey = "orange" | "amber" | "olive" | "clay" | "sage" | "ink";

const ACCENTS: Record<AccentKey, { dot: string; ring: string; text: string }> = {
  orange: {
    dot: "bg-[oklch(0.65_0.145_40)]",
    ring: "group-hover:ring-[oklch(0.65_0.145_40)]",
    text: "text-[oklch(0.52_0.12_40)]",
  },
  amber: {
    dot: "bg-[oklch(0.75_0.13_70)]",
    ring: "group-hover:ring-[oklch(0.75_0.13_70)]",
    text: "text-[oklch(0.55_0.12_70)]",
  },
  olive: {
    dot: "bg-[oklch(0.6_0.09_100)]",
    ring: "group-hover:ring-[oklch(0.6_0.09_100)]",
    text: "text-[oklch(0.48_0.07_100)]",
  },
  clay: {
    dot: "bg-[oklch(0.6_0.1_45)]",
    ring: "group-hover:ring-[oklch(0.6_0.1_45)]",
    text: "text-[oklch(0.48_0.09_45)]",
  },
  sage: {
    dot: "bg-[oklch(0.6_0.06_150)]",
    ring: "group-hover:ring-[oklch(0.6_0.06_150)]",
    text: "text-[oklch(0.45_0.05_150)]",
  },
  ink: {
    dot: "bg-[oklch(0.35_0.02_50)]",
    ring: "group-hover:ring-[oklch(0.35_0.02_50)]",
    text: "text-[oklch(0.35_0.02_50)]",
  },
};

export function accentStyles(accent: AccentKey) {
  return ACCENTS[accent] ?? ACCENTS.ink;
}
