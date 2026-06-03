module agent_blackbox::agent_blackbox {
    use std::string::String;
    use sui::event;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    /// Lightweight on-chain evidence anchor for an Agent BlackBox session.
    ///
    /// The complete replayable trace bundle remains in Walrus. Sui stores only
    /// the compact metadata needed to identify and independently verify it.
    public struct AgentSessionProof has key, store {
        id: UID,
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
        owner: address,
        created_at_ms: u64,
        status: String,
    }

    /// Emitted when a wallet creates a proof anchor. Tatum RPC can read this
    /// event and the owned proof object during independent verification.
    public struct AgentSessionProofCreated has copy, drop {
        proof_id: ID,
        session_id: String,
        owner: address,
        trace_hash: String,
        result_hash: String,
        input_hash: String,
        walrus_blob_id: String,
        storage_network: String,
        created_at_ms: u64,
    }

    /// Create a compact proof object for a trace that has already been stored
    /// on Walrus and transfer ownership of the proof to the signing wallet.
    public entry fun create_session_proof(
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
        ctx: &mut TxContext,
    ) {
        let owner = tx_context::sender(ctx);
        let proof = AgentSessionProof {
            id: object::new(ctx),
            session_id,
            agent_mode,
            input_hash,
            result_hash,
            trace_hash,
            walrus_blob_id,
            walrus_object_id,
            upload_job_id,
            upload_adapter,
            storage_provider,
            storage_network,
            owner,
            created_at_ms,
            status,
        };

        event::emit(AgentSessionProofCreated {
            proof_id: object::id(&proof),
            session_id,
            owner,
            trace_hash,
            result_hash,
            input_hash,
            walrus_blob_id,
            storage_network,
            created_at_ms,
        });
        transfer::public_transfer(proof, owner);
    }
}
