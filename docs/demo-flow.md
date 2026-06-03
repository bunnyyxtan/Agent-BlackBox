# Agent BlackBox Demo Flow

Use this as the short judging script.

## Goal

Show that Agent BlackBox records an AI-agent task, stores the sealed trace on Walrus Mainnet, anchors
proof metadata on Sui Mainnet, verifies through Tatum Sui RPC, and catches tampering.

## Steps

1. Open Agent BlackBox.
2. Go to **Use Agent** and choose an agent mode.
3. Enter a task prompt and optionally attach evidence files.
4. Run the agent.
5. Watch **Agent Execution** seal input, result, and trace hashes.
6. Approve Walrus storage transactions when prompted:
   - register blob
   - certify blob availability
7. Confirm the session shows Walrus Blob ID, storage network, and hash-match evidence.
8. Anchor the Walrus Blob ID and sealed hashes on Sui Mainnet.
9. Open the verification page.
10. Point out:
    - Walrus blob availability
    - direct Walrus readback
    - trace hash match
    - Sui proof anchor
    - Tatum Sui RPC proof-read status
11. Export the proof as JSON or Markdown.
12. Run the tamper simulation and show that the modified trace hash no longer matches the sealed proof.

## Judge Sound Bite

"Agent BlackBox is a flight recorder for AI agents. The full trace is stored on Walrus, compact proof
metadata is anchored on Sui, Tatum Sui RPC verifies the chain evidence, and the tamper test proves why
the record is valuable."

## Suggested Demo Prompts

- Sui wallet holdings analysis: analyze a Sui wallet and list token holdings returned by Sui RPC.
- Walrus storage system research: explain how Walrus stores sealed AI-agent traces and supports readback verification.
- Hackathon deployment risk review: review public API abuse, Walrus upload failures, Sui anchoring mistakes, and user trust risks.
- Hackathon build delivery proof: create a sealed delivery receipt for the submitted prototype.

## Recovery Notes

- If Walrus upload fails, re-run from the Walrus storage step; sealed agent steps stay preserved.
- If Sui anchoring returns a transaction digest but no proof object ID, the session stays pending until
  Tatum RPC can verify the object or event.
- If Sui public RPC has limited history, the Sui analyzer says so clearly and never invents activity.
