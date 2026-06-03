import type { CreateSessionInput } from "@/types/blackbox";

// These records seed the local JSON store on first run. They are not a runtime
// fallback: unknown session IDs must remain unknown.
export const seedSessionInputs: CreateSessionInput[] = [
  {
    id: "abx-research-walrus",
    title: "Research Walrus trace storage",
    prompt: "Explain how Walrus can store sealed Agent BlackBox trace bundles, support readback verification, and preserve evidence for independent replay.",
    agentMode: "research",
    storageEpochs: 5,
    createdAt: "2026-05-30T14:24:00.000Z",
    files: [{ name: "walrus-trace-notes.md", type: "text/markdown", size: 32768 }],
  },
  {
    id: "abx-delivery-verify",
    title: "Verify autonomous delivery handoff",
    prompt: "Review the delivery evidence, record the agent decision path, and prepare an auditable handoff trace.",
    agentMode: "delivery_proof",
    storageEpochs: 10,
    createdAt: "2026-05-29T09:42:00.000Z",
    files: [{ name: "handoff-manifest.json", type: "application/json", size: 18420 }],
  },
  {
    id: "abx-risk-review",
    title: "Assess treasury policy exposure",
    prompt: "Inspect the proposed treasury automation policy and record a risk review with independently verifiable evidence.",
    agentMode: "risk_review",
    storageEpochs: 5,
    createdAt: "2026-05-28T16:18:00.000Z",
    files: [{ name: "treasury-policy.pdf", type: "application/pdf", size: 284912 }],
  },
  {
    id: "abx-chain-monitor",
    title: "Analyze Sui wallet holdings",
    prompt: "Read the supplied Sui wallet through public Sui RPC, summarize token holdings, and seal the analyzer evidence trail.",
    agentMode: "onchain_monitor",
    storageEpochs: 5,
    createdAt: "2026-05-27T11:06:00.000Z",
  },
];
