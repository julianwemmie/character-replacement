import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Download } from "lucide-react";

export function VideoPage() {
  const { videoId } = useParams<{ videoId: string }>();

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="aspect-video rounded-lg border bg-muted flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Video player — {videoId || "loading..."}
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <h2 className="text-lg font-semibold">Generated Video</h2>
            <p className="text-sm text-muted-foreground">
              Created with Character Replacement AI
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
