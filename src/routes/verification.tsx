import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/MetricCard";
import {
  BlockchainStatusBadge,
  CombinedStatusBadge,
  CryptoStatusBadge,
} from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTraceData } from "@/hooks/useTraceData";
import { formatDateTime, formatNumber, titleCase } from "@/lib/format";
import {
  createEventHash,
  getCanonicalEventPayload,
  serializeCanonicalPayload,
  verifyEventHash,
} from "@/services/eventHash";
import {
  getEventVerificationSummary,
  WEB3_CONFIG,
} from "@/services/web3Anchor";
import type { CustodyEvent } from "@/types";

export const Route = createFileRoute("/verification")({
  head: () => ({
    meta: [
      { title: "Verification Ledger — TraceShield" },
      {
        name: "description",
        content:
          "Chain-of-custody verification ledger featuring deterministic SHA-256 cryptographic fingerprints and genuine Base Sepolia Web3 anchoring.",
      },
      { property: "og:title", content: "Verification ledger — TraceShield" },
      {
        property: "og:description",
        content: "Deterministic cryptographic verification and Base Sepolia Web3 chain anchoring ledger.",
      },
    ],
  }),
  component: VerificationPage,
});

function VerificationPage() {
  const { events, organizations } = useTraceData();
  const [selectedEvent, setSelectedEvent] = useState<CustodyEvent | null>(null);
  const [tamperedQuantity, setTamperedQuantity] = useState<string>("");
  const [tamperedLocation, setTamperedLocation] = useState<string>("");
  const [isTampering, setIsTampering] = useState<boolean>(false);

  const name = (id: string) =>
    organizations.find((o: { organizationId: string; name: string }) => o.organizationId === id)?.name ?? id;

  const cryptoMatches = events.filter((e: CustodyEvent) => verifyEventHash(e) === "MATCH").length;
  const cryptoMismatches = events.filter((e: CustodyEvent) => verifyEventHash(e) === "MISMATCH").length;
  const blockchainVerified = events.filter((e: CustodyEvent) => e.verificationStatus === "VERIFIED").length;
  const pendingAnchors = events.length - blockchainVerified;

  const openInspector = (event: CustodyEvent) => {
    setSelectedEvent(event);
    setTamperedQuantity(String(event.quantity));
    setTamperedLocation(event.location);
    setIsTampering(false);
  };

  const inspectPayloadEvent: CustodyEvent | null = selectedEvent
    ? {
        ...selectedEvent,
        quantity: isTampering ? Number(tamperedQuantity) || 0 : selectedEvent.quantity,
        location: isTampering ? tamperedLocation : selectedEvent.location,
      }
    : null;

  const inspectSummary = inspectPayloadEvent
    ? getEventVerificationSummary(inspectPayloadEvent)
    : null;

  const canonicalPayload = inspectPayloadEvent
    ? getCanonicalEventPayload(inspectPayloadEvent)
    : null;

  return (
    <AppShell
      title="Verification ledger"
      subtitle="Deterministic SHA-256 event fingerprinting and Base Sepolia Web3 chain anchoring verification."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Custody records" value={formatNumber(events.length)} />
        <MetricCard
          label="Local cryptographic match"
          value={formatNumber(cryptoMatches)}
          tone={cryptoMatches > 0 ? "ok" : "default"}
          hint="Verified SHA-256 fingerprints"
        />
        <MetricCard
          label="Cryptographic mismatch"
          value={formatNumber(cryptoMismatches)}
          tone={cryptoMismatches > 0 ? "critical" : "ok"}
          hint="Tampered / altered records"
        />
        <MetricCard
          label="Base Sepolia Anchors"
          value={formatNumber(blockchainVerified)}
          tone={blockchainVerified > 0 ? "ok" : "default"}
          hint={`${pendingAnchors} pending anchor`}
        />
      </div>

      <div className="mt-5 rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-sm font-semibold text-foreground">
          3-Layer Verification Architecture (Local Cryptographic Integrity + Web3 Chain Anchoring)
        </h2>
        <p className="mt-2 text-sm text-mist-400">
          TraceShield provides cryptographic proof of supply-chain custody:
          <br />
          <strong>Layer 1 (Local Integrity):</strong> Deterministic SHA-256 fingerprint generated from canonical payload fields.
          <br />
          <strong>Layer 2 (Blockchain Existence):</strong> Immutable 32-byte event hash anchored on Base Sepolia contract.
          <br />
          <strong>Layer 3 (Combined Proof):</strong> Immediate tamper detection when any canonical field is modified.
        </p>
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-4 py-3">Event ID</th>
              <th className="px-4 py-3">Batch ID</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Hand-off</th>
              <th className="px-4 py-3">Recorded</th>
              <th className="px-4 py-3">Event Hash (SHA-256)</th>
              <th className="px-4 py-3">Local Integrity</th>
              <th className="px-4 py-3">Blockchain Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((e: CustodyEvent) => {
              const summary = getEventVerificationSummary(e);
              return (
                <tr key={e.eventId} className="hover:bg-secondary/40">
                  <td className="px-4 py-3 font-mono text-xs text-mist-300">{e.eventId}</td>
                  <td className="px-4 py-3">
                    <Link
                      to="/batches/$batchId"
                      params={{ batchId: e.batchId }}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {e.batchId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{titleCase(e.type)}</td>
                  <td className="px-4 py-3 text-xs text-mist-400">
                    {name(e.fromOrganization)} → {name(e.toOrganization)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-mist-400">
                    {formatDateTime(e.timestamp)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-mist-400">
                    {e.eventHash ? (
                      <span title={e.eventHash}>
                        {e.eventHash.slice(0, 10)}...{e.eventHash.slice(-8)}
                      </span>
                    ) : (
                      <span className="text-mist-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <CryptoStatusBadge status={summary.cryptoStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <BlockchainStatusBadge status={summary.blockchainStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-mono text-[11px]"
                      onClick={() => openInspector(e)}
                    >
                      Inspect Hash
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cryptographic & Web3 Hash Inspection Modal */}
      <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-base">
              Cryptographic & Web3 Verification — {selectedEvent?.eventId}
            </DialogTitle>
          </DialogHeader>

          {selectedEvent && inspectPayloadEvent && inspectSummary && canonicalPayload && (
            <div className="space-y-4 text-xs">
              <div className="rounded border border-border bg-secondary/30 p-3">
                <p className="text-mist-300">
                  <span className="font-semibold text-foreground">Explanation:</span> This SHA-256 fingerprint guarantees data integrity. Changing any hashed event field produces a different hash.
                </p>
              </div>

              {/* Status Banner */}
              <div className="grid gap-2 sm:grid-cols-3 rounded border border-border bg-card p-3">
                <div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Local Integrity</div>
                  <div className="mt-1">
                    <CryptoStatusBadge status={inspectSummary.cryptoStatus} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Blockchain Status</div>
                  <div className="mt-1">
                    <BlockchainStatusBadge status={inspectSummary.blockchainStatus} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Combined Overall</div>
                  <div className="mt-1">
                    <CombinedStatusBadge state={inspectSummary.combinedState} />
                  </div>
                </div>
              </div>

              {/* Web3 Network Details */}
              <div className="rounded border border-border bg-card p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Network:</span>
                  <span className="text-foreground">{WEB3_CONFIG.network}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Anchor Contract:</span>
                  <span className="text-mist-300">
                    {WEB3_CONFIG.contractAddress ? (
                      `${WEB3_CONFIG.contractAddress.slice(0, 10)}...${WEB3_CONFIG.contractAddress.slice(-8)}`
                    ) : (
                      "Not configured (Set VITE_ANCHOR_CONTRACT_ADDRESS)"
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction Hash:</span>
                  <span className="text-mist-300">
                    {selectedEvent.blockchainTxHash ? (
                      selectedEvent.blockchainTxHash
                    ) : (
                      "Blockchain: Not anchored"
                    )}
                  </span>
                </div>
              </div>

              {/* Hash Comparison */}
              <div className="space-y-2 rounded border border-border bg-card p-3 font-mono text-[11px]">
                <div>
                  <div className="text-muted-foreground">STORED EVENT HASH (Original):</div>
                  <div className="mt-0.5 break-all text-mist-300">
                    {selectedEvent.eventHash || "(No hash stored)"}
                  </div>
                </div>
                <div className="pt-2 border-t border-border/60">
                  <div className="text-muted-foreground">RECALCULATED EVENT HASH (Current Data):</div>
                  <div className={`mt-0.5 break-all ${inspectSummary.cryptoStatus === "MISMATCH" ? "text-crit-400 font-bold" : "text-ok-400"}`}>
                    {createEventHash(inspectPayloadEvent)}
                  </div>
                </div>
              </div>

              {/* Canonical Payload Inspection */}
              <div className="rounded border border-border bg-card p-3 space-y-2">
                <div className="font-mono text-[10px] uppercase text-muted-foreground">
                  Canonical Event Payload (SHA-256 Input)
                </div>
                <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-[11px] text-mist-300">
                  {serializeCanonicalPayload(canonicalPayload)}
                </pre>
              </div>

              {/* Tamper Testing Tool */}
              <div className="rounded border border-border bg-card p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-foreground">
                    Interactive Verification Test
                  </span>

                  <Button
                    variant={isTampering ? "destructive" : "outline"}
                    size="sm"
                    className="font-mono text-[11px]"
                    onClick={() => {
                      if (!isTampering) {
                        setIsTampering(true);
                        setTamperedQuantity("9999");
                      } else {
                        setIsTampering(false);
                        setTamperedQuantity(String(selectedEvent.quantity));
                        setTamperedLocation(selectedEvent.location);
                      }
                    }}
                  >
                    {isTampering ? "Reset Original Event Data" : "Simulate Data Tampering"}
                  </Button>
                </div>

                {isTampering && (
                  <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Modify Quantity</Label>
                      <Input
                        type="number"
                        className="h-8 font-mono text-xs"
                        value={tamperedQuantity}
                        onChange={(e) => setTamperedQuantity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Modify Location</Label>
                      <Input
                        type="text"
                        className="h-8 font-mono text-xs"
                        value={tamperedLocation}
                        onChange={(e) => setTamperedLocation(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
