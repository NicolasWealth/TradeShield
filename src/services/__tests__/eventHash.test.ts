import {
  createEventHash,
  getCanonicalEventPayload,
  serializeCanonicalPayload,
  sha256Hex,
  verifyEventHash,
} from "../eventHash";
import {
  encodeAnchorEventCalldata,
  encodeGetAnchorCalldata,
  getEventVerificationSummary,
  getFunctionSelector,
  verifyBlockchainAnchor,
  WEB3_CONFIG,
} from "../web3Anchor";
import type { CustodyEvent } from "@/types";

const baseEvent: CustodyEvent = {
  eventId: "EVT-8841-01",
  batchId: "B-5000",
  type: "PRODUCED",
  fromOrganization: "ORG-MFR-A",
  toOrganization: "ORG-MFR-A",
  location: "Agbara Plant, Ogun",
  quantity: 5000,
  timestamp: "2026-09-01T08:00:00Z",
  previousEventId: null,
  eventHash: "",
  blockchainTxHash: "",
  verificationStatus: "PENDING_INTEGRATION",
  isDemo: true,
};

export async function runAllEventHashTests(): Promise<{
  passed: number;
  failed: number;
  results: Array<{ name: string; success: boolean; details?: string }>;
}> {
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

  const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

  // Test 1: Same event -> same hash
  try {
    const hash1 = createEventHash(baseEvent);
    const hash2 = createEventHash({ ...baseEvent });
    assert(
      "Test 1: Same event produces identical hash",
      Boolean(hash1) && hash1 === hash2,
      `Expected identical hashes, got ${hash1} vs ${hash2}`,
    );
  } catch (err) {
    assert("Test 1: Same event hash", false, errorMessage(err));
  }

  // Test 2: Different quantity -> different hash
  try {
    const hashOriginal = createEventHash(baseEvent);
    const hashModified = createEventHash({ ...baseEvent, quantity: 4999 });
    assert(
      "Test 2: Different quantity produces different hash",
      hashOriginal !== hashModified,
      "Modifying quantity did not alter the computed hash!",
    );
  } catch (err) {
    assert("Test 2: Different quantity", false, errorMessage(err));
  }

  // Test 3: Different location -> different hash
  try {
    const hashOriginal = createEventHash(baseEvent);
    const hashModified = createEventHash({ ...baseEvent, location: "Apapa, Lagos" });
    assert(
      "Test 3: Different location produces different hash",
      hashOriginal !== hashModified,
      "Modifying location did not alter the computed hash!",
    );
  } catch (err) {
    assert("Test 3: Different location", false, errorMessage(err));
  }

  // Test 4: Different timestamp -> different hash
  try {
    const hashOriginal = createEventHash(baseEvent);
    const hashModified = createEventHash({ ...baseEvent, timestamp: "2026-09-01T09:00:00Z" });
    assert(
      "Test 4: Different timestamp produces different hash",
      hashOriginal !== hashModified,
      "Modifying timestamp did not alter the computed hash!",
    );
  } catch (err) {
    assert("Test 4: Different timestamp", false, errorMessage(err));
  }

  // Test 5: Different previousEventId -> different hash
  try {
    const hashOriginal = createEventHash(baseEvent);
    const hashModified = createEventHash({ ...baseEvent, previousEventId: "EVT-PREV-999" });
    assert(
      "Test 5: Different previousEventId produces different hash",
      hashOriginal !== hashModified,
      "Modifying previousEventId did not alter the computed hash!",
    );
  } catch (err) {
    assert("Test 5: Different previousEventId", false, errorMessage(err));
  }

  // Test 6: Missing/invalid required fields handled safely
  try {
    const invalidEvent = { ...baseEvent, eventId: "" };
    const hashInvalid = createEventHash(invalidEvent);
    const verifyInvalid = verifyEventHash(invalidEvent, "somehash");
    assert(
      "Test 6: Missing/invalid required fields handled safely",
      hashInvalid === "" && verifyInvalid === "INVALID_DATA",
      `Expected empty hash & INVALID_DATA status, got hash='${hashInvalid}', status='${verifyInvalid}'`,
    );
  } catch (err) {
    assert("Test 6: Invalid event fields", false, errorMessage(err));
  }

  // Test 7: Stored matching hash -> CRYPTOGRAPHIC MATCH
  try {
    const hash = createEventHash(baseEvent);
    const eventWithHash = { ...baseEvent, eventHash: hash };
    const result = verifyEventHash(eventWithHash);
    assert(
      "Test 7: Stored matching hash yields MATCH",
      result === "MATCH",
      `Expected MATCH, got ${result}`,
    );
  } catch (err) {
    assert("Test 7: Matching hash verify", false, errorMessage(err));
  }

  // Test 8: Modified event with original hash -> CRYPTOGRAPHIC MISMATCH
  try {
    const originalHash = createEventHash(baseEvent);
    const tamperedEvent = { ...baseEvent, eventHash: originalHash, quantity: 9999 };
    const result = verifyEventHash(tamperedEvent);
    assert(
      "Test 8: Tampered event with original hash yields MISMATCH",
      result === "MISMATCH",
      `Expected MISMATCH, got ${result}`,
    );
  } catch (err) {
    assert("Test 8: Tampered event verify", false, errorMessage(err));
  }

  // Test 9: Missing stored hash -> HASH NOT AVAILABLE
  try {
    const eventNoHash = { ...baseEvent, eventHash: "" };
    const result = verifyEventHash(eventNoHash);
    assert(
      "Test 9: Missing stored hash yields NO_STORED_HASH",
      result === "NO_STORED_HASH",
      `Expected NO_STORED_HASH, got ${result}`,
    );
  } catch (err) {
    assert("Test 9: Missing hash verify", false, errorMessage(err));
  }

  // Test 10: Hashing does not depend on object property order
  try {
    const payload1 = getCanonicalEventPayload(baseEvent);
    const payload2 = getCanonicalEventPayload({
      timestamp: baseEvent.timestamp,
      quantity: baseEvent.quantity,
      location: baseEvent.location,
      toOrganization: baseEvent.toOrganization,
      fromOrganization: baseEvent.fromOrganization,
      type: baseEvent.type,
      batchId: baseEvent.batchId,
      eventId: baseEvent.eventId,
      previousEventId: baseEvent.previousEventId,
    });
    const ser1 = serializeCanonicalPayload(payload1);
    const ser2 = serializeCanonicalPayload(payload2);
    const hash1 = sha256Hex(ser1);
    const hash2 = sha256Hex(ser2);

    assert(
      "Test 10: Property ordering does not affect canonical hash",
      ser1 === ser2 && hash1 === hash2,
      `Serialization or hash mismatch due to key ordering: ${hash1} vs ${hash2}`,
    );
  } catch (err) {
    assert("Test 10: Key order independence", false, errorMessage(err));
  }

  // Test 11: Web3 Anchor verification when unconfigured returns graceful pending
  try {
    const eventWithTx = { ...baseEvent, blockchainTxHash: "0x1234567890abcdef" };
    const res = await verifyBlockchainAnchor(eventWithTx);
    assert(
      "Test 11: Web3 verification safe without RPC",
      res.verified === false && Boolean(res.message),
      `Unexpected Web3 response: ${JSON.stringify(res)}`,
    );
  } catch (err) {
    assert("Test 11: Web3 verification safety", false, errorMessage(err));
  }

  // Test 12: Contract calldata & selector encoding
  try {
    const selector = getFunctionSelector("anchorEvent(bytes32)");
    const hashHex = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
    const calldataAnchor = encodeAnchorEventCalldata(hashHex);
    const calldataGet = encodeGetAnchorCalldata(hashHex);

    assert(
      "Test 12: Contract calldata & function selector encoding",
      Boolean(selector) &&
        calldataAnchor.startsWith(`0x${selector}`) &&
        calldataAnchor.includes(hashHex) &&
        calldataGet.startsWith("0x"),
      `Unexpected calldata output: selector=${selector}, anchor=${calldataAnchor}`,
    );
  } catch (err) {
    assert("Test 12: Calldata encoding", false, errorMessage(err));
  }

  // Test 13: Zero private key in frontend WEB3_CONFIG
  try {
    const keys = Object.keys(WEB3_CONFIG);
    assert(
      "Test 13: Zero private keys in frontend WEB3_CONFIG",
      !keys.includes("privateKey") && !("privateKey" in WEB3_CONFIG),
      "Frontend WEB3_CONFIG unexpectedly contains privateKey property!",
    );
  } catch (err) {
    assert("Test 13: Zero private key check", false, errorMessage(err));
  }

  // Test 14: Combined verification state evaluation (LOCAL_VERIFIED vs TAMPERED)
  try {
    const hash = createEventHash(baseEvent);
    const validEvent = { ...baseEvent, eventHash: hash };
    const validSummary = getEventVerificationSummary(validEvent);

    const tamperedEvent = { ...baseEvent, eventHash: hash, quantity: 99999 };
    const tamperedSummary = getEventVerificationSummary(tamperedEvent);

    assert(
      "Test 14: Combined verification state evaluates LOCAL_VERIFIED vs TAMPERED correctly",
      validSummary.combinedState === "LOCAL_VERIFIED" &&
        tamperedSummary.combinedState === "TAMPERED",
      `Expected LOCAL_VERIFIED & TAMPERED, got ${validSummary.combinedState} & ${tamperedSummary.combinedState}`,
    );
  } catch (err) {
    assert("Test 14: Combined verification state", false, errorMessage(err));
  }

  // Test 15: Tampered event with simulated on-chain record still rejected locally
  try {
    const hash = createEventHash(baseEvent);
    const tamperedAnchoredEvent = {
      ...baseEvent,
      eventHash: hash,
      quantity: 8888,
      blockchainTxHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      verificationStatus: "VERIFIED" as const,
    };
    const summary = getEventVerificationSummary(tamperedAnchoredEvent);

    assert(
      "Test 15: Tampered event with on-chain anchor remains TAMPERED locally",
      summary.combinedState === "TAMPERED" && summary.cryptoStatus === "MISMATCH",
      `Expected TAMPERED state for altered event despite transaction hash, got ${summary.combinedState}`,
    );
  } catch (err) {
    assert("Test 15: Tampered event on-chain override protection", false, errorMessage(err));
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return { passed, failed, results };
}
