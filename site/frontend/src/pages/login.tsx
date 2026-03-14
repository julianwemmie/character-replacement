import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginPage() {
  return (
    <div className="flex items-center justify-center pt-20">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Sign in to manage your generations.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <Input type="email" placeholder="you@example.com" disabled />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <Input type="password" placeholder="********" disabled />
          </div>
          <Button disabled className="mt-2">
            Sign in
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Authentication will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
