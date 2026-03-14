import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export function JobStatusPage() {
  const { jobId } = useParams<{ jobId: string }>();

  // Placeholder - will be replaced with real data fetching
  const status: string = "preprocessing";
  const progress = 35;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Job Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Job ID</span>
              <p className="font-mono">{jobId || "---"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="flex items-center gap-1 capitalize">
                {status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {status === "failed" && <XCircle className="h-4 w-4 text-red-500" />}
                {status}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-6 aspect-video rounded-lg border bg-muted flex items-center justify-center">
            <p className="text-muted-foreground text-sm">
              Video preview will appear here when processing is complete.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
