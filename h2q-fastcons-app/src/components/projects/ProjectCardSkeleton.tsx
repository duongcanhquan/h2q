import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectCardSkeleton() {
  return (
    <Card aria-busy="true">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  );
}

export function ProjectGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="space-y-3" aria-label="Đang tải danh sách dự án">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <ProjectCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
