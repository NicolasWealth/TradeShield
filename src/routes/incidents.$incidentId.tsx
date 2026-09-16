import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard, ScoreBar } from "@/components/MetricCard";
import { IncidentStatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { CustodyTimeline } from "@/components/CustodyTimeline";
import { useTraceData } from "@/hooks/useTraceData";
import { analyseIncident } from "@/services/riskEngine";
import { formatDateTime, formatNumber, titleCase } from "@/lib/format";

export const Route = createFileRoute("/incidents/$incidentId")({
  head: ({ params }) => ({
    meta: [
      { title: `Incident ${params.incidentId} — TraceShield Analysis` },
      {
        name: "description",
        content: `Exposure risk, evidence confidence and recommended recall action for incident ${params.incidentId}.`,
      },
      { property: "og:title", content: `Incident ${params.incidentId} — TraceShield` },
      {
        property: "og:description",
        content: "Deterministic recall priority analysis with a full scoring breakdown.",
      },
    ],
  }),
  component: IncidentDetailPage,
});

function IncidentDetailPage() {
  const { incidentId } = Route.useParams();
  const { incidents, batches, events, organizations } = useTraceData();

  const incident = incidents.find((i) => i.incidentId === incidentId);
  const batch = batches.find((b) => b.batchId === incident?.batchId);

  const analysis = useMemo(
    () => (incident ? analyseIncident({ incident, batch, events, organizations }) : null),
    [incident, batch, events, organizations],
  );

  const batchEvents = useMemo(
    () =>
      events
        .filter((e) => e.batchId === incident?.batchId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [events, incident],
  );

  if (!incident || !analysis) {
    return (
      <AppShell title="Incident not found">
        <p className="text-sm text-muted-foreground">
          No incident matches <span className="font-mono">{incidentId}</span>.{" "}
          <Link to="/incidents" className="text-primary hover:underline">
            Back to incidents
          </Link>
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`${titleCase(incident.type)} — ${incident.incidentId}`}
      subtitle={`Reported ${formatDateTime(incident.createdAt)} on batch ${incident.batchId}`}
      actions={
        <div className="flex gap-2">
          <IncidentStatusBadge status={incident.status} />
          <PriorityBadge priority={analysis.priority} />
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Exposure risk"
          value={analysis.exposureRisk}
          hint="0–100, deterministic"
          tone={analysis.exposureRisk >= 80 ? "critical" : "warn"}
        />
        <MetricCard
          label="Evidence confidence"
          value={analysis.evidenceConfidence}
          hint="0–100, deterministic"
          tone={analysis.evidenceConfidence >= 80 ? "ok" : "warn"}
        />
        <MetricCard
          label="Units affected"
          value={formatNumber(analysis.affectedQuantity)}
          hint={`${formatNumber(analysis.accountedQuantity)} units accounted`}
        />
        <MetricCard
          label="Locations"
          value={analysis.affectedLocations.length}
          hint="in the custody chain"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="space-y-5 lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Recommended action
            </h2>
            <p className="mt-2 text-sm text-mist-300">{analysis.recommendedAction}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Exposure {analysis.exposureRisk}
                </p>
                <ScoreBar value={analysis.exposureRisk} tone="risk" />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Evidence {analysis.evidenceConfidence}
                </p>
                <ScoreBar value={analysis.evidenceConfidence} tone="confidence" />
              </div>
            </div>
          </div>

          {analysis.riskFactors && analysis.evidenceFactors ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-display text-sm font-semibold text-foreground">
                Factor Breakdown (0–100)
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 text-xs">
                <div>
                  <p className="font-mono text-[10px] uppercase text-muted-foreground mb-2">
                    Exposure Factors
                  </p>
                  <ul className="space-y-1 text-mist-300">
                    <li className="flex justify-between">
                      <span>Quantity Ratio (30%)</span>
                      <span className="font-mono">
                        {analysis.riskFactors.affectedQuantityRatio}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Downstream Reach (25%)</span>
                      <span className="font-mono">{analysis.riskFactors.downstreamReach}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Consumer Reach (20%)</span>
                      <span className="font-mono">{analysis.riskFactors.consumerFacingReach}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Geographic Reach (10%)</span>
                      <span className="font-mono">{analysis.riskFactors.geographicReach}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Severity Score (15%)</span>
                      <span className="font-mono">{analysis.riskFactors.incidentSeverity}</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-muted-foreground mb-2">
                    Evidence Factors
                  </p>
                  <ul className="space-y-1 text-mist-300">
                    <li className="flex justify-between">
                      <span>Event Completeness (25%)</span>
                      <span className="font-mono">
                        {analysis.evidenceFactors.eventCompleteness}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Chain Integrity (25%)</span>
                      <span className="font-mono">{analysis.evidenceFactors.chainIntegrity}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Inventory Accounting (20%)</span>
                      <span className="font-mono">
                        {analysis.evidenceFactors.inventoryAccounting}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Temporal Consistency (10%)</span>
                      <span className="font-mono">
                        {analysis.evidenceFactors.temporalConsistency}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Org Completeness (10%)</span>
                      <span className="font-mono">
                        {analysis.evidenceFactors.organizationCompleteness}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Anomaly Quality (10%)</span>
                      <span className="font-mono">{analysis.evidenceFactors.anomalyQuality}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Scoring breakdown
            </h2>
            <ul className="mt-3 space-y-2">
              {analysis.reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-mist-300">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Custody chain for {incident.batchId}
            </h2>
            <div className="mt-4">
              <CustodyTimeline events={batchEvents} organizations={organizations} />
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-sm font-semibold text-foreground">Report</h2>
            <p className="mt-2 text-sm text-mist-300">{incident.description}</p>
          </div>

          {analysis.evidenceGaps.length > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <h2 className="font-display text-sm font-semibold text-amber-400">
                Evidence Gaps & Anomalies
              </h2>
              <ul className="mt-2 space-y-1.5 text-xs text-amber-200/80">
                {analysis.evidenceGaps.map((gap, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span>•</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Affected locations
            </h2>
            <ul className="mt-3 space-y-2">
              {analysis.affectedLocations.map((l) => (
                <li key={`${l.organization}-${l.location}`} className="text-sm">
                  <p className="text-foreground">{l.organization}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {l.location} · {formatNumber(l.quantity)} units
                  </p>
                </li>
              ))}
              {analysis.affectedLocations.length === 0 ? (
                <li className="text-sm text-muted-foreground">Nothing has moved downstream yet.</li>
              ) : null}
            </ul>
            <Link
              to="/supply-chain"
              search={{ batch: incident.batchId, incident: incident.incidentId }}
              className="mt-3 inline-block text-xs text-primary hover:underline"
            >
              View on the supply-chain map
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
