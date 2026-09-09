import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h2 className="font-serif text-3xl font-medium tracking-tight">
        Page not found
      </h2>
      <p className="mt-2 max-w-prose text-[15px] text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Button asChild className="mt-6">
        <Link href="/home">Back to home</Link>
      </Button>
    </div>
  );
}