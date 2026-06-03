# Walrus-First Backend Plan

Date updated: June 3, 2026

## Canonical Story

**Store on Walrus. Anchor on Sui. Verify through Tatum RPC.**

- Walrus is the canonical decentralized blob-storage layer.
- Sui anchors lightweight proof metadata.
- Tatum Sui RPC reads and verifies proof objects, transactions, and events server-side.
- Tatum's Walrus-powered storage API is an optional managed upload adapter, not the storage source of truth.

## Phase 1: Local Backend

Phase 1 stays local and deterministic:

1. Generate a structured agent trace.
2. Seal input, result, and trace hashes.
3. Store the trace bundle through the `local` storage adapter.
4. Read the local trace bundle by blob ID.
5. Recompute the stored trace hash and compare it with the sealed trace hash.
6. Keep external Walrus, Sui, and Tatum RPC states clearly marked as prepared.

Canonical storage fields:

```text
storageProvider
storageStatus
blobId
blobObjectId
storageEpochs
expiryDate
uploadJobId
uploadAdapter
directReadUrl
hashMatched
```

## Adapter Contract

`lib/storage-adapters/types.ts` defines:

```text
StorageAdapter
storeTraceBundle(traceBundle)
getStoredTrace(blobId)
verifyStoredTrace(blobId, expectedTraceHash)
getStorageStatus(storageRef)
```

Implemented adapters:

```text
lib/storage-adapters/local.ts
lib/storage-adapters/walrus-direct.ts
lib/storage-adapters/walrus-sdk-relay.ts
lib/storage-adapters/tatum-walrus.ts
```

`walrus_sdk_relay` is the default mainnet adapter. `local` remains the development adapter,
`walrus_direct` is legacy-only for explicit HTTP publisher experiments, and `tatum_walrus` remains an
optional later boundary.

## Neutral API Routes

```text
POST /api/storage/upload
GET  /api/storage/status/[uploadJobId]
GET  /api/storage/list
POST /api/storage/cancel-renewal
POST /api/storage/delete
GET  /api/storage/read/[blobId]
POST /api/storage/verify/[blobId]
```

Explicit direct-Walrus verification routes remain available:

```text
GET  /api/walrus/read/[blobId]
POST /api/walrus/verify/[blobId]
```

Tatum-specific routes remain limited to infrastructure that is actually Tatum-specific:

```text
POST /api/tatum/rpc
POST /api/sui/verify-proof
```

Add a separate Tatum-managed Walrus upload route only if the adapter needs one later. Frontend code
must never call Tatum directly.

## Phase 2A: Legacy Walrus Direct HTTP Integration

Implemented:

1. `walrus_direct` uploads deterministic JSON trace bundles through `WALRUS_PUBLISHER_URL` when
   explicitly selected.
2. Publisher responses persist live Blob ID and available Walrus Object ID metadata.
3. Direct reads use `WALRUS_AGGREGATOR_URL`.
4. Direct verification re-reads aggregator content and recomputes the canonical trace hash.
5. Missing configuration and non-strict upload failures fall back to `local_only` storage with a visible warning.
6. `WALRUS_STRICT_UPLOAD=true` disables fallback and surfaces the upload error.

This is no longer the mainnet default. Do not assume a free public publisher exists.

## Phase 2E: Walrus SDK Upload Relay Integration

Implemented:

1. `walrus_sdk_relay` is the default storage provider.
2. `POST /api/agent/prepare` creates a deterministic trace bundle without claiming storage success.
3. The browser uses `@mysten/walrus` and the connected wallet to register, upload, and certify through
   `WALRUS_UPLOAD_RELAY_URL=https://upload-relay.mainnet.walrus.space`.
4. `POST /api/sessions/[id]/storage-finalize` reads the blob through
   `WALRUS_AGGREGATOR_URL=https://aggregator.walrus-mainnet.walrus.space` and recomputes the trace hash.
5. Storage is marked stored only after aggregator readback succeeds and the trace hash matches.
6. Relay status is exposed through `GET /api/storage/relay-status`.

Still planned:

1. Optionally connect `tatum_walrus` for managed upload lifecycle support.
2. Keep direct Walrus verification authoritative regardless of upload adapter.

## Phase 2B: Read-Only Tatum Sui RPC Verification

Implemented:

1. Server-only Tatum Sui RPC configuration through `TATUM_API_KEY`, `TATUM_SUI_RPC_URL`, and `SUI_NETWORK`.
2. Allowlisted `sui_getObject`, `sui_getTransactionBlock`, and `suix_queryEvents` reads.
3. Structured proof-verification states for missing configuration, local placeholders, success, and failure.
4. Honest `local_phase1` reporting until a real Sui proof anchor exists.
5. A dedicated `POST /api/sui/verify-proof` comparison endpoint.

## Phase 2C: Sui Proof Anchor

Implemented:

1. Add the owned `AgentSessionProof` Move package and `AgentSessionProofCreated` event.
2. Build unsigned `create_session_proof` calls in the browser with hashes, owner, timestamp, status,
   Blob ID, Walrus Object ID, neutral upload job ID, upload adapter, and storage provider.
3. Sign and execute proof creation only through the connected browser wallet.
4. Persist returned transaction digest and proof object ID through `POST /api/sessions/[id]/proof-anchor`.
5. Read proof objects, transactions, and events through server-side Tatum Sui RPC.
6. Compare Sui proof metadata with the directly retrieved Walrus trace.

Still required for live anchoring:

1. Publish the Move package.
2. Configure `NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID`.

## Phase 2D: Sui Mainnet Anchor Hardening

Implemented:

1. Persist explicit onchain proof mode and anchor timestamps.
2. Preserve digest-only wallet results as `anchored_pending_object`.
3. Recheck digest-only anchors through Tatum RPC and report `Transaction found` without claiming full verification.
4. Compare session ID and owner alongside hashes and Walrus Blob ID for full proof verification.
5. Show mismatch reasons and expose proof recheck controls in the UI.

Package publication and live wallet transactions remain environment-dependent mainnet steps. Mainnet
mode requires real SUI/WAL costs and a funded connected wallet for the SDK Upload Relay flow.

Developers may opt into testnet later by explicitly setting `NEXT_PUBLIC_SUI_NETWORK=testnet`,
`SUI_NETWORK=testnet`, and `WALRUS_NETWORK=testnet`, plus matching relay, aggregator, explorer
endpoints, and a testnet package ID. Testnet is not the default.

## Security Invariants

- Keep `TATUM_API_KEY` server-side.
- Do not add private-key environment variables.
- Do not call Tatum directly from frontend components.
- Treat Walrus blobs as public by default.
- Encrypt sensitive traces before production upload and decrypt locally for replay.
