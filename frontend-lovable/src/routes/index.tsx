import { createFileRoute, Link } from "@tanstack/react-router";
import { BedDouble, DoorOpen, Wrench, Users, CalendarClock, KeyRound, LogIn, LogOut } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard, useReservations } from "@/lib/queries";
import { PageHeader, Panel, ErrorState, StatusBadge, fmtDate, money } from "@/components/hotel/shared";
import type { Reservation } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Haven Grand Hotel" },
      { name: "description", content: "Live occupancy, guests and reservations at Haven Grand Hotel." },
      { property: "og:title", content: "Overview — Haven Grand Hotel" },
      { property: "og:description", content: "Live occupancy, guests and reservations at Haven Grand Hotel." },
    ],
  }),
  component: Dashboard,
});

const today = () => new Date().toLocaleDateString("en-CA");

function Dashboard() {
  const d = useDashboard();
  const r = useReservations();

  const stats = d.data
    ? [
        { label: "Total rooms", value: d.data.total_rooms, icon: BedDouble },
        { label: "Occupied", value: d.data.occupied_rooms, icon: KeyRound },
        { label: "Available", value: d.data.available_rooms, icon: DoorOpen },
        { label: "Maintenance", value: d.data.maintenance_rooms, icon: Wrench },
        { label: "Total guests", value: d.data.total_guests, icon: Users },
        { label: "Upcoming stays", value: d.data.upcoming_reservations, icon: CalendarClock },
      ]
    : [];

  const chart = d.data
    ? [
        { name: "Occupied", value: d.data.occupied_rooms, color: "var(--chart-2)" },
        { name: "Available", value: d.data.available_rooms, color: "var(--chart-1)" },
        { name: "Maintenance", value: d.data.maintenance_rooms, color: "var(--chart-4)" },
      ]
    : [];

  const list = r.data ?? [];
  const active = list.filter((x) => !/cancel/i.test(x.status));
  const t = today();
  const arrivals = active.filter((x) => x.check_in?.slice(0, 10) === t);
  const departures = active.filter((x) => x.check_out?.slice(0, 10) === t);
  const recent = [...list].sort((a, b) => b.id - a.id).slice(0, 6);

  return (
    <>
      <PageHeader eyebrow={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} title="Good day at the Grand" />

      {d.isError ? (
        <ErrorState error={d.error} onRetry={() => d.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel className="bg-sidebar p-6 text-sidebar-foreground lg:row-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-primary">Occupancy</p>
            {d.isLoading ? (
              <Skeleton className="mt-6 h-56 w-full bg-sidebar-accent" />
            ) : (
              <>
                <div className="relative mt-4 h-56">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={chart.every((c) => c.value === 0) ? [{ name: "No rooms", value: 1, color: "var(--sidebar-accent)" }] : chart} dataKey="value" innerRadius={70} outerRadius={95} stroke="none" paddingAngle={2}>
                        {(chart.every((c) => c.value === 0) ? [{ color: "var(--sidebar-accent)" }] : chart).map((c, i) => (
                          <Cell key={i} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <p className="font-display text-5xl font-semibold text-sidebar-accent-foreground">
                        {Math.round(d.data!.occupancy_percentage)}%
                      </p>
                      <p className="text-xs text-sidebar-foreground/60">occupied</p>
                    </div>
                  </div>
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  {chart.map((c) => (
                    <li key={c.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: c.color }} />{c.name}</span>
                      <span className="font-semibold text-sidebar-accent-foreground">{c.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-2">
            {d.isLoading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)
              : stats.map(({ label, value, icon: Icon }) => (
                  <Panel key={label} className="p-5">
                    <Icon className="size-4 text-accent" />
                    <p className="font-display mt-3 text-4xl font-semibold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </Panel>
                ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            <DayList title="Today's check-ins" icon={LogIn} items={arrivals} loading={r.isLoading} />
            <DayList title="Today's check-outs" icon={LogOut} items={departures} loading={r.isLoading} />
          </div>
        </div>
      )}

      <Panel className="mt-6">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-display text-2xl font-semibold">Recent reservations</h2>
          <Link to="/reservations" className="text-sm font-medium text-accent hover:underline">View all</Link>
        </div>
        {r.isError ? (
          <div className="p-6"><ErrorState error={r.error} onRetry={() => r.refetch()} /></div>
        ) : r.isLoading ? (
          <div className="space-y-2 p-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : recent.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">No reservations yet.</p>
        ) : (
          <ul className="divide-y">
            {recent.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 py-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground">#{x.id}</span>
                <span className="min-w-32 flex-1 font-medium">{x.guest?.name ?? `Guest #${x.guest_id ?? "?"}`}</span>
                <span className="text-muted-foreground">{fmtDate(x.check_in)} → {fmtDate(x.check_out)}</span>
                <span className="w-24 text-right">{money(x.total_price)}</span>
                <StatusBadge status={x.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function DayList({ title, icon: Icon, items, loading }: { title: string; icon: typeof LogIn; items: Reservation[]; loading: boolean }) {
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-accent" />{title}<span className="ml-auto text-muted-foreground">{loading ? "…" : items.length}</span></div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {!loading && items.length === 0 && <li className="text-muted-foreground">None scheduled today.</li>}
        {items.slice(0, 4).map((x) => (
          <li key={x.id} className="flex justify-between"><span>{x.guest?.name ?? `Guest #${x.guest_id}`}</span><span className="text-muted-foreground">{x.rooms.map((r) => r.room_number).filter(Boolean).join(", ") || `${x.room_ids.length} room(s)`}</span></li>
        ))}
      </ul>
    </Panel>
  );
}
