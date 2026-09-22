"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AuthError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 py-20 text-center">
      <h2 className="font-serif text-2xl font-medium tracking-tight">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-prose text-[15px] text-muted-foreground">
        We couldn&apos;t load this page. Try again.
      </p>
      <Button type="button" onClick={retry} className="mt-6">
        Try again
      </Button>
    </div>
  );
}