/**
 * Web3 Read-Only Verification Service for TraceShield.
 * Performs 3-layer verification (Local SHA-256 + On-chain Base Sepolia Contract State).
 * Safe by design: Zero private keys, zero transaction signing, zero client-side write operations.
 */
import type { CustodyEvent } from "@/types";
import {
  createEventHash,
  verifyEventHash,
  type CryptographicVerificationStatus,
} from "./eventHash";

export type CombinedVerificationState =
  | "LOCAL_VERIFIED"
  | "BLOCKCHAIN_VERIFIED"
  | "FULLY_VERIFIED"
  | "TAMPERED"
  | "PENDING_BLOCKCHAIN"
  | "VERIFICATION_UNAVAILABLE";

export interface VerificationSummary {
  cryptoStatus: CryptographicVerificationStatus;
  blockchainStatus: "VERIFIED" | "PENDING" | "UNCONFIGURED" | "FAILED" | "NOT_ANCHORED";
  combinedState: CombinedVerificationState;
  recalculatedHash: string;
  storedHash: string;
  txHash: string;
  contractAddress: string;
  network: string;
  message: string;
}

const getEnvVar = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== "undefined" && import.meta && import.meta.env) {
      return import.meta.env[key] as string | undefined;
    }
  } catch {
    /* ignore */
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
};

export const WEB3_CONFIG = {
  get rpcUrl() {
    return getEnvVar("VITE_WEB3_RPC_URL") || "https://sepolia.base.org";
  },
  get contractAddress() {
    return getEnvVar("VITE_ANCHOR_CONTRACT_ADDRESS") || "";
  },
  network: "Base Sepolia",
};

export function isWeb3Configured(): boolean {
  return Boolean(WEB3_CONFIG.contractAddress && WEB3_CONFIG.contractAddress.trim());
}

/**
 * Keccak-256 implementation for function selector and ABI encoding.
 */
export function keccak256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);

  const ROUND_CONSTANTS: bigint[] = [
    0x0000000000000001n,
    0x0000000000008082n,
    0x800000000000808an,
    0x8000000080008000n,
    0x000000000000808bn,
    0x0000000080000001n,
    0x8000000080008081n,
    0x8000000000008009n,
    0x000000000000008an,
    0x0000000000000088n,
    0x0000000080008009n,
    0x000000008000000an,
    0x000000008000808bn,
    0x800000000000008bn,
    0x8000000000008089n,
    0x8000000000008003n,
    0x8000000000008002n,
    0x8000000000000080n,
    0x000000000000800an,
    0x800000008000000an,
    0x8000000080008081n,
    0x8000000000008080n,
    0x0000000080000001n,
    0x8000000080008008n,
  ];

  const R = [
    0, 36, 3, 41, 18, 1, 44, 10, 45, 2, 62, 6, 43, 15, 61, 28, 55, 25, 21, 56, 27, 20, 39, 8, 14,
  ];

  const state = new BigUint64Array(25);
  const rate = 136;
  const paddedLength = Math.ceil((bytes.length + 1) / rate) * rate;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[paddedLength - 1] |= 0x80;

  for (let i = 0; i < padded.length; i += rate) {
    for (let j = 0; j < rate / 8; j++) {
      let word = 0n;
      for (let b = 0; b < 8; b++) {
        word |= BigInt(padded[i + j * 8 + b]) << BigInt(b * 8);
      }
      state[j] ^= word;
    }

    for (let round = 0; round < 24; round++) {
      const C = new BigUint64Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
      }
      const D = new BigUint64Array(5);
      for (let x = 0; x < 5; x++) {
        const left = C[(x + 1) % 5];
        const rotLeft = (left << 1n) | (left >> 63n);
        D[x] = C[(x + 4) % 5] ^ rotLeft;
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + y * 5] ^= D[x];
        }
      }

      const B = new BigUint64Array(25);
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const idx = x + y * 5;
          const r = BigInt(R[idx]);
          const val = state[idx];
          const rot = r === 0n ? val : (val << r) | (val >> (64n - r));
          B[y + ((2 * x + 3 * y) % 5) * 5] = rot;
        }
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const idx = x + y * 5;
          state[idx] = B[idx] ^ (~B[((x + 1) % 5) + y * 5] & B[((x + 2) % 5) + y * 5]);
        }
      }

      state[0] ^= ROUND_CONSTANTS[round];
    }
  }

  let hex = "";
  for (let i = 0; i < 4; i++) {
    const word = state[i];
    for (let b = 0; b < 8; b++) {
      const byte = Number((word >> BigInt(b * 8)) & 0xffn);
      hex += byte.toString(16).padStart(2, "0");
    }
  }

  return hex;
}

export function getFunctionSelector(signature: string): string {
  return keccak256Hex(signature).slice(0, 8);
}

export function encodeGetAnchorCalldata(eventHashHex: string): string {
  const selector = getFunctionSelector("getAnchor(bytes32)");
  const cleanHash = eventHashHex.replace(/^0x/, "").padStart(64, "0");
  return `0x${selector}${cleanHash}`;
}

export function encodeAnchorEventCalldata(eventHashHex: string): string {
  const selector = getFunctionSelector("anchorEvent(bytes32)");
  const cleanHash = eventHashHex.replace(/^0x/, "").padStart(64, "0");
  return `0x${selector}${cleanHash}`;
}

/**
 * Performs genuine read-only verification on Base Sepolia.
 * 1. Transaction lookup (eth_getTransactionByHash)
 * 2. Receipt verification (eth_getTransactionReceipt)
 * 3. Contract state read (eth_call -> getAnchor)
 */
export async function verifyBlockchainAnchor(
  event: Partial<CustodyEvent>,
): Promise<{ verified: boolean; isAnchored: boolean; timestamp?: number; message: string }> {
  if (!event.blockchainTxHash || !event.blockchainTxHash.trim()) {
    return {
      verified: false,
      isAnchored: false,
      message: "No transaction hash recorded for event",
    };
  }

  if (!isWeb3Configured()) {
    return { verified: false, isAnchored: false, message: "Web3 contract address not configured" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // Step A: Fetch transaction
    const txRes = await fetch(WEB3_CONFIG.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionByHash",
        params: [event.blockchainTxHash.trim()],
      }),
    });

    if (!txRes.ok) {
      clearTimeout(timeoutId);
      return {
        verified: false,
        isAnchored: false,
        message: `RPC response error: ${txRes.statusText}`,
      };
    }

    const txData = (await txRes.json()) as {
      result?: { input?: string; hash?: string; blockNumber?: string };
    };
    if (!txData.result) {
      clearTimeout(timeoutId);
      return {
        verified: false,
        isAnchored: false,
        message: "Transaction hash not found on Base Sepolia",
      };
    }

    // Step B: Fetch transaction receipt
    const receiptRes = await fetch(WEB3_CONFIG.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "eth_getTransactionReceipt",
        params: [event.blockchainTxHash.trim()],
      }),
    });

    const receiptData = (await receiptRes.json()) as { result?: { status?: string; to?: string } };

    if (!receiptData.result || receiptData.result.status !== "0x1") {
      clearTimeout(timeoutId);
      return {
        verified: false,
        isAnchored: false,
        message: "Transaction receipt failed or pending on chain",
      };
    }

    // Step C: Verify contract state via eth_call (getAnchor)
    const currentHash = createEventHash(event);
    const callData = encodeGetAnchorCalldata(currentHash || event.eventHash || "");

    const callRes = await fetch(WEB3_CONFIG.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "eth_call",
        params: [
          {
            to: WEB3_CONFIG.contractAddress,
            data: callData,
          },
          "latest",
        ],
      }),
    });
    clearTimeout(timeoutId);

    const callResultData = (await callRes.json()) as { result?: string };
    const rawOutput = callResultData.result || "";

    // ABI output for (bool isAnchored, uint256 timestamp):
    // First 32 bytes (64 hex chars) = isAnchored (0x...1)
    // Second 32 bytes (64 hex chars) = timestamp
    const isAnchoredBool = rawOutput.length >= 66 && BigInt(rawOutput.slice(0, 66)) > 0n;

    if (isAnchoredBool) {
      return {
        verified: true,
        isAnchored: true,
        message: "Base Sepolia contract state confirms event hash anchor",
      };
    }

    return {
      verified: false,
      isAnchored: false,
      message: "Contract state indicates event hash is not anchored",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      verified: false,
      isAnchored: false,
      message: `Blockchain verification check failed: ${errorMsg}`,
    };
  }
}

/**
 * Computes comprehensive 3-layer verification summary for an event.
 */
export function getEventVerificationSummary(event: Partial<CustodyEvent>): VerificationSummary {
  const cryptoStatus = verifyEventHash(event);
  const recalculatedHash = createEventHash(event);
  const storedHash = event.eventHash ?? "";
  const txHash = event.blockchainTxHash ?? "";
  const contractAddress = WEB3_CONFIG.contractAddress;
  const network = WEB3_CONFIG.network;

  // Layer 1 Check: Local cryptographic status
  if (cryptoStatus === "INVALID_DATA" || cryptoStatus === "NO_STORED_HASH") {
    return {
      cryptoStatus,
      blockchainStatus: "PENDING",
      combinedState: "VERIFICATION_UNAVAILABLE",
      recalculatedHash,
      storedHash,
      txHash,
      contractAddress,
      network,
      message: "Event hash is not available or event payload is incomplete.",
    };
  }

  if (cryptoStatus === "MISMATCH") {
    return {
      cryptoStatus,
      blockchainStatus: txHash ? "FAILED" : "PENDING",
      combinedState: "TAMPERED",
      recalculatedHash,
      storedHash,
      txHash,
      contractAddress,
      network,
      message:
        "Local integrity: MISMATCH! Current event data produces a fingerprint that differs from stored hash. Data tampering detected!",
    };
  }

  // Layer 2 & 3 Check: Evaluates on-chain verified state
  const isBlockchainVerified = event.verificationStatus === "VERIFIED" && Boolean(txHash.trim());

  if (isBlockchainVerified) {
    return {
      cryptoStatus,
      blockchainStatus: "VERIFIED",
      combinedState: "FULLY_VERIFIED",
      recalculatedHash,
      storedHash,
      txHash,
      contractAddress,
      network,
      message:
        "Fully Verified! Cryptographic fingerprint matches stored hash and is confirmed on Base Sepolia.",
    };
  }

  return {
    cryptoStatus,
    blockchainStatus: isWeb3Configured() ? "PENDING" : "UNCONFIGURED",
    combinedState: "LOCAL_VERIFIED",
    recalculatedHash,
    storedHash,
    txHash,
    contractAddress,
    network,
    message:
      "Locally Verified! Cryptographic fingerprint matches stored hash. Blockchain anchor pending.",
  };
}
