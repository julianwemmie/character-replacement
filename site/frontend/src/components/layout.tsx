import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "@/lib/auth-client";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/dashboard", label: "Dashboard" },
];

export function Layout() {
  const { pathname } = useLocation();
  const { data: session } = useSession();
  const user = session?.user;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="text-lg font-bold text-foreground">
            Character Replacement
          </Link>

          <nav className="flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <Button
                key={to}
                variant="ghost"
                size="sm"
                asChild
                className={cn(pathname === to && "bg-accent")}
              >
                <Link to={to}>{label}</Link>
              </Button>
            ))}

            {user ? (
              <div className="ml-2 flex items-center gap-2">
                {user.image && (
                  <img
                    src={user.image}
                    alt={user.name ?? ""}
                    className="h-7 w-7 rounded-full"
                  />
                )}
                <span className="text-sm font-medium">
                  {user.name ?? user.email}
                </span>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign out
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" asChild className="ml-2">
                <Link to="/login">Log in</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        Character Replacement &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
