/**
 * Cryptographic event hashing service for TraceShield.
 * Provides deterministic SHA-256 fingerprinting of custody events.
 */
import type { CustodyEvent } from "@/types";

export interface CanonicalEventPayload {
  eventId: string;
  batchId: string;
  type: string;
  fromOrganization: string;
  toOrganization: string;
  location: string;
  quantity: number;
  timestamp: string;
  previousEventId: string | null;
}

/**
 * Extracts and normalizes the canonical representation of a custody event.
 * Property ordering is explicitly fixed to guarantee determinism.
 */
export function getCanonicalEventPayload(event: Partial<CustodyEvent>): CanonicalEventPayload {
  return {
    eventId: String(event.eventId ?? "").trim(),
    batchId: String(event.batchId ?? "").trim(),
    type: String(event.type ?? "").trim(),
    fromOrganization: String(event.fromOrganization ?? "").trim(),
    toOrganization: String(event.toOrganization ?? "").trim(),
    location: String(event.location ?? "").trim(),
    quantity: typeof event.quantity === "number" && !isNaN(event.quantity) ? event.quantity : 0,
    timestamp: String(event.timestamp ?? "").trim(),
    previousEventId: event.previousEventId ? String(event.previousEventId).trim() : null,
  };
}

/**
 * Serializes the canonical event payload to a deterministic JSON string.
 */
export function serializeCanonicalPayload(payload: CanonicalEventPayload): string {
  return JSON.stringify({
    eventId: payload.eventId,
    batchId: payload.batchId,
    type: payload.type,
    fromOrganization: payload.fromOrganization,
    toOrganization: payload.toOrganization,
    location: payload.location,
    quantity: payload.quantity,
    timestamp: payload.timestamp,
    previousEventId: payload.previousEventId,
  });
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const SHA256_H = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

/**
 * Standard SHA-256 implementation in TypeScript.
 * Browser & Node compatible, synchronous, zero external dependencies.
 */
export function sha256Hex(message: string): string {
  let i: number;
  let j: number;
  let result = "";

  const words: number[] = [];
  const hash = [...SHA256_H];

  // Convert string to UTF-8 byte array
  const bytes: number[] = [];
  for (i = 0; i < message.length; i++) {
    const code = message.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push(192 | (code >> 6), 128 | (code & 63));
    } else if (code < 55296 || code >= 57344) {
      bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
    } else {
      i++;
      const nextCode = message.charCodeAt(i);
      const codePoint = 0x10000 + (((code & 0x3ff) << 10) | (nextCode & 0x3ff));
      bytes.push(
        240 | (codePoint >> 18),
        128 | ((codePoint >> 12) & 63),
        128 | ((codePoint >> 6) & 63),
        128 | (codePoint & 63),
      );
    }
  }

  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }

  for (i = 0; i < 8; i++) {
    bytes.push((bitLength >>> (56 - i * 8)) & 0xff);
  }

  for (i = 0; i < bytes.length; i += 4) {
    words.push(
      (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3],
    );
  }

  const w: number[] = new Array(64);

  for (i = 0; i < words.length; i += 16) {
    const oldHash = [...hash];

    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j];
      } else {
        const s0 =
          ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^
          ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^
          (w[j - 15] >>> 3);
        const s1 =
          ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^
          ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^
          (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      const S1 =
        ((hash[4] >>> 6) | (hash[4] << 26)) ^
        ((hash[4] >>> 11) | (hash[4] << 21)) ^
        ((hash[4] >>> 25) | (hash[4] << 7));
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + S1 + ch + SHA256_K[j] + w[j]) | 0;
      const S0 =
        ((hash[0] >>> 2) | (hash[0] << 30)) ^
        ((hash[0] >>> 13) | (hash[0] << 19)) ^
        ((hash[0] >>> 22) | (hash[0] << 10));
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (S0 + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    result += (hash[i] >>> 0).toString(16).padStart(8, "0");
  }

  return result;
}

/**
 * Validates that an event object contains all required fields for hashing.
 */
export function isValidEventData(event: Partial<CustodyEvent>): boolean {
  if (!event) return false;
  if (!event.eventId || typeof event.eventId !== "string" || !event.eventId.trim()) return false;
  if (!event.batchId || typeof event.batchId !== "string" || !event.batchId.trim()) return false;
  if (!event.type || typeof event.type !== "string" || !event.type.trim()) return false;
  if (!event.fromOrganization || typeof event.fromOrganization !== "string") return false;
  if (!event.toOrganization || typeof event.toOrganization !== "string") return false;
  if (!event.timestamp || typeof event.timestamp !== "string") return false;
  if (typeof event.quantity !== "number" || isNaN(event.quantity) || event.quantity < 0) return false;
  return true;
}

/**
 * Computes the deterministic SHA-256 hash for a given custody event.
 * Returns an empty string if required fields are missing/invalid.
 */
export function createEventHash(event: Partial<CustodyEvent>): string {
  if (!isValidEventData(event)) {
    return "";
  }
  const payload = getCanonicalEventPayload(event);
  const serialized = serializeCanonicalPayload(payload);
  return sha256Hex(serialized);
}

export type CryptographicVerificationStatus =
  | "MATCH"
  | "MISMATCH"
  | "NO_STORED_HASH"
  | "INVALID_DATA";

/**
 * Verifies whether the current event data matches the stored event hash.
 */
export function verifyEventHash(
  event: Partial<CustodyEvent>,
  expectedHash?: string,
): CryptographicVerificationStatus {
  if (!isValidEventData(event)) {
    return "INVALID_DATA";
  }

  const storedHash = expectedHash !== undefined ? expectedHash : event.eventHash;
  if (!storedHash || typeof storedHash !== "string" || !storedHash.trim()) {
    return "NO_STORED_HASH";
  }

  const recalculatedHash = createEventHash(event);
  if (recalculatedHash.toLowerCase() === storedHash.trim().toLowerCase()) {
    return "MATCH";
  }

  return "MISMATCH";
}
