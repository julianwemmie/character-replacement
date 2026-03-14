import { Card, CardContent } from "@/components/ui/card";
import { History, Clock } from "lucide-react";

function JobCard({ index }: { index: number }) {
  const statuses = ["done", "generating", "queued", "failed", "preprocessing"];
  const status = statuses[index % statuses.length];

  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-xs">Thumbnail</span>
      </div>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium capitalize px-2 py-0.5 rounded-full bg-secondary">
            {status}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            2 hours ago
          </span>
        </div>
        <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

export function HistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <History className="h-6 w-6" />
        <h1 className="text-2xl font-bold">My Generations</h1>
      </div>
      <p className="text-muted-foreground">
        View your past video generation jobs.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <JobCard key={i} index={i} />
        ))}
      </div>
    </div>
  );
}
