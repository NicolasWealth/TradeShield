import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { CustodyTimeline } from "@/components/CustodyTimeline";
import { MetricCard } from "@/components/MetricCard";
import { BatchStatusBadge, IncidentStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateEvent, useTraceData } from "@/hooks/useTraceData";
import { formatDate, formatNumber, shortId, titleCase } from "@/lib/format";
import { createEventHash } from "@/services/eventHash";
import type { CustodyEvent, CustodyEventType } from "@/types";

export const Route = createFileRoute("/batches/$batchId")({
  head: ({ params }) => ({
    meta: [
      { title: `Batch ${params.batchId} — TraceShield` },
      {
        name: "description",
        content: `Custody chain, shelf life and linked incidents for production batch ${params.batchId}.`,
      },
      { property: "og:title", content: `Batch ${params.batchId} — TraceShield` },
      {
        property: "og:description",
        content: "Full chain-of-custody record for this production batch.",
      },
    ],
  }),
  component: BatchDetailPage,
});

const EVENT_TYPES: CustodyEventType[] = [
  "PRODUCED",
  "SHIPPED",
  "RECEIVED",
  "STORED",
  "INSPECTED",
  "SOLD",
];

function BatchDetailPage() {
  const { batchId } = Route.useParams();
  const { batches, events, organizations, incidents } = useTraceData();
  const createEvent = useCreateEvent();
  const [open, setOpen] = useState(false);

  const batch = batches.find((b) => b.batchId === batchId);
  const batchEvents = useMemo(
    () =>
      events
        .filter((e) => e.batchId === batchId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [events, batchId],
  );
  const linkedIncidents = incidents.filter((i) => i.batchId === batchId);

  const [form, setForm] = useState({
    type: "SHIPPED" as CustodyEventType,
    fromOrganization: "ORG-MFR-A",
    toOrganization: "ORG-DIST-LAGOS",
    location: "Apapa, Lagos",
    quantity: "500",
  });

  const submit = () => {
    const last = batchEvents[batchEvents.length - 1];
    const rawEvent = {
      eventId: shortId("EVT"),
      batchId,
      type: form.type,
      fromOrganization: form.fromOrganization,
      toOrganization: form.toOrganization,
      location: form.location,
      quantity: Number(form.quantity) || 0,
      timestamp: new Date().toISOString(),
      previousEventId: last ? last.eventId : null,
      eventHash: "",
      blockchainTxHash: "",
      verificationStatus: "PENDING_INTEGRATION" as const,
    };
    const event: CustodyEvent = {
      ...rawEvent,
      eventHash: createEventHash(rawEvent),
    };
    createEvent.mutate(event, {
      onSuccess: () => {
        toast.success("Custody event recorded — hash generated & chain anchoring pending");
        setOpen(false);
      },
    });
  };

  if (!batch) {
    return (
      <AppShell title="Batch not found">
        <p className="text-sm text-muted-foreground">
          No batch matches <span className="font-mono">{batchId}</span>.{" "}
          <Link to="/batches" className="text-primary hover:underline">
            Back to register
          </Link>
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={batch.productName}
      subtitle={`Batch ${batch.batchId} · ${batch.origin}`}
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Record custody event</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record custody event</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Event type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as CustodyEventType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {titleCase(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>From</Label>
                <Select
                  value={form.fromOrganization}
                  onValueChange={(v) => setForm({ ...form, fromOrganization: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => (
                      <SelectItem key={o.organizationId} value={o.organizationId}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Select
                  value={form.toOrganization}
                  onValueChange={(v) => {
                    const org = organizations.find((o) => o.organizationId === v);
                    setForm({
                      ...form,
                      toOrganization: v,
                      location: org?.location ?? form.location,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => (
                      <SelectItem key={o.organizationId} value={o.organizationId}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="loc">Location</Label>
                <Input
                  id="loc"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={createEvent.isPending}>
                Record event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Quantity" value={formatNumber(batch.quantity)} hint="units produced" />
        <MetricCard label="Produced" value={formatDate(batch.productionDate)} />
        <MetricCard
          label="Expires"
          value={formatDate(batch.expiryDate)}
          tone={new Date(batch.expiryDate).getTime() < Date.now() ? "critical" : "default"}
        />
        <MetricCard label="Custody events" value={batchEvents.length} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Chain of custody
            </h2>
            <BatchStatusBadge status={batch.status} />
          </div>
          <CustodyTimeline events={batchEvents} organizations={organizations} />
        </section>

        <section className="space-y-5">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Linked incidents
            </h2>
            <ul className="mt-3 space-y-3">
              {linkedIncidents.map((i) => (
                <li key={i.incidentId}>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/incidents/$incidentId"
                      params={{ incidentId: i.incidentId }}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {i.incidentId}
                    </Link>
                    <IncidentStatusBadge status={i.status} />
                  </div>
                  <p className="mt-1 text-xs text-mist-400">{titleCase(i.type)}</p>
                </li>
              ))}
              {linkedIncidents.length === 0 ? (
                <li className="text-sm text-muted-foreground">No incidents on this batch.</li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Chain anchoring
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Event hashes and transaction references are reserved on every custody record
              but stay empty until the blockchain layer is integrated.
            </p>
            <Link
              to="/verification"
              className="mt-3 inline-block text-xs text-primary hover:underline"
            >
              Open verification ledger
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
