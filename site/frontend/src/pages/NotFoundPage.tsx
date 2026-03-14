import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion, Home, Upload } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <FileQuestion className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Page Not Found</h1>
          <p className="text-sm text-muted-foreground text-center">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="flex gap-3 mt-2">
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <Link to="/upload">
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Create Video
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
