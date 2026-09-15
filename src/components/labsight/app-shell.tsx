import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ChevronLeft,
  FileText,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Settings,
  Upload,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEMO_USER, getUser, signOut, supabaseSignOut } from "@/lib/mock-auth";
import { toast } from "sonner";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload Report", icon: Upload },
  { to: "/reports", label: "My Reports", icon: FileText },
  { to: "/analysis", label: "AI Analysis", icon: Gauge },
  { to: "/trends", label: "Lab Trends", icon: LineChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
        <FlaskConical className="h-5 w-5" aria-hidden />
      </span>
      {!compact && (
        <span className="truncate font-display text-base font-bold tracking-tight">
          LABSIGHT <span className="text-primary">AI</span>
        </span>
      )}
    </span>
  );
}

function NavLinks({ onNavigate, collapsed }: { onNavigate?: (() => void) | undefined; collapsed?: boolean | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || pathname.startsWith(`${to}/`);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  collapsed,
  onNavigate,
  onToggle,
}: {
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
  onToggle?: (() => void) | undefined;
}) {
  const navigate = useNavigate();
  const user = getUser() ?? DEMO_USER;

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/" onClick={onNavigate}>
          <BrandMark compact={collapsed} />
        </Link>
        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground lg:block"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      <NavLinks onNavigate={onNavigate} collapsed={collapsed} />

      <div className="mt-auto space-y-3">
        {!collapsed && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        )}
        <button
          onClick={async () => {
            await supabaseSignOut();
            signOut();
            toast.success("Signed out");
            navigate({ to: "/" });
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
          {!collapsed && "Log out"}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="ambient-glow min-h-screen">
      <div className="flex">
        <aside
          className={cn(
            "glass sticky top-0 hidden h-screen shrink-0 rounded-none border-y-0 border-l-0 transition-[width] duration-300 lg:block",
            collapsed ? "w-[84px]" : "w-[264px]",
          )}
        >
          <SidebarBody collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="glass sticky top-0 z-30 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="glass-strong w-[272px] p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarBody collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <BrandMark />
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <Activity className="h-3 w-3" /> Demo
            </span>
          </header>

          <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
