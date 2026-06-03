# Agent BlackBox

> The flight recorder for autonomous AI agents.

Agent BlackBox is a verifiable blackbox recorder for autonomous AI systems. It turns each agent task
into replayable forensic evidence: user intent, file metadata, agent plan, tool calls, final output,
deterministic hashes, managed storage references, direct Walrus references, Sui proof metadata, and
verification results.

## Problem

Autonomous agents act quickly, but their decisions are difficult to audit after the fact. A final
answer alone does not show what an agent received, planned, called, produced, stored, or proved.

## Solution

Agent BlackBox records each session as a tamper-evident trace. The application models a full
mainnet-first accountability path:

1. Run a server-side Agent Runtime and produce a structured trace-ready report.
2. Record the agent plan, tool-call summaries, final output, and deterministic hashes.
3. Store the trace bundle as a Walrus Mainnet blob.
4. Read the public Walrus Mainnet blob directly for replay and hash comparison.
5. Anchor lightweight proof metadata on Sui Mainnet.
6. Verify proof objects, transactions, events, and ownership through Tatum Sui Mainnet RPC.

## Agent Runtime

The real Agent Runtime runs server-side only. It uses `OPENAI_API_KEY` internally, returns strict
structured JSON, and stores only user-safe summaries in the BlackBox Trace. User-facing UI and stored
public trace labels must not expose API provider names, model names, or runtime implementation
branding.

Supported agents:

- Research Agent: finds and explains a topic, project, market, protocol, company, claim, or document
  through a structured research brief with scope, key findings, evidence/input summary, assumptions,
  limitations, next actions, and proof metadata.
- Risk Review Agent: checks what could go wrong through a structured risk report with overall rating,
  scorecard, severity-ranked issue cards, missing information, exposure analysis, mitigation steps,
  and proof metadata.
- Delivery Proof Agent: proves work was delivered through a sealed receipt with evidence bundle,
  handoff trail, acceptance notes, proof strength analysis, missing evidence, next actions, and proof
  metadata.
- Onchain Analyzer Agent: detects Sui wallet, transaction, object, or package context plus EVM
  wallet, transaction, or contract targets. Sui/Walrus remains the primary proof path; EVM support is
  additional multichain enrichment with honest provider-status limitations.

Tool-call summaries are stored. Hidden reasoning is not stored or requested.

## Why Tatum

Tatum provides the server-side Sui RPC verification boundary and an optional managed Walrus upload
adapter. It is infrastructure around the proof flow, not the storage source of truth. All Tatum
credentials stay behind project API routes.

## Why Walrus

Walrus is the canonical decentralized storage layer and the direct blob-level verification path.
Agent BlackBox models Blob ID, Walrus Object ID, blob availability, storage duration, replay
readiness, and hash comparison independently of the selected upload adapter.

## Why Sui

Sui stores compact proof metadata rather than full traces: owner, session ID, agent mode, input hash,
result hash, trace hash, neutral upload references, Walrus references, timestamp, and status. This
creates a lightweight onchain accountability anchor.

## Hybrid Storage Architecture

The application separates canonical storage from optional upload infrastructure:

- **Canonical storage path:** Walrus blob storage for the trace bundle, Blob ID, Walrus Object ID,
  storage duration, replay, and direct trace-hash comparison.
- **Default upload path:** The official Walrus TypeScript SDK with the official Walrus Mainnet Upload
  Relay. The connected browser wallet pays the required Walrus/Sui costs and signs the registration
  and certification transactions.
- **Optional managed upload adapter:** Tatum's Walrus-powered storage API for upload jobs,
  certification status, expiry, listing, renewal cancellation, and delete lifecycle when selected.

Walrus blobs are public by default. Production mode should encrypt sensitive agent traces before
upload and decrypt locally for replay. Phase 2E connects the `walrus_sdk_relay` adapter through the
official Walrus SDK and Mainnet Upload Relay. The older `walrus_direct` HTTP publisher adapter is
legacy-only and is not the default path.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Product landing page |
| `/dashboard` | System overview and recent sessions |
| `/sessions` | BlackBox trace archive |
| `/sessions/new` | Local agent recording flow |
| `/sessions/[id]` | Session detail and forensic timeline |
| `/verify/[id]` | Judge-facing proof report and tamper test |
| `/storage` | Walrus blob storage and direct Walrus verification |
| `/settings` | Integration configuration posture |
| `/developer` | Architecture, API surface, and Phase 2 roadmap |

## Server API Surface

```text
POST /api/agent/run
POST /api/agent/prepare
POST /api/storage/upload
GET  /api/storage/relay-status
GET  /api/storage/status/[uploadJobId]
GET  /api/storage/list
POST /api/storage/cancel-renewal
POST /api/storage/delete
GET  /api/storage/read/[blobId]
POST /api/storage/verify/[blobId]
GET  /api/walrus/read/[blobId]
POST /api/walrus/verify/[blobId]
POST /api/tatum/rpc
POST /api/sui/verify-proof
GET  /api/sessions
GET  /api/sessions/[id]
POST /api/sessions/[id]/storage-finalize
POST /api/sessions/[id]/proof-anchor
GET  /api/verify/[id]
POST /api/verify/[id]/recheck
POST /api/verify/[id]/tamper-test
POST /api/mcp/verify
```

All provider credentials stay server-side. Do not create `NEXT_PUBLIC_` variants for Tatum keys.
Sui analyzer enrichment uses the official public Sui RPC and does not require a Sui API key.
EVM and multichain analyzer enrichment uses Tatum Blockchain MCP only when enabled. The app does
not add private-key environment variables.

## Environment Setup

Create `.env.local` from `.env.example` and configure the values required for the next integration
phase:

```dotenv
NEXT_PUBLIC_APP_NAME=Agent BlackBox
NEXT_PUBLIC_SUI_NETWORK=mainnet
SUI_EXPLORER_BASE_URL=https://suivision.xyz
NEXT_PUBLIC_SUI_EXPLORER_BASE_URL=https://suivision.xyz

SUI_NETWORK=mainnet
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>
TATUM_API_KEY=
TATUM_SUI_RPC_URL=https://sui-mainnet.gateway.tatum.io
TATUM_MCP_ENABLED=true
TATUM_MCP_COMMAND=npx
TATUM_MCP_PACKAGE=@tatumio/blockchain-mcp
TATUM_MCP_SERVER_NAME=tatumio

SUI_RPC_URL=https://fullnode.mainnet.sui.io:443

TATUM_STORAGE_API_URL=
TATUM_STORAGE_PROVIDER=walrus

STORAGE_PROVIDER=walrus_sdk_relay
STORAGE_ADAPTER=
NEXT_PUBLIC_STORAGE_PROVIDER=
WALRUS_NETWORK=mainnet
WALRUS_UPLOAD_RELAY_URL=https://upload-relay.mainnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-mainnet.walrus.space
WALRUS_STORAGE_EPOCHS=1

SUI_PROOF_PACKAGE_ID=0xbaaa56797e543f20b44fd255f7ca051cb5d4e185b59179a20514159cc8a1914f
NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID=0xbaaa56797e543f20b44fd255f7ca051cb5d4e185b59179a20514159cc8a1914f
SUI_PROOF_MODULE=agent_blackbox
NEXT_PUBLIC_SUI_PROOF_MODULE=agent_blackbox
SUI_PROOF_CREATE_FUNCTION=create_session_proof
NEXT_PUBLIC_SUI_PROOF_CREATE_FUNCTION=create_session_proof
```

Agent Runtime mode requires `OPENAI_API_KEY` in server-side environment only. Mainnet mode requires real SUI/WAL costs and a connected wallet that can pay the Walrus SDK Upload
Relay flow. Do not treat a missing upload relay, missing Tatum API key, missing wallet payment, failed
aggregator readback, or missing Sui Mainnet package ID as a successful integration.
If Walrus returns an insufficient WAL balance in FROST, the UI converts it to WAL, shows a friendly
balance message, and keeps the raw technical error under `Details`.
Wallet, Walrus, Sui, and Agent Runtime errors are normalized through
`lib/errors/user-facing-errors.ts` before they are shown to users. Primary UI copy stays short and
product-readable; raw protocol details stay collapsed.

Developers may opt into testnet later by setting `NEXT_PUBLIC_SUI_NETWORK=testnet`, `SUI_NETWORK=testnet`,
and `WALRUS_NETWORK=testnet`, plus matching relay, aggregator, explorer endpoints, and a testnet
package ID. Testnet is not the default.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Phase 2A, 2B, 2C, 2D, and 2E Integration Status

The Phase 1 foundation includes the polished product UI, all required routes, typed domain models, deterministic
local trace generation, a JSON-backed server-side development session service, local-adapter trace
readback verification, hash-based tamper simulation, server-side API route boundaries, service
modules, environment template, Sui contract plan, and a shared Sui wallet identity foundation built
with the official Mysten dApp Kit packages. The landing navigation, app sidebar, landing CTA, and
agent form read the same wallet account state. New local sessions require a valid Sui owner address,
which is persisted in the session and prepared proof metadata.

The development store lives at `.data/sessions.json` and is created with sample records on first
run. It is intentionally local-only and ignored by Git. Unknown session IDs return not-found
responses instead of sample evidence.

Phase 2A kept the legacy `walrus_direct` HTTP publisher adapter available for explicit developer use.
It is not the default production path.

Phase 2B adds a server-only, read-only Tatum Sui JSON-RPC client with an explicit allowlist for
`sui_getObject`, `sui_getTransactionBlock`, and `suix_queryEvents`. `POST /api/tatum/rpc` rejects
arbitrary methods, while `POST /api/sui/verify-proof` compares available onchain proof fields to the
expected trace, result, input, and Walrus blob evidence. Current local proof placeholders are reported
as `local_phase1`; they are never presented as onchain RPC success. Configure `SUI_NETWORK`,
`TATUM_SUI_RPC_URL`, and `TATUM_API_KEY` to enable proof-anchor reads. The Onchain Analyzer uses
`SUI_RPC_URL` with the official public Sui RPC default for Sui enrichment. EVM and multichain
analysis uses Tatum Blockchain MCP only; if MCP is disabled or unavailable, the app produces a clean
preliminary EVM report and does not fall back to Etherscan or other EVM providers.

Phase 2C adds an owned `AgentSessionProof` Move object and `AgentSessionProofCreated` event under
`move/agent_blackbox`. The session detail page builds an unsigned `Transaction` with the official
Mysten SDK, asks the connected browser wallet to sign and execute it, then persists only the returned
transaction digest, proof object ID when available, deployed package ID, network, and owner. The
server never handles wallet private keys. Configure `NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID` after
publishing the package to enable the anchor action. See
[`docs/sui-proof-registry.md`](docs/sui-proof-registry.md) for publish and configuration steps.

Phase 2D hardens the live-mainnet handoff. Proof metadata now records explicit `local` or `onchain`
mode and an anchor timestamp. When a wallet transaction digest exists but the created proof object ID
cannot be extracted, the app stores `anchored_pending_object`, checks the digest through Tatum RPC,
and reports `Transaction found` without claiming full proof verification. Full `Passed` status now
requires matching object, transaction, event, session ID, owner, hashes, and Walrus Blob ID. The
session detail and verification pages expose `Recheck Proof` controls.

This workspace did not have the Sui CLI or `.env.local` configuration during the Phase 2D hardening
pass, so no package was published and no package ID was fabricated. Follow
[`docs/sui-proof-registry.md`](docs/sui-proof-registry.md) on a funded Sui Mainnet environment.

Phase 2F adds the real server-side Agent Runtime. `POST /api/agent/prepare` validates the connected
wallet, runs the selected agent mode, records tool-call summaries, creates a structured trace-ready
report, and then returns the deterministic trace bundle for wallet-paid Walrus upload.
The runtime retries schema repair once and returns `agent_runtime_schema_error` if strict structured
output still cannot be validated.

The wallet selector uses a custom dark Agent BlackBox modal backed by the same dApp Kit wallet list
and connection actions, preserving detected wallets while avoiding the default bright modal styling.

Phase 2E makes the main Walrus storage path wallet-paid and SDK-based. `POST /api/agent/prepare`
creates a deterministic trace bundle without claiming storage success. The browser uses
`@mysten/walrus` and `https://upload-relay.mainnet.walrus.space` with the connected wallet to register,
upload, and certify the blob. `POST /api/sessions/[id]/storage-finalize` then reads the blob back
through `https://aggregator.walrus-mainnet.walrus.space`, recomputes the trace hash, persists the
Walrus Mainnet references, and only marks storage as stored after the hash matches.

The optional Tatum-managed Walrus adapter, production AI execution, MCP calls, encryption,
authentication, and a database remain intentionally unconnected.

## Phase 2 Roadmap

1. Add `OPENAI_API_KEY` to server-side deployment secrets and smoke test all four agent modes.
2. Harden the wallet-paid Walrus SDK Upload Relay smoke path in a real browser wallet.
3. Extract and store live Blob ID and Walrus Object ID values from the SDK flow.
4. Keep direct Walrus blob read and trace-hash verification authoritative.
4. Verify proof objects and transaction digests through the read-only Tatum Sui RPC layer.
5. Build and publish the Sui Move proof package.
6. Create wallet-signed proof transactions.
7. Optionally connect Tatum's Walrus-powered managed upload adapter.
8. Add the Tatum MCP verifier.
9. Add optional encryption for sensitive traces.

See [`docs/sui-proof-registry.md`](docs/sui-proof-registry.md) for the implemented Move registry guide
and [`docs/contract-plan.md`](docs/contract-plan.md) for the broader contract roadmap.
