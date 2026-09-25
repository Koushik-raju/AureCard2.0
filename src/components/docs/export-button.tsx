"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExportPayload = {
  exportedAt: string;
  spaces: unknown[];
  projects: unknown[];
  tasks: unknown[];
  documents: unknown[];
};

/** Downloads the whole workspace library as JSON. Takes plain data only. */
export function ExportLibraryButton({ data }: { data: ExportPayload }) {
  const [done, setDone] = useState(false);

  function run() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `aure-export-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDone(true);
    window.setTimeout(() => setDone(false), 2500);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={run} aria-label="Export library as JSON">
      <Download className="size-4" />
      {done ? "Exported" : "Export JSON"}
    </Button>
  );
}
