import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Not Found - Character Replacement";
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 pt-20 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-lg text-muted-foreground">
        The page you're looking for doesn't exist.
      </p>
      <Button asChild className="mt-4">
        <Link to="/">Go Home</Link>
      </Button>
    </div>
  );
}
