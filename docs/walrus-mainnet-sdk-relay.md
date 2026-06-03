# Walrus Mainnet SDK Upload Relay

Updated June 3, 2026.

Agent BlackBox now uses the official Walrus TypeScript SDK and official Walrus Mainnet Upload Relay as
the default production storage path.

## Canonical Flow

1. `POST /api/agent/prepare` validates the request, generates the deterministic BlackBox trace, and
   returns a trace bundle plus relay configuration.
2. The browser uses `@mysten/walrus` with the connected Sui Mainnet wallet.
3. The wallet signs the Walrus registration transaction.
4. The SDK uploads blob bytes through `https://upload-relay.mainnet.walrus.space`.
5. The wallet signs the certification transaction.
6. `POST /api/sessions/[id]/storage-finalize` reads the blob through
   `https://aggregator.walrus-mainnet.walrus.space`, recomputes the trace hash, and persists the
   session only when the hash matches.
7. The Sui proof anchor stores the Walrus Blob ID, Walrus Object ID when available, upload adapter,
   storage provider, and `storageNetwork=walrus-mainnet`.

## Environment

```dotenv
STORAGE_PROVIDER=walrus_sdk_relay
WALRUS_NETWORK=mainnet
WALRUS_UPLOAD_RELAY_URL=https://upload-relay.mainnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-mainnet.walrus.space
WALRUS_STORAGE_EPOCHS=1
```

The old `WALRUS_PUBLISHER_URL` path is not required for the main flow. The legacy
`walrus_direct` adapter may remain available for explicit developer experiments, but Agent BlackBox
must not default to it.

## Fee And Tip Handling

Mainnet uploads cost real SUI/WAL. The app checks the relay tip configuration through
`GET /api/storage/relay-status`, which reads `/v1/tip-config` from the configured relay. The wallet
flow lets the official SDK include the required relay tip. The UI should describe this as real
mainnet cost without promising an exact amount.

Walrus insufficient-balance errors may arrive in FROST, the smallest WAL unit. User-facing errors
convert those values to WAL using `1 WAL = 1,000,000,000 FROST`, keep the raw wallet message behind
`Details`, and tell the user to add a small WAL balance before retrying. SUI gas errors are shown as
transaction-gas balance issues, not as Walrus storage failures.

The shared error normalizer lives in `lib/errors/user-facing-errors.ts`. Use it for wallet, Walrus,
storage finalization, proof anchoring, and runtime failures before rendering inline UI copy.

## Failure Rules

- If the upload relay is not configured or reachable, do not start the wallet upload.
- If the wallet rejects or a Walrus transaction fails, do not create a stored session.
- If blob certification does not complete, do not mark storage as stored.
- If aggregator readback fails, do not mark storage as stored.
- If the recomputed trace hash does not match the prepared trace hash, reject finalization.
- If the Sui package ID is missing, show `Proof contract not configured` and do not fake anchoring.

## API Surface

```text
POST /api/agent/prepare
GET  /api/storage/relay-status
POST /api/sessions/[id]/storage-finalize
GET  /api/walrus/read/[blobId]
POST /api/walrus/verify/[blobId]
```

`POST /api/agent/run` and `POST /api/storage/upload` remain useful for local or explicit legacy
adapter paths, but the SDK relay upload itself must happen in the browser with the connected wallet.

## Manual Smoke Test

1. Configure `.env.local` with the mainnet relay, aggregator, Tatum key, and Sui network values.
2. Start the app with `npm run dev`.
3. Connect a funded Sui Mainnet browser wallet.
4. Open `/sessions/new`.
5. Create a session and approve the Walrus registration and certification wallet prompts.
6. Confirm the final session shows `Walrus SDK Relay`, `Walrus Mainnet`, a Blob ID, and a matched
   direct-read hash.
7. Publish/configure the Sui package ID before testing `Anchor Proof on Sui`.
