import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function VideoViewerPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-col items-center gap-6 pt-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Video {id}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex aspect-video items-center justify-center rounded-md bg-muted">
            <p className="text-sm text-muted-foreground">Video player placeholder</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
