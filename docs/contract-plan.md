# Agent BlackBox Sui Contract Plan

Phase 2C introduces a lightweight owned Move proof object on Sui Mainnet. The contract stores evidence
references and hashes only. Full agent traces remain in Walrus-backed storage. The implemented
package lives at `move/agent_blackbox`.

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

## Events

- `AgentSessionProofCreated`

## Functions

- `create_session_proof`

Additional lifecycle events and mutation functions can be added later if the product needs them. They
are intentionally outside the Phase 2C anchor scope.

## Phase 2C Transaction Flow

1. Generate and seal the structured agent trace.
2. Store the trace bundle on Walrus Mainnet through the Walrus SDK Upload Relay.
3. Read the Walrus blob directly and compare its trace hash with the sealed trace.
4. Extract the Walrus Blob ID and Walrus Object ID.
5. Build an unsigned `create_session_proof` transaction in the browser with hashes and storage references.
6. Sign and execute the transaction through the connected Sui wallet.
7. Persist the returned proof object ID and transaction digest server-side.
8. Read the proof object, transaction, and emitted event through Tatum Sui Mainnet RPC.
9. Read the Walrus Mainnet blob directly and compare its trace hash with the proof object.

If wallet effects contain a successful digest but do not expose the created object ID, persist the
digest as `anchored_pending_object`. Tatum RPC may report `Transaction found`, but full verification
must wait until the object can be read and compared.

The legacy `walrus_direct` publisher adapter and optional `tatum_walrus` adapter may provide explicit
alternate upload paths later. They do not replace Walrus as the storage layer or direct blob reads as
the verification source.

## Privacy

Walrus blobs are public by default. Production deployments should encrypt sensitive trace bundles
before upload and decrypt locally after retrieval. Mainnet mode requires real SUI/WAL costs and a
connected browser wallet that can complete the Walrus SDK Upload Relay flow. No private keys belong in
server environment variables. Signing happens only in the connected browser wallet.

Developers may opt into testnet later by explicitly setting `NEXT_PUBLIC_SUI_NETWORK=testnet`,
`SUI_NETWORK=testnet`, and `WALRUS_NETWORK=testnet`, plus matching relay, aggregator, explorer
endpoints, and a testnet package ID. Testnet is not the default.
