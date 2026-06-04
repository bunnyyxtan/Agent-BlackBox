# Sui Proof Registry

## Purpose

Agent BlackBox follows one mainnet-first evidence flow:

**Store on Walrus Mainnet. Anchor on Sui Mainnet. Verify through Tatum Sui Mainnet RPC.**

The Sui package at `move/agent_blackbox` creates a wallet-owned `AgentSessionProof` object for each
anchored session. The proof is intentionally compact.

## Stored On Sui

- Session ID
- Agent mode
- Input hash
- Result hash
- Trace hash
- Walrus Blob ID
- Walrus Object ID when available
- Upload job ID when available
- Upload adapter
- Storage provider
- Storage network
- Signing wallet owner
- Creation timestamp
- Status

## Not Stored On Sui

The contract does not store the full trace JSON, prompts, tool-call bodies, uploaded files, private
keys, payments, escrow state, or administrative roles. The complete replayable trace bundle remains
in Walrus.

## Contract Surface

```text
module: agent_blackbox::agent_blackbox
object: AgentSessionProof
entry:  create_session_proof
event:  AgentSessionProofCreated
```

## Mainnet Deployment

```text
package:     0xbaaa56797e543f20b44fd255f7ca051cb5d4e185b59179a20514159cc8a1914f
module:      agent_blackbox
entry:       create_session_proof
publish tx:  79reMq9AMzvGo9WCeCNKePhiGYJfXXe75rZ2yqKqr8sp
upgrade cap: 0x9c532178cedd776c82d24256853fdcbac03a191930067f6c475d87cc5d0bc0e5
deployer:    0x0cebc8db9d911a312acbbaece48253379772bf8adb8f0bf211583800ea2084b6
```

Each proof object is transferred to the wallet that signs the creation transaction. There is no
shared registry object for the MVP.

## Build And Deploy

The Agent BlackBox proof package has been published on Sui Mainnet. Keep the deployed package ID,
module, and entry function in the proof environment variables; do not replace them with testnet
values in mainnet mode.

Mainnet mode requires real SUI/WAL costs, the official Walrus Mainnet Upload Relay, and a connected
browser wallet that can pay the Walrus/Sui transactions. Install the Sui CLI, verify a funded mainnet
address for package publication, then run:

```bash
sui --version
sui client active-env
sui client switch --env mainnet
sui client active-address
sui client gas
sui move build --path move/agent_blackbox
sui client publish --gas-budget 100000000 move/agent_blackbox
```

If your installed CLI has a different publish signature, run `sui client publish --help` and use the
equivalent package-path form. Capture the published package ID and publish transaction digest from the
successful command output, then record the package ID in the public frontend configuration:

```dotenv
NEXT_PUBLIC_SUI_NETWORK=mainnet
SUI_PROOF_PACKAGE_ID=0xbaaa56797e543f20b44fd255f7ca051cb5d4e185b59179a20514159cc8a1914f
NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID=0xbaaa56797e543f20b44fd255f7ca051cb5d4e185b59179a20514159cc8a1914f
SUI_PROOF_MODULE=agent_blackbox
NEXT_PUBLIC_SUI_PROOF_MODULE=agent_blackbox
SUI_PROOF_CREATE_FUNCTION=create_session_proof
NEXT_PUBLIC_SUI_PROOF_CREATE_FUNCTION=create_session_proof
SUI_EXPLORER_BASE_URL=https://suivision.xyz
NEXT_PUBLIC_SUI_EXPLORER_BASE_URL=https://suivision.xyz
```

No private-key environment variable is required or allowed. The connected browser wallet signs the
transaction.

## Mainnet Checklist

1. Publish the package and set `NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID`.
2. Configure `WALRUS_UPLOAD_RELAY_URL=https://upload-relay.mainnet.walrus.space` and
   `WALRUS_AGGREGATOR_URL=https://aggregator.walrus-mainnet.walrus.space`.
3. Configure server-only `TATUM_API_KEY` and `TATUM_SUI_RPC_URL=https://sui-mainnet.gateway.tatum.io`.
4. Start the app and connect a Sui Mainnet browser wallet.
5. Create a session so the wallet-paid Walrus SDK Upload Relay flow captures real Walrus references.
6. Open the session detail page and select `Anchor Proof on Sui`.
7. Approve the wallet transaction.
8. Confirm the UI records the digest and, when extractable, the created proof object ID.
9. Select `Recheck Proof` on the detail or verification page.
10. Confirm Tatum RPC reports `Passed` only after object, transaction, event, session ID, owner, hashes,
    and Walrus Blob ID all match.
11. Use `Recheck Proof` and confirm Walrus readback, trace hash match, and Sui proof anchor status.

Developers may opt into testnet later by setting `NEXT_PUBLIC_SUI_NETWORK=testnet`, `SUI_NETWORK=testnet`,
and `WALRUS_NETWORK=testnet`, plus matching relay, aggregator, explorer endpoints, and a testnet
package ID. Testnet is not the default and must not share package IDs with mainnet.

## Application Flow

1. Generate and seal the deterministic Agent BlackBox trace.
2. Store the complete trace bundle on Walrus Mainnet through the SDK Upload Relay.
3. Open the session detail page with the connected session-owner wallet.
4. Build an unsigned SDK `Transaction` for `create_session_proof`.
5. Ask the connected wallet to sign and execute the transaction.
6. Persist the returned transaction digest and created proof object ID when available in the local session service.
7. Recheck the proof through server-side Tatum Sui RPC.

If wallet effects contain the transaction digest but the created object ID cannot be extracted, the
session is stored as `anchored_pending_object`. Tatum RPC then checks the digest and can report
`Transaction found`, but it cannot report full `Passed` until the proof object is available.

## Tatum RPC Verification

After anchoring, the existing read-only Tatum verifier reads the proof object with `sui_getObject`,
reads the transaction with `sui_getTransactionBlock`, and queries the creation event with
`suix_queryEvents`. It compares the returned proof fields to the sealed session hashes and Walrus
Blob ID, session ID, and owner. The UI reports `Passed` only after those reads and comparisons succeed.
