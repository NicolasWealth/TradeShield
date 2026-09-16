import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ScoreBar } from "@/components/MetricCard";
import { IncidentStatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useCreateIncident, useTraceData } from "@/hooks/useTraceData";
import { analyseIncident } from "@/services/riskEngine";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime, shortId, titleCase } from "@/lib/format";
import type { Incident, IncidentType } from "@/types";

export const Route = createFileRoute("/incidents/")({
  head: () => ({
    meta: [
      { title: "Incidents — TraceShield Recall Analysis" },
      {
        name: "description",
        content:
          "Log food-safety incidents and score them with a deterministic exposure risk and evidence confidence engine.",
      },
      { property: "og:title", content: "Incident analysis — TraceShield" },
      {
        property: "og:description",
        content: "Deterministic recall priority for every reported incident.",
      },
    ],
  }),
  component: IncidentsPage,
});

const TYPES: IncidentType[] = [
  "CONTAMINATION",
  "COLD_CHAIN_BREAK",
  "FOREIGN_BODY",
  "LABELLING",
  "OTHER",
];

function IncidentsPage() {
  const { incidents, batches, events, organizations } = useTraceData();
  const createIncident = useCreateIncident();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    batchId: "",
    type: "CONTAMINATION" as IncidentType,
    description: "",
  });

  const analyses = useMemo(
    () =>
      incidents
        .map((incident) =>
          analyseIncident({
            incident,
            batch: batches.find((b) => b.batchId === incident.batchId),
            events,
            organizations,
          }),
        )
        .sort((a, b) => b.exposureRisk - a.exposureRisk),
    [incidents, batches, events, organizations],
  );

  const submit = () => {
    const batchId = form.batchId || batches[0]?.batchId;
    if (!batchId) {
      toast.error("Register a batch first");
      return;
    }
    if (form.description.trim().length < 10) {
      toast.error("Describe the incident in more detail");
      return;
    }
    const incident: Incident = {
      incidentId: shortId("INC"),
      batchId,
      type: form.type,
      description: form.description.trim(),
      status: "OPEN",
      createdAt: new Date().toISOString(),
      createdBy: user?.userId ?? "USR-001",
    };
    createIncident.mutate(incident, {
      onSuccess: () => {
        toast.success(`${incident.incidentId} logged and scored`);
        setOpen(false);
        setForm({ ...form, description: "" });
      },
    });
  };

  return (
    <AppShell
      title="Incidents"
      subtitle="Deterministic scoring — exposure risk and evidence confidence, no AI."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Log incident</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log a food-safety incident</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Affected batch</Label>
                <Select
                  value={form.batchId || batches[0]?.batchId || ""}
                  onValueChange={(v) => setForm({ ...form, batchId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.batchId} value={b.batchId}>
                        {b.batchId} — {b.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Incident type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as IncidentType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {titleCase(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">What was observed?</Label>
                <Textarea
                  id="desc"
                  rows={5}
                  value={form.description}
                  placeholder="Lab result, telemetry reading, customer complaint, inspection finding…"
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Detailed reports (120+ characters) score higher evidence confidence.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={createIncident.isPending}>
                Log and score
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {analyses.map((a) => {
          const incident = incidents.find((i) => i.incidentId === a.incidentId)!;
          return (
            <Link
              key={a.analysisId}
              to="/incidents/$incidentId"
              params={{ incidentId: a.incidentId }}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-primary">{a.incidentId}</span>
                <span className="text-sm text-foreground">{titleCase(incident.type)}</span>
                <span className="ml-auto flex gap-2">
                  <IncidentStatusBadge status={incident.status} />
                  <PriorityBadge priority={a.priority} />
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-mist-400">{incident.description}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Exposure {a.exposureRisk}
                  </p>
                  <ScoreBar value={a.exposureRisk} tone="risk" />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Evidence {a.evidenceConfidence}
                  </p>
                  <ScoreBar value={a.evidenceConfidence} tone="confidence" />
                </div>
              </div>
              <p className="mt-3 font-mono text-[10px] text-muted-foreground">
                Batch {a.batchId} · {a.affectedLocations.length} location(s) ·{" "}
                {formatDateTime(incident.createdAt)}
              </p>
            </Link>
          );
        })}
        {analyses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No incidents logged yet.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
