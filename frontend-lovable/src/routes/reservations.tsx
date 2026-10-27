import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useApiMutation, useGuests, useReservations, useRooms } from "@/lib/queries";
import { api, type Reservation, type Room } from "@/lib/api";
import { PageHeader, Panel, ErrorState, EmptyState, StatusBadge, ConfirmDialog, Field, fmtDate, money } from "@/components/hotel/shared";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reservations")({
  head: () => ({
    meta: [
      { title: "Reservations — Haven Grand Hotel" },
      { name: "description", content: "Create, review and cancel Haven Grand reservations." },
      { property: "og:title", content: "Reservations — Haven Grand Hotel" },
      { property: "og:description", content: "Create, review and cancel Haven Grand reservations." },
    ],
  }),
  component: ReservationsPage,
});

function ReservationsPage() {
  const q = useReservations();
  const guests = useGuests();
  const rooms = useRooms();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<Reservation | null>(null);
  const cancel = useApiMutation((id: number) => api.reservations.cancel(id), "Reservation cancelled", () => setCancelling(null));

  const guestName = (r: Reservation) => r.guest?.name ?? guests.data?.find((g) => g.id === r.guest_id)?.name ?? `Guest #${r.guest_id ?? "?"}`;
  const roomLabels = (r: Reservation) => {
    const nums = r.rooms.map((x) => x.room_number).filter(Boolean);
    if (nums.length) return nums;
    return r.room_ids.map((id) => rooms.data?.find((x) => x.id === id)?.room_number ?? `#${id}`);
  };

  const statuses = useMemo(() => Array.from(new Set((q.data ?? []).map((r) => r.status))), [q.data]);
  const list = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data ?? [])
      .filter((r) => status === "all" || r.status === status)
      .filter((r) => !s || guestName(r).toLowerCase().includes(s) || String(r.id).includes(s) || roomLabels(r).join(" ").toLowerCase().includes(s))
      .sort((a, b) => (b.check_in ?? "").localeCompare(a.check_in ?? ""));
  }, [q.data, search, status, guests.data, rooms.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader eyebrow="Front desk" title="Reservations" action={<Button onClick={() => setCreating(true)}><Plus /> New reservation</Button>} />
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="bg-card pl-9" placeholder="Search guest, room or booking #" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-9 rounded-md border border-input bg-card px-3 text-sm capitalize" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState title={q.data?.length ? "No matching reservations" : "No reservations yet"} hint="Bookings created here are saved straight to the hotel system." action={!q.data?.length && <Button onClick={() => setCreating(true)}><Plus /> New reservation</Button>} />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-5 py-3">Booking</th><th className="px-5 py-3">Guest</th><th className="px-5 py-3">Rooms</th><th className="px-5 py-3">Stay</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3">Status</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody className="divide-y">
              {list.map((r) => {
                const cancelled = /cancel/i.test(r.status);
                return (
                  <tr key={r.id} className={cn("hover:bg-muted/40", cancelled && "opacity-60")}>
                    <td className="px-5 py-3 font-mono text-xs">#{r.id}</td>
                    <td className="px-5 py-3 font-medium">{guestName(r)}</td>
                    <td className="px-5 py-3"><div className="flex flex-wrap gap-1">{roomLabels(r).map((n) => <span key={n} className="rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold">{n}</span>)}</div></td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</td>
                    <td className="px-5 py-3 text-right font-semibold">{money(r.total_price)}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3 text-right">
                      {!cancelled && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelling(r)}><Ban /> Cancel</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}

      <CreateDialog open={creating} onClose={() => setCreating(false)} />
      <ConfirmDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)} title={`Cancel booking #${cancelling?.id}?`} description={cancelling ? `${guestName(cancelling)} · ${fmtDate(cancelling.check_in)} → ${fmtDate(cancelling.check_out)}. This cannot be undone.` : ""} confirmLabel="Cancel reservation" pending={cancel.isPending} onConfirm={() => cancelling && cancel.mutate(cancelling.id)} />
    </>
  );
}

const iso = (d: Date) => d.toLocaleDateString("en-CA");

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const guests = useGuests();
  const rooms = useRooms();
  const [guestId, setGuestId] = useState("");
  const [roomIds, setRoomIds] = useState<number[]>([]);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"guest" | "rooms" | "checkIn" | "checkOut", string>>>({});
  const reset = () => { setGuestId(""); setRoomIds([]); setCheckIn(""); setCheckOut(""); setErrors({}); };
  const m = useApiMutation(api.reservations.create, "Reservation created", () => { reset(); onClose(); });

  // Only rooms the backend currently marks available are offered; the server performs the final date-overlap check.
  const bookable = (rooms.data ?? []).filter((r: Room) => r.status === "available");
  const today = iso(new Date());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Partial<Record<"guest" | "rooms" | "checkIn" | "checkOut", string>> = {};
    if (!guestId) er.guest = "Choose a guest";
    if (!roomIds.length) er.rooms = "Select at least one room";
    if (!checkIn) er.checkIn = "Required";
    if (!checkOut) er.checkOut = "Required";
    if (checkIn && checkOut && checkOut <= checkIn) er.checkOut = "Check-out must be after check-in";
    setErrors(er);
    if (Object.keys(er).length) return;
    m.mutate({ guest_id: Number(guestId), room_ids: roomIds, check_in: checkIn, check_out: checkOut });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !m.isPending && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="font-display text-3xl">New reservation</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Guest" error={errors.guest}>
            <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={guestId} onChange={(e) => setGuestId(e.target.value)} disabled={guests.isLoading}>
              <option value="">{guests.isLoading ? "Loading guests…" : guests.data?.length ? "Select a guest" : "No guests registered"}</option>
              {guests.data?.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.phone}</option>)}
            </select>
            {guests.isError && <p className="text-xs text-destructive">{guests.error.message}</p>}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Check-in" error={errors.checkIn}><Input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></Field>
            <Field label="Check-out" error={errors.checkOut}><Input type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></Field>
          </div>
          <Field label={`Rooms${roomIds.length ? ` · ${roomIds.length} selected` : ""}`} error={errors.rooms}>
            {rooms.isLoading ? <Skeleton className="h-20" /> : rooms.isError ? <p className="text-xs text-destructive">{rooms.error.message}</p> : bookable.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No rooms are currently marked available.</p>
            ) : (
              <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {bookable.map((r) => {
                  const on = roomIds.includes(r.id);
                  return (
                    <button type="button" key={r.id} onClick={() => setRoomIds((ids) => (on ? ids.filter((i) => i !== r.id) : [...ids, r.id]))} className={cn("rounded-md border p-3 text-left transition-colors", on ? "border-accent bg-warning-soft" : "bg-card hover:border-accent/60")}>
                      <p className="font-display text-2xl font-semibold leading-none">{r.room_number}</p>
                      <p className="mt-1 truncate text-xs capitalize text-muted-foreground">{r.room_type} · {r.capacity}p</p>
                      <p className="text-xs font-medium">{money(r.price_per_night)}/night</p>
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
          <p className="text-xs text-muted-foreground">The total price is calculated by the hotel system when the booking is saved.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={m.isPending}>Close</Button>
            <Button type="submit" disabled={m.isPending}>{m.isPending ? "Booking…" : "Create reservation"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
