# Agent BlackBox UI Wiring Report

Date audited: June 2, 2026

Scope: frontend and existing Phase 1 service-boundary inspection only. No UI, API, backend, package, or integration code was changed during this audit.

## Phase 1 Backend Foundation Update

The first backend-foundation pass was implemented after this audit. Runtime sessions now use
`lib/session-service.ts` as the shared server-side source of truth, with a local development JSON
store at `.data/sessions.json`. The use-agent form submits to `POST /api/agent/run`; dashboard,
archive, detail, storage, and verification views read the shared service; unknown IDs return
not-found responses; and the tamper test recomputes modified result and trace hashes through
`POST /api/verify/[id]/tamper-test`.

The historical findings below remain useful as the record of why this pass was needed.

## Phase 2A Walrus Direct Update

The direct Walrus HTTP pass was implemented after the local backend and shared-wallet foundations.
`walrus_direct` now uploads deterministic trace-bundle JSON through a configured publisher, reads
stored content through a configured aggregator, and recomputes the canonical trace hash from returned
blob content. Missing endpoint configuration and non-strict upload failures use the local adapter with
an explicit `local_only` warning. The storage page now reads shared sessions and exposes working
`View Status`, `Direct Read`, and `Verify Blob` actions. Historical storage-button findings below remain
as the audit record that motivated this pass. This adapter is now legacy-only and is not the default
mainnet upload path.

## Phase 2B Tatum Sui RPC Update

The read-only Tatum Sui RPC pass was implemented after direct Walrus verification. `lib/tatum-rpc.ts`
now uses server-only `TATUM_API_KEY`, `TATUM_SUI_RPC_URL`, and `SUI_NETWORK` configuration and exposes
allowlisted `sui_getObject`, `sui_getTransactionBlock`, and `suix_queryEvents` reads. The public
`POST /api/tatum/rpc` boundary rejects arbitrary methods, and `POST /api/sui/verify-proof` can compare
available onchain proof fields against expected hashes and the Walrus Blob ID. Current Phase 1 proof
placeholders return `local_phase1`, so the report no longer presents them as onchain RPC success.

## Phase 2C Sui Proof Anchor Update

The owned Sui proof-object pass was implemented after the read-only verifier. The Move package under
`move/agent_blackbox` creates one wallet-owned `AgentSessionProof` object and emits
`AgentSessionProofCreated`. The session detail page builds an unsigned SDK `Transaction`, asks the
connected browser wallet to sign and execute it, and persists returned chain references through
`POST /api/sessions/[id]/proof-anchor`. The server never stores a private key and reruns the existing
read-only Tatum verifier when a created proof object ID is available.

## Phase 2D Sui Mainnet-First Hardening Update

The mainnet-first hardening pass preserves successful wallet digests even when effects do not expose a
created proof object ID. Those sessions use `anchored_pending_object`, and Tatum RPC checks the
transaction without reporting full success prematurely. Full proof verification now compares session
ID and owner alongside hashes and Walrus Blob ID. Session detail and verification pages expose
`Recheck Proof`, and proof details surface mismatch reasons. The local workspace did not include the
Sui CLI or `.env.local`, so publishing and a funded-wallet transaction remain external test steps.

## Phase 2E Walrus SDK Upload Relay Update

The default storage path now uses `walrus_sdk_relay` with the official `@mysten/walrus` SDK and
`https://upload-relay.mainnet.walrus.space`. The Use Agent flow prepares the trace server-side,
uploads and certifies through the connected browser wallet, reads back through the Walrus Mainnet
aggregator, and only stores the session when the recomputed trace hash matches. Settings, storage,
developer, session detail, proof details, and verification surfaces now expose relay, provider, and
Walrus Mainnet metadata.

## Walrus-First Architecture Addendum

Architecture correction applied after the original audit:

**Store on Walrus. Anchor on Sui. Verify through Tatum RPC.**

Walrus is the canonical blob-storage layer and direct verification source. Tatum remains required for
server-side Sui RPC verification and may optionally provide a managed Walrus upload adapter. New backend
work must use neutral `StorageReference` fields and the adapters documented in
`docs/walrus-first-backend-plan.md`. Historical Tatum-first labels below should be read as audit findings
that motivated the correction, not as implementation guidance.

## Executive Summary

The repository is a Next.js App Router Phase 1 scaffold. It already contains the required product pages, reusable UI components, typed session models, deterministic local hashing, seeded records, browser `localStorage` persistence, tamper-test presentation, and server-side API route boundaries.

The frontend is visually close to the intended product story, but the runtime is still split between several sources of truth:

- Newly created sessions are written directly to browser `localStorage`.
- Dashboard counts and the storage page always read static seeded sessions.
- Dynamic session and verification pages read browser-local sessions but silently fall back to the first seeded session for an unknown ID.
- Existing API routes are not called by the frontend.
- Storage, Walrus, Sui, and Tatum RPC success states are generated locally or hardcoded.
- Wallet state is simulated independently inside each rendered wallet button.

The first backend work should normalize the session contract and establish a single session service used by session creation, dashboard, archive, detail, storage, and verification views.

## 1. Project Structure Summary

### Framework

- Framework: Next.js 15 App Router with React 18 and TypeScript.
- Styling: Tailwind CSS plus shared styles in `app/globals.css`.
- Root layout: `app/layout.tsx`.
- Marketing route group: `app/(marketing)/page.tsx`.
- Inside-app route group: `app/(app)/`.
- Inside-app layout: `app/(app)/layout.tsx`, which renders `components/layout/AppShell.tsx`.
- Shared domain types: `types/blackbox.ts`.
- Local session generation and persistence: `lib/agent-trace.ts`, `lib/hash.ts`, and `lib/session-store.ts`.
- Server-side integration boundaries: `lib/storage-adapters/`, `lib/walrus.ts`, `lib/tatum-rpc.ts`, `lib/sui-proof.ts`, `lib/mcp-verifier.ts`, and `lib/encryption.ts`.
- Route handlers: `app/api/`.

### Runtime Page Ownership

- Landing page: `app/(marketing)/page.tsx`.
- Landing navigation and footer: `components/layout/LandingNav.tsx` and `components/layout/Footer.tsx`.
- Inside-app shell: `components/layout/AppShell.tsx`, `components/layout/Sidebar.tsx`, and `components/layout/Navbar.tsx`.
- Domain UI: `components/blackbox/`.
- Reusable UI: `components/ui/`.

### Important Non-Runtime Artifacts

- `generated-page.html` is a standalone static design artifact, not an App Router page.
- `out.html` is empty.
- `replace.js` is a maintenance script that rewrites `app/(app)` page wrappers. It is not used by the runtime.
- `public/` currently has no tracked assets. `LogoCloud.tsx` uses icons and contains TODO notes for future logos.

### Current Phase Confirmation

The repository is still a Phase 1 scaffold, consistent with `AGENTS.md` and `README.md`. The scaffold has more API route boundaries than the UI currently consumes. No live Walrus upload, optional Tatum-managed Walrus adapter request, direct Walrus read, Sui transaction, Tatum RPC request, MCP request, AI execution request, or real wallet provider is connected.

## 2. Current Routes and Pages

### Route: `/`

**Purpose:** Marketing landing page and fast product explanation.

**Key components:** `LandingNav`, `LogoCloud`, `LiveAgentProcess`, `Footer`. `ProofPipeline` is imported but not rendered.

**Current data source:** Static JSX content.

**User actions:** Hero `Use Agent`, hero `See Verified Proof`, landing navigation anchors, top `Connect Wallet`, top `Open App`, visual `Verify Again`, bottom `Connect Wallet`, bottom `Open App`, footer links.

**Backend needed later:** None for static content. Wallet provider state is needed for wallet controls. The judge-facing proof CTA should route to a valid proof report or a public lookup flow.

**Risk of mis-wiring:** The `How It Works` navigation item targets `#how`, but the landing page has no rendered `#how` section. `ProofPipeline` exists and is imported, but the relevant block is swallowed by a malformed comment around `app/(marketing)/page.tsx:186`. The landing visual `Verify Again` button has no handler. The bottom `Connect Wallet` button is a separate plain button with no handler. The footer `Verify Proof` link points to `/verify`, but only `/verify/[id]` exists.

### Route: `/dashboard`

**Purpose:** Overview of sessions, certification, Sui anchors, and integrity posture.

**Key components:** `StatCard`, `SessionsListClient`, `SystemIntegrityPanel`, `GlassCard`.

**Current data source:** Stat cards use `seedSessions` directly. Recent cards use `SessionsListClient`, which switches from seeded sessions to `localStorage` after mount.

**User actions:** `Use Agent`, `View all`, and trace inspection through recent session cards.

**Backend needed later:** Session summary endpoint or shared session store; storage certification counts; proof-anchor counts; verification counts; integration-health endpoint if `SystemIntegrityPanel` is intended to reflect live status.

**Risk of mis-wiring:** Dashboard counters do not update for newly created browser-local sessions, while the recent-session list can update. `SystemIntegrityPanel` always shows nominal/ready states even though integrations are not live.

### Route: `/sessions`

**Purpose:** Archive of recorded BlackBox sessions.

**Key components:** `SessionsListClient`, `SessionCard`.

**Current data source:** Seeded sessions initially, then `localStorage` through `readLocalSessions()`.

**User actions:** `Use Agent`, `Inspect trace`.

**Backend needed later:** List sessions, filter/sort if added, status refresh, stable server-backed IDs.

**Risk of mis-wiring:** The archive is browser-local only. A public verifier, another browser, and server route handlers cannot retrieve newly created sessions.

### Route: `/sessions/new`

**Purpose:** Use-agent form and local BlackBox session creation.

**Key components:** `NewSessionForm`, `AgentModeSelector`, `FileDropzone`, `LiveAgentProcess`.

**Current data source:** React component state. Submit calls `createAndSaveLocalSession()` directly.

**User actions:** Enter title, enter instruction, select agent mode, attach/remove file metadata, choose storage epochs, choose storage mode, submit `Start Session`.

**Backend needed later:** Session-creation request, validation, wallet gating, optional upload preparation, agent execution progress, deterministic server/client hash agreement, storage preparation status, error handling.

**Risk of mis-wiring:** `POST /api/agent/run` already exists but is bypassed. Wallet connection is not required. The live preview is a looping animation independent of form submission. Attached files are metadata only, and the generated `contentHash` hashes metadata rather than actual file bytes.

### Route: `/sessions/[id]`

**Purpose:** Session detail, timeline replay, managed storage summary, and Sui proof summary.

**Key components:** `SessionDetailClient`, `TraceTimeline`, `CopyButton`, `StatusBadge`.

**Current data source:** `getSessionById()` reads `localStorage` on the client and then seeds. Unknown IDs silently display the first seeded session.

**User actions:** `Open Verification Page`, `Copy Proof Link`, `Export Trace JSON`, copy evidence fields, `Inspect proof bundle`.

**Backend needed later:** Load session by ID, return 404 for unknown IDs, retrieve trace, refresh storage and proof state, produce a fully qualified public proof link, authorize any private trace export if encryption is added.

**Risk of mis-wiring:** Unknown IDs show valid-looking fallback evidence. `Copy Proof Link` copies a relative path. Storage and proof sections show generated local IDs and prepared success states.

### Route: `/verify/[id]`

**Purpose:** Public/judge-facing verification report and tamper-resistance demonstration.

**Key components:** `VerifySessionClient`, `VerificationGrid`, `ProofDetails`, `TamperTestPanel`, `TraceTimeline`.

**Current data source:** Browser-local session lookup with first-seed fallback. Verification cards are mostly static labels over locally generated records.

**User actions:** Copy proof-detail values, `Simulate Tamper`, `Restore Trace`.

**Backend needed later:** Public verification report endpoint, stored-trace retrieval, direct Walrus read, deterministic recomputation, Sui proof retrieval through server-side Tatum RPC, comparison report, recheck action, tamper-test action or client-side tamper simulation with authoritative sealed proof comparison.

**Risk of mis-wiring:** The tamper button toggles presentation state only. It does not modify output or recompute a trace hash. Unknown IDs display fallback proof data. Cards state `Certified`, `Found`, and `Passed` even when no external check occurred.

### Route: `/storage`

**Purpose:** Walrus blob-storage operations and direct Walrus verification overview.

**Key components:** `StorageJobCard`, `WalrusVerificationPanel`, `GlassCard`.

**Current data source:** `seedSessions` only.

**User actions:** `View Status`, `Copy ID`, `Cancel Renewal`. Only `Copy ID` works.

**Backend needed later:** List jobs, get job status, cancel renewal, delete if supported, direct blob read, direct blob-hash verification, loading and error states.

**Risk of mis-wiring:** Newly created sessions never appear. Buttons do not call the existing API boundaries. Direct Walrus panels have no recheck/read action. No delete or instant-delete control is rendered.

### Route: `/settings`

**Purpose:** Server-side integration configuration posture.

**Key components:** `GlassCard`, `StatusBadge`.

**Current data source:** Server environment variables.

**User actions:** None.

**Backend needed later:** Optional server-side readiness check endpoint if live diagnostics are desired.

**Risk of mis-wiring:** The page safely avoids rendering `TATUM_API_KEY`, but configuration presence is not the same as connectivity. Labels should stay explicit about whether a value is configured versus verified.

### Route: `/developer`

**Purpose:** Architecture, API surface, data-model explanation, and roadmap.

**Key components:** Static arrays rendered in `GlassCard`.

**Current data source:** Static JSX content.

**User actions:** None.

**Backend needed later:** None unless this becomes live API documentation or integration diagnostics.

**Risk of mis-wiring:** The displayed roadmap calls the next work `Phase 2`, while durable product context separates Tatum/Walrus work from Sui proof-registry work in later phases. Keep phase labels synchronized when backend implementation begins.

### Route Handler Inventory

Existing server route boundaries:

```text
POST /api/agent/run
POST /api/storage/upload
GET  /api/storage/status/[uploadJobId]
GET  /api/storage/list
POST /api/storage/cancel-renewal
POST /api/storage/delete
GET  /api/walrus/read/[blobId]
POST /api/walrus/verify/[blobId]
POST /api/tatum/rpc
GET  /api/verify/[id]
POST /api/mcp/verify
```

All are Phase 1 boundaries. The frontend currently calls none of them.

## 3. Navigation and App Shell

### Landing Navigation

`components/layout/LandingNav.tsx` renders:

| Label | Target | Current result |
| --- | --- | --- |
| Brand | `/` | Works |
| Agents | `#agents` | Works |
| How It Works | `#how` | Broken: no rendered target |
| Verify Proof | `#verify` | Works as a landing-page anchor |
| Storage | `#storage` | Works |
| Developers | `#developers` | Works |
| Connect Wallet | Simulated local button state | Not a shared wallet connection |
| Open App | `/dashboard` | Works |

### Footer Navigation

| Label | Target | Current result |
| --- | --- | --- |
| Dashboard | `/dashboard` | Works |
| Agents | `/sessions/new` | Works |
| Verify Proof | `/verify` | Broken: no index page |
| Storage | `/storage` | Works |
| Developers | `/developer` | Works |
| Documentation | `#` | Placeholder |
| GitHub | `#` | Placeholder |

### Inside-App Sidebar

`components/layout/Sidebar.tsx` renders:

| Label | Target |
| --- | --- |
| Dashboard | `/dashboard` |
| Sessions | `/sessions` |
| Use Agent | `/sessions/new` |
| Storage | `/storage` |
| Settings | `/settings` |
| Developers | `/developer` |

The sidebar is correctly persistent for the current shell design: `AppShell` uses a `100dvh` flex container with internal main-content scrolling, and the desktop sidebar has `lg:h-[100dvh]`. On mobile, the same sidebar becomes a horizontal navigation row beneath the mobile topbar.

### Topbar

`components/layout/Navbar.tsx` renders:

- Mobile brand link to `/`.
- Desktop context: `Agent BlackBox / Phase 1`.
- Static network badge: `Sui Mainnet`.

Resolved by the Mainnet-first correction: `.env.example`, proof metadata defaults, explorer links, Walrus network, and Tatum RPC URL now default to Mainnet. Testnet is optional only when explicitly configured.

### Wallet UI

Wallet buttons appear in:

- Landing top navigation through `WalletConnectButton`.
- Desktop sidebar bottom through a separate `WalletConnectButton` instance.
- Landing bottom CTA as an unrelated plain `Connect Wallet` button with no behavior.

`WalletConnectButton` is a local simulation. Each instance owns separate React state, so landing and sidebar wallet displays are not synchronized.

Required future shared states:

| State | UI label | Required behavior |
| --- | --- | --- |
| Disconnected | `Connect Wallet` | Open Sui wallet selection |
| Connecting | `Connecting...` | Disable duplicate actions and show progress |
| Connected | Shortened wallet address | Show active account and offer disconnect |
| Wrong network | `Switch to Sui` | Request or explain network switch |
| Disconnect | `Disconnect wallet` | Clear shared wallet session |

The current `wrong_network` type exists but is unreachable. Clicking a connected address immediately disconnects without an explicit disconnect affordance.

## 4. Button and CTA Inventory

### Landing Page

| Button or link | Location | Current behavior | Expected final behavior | Backend/API needed | Wallet required | Loading/error state |
| --- | --- | --- | --- | --- | --- | --- |
| `Connect Wallet` | Landing nav | Simulates local connect | Connect shared Sui wallet | Frontend wallet provider | No | Connecting, rejection |
| `Open App` | Landing nav and bottom CTA | Routes to `/dashboard` | Open console | None | No | No |
| `Use Agent` | Hero | Routes to `/sessions/new` | Open use-agent flow | None | No until submit | No |
| `See Verified Proof` | Hero | Scrolls to `#verify` | Keep anchor or open a representative public proof | Optional public proof lookup | No | If lookup added |
| `Verify Again` | Landing trace visual | Does nothing | Recheck a real representative proof or remove action affordance | `POST /api/verify/[id]/recheck` | No | Yes |
| `Connect Wallet` | Landing bottom CTA | Does nothing | Use same shared wallet control as nav | Frontend wallet provider | No | Connecting, rejection |
| Footer `Verify Proof` | Footer | Routes to missing `/verify` | Route to proof lookup or a valid report | Optional verification lookup | No | If lookup added |
| Footer `Documentation` | Footer | `#` placeholder | Open docs | None | No | No |
| Footer `GitHub` | Footer | `#` placeholder | Open repository URL | None | No | No |

### App Shell and Lists

| Button or link | Location | Current behavior | Expected final behavior | Backend/API needed | Wallet required | Loading/error state |
| --- | --- | --- | --- | --- | --- | --- |
| Sidebar items | `Sidebar` | Route navigation | Keep | None | No | No |
| Sidebar wallet | `Sidebar` | Independent local simulation | Shared Sui wallet account | Frontend wallet provider | No | Yes |
| `Use Agent` | Dashboard and sessions archive | Routes to `/sessions/new` | Keep | None | No until submit | No |
| `View all` | Dashboard | Routes to `/sessions` | Keep | None | No | No |
| `Inspect trace` | `SessionCard` | Routes to `/sessions/[id]` | Keep with stable IDs | Session retrieval | No for public records | Page loading/error |

### Use-Agent Form

| Button or action | Location | Current behavior | Expected final behavior | Backend/API needed | Wallet required | Loading/error state |
| --- | --- | --- | --- | --- | --- | --- |
| Agent mode cards | `AgentModeSelector` | Updates local mode | Keep | None | No | No |
| Attach evidence | `FileDropzone` | Records browser file metadata only | Stage files and metadata; upload only when phase allows | Upload preparation and later file handling | At submit | Yes when uploading |
| Remove file | `FileDropzone` | Removes local metadata entry | Keep | None | No | No |
| `Start Session` | `NewSessionForm` | Creates local session and routes to detail | Validate, require wallet, create session, show progress, persist result | `POST /api/agent/run` or dedicated session endpoint | Yes | Yes |

### Session Detail

| Button or action | Location | Current behavior | Expected final behavior | Backend/API needed | Wallet required | Loading/error state |
| --- | --- | --- | --- | --- | --- | --- |
| `Open Verification Page` | Session detail | Routes to `/verify/[id]` | Keep | Session/proof retrieval | No | Page loading/error |
| `Copy Proof Link` | Session detail | Copies relative path | Copy absolute public URL | None | No | Clipboard success/error |
| `Export Trace JSON` | Session detail | Downloads local trace | Export retrieved/decrypted trace under privacy policy | Trace retrieval/decryption later | Depends on privacy | Yes |
| Evidence-row copy buttons | Session detail | Copy displayed values | Keep | None | No | Clipboard success/error |
| `Inspect proof bundle` | Session detail | Routes to `/verify/[id]` | Keep | Session/proof retrieval | No | Page loading/error |

### Storage

| Button or action | Location | Current behavior | Expected final behavior | Backend/API needed | Wallet required | Loading/error state |
| --- | --- | --- | --- | --- | --- | --- |
| `View Status` | `StorageJobCard` | Does nothing | Fetch and display fresh storage status | `GET /api/storage/status/[uploadJobId]` | Usually no | Yes |
| `Copy ID` | `StorageJobCard` | Copies job ID | Keep | None | No | Clipboard success/error |
| `Cancel Renewal` | `StorageJobCard` | Does nothing | Confirm and cancel renewal | `POST /api/storage/cancel-renewal` | Policy-dependent | Yes |
| Delete / instant delete | Not rendered | Missing | Add only if supported and explicitly scoped | `POST /api/storage/delete` or cancel with `instantDelete` | Policy-dependent | Yes |
| Direct Walrus read | Not rendered | Missing | Read blob directly | `GET /api/walrus/read/[blobId]` | No | Yes |
| Direct Walrus verify | Not rendered | Missing | Recompute and compare hash | `POST /api/walrus/verify/[blobId]` | No | Yes |

### Verification

| Button or action | Location | Current behavior | Expected final behavior | Backend/API needed | Wallet required | Loading/error state |
| --- | --- | --- | --- | --- | --- | --- |
| Proof-detail copy buttons | `ProofDetails` | Copy local/generated values | Copy authoritative values | None | No | Clipboard success/error |
| `Simulate Tamper` | `TamperTestPanel` | Toggles red UI state | Modify a local output copy, recompute hash, compare to sealed proof | Client hash utility and optionally `POST /api/verify/[id]/tamper-test` | No | Recompute status |
| `Restore Trace` | `TamperTestPanel` | Toggles UI back | Restore original local copy and recheck | Same as above | No | Recompute status |
| Verify/recheck | Verification page | Missing | Fetch fresh storage, Walrus, and Sui checks | `POST /api/verify/[id]/recheck` | No | Yes |

## 5. Use Agent Flow Mapping

`components/blackbox/NewSessionForm.tsx` is the current form owner.

| Field | Current UI label | Placeholder or options | Current state | Expected payload field | Validation | Required |
| --- | --- | --- | --- | --- | --- | --- |
| Task title | `Task title` | `Review autonomous settlement exception` | `title` | `taskTitle` | Trim, minimum and maximum length | Yes |
| Task prompt | `Agent instruction / task prompt` | `Record the decision path, inspect the attached evidence metadata, and generate an auditable operator summary.` | `prompt` | `taskPrompt` | Trim, minimum and maximum length | Yes |
| Agent mode | `Agent mode` | Four cards | `agentMode`, default `research` | `agentMode` | Must be supported stable ID | Yes |
| File evidence | `Optional file evidence` | Multi-file picker | `files` metadata array | `inputFiles` | File count, size, accepted types, privacy warning; later byte hashing | No |
| Storage duration | `Storage duration` | `1 epoch`, `5 epochs`, `10 epochs` | `storageEpochs`, default `5` | `storageDuration` or normalized `storageEpochs` | Supported range and product meaning | Yes |
| Storage mode | `Storage mode` | `Deletable`, `Permanent` | `storageMode`, default `deletable` | `storageMode` | Supported mode; explain delete semantics | Yes |
| Wallet address | Not in form | Not available | Missing | `walletAddress` | Must come from connected wallet, not free text | Yes at submit |
| Network | Not in form | Not available | Missing | `network` | Must match supported Sui network | Yes at submit |
| BlackBox preview | `BlackBox Preview` | Looping `LiveAgentProcess` | Static animation | Progress view | Must reflect actual session state later | Display only |

### Current Submit Path

```text
NewSessionForm
  -> createAndSaveLocalSession()
  -> createLocalAgentSession()
  -> localStorage
  -> router.push("/sessions/[id]")
```

### Expected Final Request Payload

```json
{
  "agentMode": "research",
  "taskTitle": "Review autonomous settlement exception",
  "taskPrompt": "Record the decision path and generate an auditable operator summary.",
  "inputFiles": [],
  "storageDuration": "5-epochs",
  "storageMode": "deletable",
  "walletAddress": "0x...",
  "network": "sui-testnet-or-mainnet"
}
```

### Expected Final Response Payload

```json
{
  "sessionId": "abx-...",
  "agentOutput": "...",
  "inputHash": "...",
  "resultHash": "...",
  "traceHash": "...",
  "timeline": [],
  "storageJobId": "...",
  "walrusBlobId": "...",
  "suiProofObjectId": "...",
  "transactionDigest": "...",
  "verificationStatus": "pending-or-verified"
}
```

### Recommended Progress States

```text
idle
validating
creating_session
generating_trace
hashing
preparing_storage
pending_certification
preparing_proof
verified
failed
```

## 6. Agent Cards and Agent Modes

### Typed Runtime Agent Modes

| Display name | Stable internal ID | Current selector description | Current Phase 1 behavior | Future AI behavior |
| --- | --- | --- | --- | --- |
| Research Agent | `research` | `Deep Research` | Produces the same local normalized output template as every mode | Research sources/documents and produce a traceable synthesis |
| Risk Review Agent | `risk_review` | `Risk Review` | Produces the same local normalized output template as every mode | Inspect evidence and produce a traceable risk review |
| Delivery Proof Agent | `delivery_proof` | `Delivery Proof` | Produces the same local normalized output template as every mode | Produce a proof-backed handoff or work-delivery receipt |
| Onchain Analyzer Agent | `onchain_monitor` | `Onchain Analyzer` | Produces the same local normalized output template as every mode | Analyze wallet, transaction, object, package, or protocol activity and produce an auditable report |

### Landing Page Agent Cards

The landing page shows:

```text
Research Agent
Risk Review Agent
Onchain Analyzer Agent
Content Agent
```

### Naming Mismatch

The app selector supports `delivery_proof`, but the landing page advertises `Content Agent`. There is no `content` member in `AgentMode`, no selector card for it, and no backend ID contract for it.

Recommended normalization for current scope:

```text
Replace landing "Content Agent" with "Delivery Proof Agent"
Use internal ID "delivery_proof"
```

If content generation becomes a requested product mode later, add `content` deliberately across `AgentMode`, constants, selector UI, agent execution, tests, and backend validation.

## 7. Session Data Model Audit

### Current Storage

- Seed data lives in `lib/session-store.ts`.
- New browser-local sessions live under `localStorage["agent-blackbox-sessions"]`.
- No database exists.
- Server route handlers cannot access browser `localStorage`.
- Seed data is generated at import time through `createLocalAgentSession()`.

### Current Main Types

`types/blackbox.ts` defines:

```text
AgentSession
AgentTrace
TraceTimelineItem
ToolCall
InputFile
StorageReference
WalrusVerification
ProofMetadata
VerificationResult
CreateSessionInput
```

### Current `AgentSession` Fields

| Current field | Status | Notes |
| --- | --- | --- |
| `id` | Local | Generated with `Date.now()` unless seeded |
| `title` | Local input | Real local form value |
| `prompt` | Local input | Rename or map to `taskPrompt` in API contract |
| `agentMode` | Local input | Typed stable ID |
| `ownerAddress` | Placeholder by default | Defaults to shortened `0x9f6a...14c2`, not a full address |
| `createdAt`, `updatedAt` | Local | Deterministic enough for scaffold |
| `status` | Generated success | Always `verified` from local generator |
| `inputFiles` | Metadata only | `contentHash` is computed from name/type/size, not bytes |
| `trace` | Local deterministic trace | Good scaffold boundary |
| `storage` | Generated success metadata | Job/blob/object IDs and certified status are placeholders |
| `storageMode`, `storageEpochs` | Local input | Good scaffold boundary |
| `walrusVerification` | Generated success metadata | No direct read occurs |
| `proof` | Generated success metadata | No Sui transaction occurs |
| `verification` | Generated success metadata | No external verification occurs |

### Missing or Incomplete Fields

- Full wallet address and wallet account source.
- Explicit chain/network contract on session creation.
- File upload lifecycle and actual byte-content hash.
- Agent execution state and failures.
- Managed storage polling state and errors.
- Proof transaction preparation, signature, submission, and confirmation state.
- RPC object/transaction/event results.
- Verification discrepancy details.
- Encryption metadata for production-sensitive traces.

### Recommended Final Type Shape

```ts
interface AgentSession {
  id: string;
  title: string;
  agentMode: AgentMode;
  walletAddress: string;
  network: "sui-testnet" | "sui-mainnet";
  createdAt: string;
  updatedAt: string;
  status: VerificationStatus;
  taskPrompt: string;
  agentOutput: string;
  inputFiles: InputFile[];
  timeline: TraceTimelineItem[];
  trace: AgentTrace;
  inputHash: string;
  resultHash: string;
  traceHash: string;
  storageMode: StorageMode;
  storageEpochs: number;
  storage: StorageReference;
  walrus: WalrusVerification;
  suiProof: ProofMetadata;
  verification: VerificationResult;
}
```

Keeping the nested `trace` object is useful for replay. The top-level hash fields can be derived or retained as indexed summary fields, but the API contract must choose one canonical source to prevent drift.

### Critical Store Risks

1. Dashboard stats use seeds while dashboard cards can use browser-local data.
2. Storage page always uses seeds.
3. `GET /api/verify/[id]` always uses seeds.
4. Unknown dynamic page IDs silently show the first seeded session.
5. `GET /api/verify/[id]` returns the requested `sessionId` alongside fallback proof data from a different seeded session.

Unknown IDs must become explicit not-found responses before real proof wiring.

## 8. Storage UI Mapping

### Current Walrus Storage Cards

`components/blackbox/StorageJobCard.tsx` shows:

- Trace bundle filename.
- Walrus upload job ID.
- Certification status.
- File type.
- File size.
- Expiry.
- Renewal active/cancelled state.
- Shortened Walrus Blob ID.
- `View Status`.
- `Copy ID`.
- `Cancel Renewal`.

### Current Direct Walrus Cards

`components/blackbox/WalrusVerificationPanel.tsx` shows:

- Blob ID.
- Walrus Object ID.
- Direct read status.
- Hash comparison.
- Replay readiness.

### Backend Mapping

| UI need | Existing route boundary | Later behavior |
| --- | --- | --- |
| Upload trace bundle | `POST /api/storage/upload` | Store through the selected adapter; Walrus is canonical |
| Get storage status | `GET /api/storage/status/[uploadJobId]` | Poll storage state and expiry |
| List storage jobs | `GET /api/storage/list` | Populate storage page |
| Cancel renewal | `POST /api/storage/cancel-renewal` | Cancel renewal, optionally support instant-delete semantics |
| Delete storage job | `POST /api/storage/delete` | Delete if the selected adapter semantics support it |
| Direct Walrus read | `GET /api/walrus/read/[blobId]` | Read public blob through configured aggregator |
| Direct hash verify | `POST /api/walrus/verify/[blobId]` | Hash returned content and compare against sealed trace hash |

### Storage Risks

- Optional managed-upload lifecycle and direct Walrus verification must remain separate operations in code and UI.
- The current page renders generated success values from seeds, not API results.
- Delete semantics need confirmation before adding UI.
- Public Walrus blobs require encryption before production-sensitive evidence upload.

## 9. Verification UI Mapping

### Current Verification Cards

`VerificationGrid` renders:

```text
Walrus Blob Storage     Prepared or Stored
Walrus Trace Blob       Available
Direct Walrus Read      Passed
Sui Proof Anchor        Found
Tatum RPC Check         Passed
Hash Integrity          Matched or Failed when toggled
Expiry / Renewal        Active
```

### Current Proof Details

`ProofDetails` renders:

```text
Session ID
Agent Mode
Input Hash
Trace Hash
Result Hash
Walrus Upload Job ID
Storage Status
Storage Expiry
Walrus Blob ID
Walrus Object ID
Sui Object ID
Sui Transaction Digest
Network
Verification Time
```

### Current Tamper Test

`TamperTestPanel` toggles `tampered` React state in `VerifySessionClient`. This changes:

- Header from `Trace Verified` to `Tampered Trace Detected`.
- Hash-integrity card from `Matched` to `Failed`.
- Tamper panel styling and button label.

It does not modify `finalOutput`, recompute `resultHash`, recompute `traceHash`, or compare against the sealed proof hash.

### Final Verification Flow

```text
1. Load session/proof by stable session ID.
2. Fetch storage status through the selected adapter.
3. Fetch stored trace through direct Walrus read.
4. Decrypt locally when encryption is enabled.
5. Recompute input, result, and trace hashes.
6. Read the Sui proof object through server-side Tatum RPC.
7. Read transaction block and relevant events through server-side Tatum RPC.
8. Compare recomputed hashes, stored metadata, proof hashes, owner, and network.
9. Return a structured verification report with discrepancy reasons.
10. Render chronological replay from the retrieved trace.
```

### Recommended Verification Routes

Existing:

```text
GET /api/verify/[sessionId]
```

Add when wiring the UI:

```text
POST /api/verify/[sessionId]/recheck
POST /api/verify/[sessionId]/tamper-test
```

The tamper test may also remain client-side if it intentionally modifies a local copy and compares it against an authoritative sealed hash returned by `GET /api/verify/[sessionId]`.

## 10. Sui Wallet and Chain Mapping

### Current Wallet Reality

- No real wallet provider exists.
- No Sui dApp Kit dependency is installed.
- `WalletConnectButton` is a local React-state simulation.
- The bottom landing CTA wallet button has no handler.
- No form submission checks wallet state.
- No wallet address is passed into local session creation.
- Local sessions default to a shortened placeholder owner.

### Recommended Wallet State Ownership

Introduce one client provider near the root layout or app shell so landing navigation, sidebar, use-agent form, and account displays read the same wallet state.

### Pages and Actions Requiring Wallet

| Page/action | Wallet required |
| --- | --- |
| Landing content | No |
| Open dashboard | No |
| Browse public sessions if supported | No |
| Public verification report | No |
| Use-agent submission | Yes |
| Storage lifecycle mutation | Decide by ownership policy; likely yes |
| Sui proof anchoring transaction | Yes when wallet signing is introduced |
| Read-only proof verification | No |

### Wallet Address Display Locations

| Location | Current state | Later requirement |
| --- | --- | --- |
| Sidebar bottom | Simulated address after local click | Shared connected account and disconnect action |
| Landing nav | Simulated address after independent click | Shared connected account |
| Topbar | No address | Optional compact account status |
| Session detail | `Owner Wallet` card | Authoritative full owner with shortened display |
| Proof details | Missing owner row | Add proof owner |
| Settings | Network config only | Add wallet/provider readiness only if useful |
| Developer page | Static architecture only | Add wallet integration notes only if useful |

### Chain Risk

Resolved by the Mainnet-first correction: the topbar, env defaults, proof metadata, explorer fallback, Walrus network, and Tatum RPC URL now share one Mainnet-first configuration. If developers opt into testnet, endpoints and package IDs must also be testnet.

## 11. Tatum RPC Mapping

### Current UI Mentions

Tatum RPC appears in:

- Landing hero copy.
- Landing trace visual.
- Landing developer cards.
- Landing verification cards.
- Dashboard system-integrity panel.
- Session-detail proof anchor card.
- Verification grid.
- Settings.
- Developer architecture page.

### Existing Server Boundary

```text
POST /api/tatum/rpc
```

`lib/tatum-rpc.ts` is server-only and currently returns:

```text
requested: false
rpcUrl
method
params
result: null
```

### RPC Reads Needed Later

```text
sui_getObject
sui_getTransactionBlock
suix_queryEvents
```

Use these to confirm:

- Proof object existence.
- Proof owner.
- Package and registry identity.
- Network.
- Anchored input, result, and trace hashes.
- Neutral upload job ID and selected upload adapter.
- Walrus blob and object IDs.
- Transaction digest.
- Relevant registry events.
- Verification status.

`TATUM_API_KEY` must stay in server-only code. The frontend should call project API routes only.

## 12. Walrus Mapping

### Current UI Mentions

Walrus appears in:

- Landing hero, pipeline copy, storage section, developer cards, proof cards, footer stack, and privacy warning.
- Dashboard storage stat and integration posture.
- Use-agent preview privacy warning.
- Session-detail managed-storage section.
- Storage page managed and direct-verification panels.
- Verification cards and proof details.
- Settings and developer pages.

### Current Data Fields

```text
storage.blobId
storage.blobObjectId
walrusVerification.blobId
walrusVerification.objectId
walrusVerification.readStatus
walrusVerification.availabilityStatus
walrusVerification.directReadUrl
walrusVerification.hashMatched
walrusVerification.checkedAt
```

### Expected Behavior

- Walrus is the canonical storage layer. The optional Tatum-managed Walrus adapter can provide upload lifecycle support.
- Direct Walrus verification reads the blob through the aggregator.
- The verifier recomputes the trace hash from returned content.
- The app compares direct-read content against sealed proof metadata.
- Production-sensitive traces are encrypted before public upload and decrypted locally for replay.

## 13. Optional Tatum-Managed Walrus Adapter Mapping

### Current UI Fields

```text
jobId
fileName
fileType
fileSize
status
provider
expiryDate
blobId
blobObjectId
noRenewal
createdAt
updatedAt
```

### Current UI Actions

```text
View Status
Copy ID
Cancel Renewal
```

Only `Copy ID` currently works.

### Existing Server-Side Service Boundary

`lib/storage-adapters/tatum-walrus.ts` is marked `server-only` and exposes:

```text
tatumManagedWalrusStorageAdapter
storeTraceBundle
getStoredTrace
verifyStoredTrace
getStorageStatus
```

The project is structurally ready to hide `TATUM_API_KEY` server-side. Frontend code must never call Tatum directly.

## 14. Backend Endpoint Plan From Current UI

The durable product briefing separates scaffold work, Tatum/Walrus integration, Sui proof-registry work, and polish. The minimum endpoint plan below preserves those boundaries.

### Phase 1 Backend Foundation

| Endpoint | Purpose |
| --- | --- |
| `POST /api/agent/run` | Validate request, create stable session, generate local agent output, build trace, generate deterministic hashes, persist session |
| `GET /api/sessions` | Populate dashboard, sessions archive, and local development storage views from one source |
| `GET /api/sessions/[id]` | Populate session detail or return 404 |
| `GET /api/verify/[id]` | Build local verification report from stored session data |
| `POST /api/verify/[id]/recheck` | Re-run local verification deterministically |
| `POST /api/verify/[id]/tamper-test` | Optional server helper for judge-facing tamper simulation |

For the earliest implementation, persistence can remain a simple development store. The important requirement is one store contract visible to both route handlers and pages.

### Phase 2 Walrus Integration

| Endpoint | Purpose |
| --- | --- |
| `POST /api/storage/upload` | Upload through the selected storage adapter |
| `GET /api/storage/status/[uploadJobId]` | Poll storage state and expiry |
| `GET /api/storage/list` | Populate the Walrus storage page |
| `POST /api/storage/cancel-renewal` | Cancel renewal when the selected adapter supports it |
| `POST /api/storage/delete` | Delete when the selected adapter supports it |
| `GET /api/storage/read/[blobId]` | Read through the selected adapter |
| `POST /api/storage/verify/[blobId]` | Verify through the selected adapter |
| `GET /api/walrus/read/[blobId]` | Direct aggregator read |
| `POST /api/walrus/verify/[blobId]` | Direct blob integrity comparison |

### Phase 2C Sui Proof Anchor

| Endpoint or frontend flow | Purpose |
| --- | --- |
| Wallet provider flow | Shared Sui wallet state |
| Transaction preparation flow | Build `create_session_proof` Move call |
| Wallet signing/submission flow | Anchor lightweight metadata through the connected browser wallet |
| `POST /api/sessions/[id]/proof-anchor` | Persist returned digest, proof object ID, package, network, and owner |
| `POST /api/tatum/rpc` | Read proof object, transaction, and events server-side |

### Phase 4 Polish

| Endpoint | Purpose |
| --- | --- |
| `POST /api/mcp/verify` | Optional AI-assisted discrepancy explanation |
| File upload boundary | Handle evidence bytes and real byte-content hashes |
| Encryption boundary | Encrypt sensitive bundles before Walrus upload |
| Public share flow | Produce stable absolute proof URLs |
| Real agent execution boundary | Replace local result template with scoped agent/model execution |

## 15. UI Placeholders That Must Become Real

| Current placeholder or prepared state | Required replacement |
| --- | --- |
| Independent simulated wallet buttons | Shared Sui wallet provider state |
| Bottom landing `Connect Wallet` no-op | Shared wallet control |
| Static `Sui Mainnet` topbar badge | Normalized configured/connected network |
| Local use-agent submit | Validated server session creation |
| Looping `LiveAgentProcess` | Real progress state or clearly labeled illustrative preview |
| Metadata-only file evidence | Deliberately scoped file-byte handling and hashing |
| Metadata-derived file `contentHash` | Hash of actual file bytes when file support goes live |
| Generated local result template | Scoped agent execution output |
| Generated upload job ID | Selected adapter response |
| Generated storage status | Selected adapter status |
| Generated Walrus blob/object IDs | Parsed live Walrus response |
| Generated Walrus available/matched states | Direct Walrus read and integrity result |
| Generated Sui object ID and digest | Move proof transaction result |
| Generated Tatum RPC passed state | Server-side RPC verification |
| Tamper UI toggle | Local output mutation plus recomputed hash comparison |
| Static dashboard integrity `Ready` states | Honest readiness/configuration/live-check states |
| Storage `View Status` no-op | Storage status fetch |
| Storage `Cancel Renewal` no-op | Confirmed renewal cancellation request |
| Landing visual `Verify Again` no-op | Real representative recheck or non-clickable presentation |
| Footer `/verify` link | Valid proof lookup route or valid report |
| Footer docs/GitHub `#` links | Real destinations |
| Missing rendered `#how` landing section | Restore `ProofPipeline` rendering and target |

## 16. Risk List

### High Priority

1. **Multiple sources of truth:** seeds, browser `localStorage`, local generators, hardcoded UI statuses, and unused API boundaries can diverge.
2. **Unknown IDs display the first seed:** session and verification pages can show unrelated valid-looking evidence instead of a 404.
3. **Verification fallback mismatch:** `GET /api/verify/[id]` can return a requested ID together with proof data from the first seeded session.
4. **Wallet state is not shared:** landing and sidebar wallet states can disagree; submit does not require a wallet.
5. **Network mismatch:** resolved by Mainnet-first defaults and visible mismatch handling for obvious RPC/network conflicts.

### Integration Risks

6. Optional managed-upload lifecycle and direct Walrus verification may be incorrectly collapsed into one operation.
7. Static generated success states may remain visible after partial backend wiring.
8. `TATUM_API_KEY` could be exposed if future frontend work calls Tatum directly instead of project route handlers.
9. Sui proof payload fields may drift from `docs/contract-plan.md`.
10. A shortened placeholder owner address could accidentally be treated as a valid onchain address.
11. Browser-local session IDs are not sufficient for public share links or server verification.
12. File metadata hashing may be mistaken for actual evidence-content hashing.
13. `Copy Proof Link` currently copies a relative path.
14. Storage copy buttons currently copy generated placeholder IDs.
15. Storage action buttons have no handlers despite existing route boundaries.
16. Verification cards use hardcoded success labels rather than `VerificationResult` fields.
17. Tamper test styling may be wired without an actual deterministic hash comparison.
18. Public proof pages must remain read-only and must not require wallet connection.
19. Landing `How It Works` navigation points to an absent rendered section.
20. Footer `Verify Proof` points to a missing route.
21. Landing advertises `Content Agent`, while the app supports `Delivery Proof Agent`.
22. The landing bottom wallet button is separate from `WalletConnectButton`.
23. Dashboard counters ignore newly created browser-local sessions.
24. Storage page ignores newly created browser-local sessions.
25. `POST /api/agent/run` creates but does not persist a session.

## 17. Recommended Implementation Order

1. Normalize types, agent IDs, field names, network constants, and status vocabulary.
2. Create one session store/service contract available to route handlers and page data loaders.
3. Remove silent first-seed fallbacks and return explicit not-found states.
4. Wire `NewSessionForm` to server session creation.
5. Generate deterministic input, result, and trace hashes through one canonical implementation.
6. Show created sessions consistently in dashboard, sessions archive, detail, and storage views.
7. Build `GET /api/verify/[id]` from persisted local session data.
8. Wire the tamper test to an actual local output mutation and recomputed hash mismatch.
9. Restore the landing `#how` section and fix broken landing/footer actions before integration QA.
10. Add a shared Sui wallet provider and gate session submission.
11. Add direct Walrus upload, read, and integrity verification as the canonical path.
12. Optionally add Tatum-managed Walrus upload, status polling, listing, renewal cancellation, and confirmed delete semantics.
13. Build and deploy the Sui proof registry only when that phase is explicitly requested.
14. Add proof transaction preparation, wallet signing, and submission.
15. Add Tatum Sui RPC proof-object, transaction, and event reads server-side.
16. Replace generated storage/proof success values with authoritative results.
17. Add optional MCP verification, real agent execution, file-byte handling, encryption, and public share polish in their requested phases.
18. Run final cross-route QA, including unknown IDs, wallet/network changes, pending states, failures, and tamper detection.

## Final Summary

### UI Readiness Score

**7/10**

The product shell is substantial and judge-friendly. The main flow, archive, detail view, storage view, proof report, and tamper presentation exist. Before backend wiring, fix the missing `#how` section, broken links, wallet-state fragmentation, and misleading fallback behavior.

### Backend Readiness Score

**4/10**

The server-only boundaries and route-handler placeholders are thoughtfully separated, but the frontend does not consume them and there is no shared persistence layer. Integration work should begin by making local backend behavior coherent before connecting external services.

### Top 5 Things to Fix Before Backend

1. Replace unknown-ID seed fallbacks with real not-found states.
2. Normalize mainnet/testnet configuration and displayed network.
3. Normalize landing agent cards to match typed runtime modes.
4. Restore the rendered landing `#how` section and fix `/verify`, docs, and GitHub links.
5. Decide and document the single canonical `AgentSession` API shape.

### Top 5 Backend Tasks to Start With

1. Build one session store/service contract.
2. Wire `POST /api/agent/run` to validation, deterministic local trace generation, and persistence.
3. Add `GET /api/sessions` and `GET /api/sessions/[id]`.
4. Wire dashboard, archive, detail, and storage views to the shared session source.
5. Build real local verification and hash-based tamper simulation before external integration.

### Labels or Components That Still Confuse Users

- `Content Agent` on landing versus `Delivery Proof Agent` in the app.
- `Sui Mainnet` in topbar must match Mainnet endpoints and package IDs; testnet is an explicit dev override only.
- `Ready`, `Certified`, `Found`, and `Passed` labels currently look live even when locally prepared.
- `Live Session` preview loops independently of any submitted task.
- Landing `How It Works` link has no rendered section.
- Footer `Verify Proof` link has no valid index route.

## Checks Run

```text
npm.cmd run build
```

Result: passed. Next.js generated all current pages and route handlers successfully.

Repository note: the workspace folder is not currently a Git repository, so `git status --short` could not report tracked changes.
