import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function JobStatusPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Status</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{id}</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Generation Details</CardTitle>
          <Badge variant="pending">pending</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Job details will appear here once the backend is connected.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
