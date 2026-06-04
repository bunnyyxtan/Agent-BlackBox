# Agent BlackBox: Product Context for AI Collaborators

Read this file before changing the project. It is the durable product briefing for future AI agents and
human contributors.

## Source of Truth

This context was distilled from the 23-page `Agent BlackBox PRD.pdf` provided on June 2, 2026.
The PRD is the product source of truth. This file exists so future agents can quickly recover the product
vision, architectural intent, implementation boundaries, and decision criteria without reducing the idea
to a feature checklist.

Also read:

- `README.md` for setup, implemented routes, and current scaffold status.
- `docs/sui-proof-registry.md` for the deployed Sui proof registry and anchoring flow.
- `docs/agent-runtime.md` for the server-side Agent Runtime and trace-output contract.
- `docs/walrus-mainnet-sdk-relay.md` for the Walrus Mainnet SDK Upload Relay flow.
- The existing code before making assumptions about the current implementation phase.

## Walrus-First Architecture Correction

As of June 2, 2026, the canonical product story is:

**Store on Walrus. Anchor on Sui. Verify through Tatum RPC.**

Walrus is the decentralized blob-storage layer and direct blob-verification source. Sui anchors compact
proof metadata. Tatum remains required for server-side Sui RPC reads and may optionally provide a
managed Walrus upload adapter. Do not describe Tatum as the storage network or make a Tatum-specific
job type the canonical session-storage model.

## Mainnet-First Network Correction

As of June 3, 2026, Agent BlackBox is mainnet-first.

The canonical production flow is:

**Use Agent -> Generate BlackBox Trace -> Store trace on Walrus Mainnet -> Anchor proof on Sui
Mainnet -> Verify through Tatum Sui Mainnet RPC.**

Do not default to testnet unless the user explicitly enables testnet mode. Do not fake mainnet success,
silently fallback to testnet, show Sui Mainnet while using testnet endpoints, use testnet package IDs on
mainnet, or use testnet explorer links for mainnet transactions.

Mainnet mode requires real SUI/WAL costs and a connected wallet able to complete the official Walrus
SDK Upload Relay flow. The default storage provider is `walrus_sdk_relay` with
`WALRUS_UPLOAD_RELAY_URL=https://upload-relay.mainnet.walrus.space`. Do not treat a missing upload
relay, wallet rejection, failed certification, or failed aggregator readback as successful storage.

Developers may opt into testnet later by explicitly setting `NEXT_PUBLIC_SUI_NETWORK=testnet`,
`SUI_NETWORK=testnet`, and `WALRUS_NETWORK=testnet`, plus matching relay, aggregator, explorer
endpoints, and a testnet package ID. Testnet is not the default.

## Product Identity

**Name:** Agent BlackBox

**Tagline:** The flight recorder for autonomous AI agents.

**One-line description:** Agent BlackBox records, stores, replays, and verifies AI agent sessions by
storing traces on Walrus, anchoring proof metadata on Sui, and verifying proof reads through Tatum RPC.

## Agent Runtime Branding Rule

The real Agent Runtime may use an external AI API internally through a server-only `OPENAI_API_KEY`,
but the user-facing product must not mention API provider names, model names, GPT names, or runtime
vendor branding. UI and stored public trace labels should use product language such as `Agent`,
`Agent Runtime`, `Agent Trace`, `Agent Plan`, `Tool Call`, `Verification`, and `BlackBox Trace`.

Never expose `OPENAI_API_KEY` to client components or `NEXT_PUBLIC_` environment variables. Store
structured reports, tool-call summaries, observations, limitations, confidence, and final output.
Do not store hidden reasoning.

## The Core Vision

Agent BlackBox is not a file uploader, a cloud drive, a generic chatbot, or a blockchain dashboard.
It is accountability infrastructure for autonomous AI agents.

As AI agents move from producing chat responses to taking meaningful actions, users need evidence of:

- What the user originally asked.
- What files or inputs the agent used.
- What plan the agent created.
- What tools the agent called.
- What final output the agent produced.
- Whether the trace or output was modified afterward.
- Whether the evidence remains available.
- Whether a third party can verify the result independently.

The product turns every AI task into a tamper-evident, replayable evidence record. The important idea is
not merely that a trace was stored. The important idea is that the full record can be replayed, its hashes
can be recomputed, its storage can be checked directly, and its compact proof can be verified independently.

## Product Thesis

AI systems increasingly act in domains where an unverifiable final answer is not enough: payments,
compliance, research, freelance delivery, DAO operations, onchain automation, trading support, and
business workflows.

Agent BlackBox gives those workflows a flight recorder:

1. Capture what happened.
2. Seal the trace with deterministic hashes.
3. Store the full evidence bundle offchain.
4. Anchor lightweight proof metadata onchain.
5. Let anyone replay and verify the evidence.
6. Make later tampering visibly fail.

## The Evidence Model

### Agent Session

An Agent Session is one recorded AI task. It includes:

- Session ID
- Task title
- User prompt or instruction
- Agent mode
- Uploaded file metadata
- Input hash
- Agent plan
- Tool-call timeline
- Structured Agent Runtime report
- Final output
- Result hash
- Trace hash
- Walrus upload job ID, selected upload adapter, and storage status
- Storage expiry and renewal state
- Walrus Blob ID and Walrus Object ID
- Direct Walrus read and integrity result
- Sui proof object ID and transaction digest
- Tatum Sui RPC verification result

### BlackBox Trace

The BlackBox Trace is the complete structured JSON record of an agent session. It is the replayable
forensic artifact. It belongs in Walrus-backed storage, not directly onchain.

### Sui Proof Anchor

The Sui Proof Anchor is compact onchain metadata that proves a wallet registered a specific trace hash
and result hash at a specific time. Sui should store lightweight proof metadata only, never the full trace.

### Verification Report

The public verification report is the product center of gravity. It should answer, at a glance:

- Is the Walrus blob stored and available?
- Is the Walrus blob available?
- Can the blob be read directly?
- Is the Sui proof anchor present?
- Does Tatum RPC confirm the proof?
- Do the hashes match?
- Is storage active?
- Can the session be replayed chronologically?

### Tamper Resistance Test

The tamper test is the clearest product demonstration:

1. Begin with a verified trace.
2. Modify the final output locally.
3. Recompute the trace hash.
4. Show that the local trace no longer matches the sealed proof hash.
5. Change the UI from `Trace Verified` to `Tampered Trace Detected`.

This should be the strongest judge-facing moment because it makes the product value concrete immediately.

## Hybrid Architecture

The product intentionally combines five Sui-native technical paths.
Do not blur these responsibilities together.

### 1. Canonical Storage and Verification: Walrus Blob Storage

Walrus is the storage source of truth. Use direct Walrus blob concepts for storage and independent
evidence verification:

- Store trace bundles as Walrus blobs.
- Parse Blob ID and Walrus Object ID.
- Read the stored trace through the aggregator.
- Check blob availability.
- Check storage duration.
- Replay the trace.
- Compare the returned blob content hash with the expected trace hash.

This path is canonical even when an optional managed adapter performs the upload.

### 2. Default Upload Adapter: Walrus SDK Upload Relay

Use the official Walrus TypeScript SDK and official Mainnet Upload Relay for the default upload path:

- Prepare deterministic trace bundles server-side.
- Register and certify storage through the connected browser wallet.
- Upload blob bytes through the relay.
- Persist Blob ID, Walrus Object ID when available, relay URL, aggregator URL, provider, and network.
- Read the blob back through the Mainnet aggregator and recompute the trace hash before marking stored.

This path replaces the previous self-hosted publisher assumption. Do not assume a free public publisher
or unauthenticated third-party publisher exists.

### 3. Optional Managed Upload Adapter: Tatum Walrus API

Tatum's Walrus-powered storage API may be supported as an optional managed upload adapter:

- Upload trace bundles and evidence files to Walrus.
- Receive an upload job ID.
- Poll pending and certified status.
- List uploaded files.
- Read expiry dates.
- Cancel renewal.
- Support deletion and instant-delete flow.

This adapter makes Walrus storage operationally convenient. It does not replace Walrus as the storage
layer or direct Walrus reads as the proof source.

### 4. Proof Registry: Sui

Use Sui for lightweight proof metadata:

- Owner
- Task title
- Agent mode
- Trace hash
- Result hash
- Input hash
- Neutral upload job ID and upload adapter
- Storage provider and storage network
- Walrus Blob ID
- Walrus Object ID
- Creation timestamp
- Verification status

The deployed `AgentSessionProof` object, event, and function are described in `docs/sui-proof-registry.md`.

### 5. Proof Reads: Tatum Sui RPC

Use Tatum Sui RPC server-side for:

- Reading proof objects.
- Reading transaction blocks.
- Querying proof events.
- Confirming owner and network.
- Supporting the verification report.

### 6. Sui Onchain Analyzer

Use Sui JSON-RPC for Sui wallet, token, transaction, object, and package analysis. The analyzer should
read balances, coin metadata, owned objects, transaction blocks, object details, and available effects
without requiring paid Sui provider keys. It should never fabricate holdings, history, or suspicious
activity. Non-Sui provider paths are outside the active product scope.

## Primary User Flow

The core product story should remain easy to demonstrate:

1. User opens the landing page.
2. User clicks `Start Recording`.
3. User creates an agent session with a title, prompt, mode, optional file metadata, and storage policy.
4. The app generates a structured trace and deterministic hashes.
5. The app stores or prepares the trace for Walrus storage through the selected upload adapter.
6. The app prepares or submits a lightweight Sui proof anchor.
7. The user opens the session detail page and sees the forensic timeline.
8. The user opens the verification report.
9. The user runs the tamper resistance test.
10. The mismatch makes the accountability value obvious.

For the hackathon story, a judge should understand the product in under 20 seconds and complete the main
flow in under 2 minutes.

## Target Users

### Near-Term

- Hackathon judges
- Developers
- AI-agent builders
- Web3 infrastructure reviewers

### Future

- AI-agent developers who need verifiable logs
- DAOs using agents for operations
- Freelancers and teams delivering AI-assisted work
- Enterprises needing AI decision audit trails
- Onchain automation builders
- Compliance and risk-review teams
- Research and data teams needing reproducible outputs

## User Experience Principles

The product must feel like serious cyber-forensics infrastructure for AI accountability.

### Visual Direction

- Premium dark interface
- Glassmorphism cards
- Subtle gradients
- Neon cyan and blue accents
- Readable futuristic typography
- Responsive desktop and mobile layouts
- Clear status hierarchy
- Calm, technical confidence

### Avoid

- Crypto casino aesthetics
- Meme UI
- Generic uploader framing
- Generic chatbot framing
- Excessive animation
- Decorative complexity that distracts from proof
- Unnecessary emoji

### Language Rules

User-facing UI must not use the words `mock`, `fake`, `demo`, or `stub`.

When external integrations are not live, describe states honestly through product language such as
`Pending`, `Prepared`, `Certified`, `Verified`, or configuration readiness. Keep implementation caveats
in code comments and technical documentation.

## Security and Privacy Invariants

These are hard constraints:

- Never expose `TATUM_API_KEY` to client components.
- Route optional Tatum-managed Walrus adapter calls through server-side API routes.
- Route Tatum Sui RPC calls through server-side API routes.
- Do not add private-key environment variables.
- Do not commit secrets.
- Do not store sensitive user files permanently in the scaffold.
- Keep proof signing in the connected browser wallet. Never add server-side wallet signing or private keys.
- Do not add database secrets during the scaffold phase.

Walrus blobs are public and discoverable by default. Production mode must encrypt sensitive trace bundles
before upload and decrypt locally for replay. The encryption service boundary exists so this can be added
without redesigning the storage architecture.

## Build Phases

Always confirm the requested phase before expanding the system. Do not quietly implement future phases.

### Phase 1: Scaffold MVP

Purpose: build the complete product shell and prove the user story locally.

Includes:

- Premium UI shell
- Required routes and reusable components
- Typed data models
- Local session generation
- Deterministic hashing
- Storage and proof preparation states
- Server-side API route boundaries
- Shared frontend Sui wallet connection state and owner capture for new local sessions
- Tamper simulation
- README and contract plan

Does not include:

- Live AI API
- Live Walrus upload or Tatum-managed Walrus adapter
- Live direct Walrus read
- Live Sui contract
- Wallet signing or onchain wallet transactions
- Live non-Sui provider calls

### Phase 2A: Legacy Walrus Direct HTTP Integration

Implemented:

- Deterministic trace-bundle upload through a configured Walrus HTTP publisher when explicitly selected
- Blob ID and available Walrus Object ID persistence
- Direct aggregator reads
- Trace-hash recomputation from aggregator content
- Honest `local_only` fallback when endpoints are absent or non-strict uploads fail
- Storage-console status, direct-read, and verify actions

This adapter is legacy-only. It is not the default mainnet path.

### Phase 2B: Read-Only Tatum Sui RPC Verification

Implemented:

- Server-only Tatum Sui JSON-RPC client using `TATUM_API_KEY`, `TATUM_SUI_RPC_URL`, and `SUI_NETWORK`
- Read allowlist for `sui_getObject`, `sui_getTransactionBlock`, and `suix_queryEvents`
- Structured `not_configured`, `local_phase1`, `passed`, and `failed` verification states
- Dedicated `POST /api/sui/verify-proof` endpoint
- Honest local-proof handling: Phase 1 placeholders never report onchain RPC success
- Verification-report, session-detail, settings, and developer-page status updates

### Phase 2C: Sui Proof Anchor

Implemented:

- Owned `AgentSessionProof` Move object and `AgentSessionProofCreated` event package
- Lightweight hash, Walrus-reference, upload-reference, owner, timestamp, and status anchoring
- Unsigned Sui `Transaction` builder in the frontend
- Connected-browser-wallet signing and execution through Mysten dApp Kit
- Server-side persistence of returned transaction digest, proof object ID, package ID, network, and owner
- Read-only proof object, transaction, and event verification through Tatum Sui RPC after anchoring
- Honest configuration, wallet, network, storage, and pending-object states

### Phase 2D: Sui Mainnet Anchor Hardening

Implemented:

- Explicit `local` and `onchain` proof modes with persisted anchor timestamps
- Explicit `anchored_pending_object` state when wallet effects return a digest without an extractable object ID
- Transaction-only Tatum RPC recheck with honest `Transaction found` reporting
- Full proof verification comparison for session ID, owner, hashes, Walrus Blob ID, object, transaction, and event
- Mismatch reasons in proof details
- Recheck controls on session detail and verification pages
- Preferred `NEXT_PUBLIC_SUI_EXPLORER_BASE_URL` configuration with backward-compatible explorer fallback
- Honest publish guidance when the local Sui CLI, funded wallet, or environment configuration is unavailable

### Phase 2E: Walrus SDK Upload Relay Integration

Implemented:

- Default `walrus_sdk_relay` storage provider.
- Official `@mysten/walrus` browser upload flow through `https://upload-relay.mainnet.walrus.space`.
- Server-side `/api/agent/prepare` trace-bundle preparation.
- Wallet-paid register, upload, certify, and readback progress states in the Use Agent flow.
- Server-side `/api/sessions/[id]/storage-finalize` aggregator readback and hash verification.
- `/api/storage/relay-status` upload-relay readiness check.
- Mainnet relay, aggregator, provider, and storage-network metadata in session, proof, settings,
  storage, developer, and verification surfaces.

### Phase 2F: Server-Side Agent Runtime

Implemented:

- Server-only Agent Runtime using `OPENAI_API_KEY`.
- Strict structured JSON output for Research, Risk Review, Delivery Proof, and Sui Onchain
  Analyzer agents.
- Traceable internal tool abstractions: `recordInputEvidence`, `generatePlan`, `analyzeOnchainTarget`,
  `analyzeSpecialistAgentContext`, `tatumSuiRpcCheck`, `hashTracePreview`, `prepareWalrusTrace`, and
  `finalizeAgentReport`.
- Research, Risk Review, and Delivery Proof agents attach deterministic `specialistAnalysis` payloads
  with task-specific research briefs, risk matrices, delivery receipts, detected entities, evidence
  items, structured report sections, limitations, next actions, and proof notes. The report UI and
  JSON/Markdown/Copy exports render these payloads directly so the final report is useful even when
  external web search is disabled.
- Sui Onchain Analyzer detects Sui wallet, transaction, object, package, and network context through
  `lib/onchain/analyzer-router.ts`. It reads balances, coin metadata, owned objects, transaction
  blocks, object/package details, effects, events, and balance/object changes where Sui JSON-RPC
  returns them. It does not route to non-Sui providers and does not fabricate onchain activity.
- Sui analyzer enrichment uses `SUI_RPC_URL` when present and otherwise defaults server-side to
  `https://fullnode.mainnet.sui.io:443`; no Sui API key is required for the first analyzer version.
  Do not add Sui gRPC, Sui indexer, SuiVision, Suiscan, BlockVision, or paid Sui provider integration
  in this version. Sui analysis should remain simple and reliable with official JSON-RPC only.
- Agent trace bundles store user intent, selected agent, prompt, file metadata, structured output,
  tool-call summaries, hashes, owner wallet, storage network, timestamps, and version.
- UI execution timeline for reading task, planning, tool calls, report production, trace sealing,
  Walrus upload, blob readback, hash verification, and session save.
- Sidebar wallet dropdown is rendered through a body-level fixed-position portal to avoid clipping.
- WAL insufficient-balance errors are displayed in WAL, not raw FROST-only amounts, with raw details
  available only under a debugging disclosure.
- Wallet connection uses the custom premium Agent BlackBox modal, backed by dApp Kit `useWallets`
  and `connectWallet`, instead of the default bright wallet selector.
- Wallet, Walrus, Sui, storage, proof-anchor, and Agent Runtime errors should pass through
  `lib/errors/user-facing-errors.ts` before user display.
- Settings includes an asynchronous readiness panel for runtime key presence, Tatum RPC reachability,
  Walrus relay/aggregator configuration, proof package configuration, and latest session status.

### Phase 4: Submission Polish

Purpose: finish the judge experience and keep provider routing stable.

Build:

- Better error states
- Strong judge-ready data
- Final README refinement
- Demo video script and submission flow

## Current Repository State

As of June 3, 2026, the repository contains the Phase 1 scaffold, local backend foundation, shared
Sui wallet identity foundation, Phase 2C proof-anchor implementation, Phase 2D mainnet-first
hardening, Phase 2E Walrus SDK Upload Relay integration, and Phase 2F server-side Agent Runtime. The frontend uses the official Mysten dApp Kit provider and a reusable
wallet control across the landing page, sidebar, and agent form. New local sessions require a valid
connected Sui owner address, which is persisted in the session and prepared proof metadata. Phase 2E
prepares deterministic trace bundles server-side, uploads them on Walrus Mainnet through the official
SDK Upload Relay with connected-wallet payment, persists live blob metadata, and only marks storage
as stored after direct Mainnet aggregator readback and trace-hash recomputation succeed. Phase 2F
runs the selected agent mode server-side before Walrus upload and stores structured reports plus
tool-call summaries in the trace. The final Sui-scope polish pass improved deterministic specialist
reports, Sui wallet balance/coin metadata reads, report-first session detail hierarchy, readiness
copy, strict schema repair retry, friendly WAL/SUI balance errors, explicit proof-package
configuration status, root/app loading states, and a `/developers` alias that redirects to the
canonical `/developer` route. The legacy
Phase 2A HTTP publisher adapter remains available only when explicitly selected. The repository
includes a server-only, read-only Tatum Sui JSON-RPC verifier with an explicit three-method allowlist.
Local proof placeholders return `local_phase1`; anchored references can be checked through Tatum RPC
without exposing the API key or enabling RPC write methods. Phase 2C adds the owned proof-object Move
package under `move/agent_blackbox`, a browser-safe unsigned transaction builder, a wallet-signed
`Anchor Proof on Sui` action for real Walrus-backed sessions, and a server route that persists only
returned chain references before rerunning read-only verification. Phase 2D adds explicit onchain
proof mode and anchor timestamps, a digest-only `anchored_pending_object` state, transaction-only
Tatum checks, owner and session-ID comparison during full verification, mismatch reasons, and
recheck controls. The Agent BlackBox Move proof package is now published on Sui Mainnet at
`0xbaaa56797e543f20b44fd255f7ca051cb5d4e185b59179a20514159cc8a1914f` with module
`agent_blackbox` and entry function `create_session_proof`; publish transaction
`79reMq9AMzvGo9WCeCNKePhiGYJfXXe75rZ2yqKqr8sp`. The active onchain product is Sui-native: no
non-Sui provider path or local tool-server runtime is part of the active provider path. No
server-side private key exists.
The repository
includes the primary UI routes, typed models, local deterministic trace generation, a JSON-backed
server-side development session service, neutral storage-adapter boundaries, local trace-bundle
storage and hash verification, direct-Walrus and optional Tatum-managed Walrus adapter boundaries,
server-side API routes, the verification report, storage views, hash-based tamper simulation,
`.env.example`, `README.md`, and `docs/sui-proof-registry.md`. Browser `localStorage` is not the canonical
session store, and unknown IDs return not-found responses instead of sample evidence.

Before changing anything, inspect the repository and confirm this status is still accurate. Update this
section when a later phase is completed.

## Required Product Routes

- `/`
- `/dashboard`
- `/sessions`
- `/sessions/new`
- `/sessions/[id]`
- `/verify/[id]`
- `/storage`
- `/settings`
- `/developer`

## Planned Server API Boundaries

- `POST /api/agent/run`
- `POST /api/agent/prepare`
- `POST /api/onchain/analyze`
- `POST /api/storage/upload`
- `GET /api/storage/relay-status`
- `GET /api/storage/status/[uploadJobId]`
- `GET /api/storage/list`
- `POST /api/storage/cancel-renewal`
- `POST /api/storage/delete`
- `GET /api/storage/read/[blobId]`
- `POST /api/storage/verify/[blobId]`
- `GET /api/walrus/read/[blobId]`
- `POST /api/walrus/verify/[blobId]`
- `POST /api/tatum/rpc`
- `POST /api/sui/verify-proof`
- `POST /api/sessions/[id]/storage-finalize`
- `POST /api/sessions/[id]/proof-anchor`
- `GET /api/verify/[id]`

## Non-Goals

Do not add these unless the user explicitly changes the scope:

- Generic cloud-drive features
- Generic chatbot features
- Authentication
- Database persistence
- Payments or escrow
- Marketplace features
- Agent monetization
- Private-key management
- Real autonomous onchain actions
- Complex AI workflows
- Mobile app
- Team collaboration
- Enterprise compliance suites
- Advanced encryption implementation before the core proof flow works

## Decision Filter for Future Work

Before adding a feature, ask:

1. Does this make an agent session more recordable, replayable, or independently verifiable?
2. Does it make the hybrid Tatum, Walrus, and Sui architecture clearer?
3. Does it strengthen the verification report or the tamper-resistance story?
4. Is it part of the explicitly requested build phase?
5. Can it be added without exposing secrets or weakening the storage-proof boundary?

If the answer is mostly no, it is probably outside the Agent BlackBox vision.

## Collaboration Rules for Future AI Agents

- Read this file, `README.md`, and `docs/sui-proof-registry.md` before implementation work.
- Inspect the current repository state before assuming a phase is incomplete.
- Follow the PRD closely and keep changes scoped to the requested phase.
- Keep components reusable and TypeScript types consistent.
- Preserve the distinction between Walrus blob storage, optional upload adapters, direct blob verification,
  onchain proof, and RPC reads.
- Keep secrets server-side.
- Keep `OPENAI_API_KEY` server-side and out of public UI/client bundles.
- Do not add private keys.
- Do not overbuild.
- Do not push to Git unless the user explicitly asks.
- When a phase advances, update this context file so the next agent inherits an accurate picture.

## Canonical Pitch

Agent BlackBox is the flight recorder for autonomous AI agents. It records every AI task as a
tamper-evident trace, stores the trace on Walrus Mainnet through the official Walrus SDK Upload Relay,
verifies blob availability directly through Walrus, anchors proof metadata on Sui, and verifies proof
reads through Tatum Sui RPC. Tatum's Walrus-powered storage API remains available as an optional
managed upload adapter.

The result is a replayable, verifiable, storage-backed record of what an AI agent did and whether its
output was modified later.
