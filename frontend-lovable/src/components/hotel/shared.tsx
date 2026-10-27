import type { ReactNode } from "react";
import { AlertTriangle, RotateCw, Inbox } from "lucide-react";
import { cva } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
        <h1 className="font-display mt-1 text-4xl font-semibold text-foreground md:text-5xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

const badge = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", {
  variants: {
    tone: {
      success: "bg-success-soft text-success",
      danger: "bg-danger-soft text-destructive",
      warning: "bg-warning-soft text-warning",
      info: "bg-info-soft text-info",
      muted: "bg-muted text-muted-foreground",
    },
  },
});

const toneFor = (s: string) => {
  const v = s.toLowerCase();
  if (["available", "confirmed", "active", "booked"].includes(v)) return "success";
  if (["occupied", "checked_in", "checked-in"].includes(v)) return "info";
  if (["maintenance", "pending"].includes(v)) return "warning";
  if (["cancelled", "canceled"].includes(v)) return "danger";
  return "muted";
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={badge({ tone: toneFor(status) as never })}>
      <span className="size-1.5 rounded-full bg-current" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: (() => void) | undefined }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-danger-soft p-6 text-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="font-semibold text-destructive">Couldn't load data from the hotel server</p>
          <p className="mt-1 text-foreground/80">{error.message}</p>
        </div>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCw /> Retry
          </Button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode | undefined }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed bg-card px-6 py-14 text-center">
      <Inbox className="size-8 text-accent" />
      <p className="font-display mt-3 text-2xl font-semibold">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border bg-card shadow-soft", className)}>{children}</div>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean | undefined;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const money = (n: number | null | undefined) =>
  n == null || Number.isNaN(n)
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (d: string | undefined) => {
  if (!d) return "—";
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export function Field({ label, error, className, children }: { label: string; error?: string | undefined; className?: string; children: ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
