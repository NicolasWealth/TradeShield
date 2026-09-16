import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { GraphEvidenceState, GraphNodeData, GraphNodeKind } from "@/services/graph";

const TONE: Record<GraphNodeKind, string> = {
  BATCH: "border-primary/60 bg-seal-500/10",
  MANUFACTURER: "border-border bg-card",
  DISTRIBUTOR: "border-border bg-card",
  WAREHOUSE: "border-border bg-card",
  RETAILER: "border-ok-500/40 bg-ok-500/8",
  UNKNOWN: "border-crit-500/45 bg-crit-500/10",
};

const EVIDENCE_TONE: Record<GraphEvidenceState, string> = {
  VERIFIED: "bg-ok-500",
  PENDING_VERIFICATION: "bg-seal-500",
  EVIDENCE_GAP: "bg-crit-500",
  UNKNOWN: "bg-mist-500",
};

export function TraceNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const isSelected = selected || data.investigationState === "selected";
  const isConnected = data.investigationState === "connected";
  const isDimmed = data.investigationState === "dimmed";

  return (
    <div
      className={cn(
        "w-56 rounded-md border px-3 py-2 shadow-sm transition-all",
        TONE[data.kind],
        isSelected && "border-primary bg-seal-500/15 ring-2 ring-primary/80",
        isConnected && "border-seal-500/70 bg-seal-500/8",
        isDimmed && "opacity-30 grayscale",
      )}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          {data.kind}
        </p>
        <span
          className={cn("size-2 rounded-full", EVIDENCE_TONE[data.evidenceState])}
          title={data.evidenceState.replace(/_/g, " ")}
        />
      </div>
      <p className="truncate font-display text-sm font-medium text-foreground">{data.label}</p>
      <p className="truncate text-xs text-mist-400">{data.subtitle}</p>
      <dl className="mt-2 space-y-0.5">
        {data.detail.slice(0, 3).map((d) => (
          <div key={d.label} className="flex justify-between gap-2 text-[10px]">
            <dt className="text-muted-foreground">{d.label}</dt>
            <dd className="truncate font-mono text-mist-300">{d.value}</dd>
          </div>
        ))}
      </dl>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
