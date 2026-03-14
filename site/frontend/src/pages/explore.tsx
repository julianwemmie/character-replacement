import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ExplorePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Explore</h1>
        <p className="mt-1 text-muted-foreground">Browse public character replacement videos.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-base">Sample Video {i + 1}</CardTitle>
              <CardDescription>Placeholder</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex aspect-video items-center justify-center rounded-md bg-muted">
                <p className="text-xs text-muted-foreground">Preview</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
