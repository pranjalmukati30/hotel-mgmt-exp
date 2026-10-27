import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Pencil, Trash2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useApiMutation, useGuests } from "@/lib/queries";
import { api, type Guest, type GuestInput } from "@/lib/api";
import { PageHeader, Panel, ErrorState, EmptyState, ConfirmDialog, Field } from "@/components/hotel/shared";

export const Route = createFileRoute("/guests")({
  head: () => ({
    meta: [
      { title: "Guests — Haven Grand Hotel" },
      { name: "description", content: "Guest register for Haven Grand Hotel." },
      { property: "og:title", content: "Guests — Haven Grand Hotel" },
      { property: "og:description", content: "Guest register for Haven Grand Hotel." },
    ],
  }),
  component: GuestsPage,
});

function GuestsPage() {
  const q = useGuests();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Guest | null | "new">(null);
  const [deleting, setDeleting] = useState<Guest | null>(null);
  const del = useApiMutation((id: number) => api.guests.remove(id), "Guest removed", () => setDeleting(null));

  const guests = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data ?? []).filter(
      (g) => !s || g.name.toLowerCase().includes(s) || (g.email ?? "").toLowerCase().includes(s) || g.phone.includes(s),
    );
  }, [q.data, search]);

  return (
    <>
      <PageHeader eyebrow="Register" title="Guests" action={<Button onClick={() => setEditing("new")}><Plus /> Add guest</Button>} />
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input className="bg-card pl-9" placeholder="Search name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : guests.length === 0 ? (
        <EmptyState title={q.data?.length ? "No matching guests" : "No guests yet"} hint={q.data?.length ? "Try another search." : "Register a guest before creating a reservation."} action={!q.data?.length && <Button onClick={() => setEditing("new")}><Plus /> Add guest</Button>} />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-5 py-3">Guest</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody className="divide-y">
              {guests.map((g) => (
                <tr key={g.id} className="hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-display grid size-9 place-items-center rounded-full bg-secondary text-lg font-semibold">{g.name.charAt(0).toUpperCase()}</span>
                      <div><p className="font-medium">{g.name}</p><p className="text-xs text-muted-foreground">ID #{g.id}</p></div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground"><span className="flex items-center gap-1.5"><Mail className="size-3.5" />{g.email || "—"}</span></td>
                  <td className="px-5 py-3 text-muted-foreground"><span className="flex items-center gap-1.5"><Phone className="size-3.5" />{g.phone}</span></td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" aria-label="Edit guest" onClick={() => setEditing(g)}><Pencil /></Button>
                    <Button size="icon" variant="ghost" aria-label="Delete guest" onClick={() => setDeleting(g)}><Trash2 className="text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <GuestDialog guest={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Remove ${deleting?.name}?`} description="This permanently deletes the guest record. Guests with reservations may be refused by the server." confirmLabel="Delete guest" pending={del.isPending} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.union([z.literal(""), z.string().trim().email("Invalid email")]).transform((v) => (v ? v : null)),
  phone: z.string().trim().min(5, "Enter a valid phone number").regex(/^[+\d\s()-]+$/, "Digits, spaces, + ( ) - only"),
});

function GuestDialog({ guest, onClose }: { guest: Guest | null | "new"; onClose: () => void }) {
  const isEdit = guest && guest !== "new";
  const form = useForm<{ name: string; email: string; phone: string }>({ resolver: zodResolver(schema) as never });
  useEffect(() => {
    if (guest) form.reset(isEdit ? { name: guest.name, email: guest.email ?? "", phone: guest.phone } : { name: "", email: "", phone: "" });
  }, [guest]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useApiMutation(
    (v: GuestInput) => (isEdit ? api.guests.update((guest as Guest).id, v) : api.guests.create(v)),
    isEdit ? "Guest updated" : "Guest added",
    onClose,
  );
  const err = form.formState.errors;
  return (
    <Dialog open={!!guest} onOpenChange={(o) => !o && !m.isPending && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-3xl">{isEdit ? "Edit guest" : "New guest"}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => m.mutate(v as unknown as GuestInput))}>
          <Field label="Full name" error={err.name?.message}><Input {...form.register("name")} /></Field>
          <Field label="Email (optional)" error={err.email?.message}><Input type="email" {...form.register("email")} /></Field>
          <Field label="Phone" error={err.phone?.message}><Input {...form.register("phone")} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={m.isPending}>Cancel</Button>
            <Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Save guest"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
