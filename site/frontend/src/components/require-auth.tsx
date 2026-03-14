import { Navigate } from "react-router-dom";
import { useSession } from "@/lib/auth-client";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex items-center justify-center pt-20">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session?.user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
