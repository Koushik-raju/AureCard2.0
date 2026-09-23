"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PREF_KEYS, readJson, writeJson } from "@/lib/prefs";
import { cn } from "@/lib/utils";

type Plan = "free" | "pro";

const PLANS: { value: Plan; name: string; price: string; blurb: string; features: string[] }[] = [
  {
    value: "free",
    name: "Starter",
    price: "$0",
    blurb: "For personal capture and everyday planning.",
    features: ["Unlimited spaces & tasks", "In-browser recording", "Library & Atlas Assistant", "7-day insights"],
  },
  {
    value: "pro",
    name: "Pro",
    price: "$12 / month",
    blurb: "For teams, clinics and power capturers.",
    features: ["Everything in Starter", "Organization digests", "Longer recordings (Storage)", "Priority transcription languages"],
  },
];

function loadPlan(): Plan {
  const raw = readJson<{ plan: Plan }>(PREF_KEYS.plan, { plan: "free" });
  return raw.plan === "pro" ? "pro" : "free";
}

export function PlanManager() {
  const [plan, setPlan] = useState<Plan>(loadPlan);
  const [confirming, setConfirming] = useState<Plan | null>(null);

  function choose(next: Plan) {
    setPlan(next);
    writeJson(PREF_KEYS.plan, { plan: next });
    setConfirming(null);
  }

  return (
    <div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {PLANS.map((p) => {
          const current = plan === p.value;
          return (
            <article
              key={p.value}
              className={cn(
                "rounded-xl border bg-card p-6",
                current ? "border-primary" : "border-border"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif text-xl font-medium tracking-tight">{p.name}</h2>
                {current && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    <Check className="size-3.5" /> Current
                  </span>
                )}
              </div>
              <p className="mt-1 text-2xl font-medium">{p.price}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
              <ul className="mt-4 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              {current ? null : confirming === p.value ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => choose(p.value)} className="min-h-11">
                    Confirm switch
                  </Button>
                  <Button variant="outline" onClick={() => setConfirming(null)} className="min-h-11">
                    Keep {plan === "pro" ? "Pro" : "Starter"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setConfirming(p.value)}
                  className="mt-4 min-h-11"
                >
                  Switch to {p.name}
                </Button>
              )}
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Plan changes apply instantly to this workspace. Card and device
        entitlements, invoices and seat management are handled through your
        billing portal once checkout is connected.
      </p>
    </div>
  );
}
