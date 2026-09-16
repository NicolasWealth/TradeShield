/**
 * Controlled Server/CLI Script for Base Sepolia TraceShield Event Anchoring.
 * Reads signing secrets strictly from CLI/Server environment variables:
 * - WEB3_PRIVATE_KEY (NEVER exposed to VITE / browser)
 * - WEB3_RPC_URL
 * - ANCHOR_CONTRACT_ADDRESS
 *
 * Usage:
 *   npx tsx scripts/anchor-event.ts <EVENT_HASH>
 */
import { encodeAnchorEventCalldata, encodeGetAnchorCalldata } from "../src/services/web3Anchor";

async function main() {
  const args = process.argv.slice(2);
  const eventHash = args[0]?.trim();

  if (!eventHash) {
    console.error("Usage: npx tsx scripts/anchor-event.ts <EVENT_HASH>");
    process.exit(1);
  }

  const cleanHash = eventHash.replace(/^0x/, "");
  if (cleanHash.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(cleanHash)) {
    console.error(
      `Invalid event hash: '${eventHash}'. Expected 32-byte (64 hex characters) SHA-256 string.`,
    );
    process.exit(1);
  }

  const privateKey = process.env.WEB3_PRIVATE_KEY;
  const rpcUrl = process.env.WEB3_RPC_URL || "https://sepolia.base.org";
  const contractAddress = process.env.ANCHOR_CONTRACT_ADDRESS;

  console.log("--------------------------------------------------");
  console.log(" TraceShield Base Sepolia Anchor CLI Tool");
  console.log("--------------------------------------------------");
  console.log(`Event Hash: 0x${cleanHash}`);
  console.log(`RPC Endpoint: ${rpcUrl}`);
  console.log(`Contract Address: ${contractAddress || "(Not configured)"}`);

  if (!privateKey || !contractAddress) {
    console.error("\n[BLOCKER] Missing required environment variables:");
    if (!privateKey) console.error("  - WEB3_PRIVATE_KEY is not set.");
    if (!contractAddress) console.error("  - ANCHOR_CONTRACT_ADDRESS is not set.");
    console.error(
      "\nTo execute live Base Sepolia transactions, set WEB3_PRIVATE_KEY and ANCHOR_CONTRACT_ADDRESS.",
    );
    process.exit(1);
  }

  const calldata = encodeAnchorEventCalldata(cleanHash);
  console.log(`Calldata (unsigned): ${calldata}`);

  // NOTE: Transaction signing is not yet implemented. `eth_sendRawTransaction`
  // requires a fully signed, RLP-encoded transaction (nonce, gas, chainId,
  // to, value, data, and an ECDSA signature over all of it) — not just this
  // ABI calldata. No signing library (ethers/viem/@noble) is wired into this
  // script yet, so WEB3_PRIVATE_KEY is read and validated above but not used
  // to sign anything. Submitting the raw calldata as-is would always be
  // rejected by the RPC node, regardless of testnet ETH balance.
  console.error("\n[NOT IMPLEMENTED] Transaction signing is not wired into this script yet.");
  console.error("The calldata above is correct, but this script cannot yet construct and");
  console.error("sign a full Base Sepolia transaction from it. Add a signing library");
  console.error("(e.g. viem or ethers) here to build + sign the transaction, then submit");
  console.error("it via eth_sendRawTransaction.");
  process.exit(1);
}

main();
