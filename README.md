# Agent BlackBox

> The flight recorder for autonomous AI agents.

Agent BlackBox records an AI-agent task as a tamper-evident proof bundle: the original user intent,
file metadata, agent plan, tool-call summaries, final report, deterministic hashes, Walrus storage
references, Sui proof-anchor metadata, and verification results.

## Problem

Autonomous agents can produce useful work, but a final answer alone does not prove what happened. Agent
BlackBox records the evidence trail so a user, reviewer, or judge can inspect the input, replay the
trace, verify storage availability, confirm the Sui proof anchor, and detect later tampering.

The canonical production flow is:

```text
Use Agent -> Generate BlackBox Trace -> Store on Walrus Mainnet -> Anchor on Sui Mainnet -> Verify through Tatum Sui RPC
```

## Architecture

- **Agent Runtime** runs server-side, produces structured reports, and stores only user-safe
  summaries in the trace. `OPENAI_API_KEY` is never exposed to the client.
- **Walrus Mainnet** is the canonical blob-storage layer. The default upload path uses the official
  Walrus SDK Upload Relay with connected-wallet payment and direct aggregator readback.
- **Sui Mainnet** stores lightweight proof metadata only: owner, session ID, hashes, Walrus
  references, upload references, timestamp, and status.
- **Tatum Sui RPC** verifies proof objects, transactions, and events through server-side read-only
  routes. `TATUM_API_KEY` stays server-side.
- **Etherscan V2** enriches EVM wallet and transaction reports when `ETHERSCAN_API_KEY` is configured.
  Sui analysis uses the official public Sui JSON-RPC endpoint only.

Walrus blobs are public by default. Production deployments should encrypt sensitive trace bundles
before upload and use durable authenticated session storage.

## Why Walrus Matters

Walrus stores the sealed BlackBox Trace as replayable blob evidence. Agent BlackBox records Blob ID,
available Object ID, upload relay, aggregator URL, storage network, and storage duration. After upload,
the server reads the blob back through the Walrus aggregator, recomputes the trace hash, and marks the
session verified only when the stored payload matches the sealed trace hash.

## Why Tatum Sui RPC Matters

Tatum Sui RPC is the read-only verification layer for Sui proof evidence. Agent BlackBox uses
server-side Tatum RPC calls to read proof objects, transaction blocks, and proof events without exposing
`TATUM_API_KEY` to the browser. Settings and Developer diagnostics show the RPC host, configured Sui
network, key presence, reachability status, and last safe check result.

## How Sui Anchoring Works

The connected browser wallet signs `agent_blackbox::create_session_proof` on Sui Mainnet after Walrus
storage succeeds. The Move object stores compact proof metadata only: owner, session ID, agent mode,
input hash, result hash, trace hash, Walrus Blob ID, Walrus Object ID, upload reference, storage
network, and timestamp. The server never signs transactions or holds wallet private keys.

## Judging Criteria Alignment

**Walrus and Tatum Integration**

- Walrus Mainnet stores sealed trace bundles as replayable evidence.
- Walrus aggregator readback verifies that stored blob content matches the sealed trace hash.
- Tatum Sui RPC verifies Sui Mainnet proof objects, transactions, and events server-side.
- Etherscan V2 enriches EVM wallet and transaction reports where configured.

**Technical Quality**

- Typed Next.js app with server/client boundaries and server-only secrets.
- Safe JSON request parsing, structured API errors, rate-limited API guard, bounded provider reads, and provider timeouts.
- Sui analysis uses official public Sui JSON-RPC; EVM analysis routes to Etherscan V2.
- The active app avoids unstable local tool-server runtime dependencies.
- Build and typecheck are part of the validation flow.

**Creativity**

- Agent BlackBox acts as a flight recorder for AI-agent work.
- Tamper-resistant traces prove when a final answer was changed after sealing.
- Verification pages combine replay, blob availability, hash comparison, Sui anchor status, and exportable proof reports.

**Presentation**

- README, integration docs, and [demo flow](docs/demo-flow.md) explain the complete judge path.
- The UI surfaces Agent Execution, Walrus storage, Sui anchoring, Tatum RPC readiness, proof export, and tamper simulation.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Product landing page |
| `/dashboard` | System overview and recent sessions |
| `/sessions` | BlackBox trace archive |
| `/sessions/new` | Agent recording flow |
| `/sessions/[id]` | Session detail, evidence, proof actions, and exports |
| `/verify/[id]` | Public proof report and tamper-resistance test |
| `/storage` | Walrus blob status and direct verification |
| `/settings` | Clean integration configuration posture |
| `/developer` | Server boundaries and developer diagnostics |

## Demo Flow

See [docs/demo-flow.md](docs/demo-flow.md) for the short judge script. The core path is:

1. Create an agent session.
2. Watch the Agent Execution timeline seal input, result, and trace hashes.
3. Store the trace on Walrus Mainnet through the SDK Upload Relay.
4. Read the Walrus blob back and verify the trace hash.
5. Anchor the Walrus Blob ID and hashes on Sui Mainnet.
6. Open the verification page, export evidence, and run the tamper simulation.

## Environment

Create `.env.local` from `.env.example`. Use placeholders only in committed files.

```dotenv
NEXT_PUBLIC_APP_NAME=Agent BlackBox
NEXT_PUBLIC_SUI_NETWORK=mainnet
SUI_NETWORK=mainnet
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443

OPENAI_API_KEY=<YOUR_AGENT_RUNTIME_KEY>
TATUM_API_KEY=<YOUR_TATUM_API_KEY>
TATUM_SUI_RPC_URL=https://sui-mainnet.gateway.tatum.io

ETHERSCAN_API_KEY=<YOUR_ETHERSCAN_V2_API_KEY>
ETHERSCAN_V2_BASE_URL=https://api.etherscan.io/v2/api

STORAGE_PROVIDER=walrus_sdk_relay
WALRUS_NETWORK=mainnet
WALRUS_UPLOAD_RELAY_URL=https://upload-relay.mainnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-mainnet.walrus.space
WALRUS_STORAGE_EPOCHS=1

NEXT_PUBLIC_SUI_EXPLORER_BASE_URL=https://suivision.xyz
SUI_PROOF_PACKAGE_ID=0xbaaa56797e543f20b44fd255f7ca051cb5d4e185b59179a20514159cc8a1914f
NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID=0xbaaa56797e543f20b44fd255f7ca051cb5d4e185b59179a20514159cc8a1914f
SUI_PROOF_MODULE=agent_blackbox
NEXT_PUBLIC_SUI_PROOF_MODULE=agent_blackbox
SUI_PROOF_CREATE_FUNCTION=create_session_proof
NEXT_PUBLIC_SUI_PROOF_CREATE_FUNCTION=create_session_proof

DEMO_API_GUARD_ENABLED=false
DEMO_API_TOKEN=
```

Mainnet mode requires real SUI/WAL costs and a connected wallet that can complete Walrus register and
certify transactions plus the separate Agent BlackBox Sui proof-anchor transaction. Missing config,
wallet rejection, failed storage certification, failed aggregator readback, or missing proof package
configuration is reported as an action-needed state, not success.

Developers can opt into testnet only by explicitly setting `NEXT_PUBLIC_SUI_NETWORK=testnet`,
`SUI_NETWORK=testnet`, and `WALRUS_NETWORK=testnet` with matching endpoints and a testnet proof
package.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
node_modules\.bin\tsc.cmd --noEmit
npm run build
```

## Security Notes

- Do not commit `.env.local`, real API keys, private keys, seed phrases, or session data.
- Do not create `NEXT_PUBLIC_` variants of secret keys.
- Sui proof signing happens in the connected browser wallet; the server never signs transactions.
- Tatum Sui RPC routes are read-only and allowlisted.
- The local JSON session store is for controlled evaluation and is ignored by Git.
- EVM reports use Etherscan V2 when configured and do not fall back to Moralis, Alchemy, Covalent, or Chainbase.

## Known Demo Limitations

- Local JSON session storage is suitable for controlled judging and local operation, not serverless production persistence.
- Mainnet storage and proof anchoring require real wallet approvals and sufficient SUI/WAL balance.
- Sensitive production traces should be encrypted before public decentralized storage upload.
- EVM enrichment requires a server-side Etherscan V2 API key.

## References

- [`docs/sui-proof-registry.md`](docs/sui-proof-registry.md)
- [`docs/contract-plan.md`](docs/contract-plan.md)
- [`docs/agent-runtime.md`](docs/agent-runtime.md)
- [`docs/walrus-mainnet-sdk-relay.md`](docs/walrus-mainnet-sdk-relay.md)
