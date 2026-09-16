import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AppShell } from "@/components/layout/AppShell";
import { TraceNode } from "@/components/graph/TraceNode";
import { InvestigationPanel } from "@/components/graph/InvestigationPanel";
import { useTraceData } from "@/hooks/useTraceData";
import {
  applyInvestigationHighlight,
  buildSupplyChainGraph,
  type GraphEdgeData,
  type GraphNodeData,
} from "@/services/graph";
import { formatNumber } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Search {
  batch?: string;
  incident?: string;
}

export const Route = createFileRoute("/supply-chain")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const result: Search = {};
    if (typeof search["batch"] === "string" && search["batch"]) {
      result.batch = search["batch"] as string;
    }
    if (typeof search["incident"] === "string" && search["incident"]) {
      result.incident = search["incident"] as string;
    }
    return result;
  },
  head: () => ({
    meta: [
      { title: "Supply Chain Map - TraceShield" },
      {
        name: "description",
        content:
          "Interactive map of manufacturers, distributors, warehouses and retailers with custody flows between them.",
      },
      { property: "og:title", content: "Supply chain map - TraceShield" },
      {
        property: "og:description",
        content: "Trace every custody hand-off from plant to retail shelf.",
      },
    ],
  }),
  component: SupplyChainPage,
});

const nodeTypes = { traceNode: TraceNode };

const LEGEND = [
  { label: "Batch", className: "border-primary/60 bg-seal-500/10" },
  { label: "Manufacturer", className: "border-border bg-card" },
  { label: "Distributor", className: "border-border bg-card" },
  { label: "Warehouse / Cold Store", className: "border-border bg-card" },
  { label: "Retailer", className: "border-ok-500/40 bg-ok-500/10" },
  { label: "Unknown", className: "border-crit-500/45 bg-crit-500/10" },
];

function SupplyChainPage() {
  const { batch, incident } = Route.useSearch();
  const navigate = useNavigate();
  const { organizations, batches, events, incidents, isLoading, isError, error } = useTraceData();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const selectedIncident = incidents.find((i) => i.incidentId === incident);

  const graph = useMemo(
    () => buildSupplyChainGraph(organizations, batches, events, batch, selectedIncident),
    [organizations, batches, events, batch, selectedIncident],
  );

  const highlighted = useMemo(
    () => applyInvestigationHighlight(graph.nodes, graph.edges, selectedNodeId, selectedEdgeId),
    [graph.nodes, graph.edges, selectedNodeId, selectedEdgeId],
  );

  const selectedNode = highlighted.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = highlighted.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const selectedBatch = batch ? batches.find((b) => b.batchId === batch) : null;
  const selectedAnalysis = selectedIncident
    ? graph.analysesByBatch[selectedIncident.batchId]
    : null;
  const selectedFlow = batch ? graph.flowByBatch[batch] : null;

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const handleNodeClick = useCallback((_: MouseEvent, node: Node<GraphNodeData>) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const handleEdgeClick = useCallback((_: MouseEvent, edge: Edge<GraphEdgeData>) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const updateBatch = (value: string) => {
    clearSelection();
    navigate({
      to: "/supply-chain",
      search: value === "ALL" ? {} : { batch: value },
    });
  };

  const updateIncident = (value: string) => {
    clearSelection();
    if (value === "NONE") {
      navigate({
        to: "/supply-chain",
        search: batch ? { batch } : {},
      });
      return;
    }

    const nextIncident = incidents.find((i) => i.incidentId === value);
    navigate({
      to: "/supply-chain",
      search: nextIncident
        ? { batch: nextIncident.batchId, incident: nextIncident.incidentId }
        : {},
    });
  };

  return (
    <AppShell
      title="Supply chain map"
      subtitle={
        selectedIncident
          ? `${selectedIncident.incidentId} investigation on batch ${selectedIncident.batchId}`
          : selectedBatch
            ? `${selectedBatch.batchId} - ${selectedBatch.productName}`
            : "Manufacturer A into the Lagos and Abuja distribution legs."
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Select value={batch ?? "ALL"} onValueChange={updateBatch}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All batches</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.batchId} value={b.batchId}>
                  {b.batchId} - {b.productName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={incident ?? "NONE"} onValueChange={updateIncident}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">No incident context</SelectItem>
              {incidents.map((i) => (
                <SelectItem key={i.incidentId} value={i.incidentId}>
                  {i.incidentId} - {i.batchId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-4">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`size-3 rounded-sm border ${l.className}`} />
            {l.label}
          </span>
        ))}
      </div>

      {selectedAnalysis || selectedFlow ? (
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          {selectedAnalysis ? (
            <>
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Exposure
                </p>
                <p className="font-display text-lg font-semibold text-crit-400">
                  {selectedAnalysis.exposureRisk}/100
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Evidence
                </p>
                <p className="font-display text-lg font-semibold text-ok-400">
                  {selectedAnalysis.evidenceConfidence}/100
                </p>
              </div>
            </>
          ) : null}
          {selectedFlow ? (
            <div className="rounded-lg border border-border bg-card px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Affected units
              </p>
              <p className="font-display text-lg font-semibold text-foreground">
                {formatNumber(selectedFlow.affectedQuantity)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-[70vh] rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading custody graph...
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-crit-500/40 bg-crit-500/10 p-4 text-sm text-crit-400">
          Supply-chain data could not be loaded: {error?.message ?? "Unknown error"}
        </div>
      ) : graph.nodes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          No custody graph is available for the selected scope.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-[70vh] overflow-hidden rounded-lg border border-border bg-card">
            <ReactFlow
              nodes={highlighted.nodes as Node<GraphNodeData>[]}
              edges={highlighted.edges as Edge<GraphEdgeData>[]}
              nodeTypes={nodeTypes}
              fitView
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onPaneClick={clearSelection}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="var(--ink-700)" gap={20} />
              <MiniMap
                pannable
                zoomable
                maskColor="rgba(0,0,0,0.55)"
                nodeColor={(node) => {
                  const kind = (node as Node<GraphNodeData>).data.kind;
                  if (kind === "RETAILER") return "var(--ok-500)";
                  if (kind === "BATCH") return "var(--seal-500)";
                  if (kind === "UNKNOWN") return "var(--crit-500)";
                  return "var(--mist-500)";
                }}
                style={{ background: "var(--ink-900)" }}
              />
              <Controls />
            </ReactFlow>
          </div>

          <InvestigationPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onClose={clearSelection}
          />
        </div>
      )}
    </AppShell>
  );
}
