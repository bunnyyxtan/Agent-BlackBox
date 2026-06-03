# Agent BlackBox Mainnet Integration Values Checklist

Inspected and updated on June 3, 2026.

Mainnet production flow:

**Use Agent -> Generate BlackBox Trace -> Store trace on Walrus Mainnet through SDK Upload Relay ->
Anchor proof on Sui Mainnet -> Verify through Tatum Sui Mainnet RPC**

Do not fake mainnet success. A missing Agent Runtime key, missing upload relay, wallet rejection, failed certification, failed
Walrus aggregator readback, missing Tatum API key, or missing Sui Mainnet package ID must remain
visibly unconfigured or failed.

## 1. Environment Values

| Variable | Exposure | Mainnet value or placeholder | Required for |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | Public | `Agent BlackBox` | UI labels |
| `NEXT_PUBLIC_SUI_NETWORK` | Public | `mainnet` | Browser wallet network |
| `SUI_NETWORK` | Server-only | `mainnet` | Tatum RPC proof reads |
| `SUI_EXPLORER_BASE_URL` | Server-only | `https://suivision.xyz` | Server-generated explorer links |
| `NEXT_PUBLIC_SUI_EXPLORER_BASE_URL` | Public | `https://suivision.xyz` | Mainnet explorer links |
| `OPENAI_API_KEY` | Secret, server-only | user-provided | Agent Runtime |
| `TATUM_API_KEY` | Secret, server-only | user-provided | Tatum Sui Mainnet RPC and Tatum MCP authentication |
| `TATUM_SUI_RPC_URL` | Server-only | `https://sui-mainnet.gateway.tatum.io` | Proof object, transaction, and event reads |
| `TATUM_MCP_ENABLED` | Server-only | `false` by default | Optional EVM/multichain analyzer enrichment |
| `TATUM_MCP_COMMAND` | Server-only | `npx` | Tatum MCP local package runner |
| `TATUM_MCP_PACKAGE` | Server-only | `@tatumio/blockchain-mcp` | Tatum MCP package |
| `TATUM_MCP_SERVER_NAME` | Server-only | `tatumio` | Tatum MCP server label |
| `STORAGE_PROVIDER` | Server-only | `walrus_sdk_relay` | Default storage adapter |
| `WALRUS_NETWORK` | Server-only | `mainnet` | Walrus network label |
| `WALRUS_UPLOAD_RELAY_URL` | Server-only | `https://upload-relay.mainnet.walrus.space` | Wallet-paid SDK upload relay |
| `WALRUS_AGGREGATOR_URL` | Server-only | `https://aggregator.walrus-mainnet.walrus.space` | Direct blob read and hash verification |
| `WALRUS_STORAGE_EPOCHS` | Server-only | `1` | Storage duration |
| `SUI_PROOF_PACKAGE_ID` | Server-only | `0xbaaa56797e543f20b44fd255f7ca051cb5d4e185b59179a20514159cc8a1914f` | Sui proof anchoring |
| `NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID` | Public | `0xbaaa56797e543f20b44fd255f7ca051cb5d4e185b59179a20514159cc8a1914f` | Sui proof anchoring |
| `SUI_PROOF_MODULE` | Server-only | `agent_blackbox` | Sui proof anchoring |
| `NEXT_PUBLIC_SUI_PROOF_MODULE` | Public | `agent_blackbox` | Sui proof anchoring |
| `SUI_PROOF_CREATE_FUNCTION` | Server-only | `create_session_proof` | Sui proof anchoring |
| `NEXT_PUBLIC_SUI_PROOF_CREATE_FUNCTION` | Public | `create_session_proof` | Sui proof anchoring |

`OPENAI_API_KEY` and `TATUM_API_KEY` must never use a `NEXT_PUBLIC_` prefix.

## 2. Agent Runtime Requirements

| Requirement | Expected state |
| --- | --- |
| Runtime key | `OPENAI_API_KEY` exists only in server-side environment |
| UI branding | No API provider names, model names, or GPT names |
| Output shape | Strict structured JSON |
| Stored reasoning | User-safe summaries only; no hidden reasoning |
| Tool traces | Summaries for evidence, plan, optional Sui RPC check, hash preview, Walrus prep, final report |

## 3. Removed Main-Path Values

`WALRUS_PUBLISHER_URL` and `WALRUS_STRICT_UPLOAD` are not part of the default production flow.
The legacy `walrus_direct` HTTP publisher adapter may remain in code for explicit developer use, but
do not configure it as the mainnet default and do not assume a free public publisher exists.

## 4. Walrus Mainnet Upload Requirements

| Requirement | Expected state |
| --- | --- |
| Default provider | `STORAGE_PROVIDER=walrus_sdk_relay` |
| Upload relay | `WALRUS_UPLOAD_RELAY_URL=https://upload-relay.mainnet.walrus.space` |
| Aggregator | `WALRUS_AGGREGATOR_URL=https://aggregator.walrus-mainnet.walrus.space` |
| Wallet | Connected Sui Mainnet wallet with enough balance for real SUI/WAL costs |
| Relay tip handling | Read `/v1/tip-config`; let the official SDK include the required relay tip |
| Success condition | Blob is uploaded/certified, read back through aggregator, and trace hash matches |

Mainnet mode requires real SUI/WAL costs and a configured Walrus Mainnet Upload Relay.
If the wallet has insufficient WAL, user-facing UI must convert FROST to WAL and keep the raw error
under `Details` for debugging.

## 5. Tatum Sui Mainnet RPC

| Value | Expected state |
| --- | --- |
| `TATUM_SUI_RPC_URL` | `https://sui-mainnet.gateway.tatum.io` |
| `TATUM_API_KEY` | Present only in `.env.local` or deployment secrets |
| Client exposure | Never exposed to browser code |

The application calls Tatum only through server-side API routes.

## 6. Sui Proof Contract

| Value | Expected state |
| --- | --- |
| Move package directory | `move/agent_blackbox` |
| Move framework branch | Mainnet |
| Package ID | `0xbaaa56797e543f20b44fd255f7ca051cb5d4e185b59179a20514159cc8a1914f` |
| Proof module | `agent_blackbox` |
| Create function | `create_session_proof` |
| Publish transaction | `79reMq9AMzvGo9WCeCNKePhiGYJfXXe75rZ2yqKqr8sp` |

If `NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID` is missing, UI must show `Proof contract not configured`
and must not fake proof anchoring. Do not use a testnet package ID on Mainnet.

## 7. Safe `.env.local` Template

```dotenv
NEXT_PUBLIC_APP_NAME=Agent BlackBox
NEXT_PUBLIC_SUI_NETWORK=mainnet
SUI_EXPLORER_BASE_URL=https://suivision.xyz
NEXT_PUBLIC_SUI_EXPLORER_BASE_URL=https://suivision.xyz

SUI_NETWORK=mainnet
OPENAI_API_KEY=<your-agent-runtime-key>
TATUM_API_KEY=<your-tatum-api-key>
TATUM_SUI_RPC_URL=https://sui-mainnet.gateway.tatum.io
# Set to true only when EVM/multichain analysis should use Tatum MCP.
TATUM_MCP_ENABLED=false
TATUM_MCP_COMMAND=npx
TATUM_MCP_PACKAGE=@tatumio/blockchain-mcp
TATUM_MCP_SERVER_NAME=tatumio

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

TATUM_STORAGE_API_URL=
TATUM_STORAGE_PROVIDER=walrus
```

## 8. Optional Developer Testnet Override

Testnet is not the default. Developers may opt in later with:

```dotenv
NEXT_PUBLIC_SUI_NETWORK=testnet
SUI_NETWORK=testnet
WALRUS_NETWORK=testnet
```

When doing this, also use matching testnet relay, aggregator, explorer endpoints, and a testnet package
ID. Never show Sui Mainnet while using testnet endpoints.

## 9. Readiness Snapshot

| Area | Status |
| --- | --- |
| Agent Runtime | Implemented; requires server-only runtime key |
| Mainnet defaults | Ready |
| Walrus SDK Upload Relay path | Implemented, requires connected wallet approval |
| Walrus Mainnet read/hash verification | Implemented through aggregator readback |
| Tatum Sui Mainnet RPC | Configured by URL; requires server-only API key |
| Sui Mainnet proof registry | Contract code present; package ID configured for Mainnet |
| UI honesty | Missing relay/package/wallet states are surfaced instead of reported as success |
| Readiness panel | Settings loads readiness checks asynchronously and never prints secrets |

## Official References

- Walrus TypeScript SDK package: <https://www.npmjs.com/package/@mysten/walrus>
- Walrus Upload Relay documentation: <https://docs.wal.app/>
- Tatum gateway authentication: <https://docs.tatum.io/docs/authentication>
- Sui documentation: <https://docs.sui.io/>
