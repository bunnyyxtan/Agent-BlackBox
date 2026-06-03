# Agent BlackBox Sui Proof Registry

This package creates one wallet-owned `AgentSessionProof` object per anchored agent session.

Walrus stores the complete replayable trace bundle. Sui stores only compact metadata: hashes,
Walrus references, upload-adapter context, owner, timestamp, and status. The
`AgentSessionProofCreated` event gives Tatum RPC a direct event surface for later verification.

## Build

```bash
sui move build --path move/agent_blackbox
```

## Publish

```bash
sui client publish move/agent_blackbox --gas-budget <MIST>
```

After publishing, set `NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID` to the deployed package ID. Wallets
sign and execute `agent_blackbox::create_session_proof` in the browser. No private key belongs in
the application environment.
