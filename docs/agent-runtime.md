# Agent Runtime

Updated June 3, 2026.

Agent BlackBox now runs a real server-side Agent Runtime before Walrus upload. The runtime produces a
strict structured report that becomes part of the BlackBox Trace.

## Server-Side Boundary

```dotenv
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>
```

`OPENAI_API_KEY` is server-only. Do not create `NEXT_PUBLIC_OPENAI_API_KEY`, do not expose the key to
client components, and do not print it in logs or UI.

User-facing UI and stored public trace labels must not mention API provider names, model names, or GPT
names. Use product language: `Agent`, `Agent Runtime`, `Agent Trace`, `Agent Plan`, `Tool Call`,
`Verification`, and `BlackBox Trace`.

## Agent Modes

| Mode | Output focus |
| --- | --- |
| Research Agent | Professional research brief with scope, key findings, evidence/input summary, assumptions, limitations, next actions, proof metadata |
| Risk Review Agent | Professional risk report with overall rating, scorecard, severity-ranked risks, missing information, exposure analysis, mitigation plan, proof metadata |
| Delivery Proof Agent | Sealed delivery receipt with evidence bundle, handoff trail, acceptance notes, proof strength, missing evidence, next actions, proof metadata |
| Multichain Onchain Analyzer | Sui-first target analysis plus EVM enrichment: detected chain, target type, provider status, risk signals, limitations, proof metadata, explorer links |

## Structured Output

The runtime returns strict JSON with:

```text
agentMode
agentDisplayName
taskTitle
executiveSummary
plan[]
toolCalls[]
findings[]
finalOutput
confidence
limitations[]
recommendedNextActions[]
specialistAnalysis?  # deterministic Research/Risk/Delivery report payload
onchainAnalysis?     # deterministic Multichain Onchain Analyzer payload
```

The trace stores summaries and observations only. It does not store hidden reasoning.

If the first runtime response does not validate against the required schema, the server retries once
with a stricter repair instruction. If validation still fails, the API returns
`agent_runtime_schema_error` and no successful session or Walrus storage state is fabricated.

## Tool Summaries

The runtime records traceable tool-call summaries:

```text
recordInputEvidence
generatePlan
analyzeSpecialistAgentContext
analyzeOnchainTarget
tatumSuiRpcCheck
hashTracePreview
prepareWalrusTrace
finalizeAgentReport
```

For Research, Risk Review, and Delivery Proof agents, `analyzeSpecialistAgentContext` parses the
title, prompt, links, attached file metadata, dates, acceptance language, entities, missing evidence,
risk categories, and proof notes into a deterministic specialist report. The live runtime summarizes
that payload, while the trace stores it as `specialistAnalysis` so the UI and exports can show
scorecards, evidence cards, report sections, limitations, next actions, and proof metadata.

When external search or file-content retrieval is not configured, Research reports explicitly say the
brief is based on user-provided inputs and attached metadata only. Risk reports avoid inventing
incidents and classify confidence from supplied evidence. Delivery Proof reports separate claimed
delivery from provided evidence and missing acceptance/delivery checklist items.

For Multichain Onchain Analyzer, `analyzeOnchainTarget` routes through `lib/onchain/analyzer-router.ts`.
It detects Sui wallet addresses, transaction digests, object IDs, package IDs, Sui network hints, EVM
addresses, EVM transaction hashes, EVM contract context, and EVM chain mentions. Sui remains the
specialized proof chain for Agent BlackBox; EVM support is additional enrichment captured inside the
sealed trace.

Provider absence is not treated as a useless failure. Sui targets use Sui public RPC only. EVM and
multichain targets use Tatum Blockchain MCP only when it is enabled and available. If Tatum MCP is
disabled, missing its server-only API key, unavailable, or times out, the analyzer returns a professional
preliminary EVM report without exposing raw env names or falling back to Etherscan/Moralis/Alchemy/
Covalent/Chainbase. It does not fabricate wallet balances, transfers, object state, token activity,
contract verification, or suspicious behavior.

Sui analyzer enrichment uses only Sui JSON-RPC in this version. `SUI_RPC_URL` defaults server-side to
the official public Mainnet fullnode `https://fullnode.mainnet.sui.io:443` when missing. No Sui API key,
gRPC URL, Sui indexer, SuiVision, Suiscan, BlockVision, or paid Sui provider integration is required
or configured for this analyzer version.

## Trace Flow

1. Validate wallet, mode, title, and prompt.
2. Run the Agent Runtime server-side.
3. Store the structured report and tool-call summaries in `session.trace.structuredOutput`.
4. Compute input, result, and trace hashes.
5. Return the trace bundle to the browser for wallet-paid Walrus Mainnet SDK Upload Relay storage.
6. Finalize only after aggregator readback and hash verification.
7. Anchor proof on Sui Mainnet after the package ID is configured.

Missing runtime configuration returns a setup error before any Walrus success is claimed.
