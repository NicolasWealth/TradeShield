# TraceShield

> **Verifiable Supply-Chain Intelligence for Precision Recalls**

TraceShield is an enterprise supply-chain intelligence platform designed for food manufacturers and distributors. When contamination incidents occur, TraceShield maps batch custody, cryptographically verifies event integrity, scores exposure risk against evidence confidence, and recommends targeted recall actions.

---

## Core Problem & Differentiator

### The Problem
During food safety or contamination events, fragmented supply-chain records make recall investigations slow, imprecise, and uncertain. Operators struggle to determine exactly where contaminated inventory has travelled, which locations require urgent recalls, and whether custody records have been altered or lost.

### The Central Differentiator
TraceShield **decouples Exposure Risk from Evidence Confidence**:
- **Exposure Risk (0–100):** Measures physical inventory units at risk, downstream distributor/retailer reach, consumer endpoints, geographic spread, and incident severity.
- **Evidence Confidence (0–100):** Measures cryptographic chain integrity, event completeness, inventory accounting balance, temporal consistency, and registry validity.

By isolating risk from confidence, operators can distinguish between high-risk events backed by solid evidence (`IMMEDIATE RECALL`) and high-risk events with incomplete or broken custody chains (`URGENT INVESTIGATION`).

---

## Core Functions

1. **TRACE:** Map batch custody from production to retail endpoints using chronological event chains and interactive network graphs.
2. **VERIFY:** Generate deterministic SHA-256 fingerprints from canonical custody payloads and verify local integrity alongside read-only Base Sepolia smart contract state.
3. **PRIORITIZE:** Evaluate transparent, explainable 2D risk/evidence scores to assign actionable recall priorities without black-box AI dependencies.

---

## MVP Capabilities

- **Batch Management:** Create, filter, search, and inspect product batches with origin, production, and expiration metadata.
- **Custody Event Logging:** Record custody transfers (`PRODUCED`, `SHIPPED`, `RECEIVED`, `STORED`, `INSPECTED`, `SOLD`) linked via `previousEventId` parent chains.
- **Supply-Chain Graph:** Interactive React Flow visualization showing nodes (Manufacturers, Distributors, Warehouses, Retailers) and custody movement edges with live inventory filters.
- **Incident Investigation:** Log recall incidents (`CONTAMINATION`, `COLD_CHAIN_BREAK`, `FOREIGN_BODY`, `LABELLING`) and execute multi-factor risk analyses.
- **Inventory Flow Engine:** Bounded inventory calculation that accounts for current location balances without double-counting units across multi-leg shipments.
- **SHA-256 Fingerprinting:** Automatic canonical payload normalization and SHA-256 hashing.
- **Interactive Tamper Detection:** In-browser inspector to simulate payload modifications and observe immediate cryptographic mismatch detection.
- **Read-Only Web3 Verification:** Client-side RPC inspection of Base Sepolia transaction receipts and smart contract state.
- **Controlled CLI Anchoring:** CLI script (`scripts/anchor-event.ts`) for server-side event anchoring using private keys outside browser scope.
- **Resilient Fallback Data:** Automatic local storage fallback seeded with realistic multi-leg demonstration data when Firebase is unconfigured.

---

## Web3 & Cryptographic Architecture

### Browser Strategy (Read-Only)
- The browser interface operates strictly in **read-only mode**.
- Client-side code does **NOT** hold, request, or expose Web3 private keys or attempt wallet transaction signing (`eth_sendRawTransaction`).
- Blockchain status is verified via standard JSON-RPC queries (`eth_getTransactionByHash`, `eth_getTransactionReceipt`, `eth_call`).

### Controlled CLI Anchoring (Server Path)
- Event hash anchoring to the blockchain occurs through a controlled server/CLI environment.
- The script `scripts/anchor-event.ts` reads `WEB3_PRIVATE_KEY` strictly from process environment variables, ensuring signing keys never enter client bundles.

### Smart Contract (`contracts/TraceShieldAnchor.sol`)
- Minimal EVM contract deployed on **Base Sepolia**.
- Exposes `anchorEvent(bytes32 eventHash)` to record block timestamp anchors.
- Exposes `getAnchor(bytes32 eventHash)` returning `(bool isAnchored, uint256 timestamp)` for non-custodial verification.

### Honest Status & Current Limitations
- **Live Testnet Status:** A live Base Sepolia contract transaction was **not completed** for demo records in this submission environment. `scripts/anchor-event.ts` correctly builds the anchor calldata and validates configuration, but does not yet include transaction signing (no signing library is wired in), so it cannot submit a real transaction. This is a scoped gap in the CLI script, not a testnet funding issue.
- **Transparent Reporting:** The application reports `UNCONFIGURED` or `PENDING` for blockchain status on demo events. No fake or synthetic transaction hashes are displayed.
- **Read-only verification:** `verifyBlockchainAnchor` performs genuine read-only Base Sepolia RPC calls (`eth_getTransactionByHash`, `eth_getTransactionReceipt`, `eth_call`) and is covered by tests, but is not yet wired into a UI action — the Verification page currently displays blockchain status from stored event fields rather than triggering a live RPC check on demand.

---

## Verification States

| State | Description |
| :--- | :--- |
| `LOCAL_VERIFIED` | Canonical SHA-256 payload matches the stored event hash. |
| `BLOCKCHAIN_VERIFIED` | Event hash confirmed anchored in the Base Sepolia smart contract. |
| `FULLY_VERIFIED` | Local SHA-256 match AND on-chain Base Sepolia anchor confirmed. |
| `TAMPERED` | Canonical payload re-hashing differs from stored hash (tampering detected). |
| `PENDING_BLOCKCHAIN` / `UNCONFIGURED` | Valid locally; on-chain anchor is pending execution or contract address is unconfigured. |
| `VERIFICATION_UNAVAILABLE` | Event payload is incomplete or missing required fields for hashing. |

---

## Deterministic Scoring Engine

### Exposure Risk Matrix (0–100)
- **30%** Affected Quantity Ratio (`affectedQuantity / totalBatchQuantity`)
- **25%** Downstream Location Reach (Active distributor/warehouse count)
- **20%** Consumer Endpoint Reach (Retailer nodes reached)
- **10%** Geographic Scope (Unique location count)
- **15%** Incident Severity Factor (`CONTAMINATION`: 100, `COLD_CHAIN_BREAK`: 75, `FOREIGN_BODY`: 60, `LABELLING`: 30)

### Evidence Confidence Matrix (0–100)
- **25%** Event Completeness (Presence of production and custody transfer events)
- **25%** Chain Integrity (Parent `previousEventId` link validity)
- **20%** Inventory Accounting (Ratio of accounted to total batch units)
- **10%** Temporal Consistency (Chronological validity across parent-child links)
- **10%** Organization Registry Completeness (Registered org verification)
- **10%** Anomaly Quality (Penalty for duplicate events or unaccounted inventory)

---

## Verified Quality & Status

- **Automated Tests:** **57 passed, 0 failed** (Verified via `npx tsx src/test/runTests.ts`)
  - Event Hash & 3-Layer Verification: 15 tests
  - Risk Engine & Inventory Flow: 28 tests
  - Supply-Chain Graph Engine: 14 tests
- **Production Build:** **PASS** (Compiled with Nitro preset for Cloudflare / Vercel deployment)
- **Security Audit:** **PASS** (Zero hardcoded secrets, zero browser private key exposure)

---

## Setup & Local Development

### Prerequisites
- Node.js v18+ 
- npm v9+

### Environment Configuration
Copy `.env.example` to create your local environment configuration:
```sh
cp .env.example .env
```

Environment variable options:
```ini
# Optional Firebase Configuration (App falls back to local demo store if omitted)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=

# Read-Only Base Sepolia Web3 Configuration (Client-safe)
VITE_WEB3_RPC_URL=https://sepolia.base.org
VITE_ANCHOR_CONTRACT_ADDRESS=

# CLI / Server Signing Configuration (NEVER prefixed with VITE_; CLI ONLY)
WEB3_RPC_URL=https://sepolia.base.org
WEB3_PRIVATE_KEY=
ANCHOR_CONTRACT_ADDRESS=
```

### Installation & Execution

```sh
# Install dependencies
npm install

# Run automated verification and engine test suite (57 tests)
npx tsx src/test/runTests.ts

# Start local development server
npm run dev

# Build production distribution bundle
npm run build
```

---

## Technology Stack

- **Frontend Core:** React 19, TypeScript, TanStack Start, TanStack Router, TanStack Query
- **Styling & UI:** Tailwind CSS, Radix UI primitives, Lucide React icons
- **Graph Visualization:** React Flow (`@xyflow/react`)
- **Blockchain / Smart Contracts:** Solidity 0.8.20 (`contracts/TraceShieldAnchor.sol`), Base Sepolia JSON-RPC
- **Database Layer:** Cloud Firestore (optional) with automatic localStorage fallback
