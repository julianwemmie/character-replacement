import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Film, Image } from "lucide-react";
import type { JobMode } from "@character-replacement/shared";

export function UploadPage() {
  const [mode, setMode] = useState<JobMode>("replace");

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Create New Video
          </CardTitle>
          <CardDescription>
            Upload a source video and a target character image to generate a new video.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Film className="h-4 w-4" />
              Source Video
            </label>
            <Input type="file" accept="video/*" disabled />
            <p className="text-xs text-muted-foreground">MP4, MOV, or WebM. Max 100MB.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Image className="h-4 w-4" />
              Target Character Image
            </label>
            <Input type="file" accept="image/*" disabled />
            <p className="text-xs text-muted-foreground">PNG or JPG. Clear front-facing photo works best.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mode</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="replace"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                  className="accent-primary"
                />
                <span className="text-sm">Replace Character</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="animate"
                  checked={mode === "animate"}
                  onChange={() => setMode("animate")}
                  className="accent-primary"
                />
                <span className="text-sm">Animate Image</span>
              </label>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button disabled className="w-full gap-2">
            <Upload className="h-4 w-4" />
            Generate Video
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
