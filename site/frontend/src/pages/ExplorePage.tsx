import { Card, CardContent } from "@/components/ui/card";
import { Compass } from "lucide-react";

function SkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-muted animate-pulse" />
      <CardContent className="p-4 space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

export function ExplorePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Compass className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Explore</h1>
      </div>
      <p className="text-muted-foreground">
        Discover videos created by the community.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
