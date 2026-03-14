import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/dashboard", label: "Dashboard" },
];

export function Layout() {
  const { pathname } = useLocation();

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
            <Button variant="outline" size="sm" asChild className="ml-2">
              <Link to="/login">Log in</Link>
            </Button>
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
