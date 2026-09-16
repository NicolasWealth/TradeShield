import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { BatchStatusBadge } from "@/components/StatusBadge";
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
import { useCreateBatch, useTraceData } from "@/hooks/useTraceData";
import { formatDate, formatNumber, shortId } from "@/lib/format";
import type { Batch, BatchStatus } from "@/types";

export const Route = createFileRoute("/batches/")({
  head: () => ({
    meta: [
      { title: "Batches — TraceShield Traceability Register" },
      {
        name: "description",
        content:
          "Register, track and inspect production batches with full custody history across the distribution network.",
      },
      { property: "og:title", content: "Batch register — TraceShield" },
      {
        property: "og:description",
        content: "Every production batch with quantity, shelf life and custody status.",
      },
    ],
  }),
  component: BatchesPage,
});

const STATUSES: BatchStatus[] = ["PRODUCED", "IN_TRANSIT", "DELIVERED", "HELD", "RECALLED"];

function BatchesPage() {
  const { batches, events, organizations } = useTraceData();
  const createBatch = useCreateBatch();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"ALL" | BatchStatus>("ALL");

  const [form, setForm] = useState({
    productName: "",
    quantity: "1000",
    productionDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
    origin: "Agbara Plant, Ogun",
    organizationId: "ORG-MFR-A",
  });

  const rows = useMemo(
    () => (filter === "ALL" ? batches : batches.filter((b) => b.status === filter)),
    [batches, filter],
  );

  const eventCount = (batchId: string) => events.filter((e) => e.batchId === batchId).length;

  const submit = () => {
    if (!form.productName.trim()) {
      toast.error("Product name is required");
      return;
    }
    const batch: Batch = {
      batchId: shortId("B"),
      productName: form.productName.trim(),
      quantity: Number(form.quantity) || 0,
      productionDate: new Date(form.productionDate).toISOString(),
      expiryDate: new Date(form.expiryDate).toISOString(),
      origin: form.origin,
      organizationId: form.organizationId,
      status: "PRODUCED",
      createdAt: new Date().toISOString(),
    };
    createBatch.mutate(batch, {
      onSuccess: () => {
        toast.success(`Batch ${batch.batchId} registered`);
        setOpen(false);
        setForm((f) => ({ ...f, productName: "" }));
      },
    });
  };

  return (
    <AppShell
      title="Batch register"
      subtitle="Production lots under traceability control."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Register batch</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register production batch</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="productName">Product name</Label>
                <Input
                  id="productName"
                  value={form.productName}
                  placeholder="Chilled Poultry — 4.5kg trays"
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity (units)</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="origin">Origin</Label>
                <Input
                  id="origin"
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productionDate">Production date</Label>
                <Input
                  id="productionDate"
                  type="date"
                  value={form.productionDate}
                  onChange={(e) => setForm({ ...form, productionDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Producing organization</Label>
                <Select
                  value={form.organizationId}
                  onValueChange={(v) => setForm({ ...form, organizationId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations
                      .filter((o) => o.type === "MANUFACTURER")
                      .map((o) => (
                        <SelectItem key={o.organizationId} value={o.organizationId}>
                          {o.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={createBatch.isPending}>
                Register batch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["ALL", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
              filter === s
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Produced</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Events</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((b) => (
              <tr key={b.batchId} className="hover:bg-secondary/40">
                <td className="px-4 py-3">
                  <Link
                    to="/batches/$batchId"
                    params={{ batchId: b.batchId }}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {b.batchId}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground">{b.productName}</td>
                <td className="px-4 py-3 font-mono text-xs text-mist-300">
                  {formatNumber(b.quantity)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-mist-400">
                  {formatDate(b.productionDate)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-mist-400">
                  {formatDate(b.expiryDate)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-mist-400">
                  {eventCount(b.batchId)}
                </td>
                <td className="px-4 py-3">
                  <BatchStatusBadge status={b.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No batches match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
