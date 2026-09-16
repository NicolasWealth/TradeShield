import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  Boxes,
  GaugeCircle,
  LogOut,
  Network,
  ScrollText,
  Settings,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useResolvedDataSource } from "@/hooks/useTraceData";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Control Room", icon: GaugeCircle },
  { to: "/batches", label: "Batches", icon: Boxes },
  { to: "/supply-chain", label: "Supply Chain", icon: Network },
  { to: "/incidents", label: "Incidents", icon: Siren },
  { to: "/verification", label: "Verification", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const { user, ready, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const dataSource = useResolvedDataSource();

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex items-center gap-2 border-b border-border px-5 py-5">
          <ShieldCheck className="size-5 text-primary" />
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold tracking-wide text-foreground">
              TraceShield
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Recall Intelligence
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <item.icon className={cn("size-4", active ? "text-primary" : "text-mist-500")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2">
            <ScrollText className="size-4 text-mist-500" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs text-foreground">{user?.displayName ?? "—"}</p>
              <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {dataSource === "firestore" ? "Firestore" : "Demo data"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              onClick={() => {
                signOut();
                navigate({ to: "/login" });
              }}
              className="text-mist-500 transition-colors hover:text-destructive"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4 md:px-8">
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex-1 px-5 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
