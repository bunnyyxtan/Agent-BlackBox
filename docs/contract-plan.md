# Agent BlackBox Sui Proof Contract

Agent BlackBox anchors lightweight proof metadata on Sui Mainnet. Full agent traces remain in Walrus
blob storage; Sui stores only references and hashes.

The deployed Move package lives under `move/agent_blackbox`.

## AgentSessionProof Object

```move
struct AgentSessionProof has key, store {
    id: UID,
    owner: address,
    session_id: String,
    agent_mode: String,
    input_hash: String,
    result_hash: String,
    trace_hash: String,
    walrus_blob_id: String,
    walrus_object_id: String,
    upload_job_id: String,
    upload_adapter: String,
    storage_provider: String,
    storage_network: String,
    created_at_ms: u64,
    status: String,
}
```

## Event

- `AgentSessionProofCreated`

## Function

- `create_session_proof`

## Transaction Flow

1. Generate and seal the structured Agent Trace.
2. Store the trace bundle on Walrus Mainnet through the Walrus SDK Upload Relay.
3. Read the Walrus blob directly and compare its trace hash with the sealed trace hash.
4. Build an unsigned `create_session_proof` transaction in the browser.
5. Sign and execute the transaction through the connected Sui wallet.
6. Persist the returned transaction digest and proof object ID when available.
7. Read the proof object, transaction, and emitted event through Tatum Sui Mainnet RPC.
8. Compare session ID, owner, input hash, result hash, trace hash, Walrus Blob ID, and storage network.

If wallet effects return a successful digest but no created object ID, the session remains
`anchored_pending_object`. Tatum RPC may confirm the transaction, but full verification requires a
matching proof object or matching proof event.

## Boundaries

- Walrus remains the storage source of truth.
- Sui stores compact proof metadata only.
- Tatum Sui RPC is read-only and allowlisted.
- Signing happens only in the connected browser wallet.
- No private keys belong in server environment variables.

Mainnet mode requires real SUI/WAL costs. Developers can opt into testnet only by explicitly setting
testnet network values, endpoints, explorer links, and a matching testnet proof package.
