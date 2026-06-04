# Agent BlackBox User Demo Flow

This guide shows how to use Agent BlackBox to create a verifiable AI-agent record on Sui and Walrus.

## What Agent BlackBox Does

Agent BlackBox lets you run an AI-agent task, seal the task output with hashes, store the full trace on Walrus Mainnet, anchor compact proof metadata on Sui Mainnet, and later verify that the record was not changed.

## Before You Start

You need:

- A Sui-compatible wallet connected to Sui Mainnet
- Enough SUI for gas and Walrus storage transactions
- Agent BlackBox opened in the browser

## Step 1 — Connect Your Wallet

Open Agent BlackBox and connect your Sui wallet.

The connected wallet is used to:

- Pay for Walrus storage transactions
- Anchor proof metadata on Sui
- Associate the proof with your wallet address

## Step 2 — Choose an Agent

Go to **Use Agent** and choose one agent mode:

- **Sui Onchain Analyzer** — analyze a Sui wallet, object, transaction, or package
- **Research Agent** — create a sealed research brief
- **Risk Review Agent** — create a risk review with findings and mitigations
- **Delivery Proof Agent** — create a delivery receipt and proof trail

## Step 3 — Enter Your Task

Add a clear task title and prompt.

Example prompts:

### Sui Wallet Analysis

```text
Analyze this Sui wallet and list token holdings returned by Sui RPC:

0x0cebc8db9d911a312acbbaece48253379772bf8adb8f0bf211583800ea2084b6
```

### Walrus Research

```text
Research how Walrus can store sealed AI-agent traces and support readback verification.
```

### Risk Review

```text
Review the risks of deploying Agent BlackBox publicly for a hackathon demo.

Focus on public API abuse, Walrus upload failures, Sui proof anchoring mistakes, and user trust risks.
```

### Delivery Proof

```text
Create a sealed delivery receipt for the Agent BlackBox prototype.

Delivered:
- agent execution timeline
- Walrus trace storage
- Walrus readback verification
- Sui proof anchoring
- Tatum Sui RPC readiness
- verification page
- JSON and Markdown export
```

## Step 4 — Run the Agent

Click **Run Agent**.

Agent BlackBox will:

1. Record the user task
2. Generate an agent report
3. Create input, result, and trace hashes
4. Prepare a sealed trace bundle
5. Prepare the Walrus storage step

## Step 5 — Store the Trace on Walrus

When prompted, approve the Walrus storage transactions in your wallet.

Walrus storage may require more than one wallet approval:

1. Register/store the blob
2. Certify blob availability after storage confirmation

After successful storage, the session should show:

- Walrus Blob ID
- Walrus Mainnet storage status
- Replay/readback status
- Trace hash match

## Step 6 — Review the Agent Report

Open the session result and review the main report first.

Depending on the selected agent, the report may show:

- Sui token holdings
- Research findings
- Risk matrix
- Delivery receipt
- Limitations and confidence level
- Proof summary

## Step 7 — Anchor Proof on Sui

Click **Anchor Proof on Sui**.

Your wallet will ask you to approve a Sui transaction.

This stores compact proof metadata on Sui, such as:

- Session ID
- Trace hash
- Result hash
- Walrus reference
- Timestamp / proof metadata

After anchoring, the session should show the Sui proof object or transaction digest.

## Step 8 — Open the Verification Page

Click **Open Verification Page**.

The verification page lets anyone check:

- The Walrus blob is available
- The stored trace can be read back
- The replayed trace hash matches the sealed hash
- The Sui proof anchor exists
- The proof metadata matches the session

## Step 9 — Export the Proof

Use the export buttons to download or copy the proof:

- **Download JSON**
- **Download Markdown**
- **Copy Report**
- **Export Trace JSON**

Use these exports for submissions, audits, handoff, or public proof sharing.

## Step 10 — Run Tamper Simulation

Use **Run Tamper Simulation** to test proof integrity.

This does not change the real session.

Agent BlackBox creates a temporary modified local copy and compares its hash with the sealed proof hash.

If the hashes do not match, the page shows that tampering would be detected.

The original proof remains unchanged.

## Recovery Notes

If Walrus upload fails, retry from the Walrus storage step. The earlier sealed agent steps remain preserved.

If Sui anchoring returns a transaction digest but no proof object ID, the session can stay pending until Sui chain readback verifies the proof object or anchor event.

If Sui RPC has limited visibility for a target, the analyzer should say so clearly and must not invent activity.

## What a Completed Session Should Show

A completed Agent BlackBox session should include:

- Agent report
- Original task and prompt
- Sealed input/result/trace hashes
- Walrus Blob ID
- Walrus readback status
- Trace hash match
- Sui proof anchor status
- Export options
- Tamper simulation result
