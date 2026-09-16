import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard, ScoreBar } from "@/components/MetricCard";
import { BatchStatusBadge, IncidentStatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { useTraceData } from "@/hooks/useTraceData";
import { analyseIncident } from "@/services/riskEngine";
import { formatDate, formatNumber, titleCase } from "@/lib/format";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Control Room — TraceShield Recall Intelligence" },
      {
        name: "description",
        content:
          "Live view of batches in custody, open food-safety incidents and recall priority scoring across the distribution network.",
      },
      { property: "og:title", content: "TraceShield Control Room" },
      {
        property: "og:description",
        content: "Batches, incidents and recall priorities at a glance.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { organizations, batches, events, incidents } = useTraceData();

  const analyses = useMemo(
    () =>
      incidents.map((incident) =>
        analyseIncident({
          incident,
          batch: batches.find((b) => b.batchId === incident.batchId),
          events,
          organizations,
        }),
      ),
    [incidents, batches, events, organizations],
  );

  const openIncidents = incidents.filter(
    (i) => i.status === "OPEN" || i.status === "INVESTIGATING",
  );
  const recallCount = analyses.filter((a) => a.priority === "IMMEDIATE_RECALL").length;
  const unitsAtRisk = analyses.reduce((sum, a) => sum + a.affectedQuantity, 0);

  return (
    <AppShell
      title="Control Room"
      subtitle="Seeded network — Manufacturer A into the Lagos and Abuja distribution legs."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Batches tracked"
          value={formatNumber(batches.length)}
          hint={`${formatNumber(events.length)} custody events recorded`}
        />
        <MetricCard
          label="Open incidents"
          value={formatNumber(openIncidents.length)}
          hint={`${incidents.length} total logged`}
          tone={openIncidents.length ? "warn" : "default"}
        />
        <MetricCard
          label="Immediate recalls"
          value={formatNumber(recallCount)}
          hint="Exposure ≥ 80 and evidence ≥ 80"
          tone={recallCount ? "critical" : "ok"}
        />
        <MetricCard
          label="Units at risk"
          value={formatNumber(unitsAtRisk)}
          hint="Downstream of the incident point"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <section className="rounded-lg border border-border bg-card lg:col-span-3">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Recall priority queue
            </h2>
            <Link to="/incidents" className="text-xs text-primary hover:underline">
              All incidents
            </Link>
          </header>
          <ul className="divide-y divide-border">
            {analyses.map((a) => {
              const incident = incidents.find((i) => i.incidentId === a.incidentId)!;
              return (
                <li key={a.analysisId} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/incidents/$incidentId"
                      params={{ incidentId: a.incidentId }}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {a.incidentId}
                    </Link>
                    <span className="text-sm text-foreground">
                      {titleCase(incident.type)} · {a.batchId}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <IncidentStatusBadge status={incident.status} />
                      <PriorityBadge priority={a.priority} />
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
                </li>
              );
            })}
            {analyses.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">No incidents logged.</li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card lg:col-span-2">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Batches in custody
            </h2>
            <Link to="/batches" className="text-xs text-primary hover:underline">
              All batches
            </Link>
          </header>
          <ul className="divide-y divide-border">
            {batches.slice(0, 6).map((b) => (
              <li key={b.batchId} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/batches/$batchId"
                    params={{ batchId: b.batchId }}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {b.batchId}
                  </Link>
                  <p className="truncate text-sm text-foreground">{b.productName}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Expires {formatDate(b.expiryDate)} · {formatNumber(b.quantity)} units
                  </p>
                </div>
                <BatchStatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
