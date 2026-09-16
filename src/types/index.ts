/** TraceShield domain entities. Mirrors the Firestore collection structure. */

export type OrganizationType = "MANUFACTURER" | "DISTRIBUTOR" | "WAREHOUSE" | "RETAILER";

export interface Organization {
  organizationId: string;
  name: string;
  type: OrganizationType;
  location: string;
  isDemo?: boolean;
}

export interface User {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  organizationId: string;
}

export type BatchStatus = "PRODUCED" | "IN_TRANSIT" | "DELIVERED" | "HELD" | "RECALLED";

export interface Batch {
  batchId: string;
  productName: string;
  quantity: number;
  productionDate: string;
  expiryDate: string;
  origin: string;
  organizationId: string;
  status: BatchStatus;
  createdAt: string;
  isDemo?: boolean;
}

export type CustodyEventType =
  "PRODUCED" | "SHIPPED" | "RECEIVED" | "STORED" | "INSPECTED" | "SOLD";

/**
 * Blockchain anchoring is NOT implemented in this MVP.
 * `eventHash`, `blockchainTxHash` stay empty and `verificationStatus`
 * stays "PENDING_INTEGRATION" until the chain layer is added.
 */
export type VerificationStatus = "PENDING_INTEGRATION" | "VERIFIED";

export interface CustodyEvent {
  eventId: string;
  batchId: string;
  type: CustodyEventType;
  fromOrganization: string;
  toOrganization: string;
  location: string;
  quantity: number;
  timestamp: string;
  previousEventId: string | null;
  eventHash: string;
  blockchainTxHash: string;
  verificationStatus: VerificationStatus;
  isDemo?: boolean;
}

export type IncidentType =
  "CONTAMINATION" | "COLD_CHAIN_BREAK" | "FOREIGN_BODY" | "LABELLING" | "OTHER";

export type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "CLOSED";

export interface Incident {
  incidentId: string;
  batchId: string;
  type: IncidentType;
  description: string;
  status: IncidentStatus;
  createdAt: string;
  createdBy: string;
  isDemo?: boolean;
}

export type Priority = "IMMEDIATE_RECALL" | "URGENT_INVESTIGATION" | "MONITOR" | "VERIFY_EVIDENCE";

export interface AffectedLocation {
  location: string;
  organization: string;
  quantity: number;
}

export interface RiskFactors {
  affectedQuantityRatio: number;
  downstreamReach: number;
  consumerFacingReach: number;
  geographicReach: number;
  incidentSeverity: number;
}

export interface EvidenceFactors {
  eventCompleteness: number;
  chainIntegrity: number;
  inventoryAccounting: number;
  temporalConsistency: number;
  organizationCompleteness: number;
  anomalyQuality: number;
}

export interface Analysis {
  analysisId: string;
  incidentId: string;
  batchId: string;
  affectedLocations: AffectedLocation[];
  affectedQuantity: number;
  accountedQuantity: number;
  unaccountedQuantity: number;
  exposureRisk: number;
  evidenceConfidence: number;
  riskFactors?: RiskFactors;
  evidenceFactors?: EvidenceFactors;
  priority: Priority;
  reasons: string[];
  evidenceGaps: string[];
  recommendedAction: string;
  generatedAt: string;
}
