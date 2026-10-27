import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useApiMutation, useRooms } from "@/lib/queries";
import { api, type Room, type RoomInput } from "@/lib/api";
import { PageHeader, Panel, ErrorState, EmptyState, StatusBadge, ConfirmDialog, Field, money } from "@/components/hotel/shared";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rooms")({
  head: () => ({
    meta: [
      { title: "Rooms — Haven Grand Hotel" },
      { name: "description", content: "Manage Haven Grand rooms, rates and status." },
      { property: "og:title", content: "Rooms — Haven Grand Hotel" },
      { property: "og:description", content: "Manage Haven Grand rooms, rates and status." },
    ],
  }),
  component: RoomsPage,
});

const STATUSES = ["available", "occupied", "maintenance"];
const selectCls = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

function RoomsPage() {
  const q = useRooms();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Room | null | "new">(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const del = useApiMutation((id: number) => api.rooms.remove(id), "Room deleted", () => setDeleting(null));

  const rooms = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data ?? [])
      .filter((r) => status === "all" || r.status === status)
      .filter((r) => !s || r.room_number.toLowerCase().includes(s) || r.room_type.toLowerCase().includes(s))
      .sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));
  }, [q.data, search, status]);

  return (
    <>
      <PageHeader eyebrow="Inventory" title="Rooms" action={<Button onClick={() => setEditing("new")}><Plus /> Add room</Button>} />
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="bg-card pl-9" placeholder="Search number or type" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 rounded-md border bg-card p-1">
          {["all", ...STATUSES].map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={cn("rounded px-3 py-1 text-sm capitalize", status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{s}</button>
          ))}
        </div>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : rooms.length === 0 ? (
        <EmptyState title={q.data?.length ? "No matching rooms" : "No rooms yet"} hint={q.data?.length ? "Try a different search or filter." : "Add your first room to start taking reservations."} action={!q.data?.length && <Button onClick={() => setEditing("new")}><Plus /> Add room</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((r) => (
            <Panel key={r.id} className="group overflow-hidden">
              <div className={cn("h-1", r.status === "available" ? "bg-success" : r.status === "occupied" ? "bg-info" : "bg-warning")} />
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Room</p>
                    <p className="font-display text-4xl font-semibold">{r.room_number}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-2 capitalize">{r.room_type}</p>
                <div className="mt-4 flex items-end justify-between border-t pt-4">
                  <div>
                    <p className="font-semibold">{money(r.price_per_night)}<span className="text-xs font-normal text-muted-foreground"> / night</span></p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3" /> Sleeps {r.capacity}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label="Edit room" onClick={() => setEditing(r)}><Pencil /></Button>
                    <Button size="icon" variant="ghost" aria-label="Delete room" onClick={() => setDeleting(r)}><Trash2 className="text-destructive" /></Button>
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <RoomDialog room={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete room ${deleting?.room_number}?`} description="This permanently removes the room. Rooms with reservations may be refused by the server." confirmLabel="Delete room" pending={del.isPending} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </>
  );
}

const schema = z.object({
  room_number: z.string().trim().min(1, "Required"),
  room_type: z.string().trim().min(1, "Required"),
  price_per_night: z.coerce.number().positive("Must be greater than 0"),
  capacity: z.coerce.number().int().min(1, "At least 1"),
  status: z.string().min(1),
});

function RoomDialog({ room, onClose }: { room: Room | null | "new"; onClose: () => void }) {
  const isEdit = room && room !== "new";
  const form = useForm<RoomInput>({ resolver: zodResolver(schema) as never });
  useEffect(() => {
    if (room) form.reset(isEdit ? room : { room_number: "", room_type: "", price_per_night: undefined as never, capacity: 2, status: "available" });
  }, [room]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useApiMutation(
    (v: RoomInput) => (isEdit ? api.rooms.update((room as Room).id, v) : api.rooms.create(v)),
    isEdit ? "Room updated" : "Room added",
    onClose,
  );
  const err = form.formState.errors;
  return (
    <Dialog open={!!room} onOpenChange={(o) => !o && !m.isPending && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-3xl">{isEdit ? `Edit room ${room.room_number}` : "New room"}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-4" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
          <Field label="Room number" error={err.room_number?.message}><Input {...form.register("room_number")} /></Field>
          <Field label="Type" error={err.room_type?.message}><Input placeholder="e.g. deluxe" {...form.register("room_type")} /></Field>
          <Field label="Price per night" error={err.price_per_night?.message}><Input type="number" step="0.01" {...form.register("price_per_night")} /></Field>
          <Field label="Capacity" error={err.capacity?.message}><Input type="number" {...form.register("capacity")} /></Field>
          <Field label="Status" className="col-span-2">
            <select className={selectCls} {...form.register("status")}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </Field>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={m.isPending}>Cancel</Button>
            <Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Save room"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

