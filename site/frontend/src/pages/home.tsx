import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function HomePage() {
  return (
    <div className="flex flex-col items-center gap-8 pt-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Replace Characters in Video</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Upload a video and a reference image to swap characters using AI.
        </p>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>New Generation</CardTitle>
          <CardDescription>Upload your source video and reference image to get started.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Source Video</label>
            <Input type="file" accept="video/*" disabled />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Reference Image</label>
            <Input type="file" accept="image/*" disabled />
          </div>
          <Button disabled className="mt-2">
            Generate
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Upload functionality will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
