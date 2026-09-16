/**
 * Deterministic, transparent recall-scoring engine.
 * No AI, no external calls — every point is explainable and reproducible.
 * Core differentiator: downstream exposure is calculated from supply-chain inventory flow
 * without double-counting units as they move through custody events.
 */
import type {
  AffectedLocation,
  Analysis,
  Batch,
  CustodyEvent,
  Incident,
  Organization,
  Priority,
} from "@/types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const PRIORITY_LABEL: Record<Priority, string> = {
  IMMEDIATE_RECALL: "Immediate Recall",
  URGENT_INVESTIGATION: "Urgent Investigation",
  MONITOR: "Monitor",
  VERIFY_EVIDENCE: "Verify Evidence",
};

const RECOMMENDED_ACTION: Record<Priority, string> = {
  IMMEDIATE_RECALL:
    "Issue a targeted recall notice to every affected location now, quarantine remaining stock and notify the regulator.",
  URGENT_INVESTIGATION:
    "Hold distribution for the affected locations and close the evidence gaps within 24 hours before deciding on a recall.",
  MONITOR:
    "Keep the batch under active surveillance, sample the next delivery and re-score if new custody events arrive.",
  VERIFY_EVIDENCE:
    "Collect further laboratory and custody evidence; there is not enough signal to justify market action yet.",
};

export const EXPOSURE_HIGH_THRESHOLD = 80;
export const CONFIDENCE_HIGH_THRESHOLD = 80;

const SEVERITY_SCORES: Record<Incident["type"], number> = {
  CONTAMINATION: 100,
  COLD_CHAIN_BREAK: 75,
  FOREIGN_BODY: 60,
  LABELLING: 30,
  OTHER: 25,
};

export interface InventoryPosition {
  organizationId: string;
  organizationName: string;
  location: string;
  quantity: number;
  isManufacturer: boolean;
}

export interface InventoryFlowResult {
  affectedLocations: AffectedLocation[];
  affectedQuantity: number;
  accountedQuantity: number;
  unaccountedQuantity: number;
  evidenceGaps: string[];
  chainComplete: boolean;
  duplicateEventsCount: number;
  brokenLinksCount: number;
  inventoryPositions: InventoryPosition[];
}

/** The four documented priority rules using centralized thresholds. */
export function resolvePriority(exposureRisk: number, evidenceConfidence: number): Priority {
  if (exposureRisk >= EXPOSURE_HIGH_THRESHOLD && evidenceConfidence >= CONFIDENCE_HIGH_THRESHOLD) {
    return "IMMEDIATE_RECALL";
  }
  if (exposureRisk >= EXPOSURE_HIGH_THRESHOLD) return "URGENT_INVESTIGATION";
  if (evidenceConfidence >= CONFIDENCE_HIGH_THRESHOLD) return "MONITOR";
  return "VERIFY_EVIDENCE";
}

/**
 * Calculates deterministic inventory flow across custody events.
 * Bounds exposure by batch quantity and tracks current inventory positions.
 */
export function calculateInventoryFlow(
  batch: Batch | undefined,
  events: CustodyEvent[],
  organizations: Organization[],
): InventoryFlowResult {
  const orgName = (id: string) => organizations.find((o) => o.organizationId === id)?.name ?? id;
  const getOrg = (id: string) => organizations.find((o) => o.organizationId === id);

  const batchId = batch?.batchId ?? events[0]?.batchId ?? "UNKNOWN";
  const batchEvents = events.filter((e) => e.batchId === batchId);

  // Deduplicate identical events
  const uniqueEvents: CustodyEvent[] = [];
  const seenEventKeys = new Set<string>();
  let duplicateEventsCount = 0;

  for (const e of batchEvents) {
    const key = `${e.eventId}|${e.type}|${e.fromOrganization}|${e.toOrganization}|${e.quantity}|${e.timestamp}|${e.location}`;
    const dedupeKey = `${e.type}|${e.fromOrganization}|${e.toOrganization}|${e.quantity}|${e.timestamp}|${e.location}`;
    if (seenEventKeys.has(key) || seenEventKeys.has(dedupeKey)) {
      duplicateEventsCount++;
    } else {
      seenEventKeys.add(key);
      seenEventKeys.add(dedupeKey);
      uniqueEvents.push(e);
    }
  }

  // Sort events chronologically
  uniqueEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Determine starting batch quantity
  const totalBatchQty = batch?.quantity ?? Math.max(...uniqueEvents.map((e) => e.quantity), 0);

  const evidenceGaps: string[] = [];
  let brokenLinksCount = 0;

  if (duplicateEventsCount > 0) {
    evidenceGaps.push(`${duplicateEventsCount} duplicate custody event(s) detected and ignored.`);
  }

  // Check previousEventId integrity
  const eventIdMap = new Map<string, CustodyEvent>(uniqueEvents.map((e) => [e.eventId, e]));
  let chainComplete = uniqueEvents.length > 0;

  for (let i = 0; i < uniqueEvents.length; i++) {
    const e = uniqueEvents[i];
    if (!e) continue;
    if (e.previousEventId !== null && e.previousEventId !== undefined) {
      const parent = eventIdMap.get(e.previousEventId);
      if (!parent) {
        brokenLinksCount++;
        chainComplete = false;
        evidenceGaps.push(
          `Broken custody link: Event ${e.eventId} references missing previous event ${e.previousEventId}.`,
        );
      }
    } else if (i > 0 && e.type !== "PRODUCED") {
      chainComplete = false;
    }
  }

  // Inventory balance per organization & location
  interface NodeBalance {
    organizationId: string;
    organizationName: string;
    location: string;
    quantity: number;
    isManufacturer: boolean;
  }
  const balances = new Map<string, NodeBalance>();

  const addBalance = (orgId: string, location: string, qty: number) => {
    const key = `${orgId}|${location}`;
    const org = getOrg(orgId);
    const existing = balances.get(key);
    const isMfr = org?.type === "MANUFACTURER";
    if (existing) {
      existing.quantity += qty;
    } else {
      balances.set(key, {
        organizationId: orgId,
        organizationName: orgName(orgId),
        location,
        quantity: Math.max(0, qty),
        isManufacturer: isMfr,
      });
    }
  };

  const deductBalance = (orgId: string, qty: number): number => {
    let remainingToDeduct = qty;
    for (const b of balances.values()) {
      if (b.organizationId === orgId && b.quantity > 0) {
        const deduct = Math.min(b.quantity, remainingToDeduct);
        b.quantity -= deduct;
        remainingToDeduct -= deduct;
        if (remainingToDeduct <= 0) break;
      }
    }
    return qty - remainingToDeduct;
  };

  // Seed origin manufacturer balance
  const originOrgId =
    batch?.organizationId ??
    uniqueEvents.find((e) => e.type === "PRODUCED")?.fromOrganization ??
    uniqueEvents[0]?.fromOrganization;

  if (originOrgId) {
    const originOrg = getOrg(originOrgId);
    const originLocation = originOrg?.location ?? uniqueEvents[0]?.location ?? "Origin";
    addBalance(originOrgId, originLocation, totalBatchQty);
  }

  let totalSoldQuantity = 0;

  // Process unique events chronologically
  for (let i = 0; i < uniqueEvents.length; i++) {
    const e = uniqueEvents[i];
    if (!e) continue;
    const fromOrg = e.fromOrganization;
    const toOrg = e.toOrganization;
    const qty = e.quantity;

    if (e.type === "PRODUCED") {
      continue;
    } else if (e.type === "SHIPPED" || e.type === "STORED") {
      if (fromOrg !== toOrg) {
        deductBalance(fromOrg, qty);
        addBalance(toOrg, e.location, qty);
      } else {
        addBalance(toOrg, e.location, 0);
      }
    } else if (e.type === "RECEIVED") {
      // Check if this RECEIVED event confirms a prior SHIPPED event for the same movement leg
      const prevEvent = i > 0 ? uniqueEvents[i - 1] : null;
      const isReceiptConfirmation =
        prevEvent &&
        prevEvent.type === "SHIPPED" &&
        prevEvent.fromOrganization === fromOrg &&
        prevEvent.toOrganization === toOrg &&
        prevEvent.quantity === qty;

      if (!isReceiptConfirmation && fromOrg !== toOrg) {
        deductBalance(fromOrg, qty);
        addBalance(toOrg, e.location, qty);
      }
    } else if (e.type === "SOLD") {
      deductBalance(fromOrg, qty);
      totalSoldQuantity += qty;
    }
  }

  // Gather downstream balances (non-manufacturer nodes with positive quantity)
  const downstreamList: AffectedLocation[] = [];
  let downstreamQuantitySum = 0;
  let totalNetworkQuantity = 0;

  for (const b of balances.values()) {
    if (b.quantity > 0) {
      totalNetworkQuantity += b.quantity;
      if (!b.isManufacturer) {
        downstreamQuantitySum += b.quantity;
        downstreamList.push({
          location: b.location,
          organization: b.organizationName,
          quantity: b.quantity,
        });
      }
    }
  }

  const rawAffected = downstreamQuantitySum + totalSoldQuantity;
  const affectedQuantity = Math.min(totalBatchQty, rawAffected);
  const accountedQuantity = Math.min(totalBatchQty, totalNetworkQuantity + totalSoldQuantity);
  const unaccountedQuantity = Math.max(0, totalBatchQty - accountedQuantity);

  if (unaccountedQuantity > 0 && uniqueEvents.length > 0) {
    evidenceGaps.push(
      `${unaccountedQuantity.toLocaleString()} units of batch ${batchId} are unaccounted for in custody events.`,
    );
  }

  downstreamList.sort((a, b) => b.quantity - a.quantity);
  const inventoryPositions = [...balances.values()]
    .map((b) => ({ ...b }))
    .sort((a, b) => a.organizationName.localeCompare(b.organizationName));

  return {
    affectedLocations: downstreamList,
    affectedQuantity,
    accountedQuantity,
    unaccountedQuantity,
    evidenceGaps,
    chainComplete,
    duplicateEventsCount,
    brokenLinksCount,
    inventoryPositions,
  };
}

export interface AnalysisInput {
  incident: Incident;
  batch: Batch | undefined;
  events: CustodyEvent[];
  organizations: Organization[];
}

export function analyseIncident({
  incident,
  batch,
  events,
  organizations,
}: AnalysisInput): Analysis {
  const batchEvents = events
    .filter((e) => e.batchId === incident.batchId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const flow = calculateInventoryFlow(batch, events, organizations);
  const {
    affectedLocations,
    affectedQuantity,
    accountedQuantity,
    unaccountedQuantity,
    evidenceGaps,
  } = flow;

  const totalBatchQty = batch?.quantity ?? Math.max(affectedQuantity, 1);
  const affectedRatio = Math.min(1, affectedQuantity / totalBatchQty);

  const retailLocations = affectedLocations.filter((l) =>
    organizations.some((o) => o.name === l.organization && o.type === "RETAILER"),
  );
  const retailReachCount = retailLocations.length;

  const uniqueGeographicLocations = new Set(affectedLocations.map((l) => l.location));

  // =========================================================================
  // 1. EXPOSURE RISK (30% Qty + 25% Downstream + 20% Consumer + 10% Geo + 15% Severity)
  // =========================================================================
  const affectedQuantityRatioFactor = clamp(affectedRatio * 100);
  const downstreamReachFactor = clamp(Math.min(100, affectedLocations.length * 25));
  const consumerFacingReachFactor = clamp(Math.min(100, retailReachCount * 50));
  const geographicReachFactor = clamp(Math.min(100, uniqueGeographicLocations.size * 35));
  const incidentSeverityFactor = SEVERITY_SCORES[incident.type] ?? 25;

  const rawExposureRisk =
    affectedQuantityRatioFactor * 0.3 +
    downstreamReachFactor * 0.25 +
    consumerFacingReachFactor * 0.2 +
    geographicReachFactor * 0.1 +
    incidentSeverityFactor * 0.15;

  const exposureRisk = clamp(rawExposureRisk);

  // =========================================================================
  // 2. EVIDENCE CONFIDENCE (25% Comp + 25% Chain + 20% Inventory + 10% Temp + 10% Org + 10% Anomaly)
  // =========================================================================

  // Event completeness (0-100): does the chain contain production + custody events?
  let eventCompletenessScore = 40;
  const hasProduced = batchEvents.some((e) => e.type === "PRODUCED");
  const hasDownstreamEvents = batchEvents.some((e) => e.type !== "PRODUCED");
  if (hasProduced) eventCompletenessScore += 30;
  if (hasDownstreamEvents) eventCompletenessScore += 30;
  const eventCompletenessFactor = clamp(eventCompletenessScore);

  // Chain integrity (0-100): previousEventId validity
  let chainIntegrityScore = 100;
  if (flow.brokenLinksCount > 0) {
    chainIntegrityScore -= flow.brokenLinksCount * 35;
  }
  if (!flow.chainComplete && batchEvents.length > 1) {
    chainIntegrityScore -= 15;
  }
  const chainIntegrityFactor = clamp(chainIntegrityScore);

  // Inventory accounting completeness (0-100)
  const inventoryAccountingFactor = clamp((accountedQuantity / totalBatchQty) * 100);

  // Temporal consistency (0-100): verify chronological order along parent-child links
  let temporalInconsistencies = 0;
  const eventMap = new Map<string, CustodyEvent>(batchEvents.map((e) => [e.eventId, e]));
  for (const e of batchEvents) {
    if (e.previousEventId) {
      const parent = eventMap.get(e.previousEventId);
      if (parent && parent.timestamp > e.timestamp) {
        temporalInconsistencies++;
        evidenceGaps.push(
          `Temporal anomaly: Event ${e.eventId} timestamp is earlier than previous event ${parent.eventId}.`,
        );
      }
    }
  }
  const temporalConsistencyFactor = clamp(100 - temporalInconsistencies * 35);

  // Organization/Location completeness (0-100)
  let unknownOrgsCount = 0;
  const orgMap = new Map<string, Organization>(organizations.map((o) => [o.organizationId, o]));
  for (const e of batchEvents) {
    if (!orgMap.has(e.fromOrganization)) unknownOrgsCount++;
    if (!orgMap.has(e.toOrganization)) unknownOrgsCount++;
  }
  if (unknownOrgsCount > 0) {
    evidenceGaps.push(
      `${unknownOrgsCount} custody transfer reference organization(s) not in registry.`,
    );
  }
  const organizationCompletenessFactor = clamp(100 - unknownOrgsCount * 25);

  // Duplicate / Anomaly quality (0-100)
  let anomalyScore = 100;
  if (flow.duplicateEventsCount > 0) {
    anomalyScore -= flow.duplicateEventsCount * 30;
  }
  if (unaccountedQuantity > 0 && batchEvents.length > 0) {
    anomalyScore -= 20;
  }
  const anomalyQualityFactor = clamp(anomalyScore);

  const rawEvidenceConfidence =
    eventCompletenessFactor * 0.25 +
    chainIntegrityFactor * 0.25 +
    inventoryAccountingFactor * 0.2 +
    temporalConsistencyFactor * 0.1 +
    organizationCompletenessFactor * 0.1 +
    anomalyQualityFactor * 0.1;

  const evidenceConfidence = clamp(rawEvidenceConfidence);

  // =========================================================================
  // 3. HUMAN-READABLE REASONS & FACTOR EXPLANATIONS
  // =========================================================================
  const reasons: string[] = [
    `Incident type '${incident.type}' severity contributes factor score of ${incidentSeverityFactor}/100 (weighted 15%).`,
    `${Math.round(affectedRatio * 100)}% of batch quantity (${affectedQuantity.toLocaleString()} / ${totalBatchQty.toLocaleString()} units) is downstream affected (quantity factor: ${affectedQuantityRatioFactor}/100, weighted 30%).`,
    `${affectedLocations.length} active downstream location(s) reached (reach factor: ${downstreamReachFactor}/100, weighted 25%).`,
    `${retailReachCount} retail endpoint(s) reached by consumers (consumer factor: ${consumerFacingReachFactor}/100, weighted 20%).`,
    `${uniqueGeographicLocations.size} unique geographic location(s) affected (geographic factor: ${geographicReachFactor}/100, weighted 10%).`,
    `Event completeness score is ${eventCompletenessFactor}/100 (weighted 25%).`,
    `Custody chain integrity score is ${chainIntegrityFactor}/100 with ${flow.brokenLinksCount} broken link(s) (weighted 25%).`,
    `Inventory accounting completeness score is ${inventoryAccountingFactor}/100 (${accountedQuantity.toLocaleString()} units accounted) (weighted 20%).`,
    `Temporal consistency score is ${temporalConsistencyFactor}/100 with ${temporalInconsistencies} anomaly(ies) (weighted 10%).`,
    `Organization completeness score is ${organizationCompletenessFactor}/100 (weighted 10%).`,
    `Anomaly & duplicate data quality score is ${anomalyQualityFactor}/100 with ${flow.duplicateEventsCount} duplicate(s) (weighted 10%).`,
  ];

  const priority = resolvePriority(exposureRisk, evidenceConfidence);

  const riskFactors = {
    affectedQuantityRatio: affectedQuantityRatioFactor,
    downstreamReach: downstreamReachFactor,
    consumerFacingReach: consumerFacingReachFactor,
    geographicReach: geographicReachFactor,
    incidentSeverity: incidentSeverityFactor,
  };

  const evidenceFactors = {
    eventCompleteness: eventCompletenessFactor,
    chainIntegrity: chainIntegrityFactor,
    inventoryAccounting: inventoryAccountingFactor,
    temporalConsistency: temporalConsistencyFactor,
    organizationCompleteness: organizationCompletenessFactor,
    anomalyQuality: anomalyQualityFactor,
  };

  return {
    analysisId: `ANL-${incident.incidentId}`,
    incidentId: incident.incidentId,
    batchId: incident.batchId,
    affectedLocations,
    affectedQuantity,
    accountedQuantity,
    unaccountedQuantity,
    exposureRisk,
    evidenceConfidence,
    riskFactors,
    evidenceFactors,
    priority,
    reasons,
    evidenceGaps,
    recommendedAction: RECOMMENDED_ACTION[priority],
    generatedAt: new Date().toISOString(),
  };
}
