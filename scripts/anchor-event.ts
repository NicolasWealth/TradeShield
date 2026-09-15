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
import {
  encodeAnchorEventCalldata,
  encodeGetAnchorCalldata,
} from "../src/services/web3Anchor";

async function main() {
  const args = process.argv.slice(2);
  const eventHash = args[0]?.trim();

  if (!eventHash) {
    console.error("Usage: npx tsx scripts/anchor-event.ts <EVENT_HASH>");
    process.exit(1);
  }

  const cleanHash = eventHash.replace(/^0x/, "");
  if (cleanHash.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(cleanHash)) {
    console.error(`Invalid event hash: '${eventHash}'. Expected 32-byte (64 hex characters) SHA-256 string.`);
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
    console.error("\nTo execute live Base Sepolia transactions, set WEB3_PRIVATE_KEY and ANCHOR_CONTRACT_ADDRESS.");
    process.exit(1);
  }

  const calldata = encodeAnchorEventCalldata(cleanHash);
  console.log(`Calldata: ${calldata}`);
  console.log("\nSubmitting transaction to Base Sepolia...");

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendRawTransaction",
        params: [calldata],
      }),
    });

    const data = (await response.json()) as { result?: string; error?: { message: string } };

    if (data.error) {
      console.error(`\n[ERROR] Transaction rejected by Base Sepolia RPC: ${data.error.message}`);
      process.exit(1);
    }

    const txHash = data.result;
    console.log(`\nSUCCESS: Transaction submitted! Tx Hash: ${txHash}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n[ERROR] Failed to execute Base Sepolia transaction: ${msg}`);
    process.exit(1);
  }
}

main();
