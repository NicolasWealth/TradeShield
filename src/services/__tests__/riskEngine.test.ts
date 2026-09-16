import { calculateInventoryFlow, analyseIncident } from "../riskEngine.ts";
import type { Batch, CustodyEvent, Incident, Organization } from "@/types";

const testOrgs: Organization[] = [
  { organizationId: "MFR-1", name: "Manufacturer A", type: "MANUFACTURER", location: "Ogun" },
  { organizationId: "DIST-1", name: "Distributor Lagos", type: "DISTRIBUTOR", location: "Lagos" },
  { organizationId: "WH-1", name: "Warehouse Ikeja", type: "WAREHOUSE", location: "Ikeja" },
  { organizationId: "RET-A", name: "Retailer Ikeja", type: "RETAILER", location: "Ikeja" },
  { organizationId: "RET-B", name: "Retailer Lekki", type: "RETAILER", location: "Lekki" },
];

const testBatch: Batch = {
  batchId: "B-TEST-100",
  productName: "Test Product",
  quantity: 5000,
  productionDate: "2026-09-01T00:00:00Z",
  expiryDate: "2026-12-01T00:00:00Z",
  origin: "Ogun",
  organizationId: "MFR-1",
  status: "IN_TRANSIT",
  createdAt: "2026-09-01T00:00:00Z",
};

const testIncident: Incident = {
  incidentId: "INC-TEST-1",
  batchId: "B-TEST-100",
  type: "CONTAMINATION",
  description:
    "Detailed contamination test report exceeding 120 characters to ensure full description confidence score calculation is applied.",
  status: "OPEN",
  createdAt: "2026-09-02T10:00:00Z",
  createdBy: "USR-1",
};

export function runAllRiskEngineTests(): {
  passed: number;
  failed: number;
  results: Array<{ name: string; success: boolean; details?: string }>;
} {
  const results: Array<{ name: string; success: boolean; details?: string }> = [];

  const assert = (name: string, condition: boolean, details?: string) => {
    if (condition) {
      results.push({ name, success: true });
    } else if (details) {
      results.push({ name, success: false, details });
    } else {
      results.push({ name, success: false });
    }
  };

  // Test 1: Linear Custody Chain (5,000 -> Dist -> WH -> Ret = 5,000 affected, not 15,000)
  try {
    const events: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E3",
        batchId: "B-TEST-100",
        type: "RECEIVED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T03:00:00Z",
        previousEventId: "E2",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E4",
        batchId: "B-TEST-100",
        type: "STORED",
        fromOrganization: "DIST-1",
        toOrganization: "WH-1",
        location: "Ikeja",
        quantity: 5000,
        timestamp: "2026-09-01T04:00:00Z",
        previousEventId: "E3",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E5",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "WH-1",
        toOrganization: "RET-A",
        location: "Ikeja",
        quantity: 5000,
        timestamp: "2026-09-01T05:00:00Z",
        previousEventId: "E4",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const res = calculateInventoryFlow(testBatch, events, testOrgs);
    assert(
      "Test 1: Linear chain downstream exposure",
      res.affectedQuantity === 5000,
      `Expected 5000, got ${res.affectedQuantity}`,
    );
    assert(
      "Test 1: Linear chain single active downstream location",
      res.affectedLocations.length === 1 &&
        res.affectedLocations[0]?.organization === "Retailer Ikeja",
      `Expected 1 location (Retailer Ikeja), got ${res.affectedLocations.length}`,
    );
  } catch (err: unknown) {
    assert("Test 1: Linear chain", false, err instanceof Error ? err.message : String(err));
  }

  // Test 2: Split Inventory (5,000 -> WH -> 2,500 Ret A + 2,500 Ret B = 5,000)
  try {
    const events: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "WH-1",
        location: "Ikeja",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E3",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "WH-1",
        toOrganization: "RET-A",
        location: "Ikeja",
        quantity: 2500,
        timestamp: "2026-09-01T03:00:00Z",
        previousEventId: "E2",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E4",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "WH-1",
        toOrganization: "RET-B",
        location: "Lekki",
        quantity: 2500,
        timestamp: "2026-09-01T04:00:00Z",
        previousEventId: "E3",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const res = calculateInventoryFlow(testBatch, events, testOrgs);
    assert(
      "Test 2: Split inventory total exposure",
      res.affectedQuantity === 5000,
      `Expected 5000, got ${res.affectedQuantity}`,
    );
    assert(
      "Test 2: Split inventory downstream locations count",
      res.affectedLocations.length === 2,
      `Expected 2 locations, got ${res.affectedLocations.length}`,
    );
  } catch (err: unknown) {
    assert("Test 2: Split inventory", false, err instanceof Error ? err.message : String(err));
  }

  // Test 3: Partial Shipment (5,000 -> Dist -> 2,000 Ret A + 1,000 Ret B = 3,000 Ret + 2,000 Dist = 5,000)
  try {
    const events: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E3",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "DIST-1",
        toOrganization: "RET-A",
        location: "Ikeja",
        quantity: 2000,
        timestamp: "2026-09-01T03:00:00Z",
        previousEventId: "E2",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E4",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "DIST-1",
        toOrganization: "RET-B",
        location: "Lekki",
        quantity: 1000,
        timestamp: "2026-09-01T04:00:00Z",
        previousEventId: "E3",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const res = calculateInventoryFlow(testBatch, events, testOrgs);
    assert(
      "Test 3: Partial shipment downstream total",
      res.affectedQuantity === 5000,
      `Expected 5000 total downstream, got ${res.affectedQuantity}`,
    );
    assert(
      "Test 3: Distributor retains 2000 balance",
      res.affectedLocations.some(
        (l) => l.organization === "Distributor Lagos" && l.quantity === 2000,
      ),
      "Distributor Lagos should retain 2000 units",
    );
  } catch (err: unknown) {
    assert("Test 3: Partial shipment", false, err instanceof Error ? err.message : String(err));
  }

  // Test 4: Return Events (inventory returned to manufacturer removed from downstream exposure)
  try {
    const events: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E3",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "DIST-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T03:00:00Z",
        previousEventId: "E2",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const res = calculateInventoryFlow(testBatch, events, testOrgs);
    assert(
      "Test 4: Returned inventory downstream exposure is 0",
      res.affectedQuantity === 0,
      `Expected 0 downstream exposure after return, got ${res.affectedQuantity}`,
    );
  } catch (err: unknown) {
    assert("Test 4: Return events", false, err instanceof Error ? err.message : String(err));
  }

  // Test 5: Duplicate Event Handling (identical events do not inflate quantity)
  try {
    const events: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const res = calculateInventoryFlow(testBatch, events, testOrgs);
    assert(
      "Test 5: Duplicate event deduplication",
      res.duplicateEventsCount === 1,
      `Expected 1 duplicate, got ${res.duplicateEventsCount}`,
    );
    assert(
      "Test 5: Duplicate event exposure unchanged",
      res.affectedQuantity === 5000,
      `Expected 5000, got ${res.affectedQuantity}`,
    );
  } catch (err: unknown) {
    assert("Test 5: Duplicate events", false, err instanceof Error ? err.message : String(err));
  }

  // Test 6: Broken previousEventId Chain (does not crash, records evidence gap, lowers confidence)
  try {
    const events: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "MISSING-EVT-999",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const res = calculateInventoryFlow(testBatch, events, testOrgs);
    assert(
      "Test 6: Broken chain detected",
      res.brokenLinksCount === 1,
      `Expected 1 broken link, got ${res.brokenLinksCount}`,
    );
    assert(
      "Test 6: Evidence gap generated",
      res.evidenceGaps.length > 0,
      "Expected evidence gaps to be recorded",
    );

    const analysis = analyseIncident({
      incident: testIncident,
      batch: testBatch,
      events,
      organizations: testOrgs,
    });
    assert(
      "Test 6: Incident analysis does not crash",
      analysis.incidentId === "INC-TEST-1",
      "Analysis should complete successfully",
    );
  } catch (err: unknown) {
    assert("Test 6: Broken chain", false, err instanceof Error ? err.message : String(err));
  }

  // Test 7: Multiple Downstream Branches (Lagos vs Abuja)
  try {
    const events: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 3000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E3",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "WH-1",
        location: "Ikeja",
        quantity: 2000,
        timestamp: "2026-09-01T03:00:00Z",
        previousEventId: "E2",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const res = calculateInventoryFlow(testBatch, events, testOrgs);
    assert(
      "Test 7: Multiple branches total exposure bounded",
      res.affectedQuantity === 5000,
      `Expected 5000, got ${res.affectedQuantity}`,
    );
    assert(
      "Test 7: Branch locations recorded",
      res.affectedLocations.length === 2,
      `Expected 2 branch locations, got ${res.affectedLocations.length}`,
    );
  } catch (err: unknown) {
    assert("Test 7: Multiple branches", false, err instanceof Error ? err.message : String(err));
  }

  // Test 8: Batch Quantity Upper Bound Constraint (cannot exceed 5,000 total batch quantity)
  try {
    const events: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E3",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "DIST-1",
        toOrganization: "WH-1",
        location: "Ikeja",
        quantity: 5000,
        timestamp: "2026-09-01T03:00:00Z",
        previousEventId: "E2",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E4",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "WH-1",
        toOrganization: "RET-A",
        location: "Ikeja",
        quantity: 5000,
        timestamp: "2026-09-01T04:00:00Z",
        previousEventId: "E3",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const res = calculateInventoryFlow(testBatch, events, testOrgs);
    assert(
      "Test 8: Upper bound check",
      res.affectedQuantity <= 5000,
      `Affected quantity ${res.affectedQuantity} exceeds batch quantity 5000!`,
    );
  } catch (err: unknown) {
    assert("Test 8: Upper bound", false, err instanceof Error ? err.message : String(err));
  }

  // Test 9: Incomplete Inventory Accounting (unaccounted quantity flagged)
  try {
    const batchSmall: Batch = { ...testBatch, quantity: 5000 };
    const events: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 3000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const res = calculateInventoryFlow(batchSmall, events, testOrgs);
    assert(
      "Test 9: Accounted quantity is 5000 (3000 at Dist + 2000 retained at Mfr)",
      res.accountedQuantity === 5000,
      `Expected 5000 accounted, got ${res.accountedQuantity}`,
    );
    assert(
      "Test 9: Unaccounted quantity is 0 when Mfr balance remains",
      res.unaccountedQuantity === 0,
      `Expected 0 unaccounted, got ${res.unaccountedQuantity}`,
    );
  } catch (err: unknown) {
    assert(
      "Test 9: Incomplete accounting",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Test 11: Exposure Risk Bounded 0–100
  try {
    const analysis = analyseIncident({
      incident: testIncident,
      batch: testBatch,
      events: [],
      organizations: testOrgs,
    });
    assert(
      "Test 11: Exposure risk bounded >= 0",
      analysis.exposureRisk >= 0,
      `Exposure risk ${analysis.exposureRisk} < 0`,
    );
    assert(
      "Test 11: Exposure risk bounded <= 100",
      analysis.exposureRisk <= 100,
      `Exposure risk ${analysis.exposureRisk} > 100`,
    );
  } catch (err: unknown) {
    assert(
      "Test 11: Exposure risk bounding",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Test 12: Evidence Confidence Bounded 0–100
  try {
    const analysis = analyseIncident({
      incident: testIncident,
      batch: testBatch,
      events: [],
      organizations: testOrgs,
    });
    assert(
      "Test 12: Evidence confidence bounded >= 0",
      analysis.evidenceConfidence >= 0,
      `Evidence confidence ${analysis.evidenceConfidence} < 0`,
    );
    assert(
      "Test 12: Evidence confidence bounded <= 100",
      analysis.evidenceConfidence <= 100,
      `Evidence confidence ${analysis.evidenceConfidence} > 100`,
    );
  } catch (err: unknown) {
    assert(
      "Test 12: Evidence confidence bounding",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Test 13: Decoupling: High Risk + Low Confidence = URGENT_INVESTIGATION
  try {
    // Severe contamination incident with high downstream reach but broken chain & missing orgs (low confidence)
    const severeIncident: Incident = { ...testIncident, type: "CONTAMINATION" };
    const incompleteEvents: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "UNKNOWN_ORG_1",
        toOrganization: "RET-A",
        location: "Ikeja",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: "MISSING_EVT",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "PENDING_INTEGRATION",
      },
    ];
    const analysis = analyseIncident({
      incident: severeIncident,
      batch: testBatch,
      events: incompleteEvents,
      organizations: testOrgs,
    });
    assert(
      "Test 13: Decoupled high risk low confidence priority",
      analysis.exposureRisk >= 80 && analysis.evidenceConfidence < 80
        ? analysis.priority === "URGENT_INVESTIGATION"
        : true,
      `Expected URGENT_INVESTIGATION, got ${analysis.priority} (risk=${analysis.exposureRisk}, conf=${analysis.evidenceConfidence})`,
    );
  } catch (err: unknown) {
    assert("Test 13: Decoupling test", false, err instanceof Error ? err.message : String(err));
  }

  // Test 14: Decoupling: High Risk + High Confidence = IMMEDIATE_RECALL
  try {
    const severeIncident: Incident = { ...testIncident, type: "CONTAMINATION" };
    const fullVerifiedEvents: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "hash1",
        blockchainTxHash: "tx1",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "hash2",
        blockchainTxHash: "tx2",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E3",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "DIST-1",
        toOrganization: "RET-A",
        location: "Ikeja",
        quantity: 2500,
        timestamp: "2026-09-01T03:00:00Z",
        previousEventId: "E2",
        eventHash: "hash3",
        blockchainTxHash: "tx3",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E4",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "DIST-1",
        toOrganization: "RET-B",
        location: "Lekki",
        quantity: 2500,
        timestamp: "2026-09-01T04:00:00Z",
        previousEventId: "E3",
        eventHash: "hash4",
        blockchainTxHash: "tx4",
        verificationStatus: "VERIFIED",
      },
    ];
    const analysis = analyseIncident({
      incident: severeIncident,
      batch: testBatch,
      events: fullVerifiedEvents,
      organizations: testOrgs,
    });
    assert(
      "Test 14: High risk and high confidence produces IMMEDIATE_RECALL",
      analysis.priority === "IMMEDIATE_RECALL",
      `Expected IMMEDIATE_RECALL, got ${analysis.priority} (risk=${analysis.exposureRisk}, conf=${analysis.evidenceConfidence})`,
    );
  } catch (err: unknown) {
    assert(
      "Test 14: Immediate recall test",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Test 15: Removal of Event-Count Bias (Adding duplicate custody events does not increase confidence)
  try {
    const baseEvents: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const dupEvents: CustodyEvent[] = [
      ...baseEvents,
      {
        eventId: "E2-DUP",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const aBase = analyseIncident({
      incident: testIncident,
      batch: testBatch,
      events: baseEvents,
      organizations: testOrgs,
    });
    const aDup = analyseIncident({
      incident: testIncident,
      batch: testBatch,
      events: dupEvents,
      organizations: testOrgs,
    });

    assert(
      "Test 15: Duplicate events do not increase confidence",
      aDup.evidenceConfidence <= aBase.evidenceConfidence,
      `Duplicate events increased confidence from ${aBase.evidenceConfidence} to ${aDup.evidenceConfidence}!`,
    );
  } catch (err: unknown) {
    assert(
      "Test 15: Event count bias test",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Test 16: Factor Breakdown Present
  try {
    const analysis = analyseIncident({
      incident: testIncident,
      batch: testBatch,
      events: [],
      organizations: testOrgs,
    });
    assert(
      "Test 16: Risk factors object present",
      !!analysis.riskFactors,
      "Expected riskFactors to be defined",
    );
    assert(
      "Test 16: Evidence factors object present",
      !!analysis.evidenceFactors,
      "Expected evidenceFactors to be defined",
    );
  } catch (err: unknown) {
    assert(
      "Test 16: Factor breakdown test",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Test 17: Temporal Consistency Anomaly Penalty
  try {
    const timeAnomalyEvents: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T05:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const analysis = analyseIncident({
      incident: testIncident,
      batch: testBatch,
      events: timeAnomalyEvents,
      organizations: testOrgs,
    });
    assert(
      "Test 17: Temporal inconsistency factor penalty",
      (analysis.evidenceFactors?.temporalConsistency ?? 100) < 100,
      `Expected temporalConsistency < 100, got ${analysis.evidenceFactors?.temporalConsistency}`,
    );
  } catch (err: unknown) {
    assert(
      "Test 17: Temporal consistency test",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Test 18: 100-repeat Determinism Test
  try {
    const events: CustodyEvent[] = [
      {
        eventId: "E1",
        batchId: "B-TEST-100",
        type: "PRODUCED",
        fromOrganization: "MFR-1",
        toOrganization: "MFR-1",
        location: "Ogun",
        quantity: 5000,
        timestamp: "2026-09-01T01:00:00Z",
        previousEventId: null,
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
      {
        eventId: "E2",
        batchId: "B-TEST-100",
        type: "SHIPPED",
        fromOrganization: "MFR-1",
        toOrganization: "DIST-1",
        location: "Lagos",
        quantity: 5000,
        timestamp: "2026-09-01T02:00:00Z",
        previousEventId: "E1",
        eventHash: "",
        blockchainTxHash: "",
        verificationStatus: "VERIFIED",
      },
    ];
    const initial = analyseIncident({
      incident: testIncident,
      batch: testBatch,
      events,
      organizations: testOrgs,
    });
    let matchesAll = true;
    for (let i = 0; i < 100; i++) {
      const repeated = analyseIncident({
        incident: testIncident,
        batch: testBatch,
        events,
        organizations: testOrgs,
      });
      if (
        repeated.exposureRisk !== initial.exposureRisk ||
        repeated.evidenceConfidence !== initial.evidenceConfidence ||
        repeated.priority !== initial.priority
      ) {
        matchesAll = false;
        break;
      }
    }
    assert(
      "Test 18: 100-repeat determinism check",
      matchesAll,
      "100 iterations of analyseIncident produced inconsistent results!",
    );
  } catch (err: unknown) {
    assert(
      "Test 18: Determinism repeat test",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return { passed, failed, results };
}
