import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WorkspaceNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 py-20 text-center">
      <h2 className="font-serif text-2xl font-medium tracking-tight">
        Not found
      </h2>
      <p className="mt-2 max-w-prose text-[15px] text-muted-foreground">
        This space, project, task, or document doesn&apos;t exist — or is no
        longer available.
      </p>
      <Button asChild className="mt-6">
        <Link href="/home">Back to home</Link>
      </Button>
    </div>
  );
}