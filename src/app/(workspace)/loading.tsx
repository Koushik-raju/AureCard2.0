import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-5 w-72" />
      <div className="mt-10 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <div className="mt-10 space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}