import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div className="mx-auto w-full max-w-sm px-6 py-16 sm:py-24">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-4 h-10 w-full rounded-lg" />
      <Skeleton className="mt-3 h-10 w-full rounded-lg" />
      <Skeleton className="mt-6 h-9 w-28" />
    </div>
  );
}