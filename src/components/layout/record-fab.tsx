"use client";

import Link from "next/link";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RecordFab({ className }: { className?: string }) {
  return (
    <Button
      asChild
      size="lg"
      aria-label="Record a note"
      className={cn(
        "fixed bottom-6 right-6 z-40 size-14 rounded-full shadow-lg",
        "sm:bottom-8 sm:right-8",
        className
      )}
    >
      <Link href="/record">
        <Mic className="size-6" />
        <span className="sr-only">Record</span>
      </Link>
    </Button>
  );
}
