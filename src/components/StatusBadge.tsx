import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";
import type { BatchStatus, IncidentStatus, Priority, VerificationStatus } from "@/types";
import { PRIORITY_LABEL } from "@/services/riskEngine";

const base =
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]";

const BATCH_TONE: Record<BatchStatus, string> = {
  PRODUCED: "border-mist-500/30 bg-secondary text-mist-300",
  IN_TRANSIT: "border-seal-500/40 bg-seal-500/10 text-seal-400",
  DELIVERED: "border-ok-500/40 bg-ok-500/10 text-ok-400",
  HELD: "border-seal-500/50 bg-seal-500/15 text-seal-400",
  RECALLED: "border-crit-500/50 bg-crit-500/15 text-crit-400",
};

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  return <span className={cn(base, BATCH_TONE[status])}>{titleCase(status)}</span>;
}

const INCIDENT_TONE: Record<IncidentStatus, string> = {
  OPEN: "border-crit-500/50 bg-crit-500/12 text-crit-400",
  INVESTIGATING: "border-seal-500/45 bg-seal-500/12 text-seal-400",
  RESOLVED: "border-ok-500/40 bg-ok-500/10 text-ok-400",
  CLOSED: "border-mist-500/30 bg-secondary text-mist-400",
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={cn(base, INCIDENT_TONE[status])}>{titleCase(status)}</span>;
}

const PRIORITY_TONE: Record<Priority, string> = {
  IMMEDIATE_RECALL: "border-crit-500/60 bg-crit-500/18 text-crit-400 seal-pulse",
  URGENT_INVESTIGATION: "border-seal-500/60 bg-seal-500/18 text-seal-400",
  MONITOR: "border-ok-500/45 bg-ok-500/12 text-ok-400",
  VERIFY_EVIDENCE: "border-mist-500/35 bg-secondary text-mist-300",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={cn(base, PRIORITY_TONE[priority])}>{PRIORITY_LABEL[priority]}</span>;
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <span
      className={cn(
        base,
        status === "VERIFIED"
          ? "border-ok-500/45 bg-ok-500/12 text-ok-400"
          : "border-mist-500/30 bg-secondary text-mist-400",
      )}
    >
      {status === "VERIFIED" ? "Verified" : "Pending chain"}
    </span>
  );
}

export function CryptoStatusBadge({
  status,
}: {
  status: "MATCH" | "MISMATCH" | "NO_STORED_HASH" | "INVALID_DATA";
}) {
  if (status === "MATCH") {
    return (
      <span className={cn(base, "border-ok-500/45 bg-ok-500/12 text-ok-400")}>
        CRYPTOGRAPHIC MATCH
      </span>
    );
  }
  if (status === "MISMATCH") {
    return (
      <span className={cn(base, "border-crit-500/60 bg-crit-500/18 text-crit-400 font-bold")}>
        CRYPTOGRAPHIC MISMATCH
      </span>
    );
  }
  return (
    <span className={cn(base, "border-seal-500/40 bg-seal-500/10 text-seal-400")}>
      HASH NOT AVAILABLE
    </span>
  );
}

export function BlockchainStatusBadge({
  status,
}: {
  status: "VERIFIED" | "PENDING_INTEGRATION" | "UNCONFIGURED" | string;
}) {
  if (status === "VERIFIED") {
    return (
      <span className={cn(base, "border-ok-500/45 bg-ok-500/12 text-ok-400 font-semibold")}>
        BLOCKCHAIN VERIFIED
      </span>
    );
  }
  return (
    <span className={cn(base, "border-mist-500/30 bg-secondary text-mist-400")}>
      PENDING BLOCKCHAIN ANCHOR
    </span>
  );
}

export function CombinedStatusBadge({
  state,
}: {
  state:
    | "LOCAL_VERIFIED"
    | "BLOCKCHAIN_VERIFIED"
    | "FULLY_VERIFIED"
    | "TAMPERED"
    | "PENDING_BLOCKCHAIN"
    | "VERIFICATION_UNAVAILABLE"
    | string;
}) {
  if (state === "FULLY_VERIFIED" || state === "BLOCKCHAIN_VERIFIED") {
    return (
      <span className={cn(base, "border-ok-500/50 bg-ok-500/15 text-ok-400 font-bold")}>
        FULLY VERIFIED
      </span>
    );
  }
  if (state === "LOCAL_VERIFIED") {
    return (
      <span className={cn(base, "border-ok-500/40 bg-ok-500/10 text-ok-400")}>LOCAL VERIFIED</span>
    );
  }
  if (state === "TAMPERED" || state === "CRYPTOGRAPHIC_MISMATCH") {
    return (
      <span className={cn(base, "border-crit-500/60 bg-crit-500/18 text-crit-400 font-bold")}>
        TAMPERED / MISMATCH
      </span>
    );
  }
  if (state === "PENDING_BLOCKCHAIN") {
    return (
      <span className={cn(base, "border-mist-500/30 bg-secondary text-mist-400")}>
        PENDING ANCHOR
      </span>
    );
  }
  return (
    <span className={cn(base, "border-seal-500/40 bg-seal-500/10 text-seal-400")}>UNAVAILABLE</span>
  );
}
