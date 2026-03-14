import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">View and manage your generations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Generations</CardTitle>
          <CardDescription>Past and in-progress character replacements.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No generations yet. Create one from the home page.</p>
        </CardContent>
      </Card>
    </div>
  );
}
