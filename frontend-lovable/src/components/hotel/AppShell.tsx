import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, BedDouble, Users, CalendarCheck, Menu, X } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/rooms", label: "Rooms", icon: BedDouble },
  { to: "/guests", label: "Guests", icon: Users },
  { to: "/reservations", label: "Reservations", icon: CalendarCheck },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {nav.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: to === "/" }}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "!bg-sidebar-accent !text-sidebar-primary" }}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-brass font-display grid size-9 place-items-center rounded-md text-lg font-bold text-accent-foreground">
        H
      </div>
      <div className="leading-tight">
        <p className="font-display text-xl font-semibold text-sidebar-accent-foreground">Haven Grand</p>
        <p className="text-[10px] uppercase tracking-[0.25em] text-sidebar-foreground/60">Operations</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-sidebar p-5 lg:flex">
        <Brand />
        <div className="mt-10">
          <NavLinks />
        </div>
        <div className="mt-auto rounded-md border border-sidebar-border p-3 text-[11px] text-sidebar-foreground/60">
          Connected to
          <p className="mt-0.5 truncate font-mono text-sidebar-foreground/80">{API_BASE_URL.replace(/^https?:\/\//, "")}</p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <Brand />
        <button
          aria-label="Toggle menu"
          className="rounded-md p-2 text-sidebar-foreground"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      <div className={cn("bg-sidebar px-4 pb-4 lg:hidden", open ? "block" : "hidden")}>
        <NavLinks onNavigate={() => setOpen(false)} />
      </div>

      <main className="px-4 py-8 sm:px-8 lg:ml-64 lg:px-12 lg:py-12">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
