# Walrus-First Backend Architecture

Date updated: June 3, 2026

## Canonical Story

**Store on Walrus. Anchor on Sui. Verify through Tatum RPC.**

- Walrus is the canonical decentralized blob-storage layer.
- Sui anchors lightweight proof metadata.
- Tatum Sui RPC reads and verifies proof objects, transactions, and events server-side.
- Tatum MCP is optional and opt-in for EVM/multichain analyzer enrichment.

## Storage Adapters

`lib/storage-adapters/types.ts` defines the adapter contract:

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

`walrus_sdk_relay` is the default mainnet adapter. It uses the official Walrus SDK Upload Relay and
the connected wallet for storage payment and certification. `walrus_direct` is legacy-only for
explicit HTTP publisher experiments. `tatum_walrus` is kept as an inactive optional boundary and does
not fabricate storage references.

## Mainnet Upload Flow

1. `POST /api/agent/prepare` creates the deterministic trace bundle and stores a server-side draft.
2. The browser uses `@mysten/walrus` with the connected wallet to register, upload, and certify the
   blob through `WALRUS_UPLOAD_RELAY_URL`.
3. `POST /api/sessions/[id]/storage-finalize` reads the blob through `WALRUS_AGGREGATOR_URL`.
4. The server recomputes the trace hash from aggregator content.
5. Storage is marked stored only after readback succeeds and the trace hash matches.

Mainnet publishing requires real SUI/WAL costs. A missing relay, wallet rejection, certification
failure, or failed aggregator readback is an action-needed state.

## API Boundaries

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
POST /api/sessions/[id]/storage-finalize
POST /api/sessions/[id]/proof-anchor
GET  /api/verify/[id]
POST /api/verify/[id]/recheck
POST /api/verify/[id]/tamper-test
```

All provider credentials stay server-side. Frontend code calls project API routes only.

## Tatum Sui RPC

- Uses `TATUM_API_KEY`, `TATUM_SUI_RPC_URL`, and `SUI_NETWORK` on the server.
- Allows only `sui_getObject`, `sui_getTransactionBlock`, and `suix_queryEvents`.
- Reports missing configuration, transaction-only confirmation, full pass, and failure honestly.
- Never treats a local proof record or arbitrary digest as a verified Sui anchor.

## Security Invariants

- Keep `TATUM_API_KEY` and `OPENAI_API_KEY` server-side.
- Do not add private-key environment variables.
- Do not call Tatum directly from client components.
- Treat Walrus blobs as public by default.
- Encrypt sensitive traces before production upload and decrypt locally for replay.
- Keep `.data/sessions.json` ignored and out of commits.
