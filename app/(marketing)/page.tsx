"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LandingNav } from "@/components/layout/LandingNav";
import { Footer } from "@/components/layout/Footer";
import { LogoCloud } from "@/components/ui/LogoCloud";
import { ProofPipeline } from '@/components/ui/ProofPipeline';
import { LiveAgentProcess } from "@/components/ui/LiveAgentProcess";
import { ProtocolLogo, type Protocol } from "@/components/ui/ProtocolLogo";
import { WalletConnectButton } from "@/components/ui/WalletConnectButton";

/* ─── Scroll reveal observer ─── */
function useRevealObserver() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ─── Landing Page ─── */
export default function LandingPage() {
  useRevealObserver();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState("");

  useEffect(() => {
    ["/dashboard", "/sessions", "/sessions/new", "/storage", "/settings", "/developer", "/developers"].forEach((route) =>
      router.prefetch(route),
    );
  }, [router]);

  return (
    <div className="min-h-screen">
      <LandingNav />

      {/* ════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════ */}
      <section className="relative pt-44 pb-32 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Eyebrow */}
          <div className="reveal inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.02] backdrop-blur-sm mb-10">
            <span className="relative flex h-2 w-2">
              <span className="ring absolute inline-flex h-full w-full rounded-full bg-indigo-400" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
            </span>
            <span className="text-xs font-light tracking-wide text-zinc-400">
              AI agents with verifiable proof trails
            </span>
          </div>

          {/* Headline */}
          <h1
            className="reveal text-5xl sm:text-7xl lg:text-[5.5rem] leading-[0.95] tracking-tight text-white font-light mb-8"
            style={{ transitionDelay: "0.1s" }}
          >
            The flight recorder for
            <br />
            <span className="serif italic text-6xl sm:text-8xl lg:text-[6.5rem] gradient-text">
              autonomous AI agents
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="reveal max-w-2xl mx-auto text-lg sm:text-xl font-light text-zinc-400 leading-relaxed mb-12"
            style={{ transitionDelay: "0.2s" }}
          >
            Use an AI agent, get the result, and receive a verifiable BlackBox
            proof automatically. Every intent, file, tool call, and output is
            sealed, stored on Walrus, anchored on Sui, and verified through
            Tatum RPC.
          </p>

          {/* CTAs */}
          <div
            className="reveal flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ transitionDelay: "0.3s" }}
          >
            <Link
              href="/sessions/new"
              prefetch
              aria-busy={pendingHref === "/sessions/new"}
              onClick={() => setPendingHref("/sessions/new")}
              onFocus={() => router.prefetch("/sessions/new")}
              onMouseEnter={() => router.prefetch("/sessions/new")}
              className="group w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-medium text-zinc-900 bg-white px-7 py-3.5 rounded-full hover:shadow-[0_0_40px_-5px_rgba(255,255,255,0.6)] transition-all"
            >
              {pendingHref === "/sessions/new" ? "Opening Agent..." : "Use Agent"}
              <iconify-icon
                icon={pendingHref === "/sessions/new" ? "solar:spinner-linear" : "solar:arrow-right-linear"}
                className={`text-base transition-transform ${
                  pendingHref === "/sessions/new" ? "animate-spin" : "group-hover:translate-x-1"
                }`}
              />
            </Link>
            <a
              href="#verify"
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-light text-zinc-300 border border-white/10 px-7 py-3.5 rounded-full hover:bg-white/[0.03] hover:border-white/20 transition-all"
            >
              <iconify-icon
                icon="solar:shield-check-line-duotone"
                className="text-base"
              />
              See Verified Proof
            </a>
          </div>

          {/* ── Code panel / trace preview ── */}
          <div
            className="reveal mt-24 max-w-3xl mx-auto flex justify-center"
            style={{ transitionDelay: "0.4s" }}
          >
            <LiveAgentProcess />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          TRUST STRIP
      ════════════════════════════════════════════════════════ */}
      <section className="relative py-12 border-y border-white/5">
        <LogoCloud />
      </section>

      {/* ════════════════════════════════════════════════════════
          AGENTS
      ════════════════════════════════════════════════════════ */}
      <section id="agents" className="relative py-32 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-20">
            <p className="reveal mono text-xs text-indigo-400 tracking-widest uppercase mb-5">
              / Agents
            </p>
            <h2 className="reveal text-4xl sm:text-5xl font-light tracking-tight text-white leading-tight">
              Choose an agent.{" "}
              <span className="serif italic">
                Every action gets a proof trail.
              </span>
            </h2>
            <p className="reveal text-lg font-light text-zinc-500 mt-6 leading-relaxed">
              Agent BlackBox lets users run practical AI agents while
              automatically recording the full session trace for verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: "solar:documents-line-duotone",
                title: "Research Agent",
                desc: "Builds a source-aware research brief, records findings, and seals the discovery trail.",
              },
              {
                icon: "solar:danger-triangle-line-duotone",
                title: "Risk Review Agent",
                desc: "Reviews inputs for exposure, flags issues by severity, and seals a liability-aware report.",
              },
              {
                icon: "solar:chart-line-duotone",
                title: "Onchain Analyzer Agent",
                desc: "Analyzes Sui wallet, object, package, or transaction context and records a certified proof trail.",
              },
              {
                icon: "solar:verified-check-line-duotone",
                title: "Delivery Proof Agent",
                desc: "Creates a cryptographic delivery receipt with evidence, acceptance notes, and a sealed handoff trail.",
              },
            ].map((agent, i) => (
              <div
                key={agent.title}
                className="reveal card-hover rounded-2xl border border-white/10 bg-white/[0.02] p-7 hover:border-indigo-500/30 hover:bg-white/[0.04]"
                style={{ transitionDelay: `${i * 0.05}s` }}
              >
                <iconify-icon
                  icon={agent.icon}
                  className="text-3xl text-indigo-300 my-5 block"
                />
                <h3 className="text-base font-medium text-white tracking-tight mb-2">
                  {agent.title}
                </h3>
                <p className="text-sm font-light text-zinc-500 leading-relaxed">
                  {agent.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="relative py-32 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <p className="reveal mono text-xs text-indigo-400 tracking-widest uppercase mb-5">
              / How It Works
            </p>
            <h2 className="reveal text-4xl sm:text-5xl font-light tracking-tight text-white leading-tight">
              Store on Walrus. Anchor on Sui.{" "}
              <span className="serif italic">Verify through Tatum RPC.</span>
            </h2>
          </div>
          <div className="reveal">
            <ProofPipeline />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          BLACKBOX TRACE
      ════════════════════════════════════════════════════════ */}
      <section id="trace" className="relative py-32 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: text */}
          <div>
            <p className="reveal mono text-xs text-indigo-400 tracking-widest uppercase mb-5">
              / BlackBox Trace
            </p>
            <h2 className="reveal text-4xl sm:text-5xl font-light tracking-tight text-white leading-tight mb-6">
              Every agent session becomes{" "}
              <span className="serif italic">sealed evidence</span>.
            </h2>
            <p className="reveal text-lg font-light text-zinc-500 leading-relaxed mb-10">
              A BlackBox trace is more than a log. It is a structured evidence
              bundle containing the original intent, uploaded files, agent plan,
              tool calls, output, hashes, storage reference, and on-chain proof
              anchor.
            </p>

            <div className="space-y-3">
              {[
                {
                  icon: "solar:target-line-duotone",
                  label: "User intent and uploaded evidence",
                },
                {
                  icon: "solar:routing-line-duotone",
                  label: "Agent plan and tool-call timeline",
                },
                {
                  icon: "solar:hashtag-square-line-duotone",
                  label: "Input, result, and trace hashes",
                },
                {
                  icon: "solar:link-circle-line-duotone",
                  label: "Walrus upload job and blob ID",
                },
                {
                  icon: "solar:shield-check-line-duotone",
                  label: "Sui proof object and RPC verification",
                },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className="reveal flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] card-hover hover:border-white/15"
                  style={{ transitionDelay: `${i * 0.05}s` }}
                >
                  <iconify-icon
                    icon={item.icon}
                    className="text-xl text-indigo-300 shrink-0"
                  />
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <iconify-icon
                    icon="solar:lock-keyhole-minimalistic-line-duotone"
                    className="text-base text-zinc-600 ml-auto"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Right: trace card */}
          <div className="reveal">
            <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-1 glow">
              <div className="rounded-[1.4rem] bg-[#08080c] p-6">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm font-medium text-white tracking-tight">
                    BlackBox Trace #A7F2
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <iconify-icon
                      icon="solar:check-circle-bold"
                      className="text-sm"
                    />
                    Prepared
                  </span>
                </div>
                {/* Chain diagram */}
                <div className="space-y-0">
                  {[
                    {
                      icon: "solar:user-line-duotone",
                      label: "Intent hash",
                      value: "0x8f3a...c21e",
                      borderColor: "border-indigo-500/20",
                      bgColor: "bg-indigo-500/10",
                      iconColor: "text-indigo-300",
                    },
                    {
                      icon: "solar:cloud-storage-line-duotone",
                      label: "Walrus upload job",
                      value: "job_19f4",
                      borderColor: "border-indigo-500/20",
                      bgColor: "bg-indigo-500/10",
                      iconColor: "text-indigo-300",
                      protocol: "walrus" as Protocol,
                    },
                    {
                      icon: "solar:database-line-duotone",
                      label: "Walrus blob",
                      value: "blob_4f9e2a...",
                      borderColor: "border-indigo-500/20",
                      bgColor: "bg-indigo-500/10",
                      iconColor: "text-indigo-300",
                      protocol: "walrus" as Protocol,
                    },
                    {
                      icon: "solar:waterdrop-line-duotone",
                      label: "Sui proof object",
                      value: "0x2c4f...88ad",
                      borderColor: "border-emerald-500/20",
                      bgColor: "bg-emerald-500/10",
                      iconColor: "text-emerald-300",
                      protocol: "sui" as Protocol,
                    },
                    {
                      icon: "solar:server-line-duotone",
                      label: "Tatum RPC check",
                      value: "Pending",
                      borderColor: "border-indigo-500/20",
                      bgColor: "bg-indigo-500/10",
                      iconColor: "text-indigo-300",
                      protocol: "tatum" as Protocol,
                    },
                  ].map((node, i, arr) => (
                    <div key={node.label}>
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-11 w-11 rounded-xl ${node.bgColor} ${node.borderColor} border flex items-center justify-center shrink-0`}
                        >
                          {node.protocol ? (
                            <ProtocolLogo protocol={node.protocol} size="md" className="border-0 bg-transparent shadow-none" />
                          ) : (
                            <iconify-icon
                              icon={node.icon}
                              className={node.iconColor}
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-zinc-500">{node.label}</p>
                          <p className="mono text-sm text-zinc-300">
                            {node.value}
                          </p>
                        </div>
                      </div>
                      {i < arr.length - 1 && (
                        <div
                          className={`ml-5 h-8 w-px bg-gradient-to-b ${
                            i < arr.length - 2
                              ? "from-indigo-500/40 to-indigo-500/40"
                              : "from-indigo-500/40 to-emerald-500/40"
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs text-zinc-600">
                    <ProtocolLogo protocol="sui" size="sm" />
                    Network · Sui Mainnet
                  </span>
                  <button className="text-xs font-medium text-indigo-300 hover:text-indigo-200 flex items-center gap-1 transition-colors">
                    Verify Again
                    <iconify-icon
                      icon="solar:refresh-line-duotone"
                      className="text-sm"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          STORAGE
      ════════════════════════════════════════════════════════ */}
      <section id="storage" className="relative py-32 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <p className="reveal mono text-xs text-indigo-400 tracking-widest uppercase mb-5">
              / Storage
            </p>
            <h2 className="reveal text-4xl sm:text-5xl font-light tracking-tight text-white leading-tight">
              Walrus storage.{" "}
              <span className="serif italic">Direct verification.</span>
            </h2>
            <p className="reveal text-lg font-light text-zinc-500 mt-6 leading-relaxed">
              Trace bundles are stored on Walrus. Direct Walrus verification
              confirms blob availability and trace integrity, while upload
              adapters can provide managed lifecycle support.
            </p>
          </div>

          <div className="reveal grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: "solar:cloud-storage-line-duotone",
                label: "Walrus Upload Job",
                status: "Prepared",
                protocol: "walrus" as Protocol,
              },
              {
                icon: "solar:database-line-duotone",
                label: "Walrus Blob",
                status: "Prepared",
                protocol: "walrus" as Protocol,
              },
              {
                icon: "solar:calendar-line-duotone",
                label: "Expiry",
                status: "Prepared",
              },
              {
                icon: "solar:download-minimalistic-line-duotone",
                label: "Direct Read",
                status: "Prepared",
                protocol: "walrus" as Protocol,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="card-hover rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  {card.protocol ? (
                    <ProtocolLogo protocol={card.protocol} size="md" />
                  ) : (
                    <iconify-icon
                      icon={card.icon}
                      className="text-2xl text-indigo-300"
                    />
                  )}
                  <iconify-icon
                    icon="solar:check-circle-bold"
                    className="text-base text-emerald-400"
                  />
                </div>
                <h4 className="text-sm font-medium text-white mb-1.5">
                  {card.label}
                </h4>
                <p className="text-xs font-light text-emerald-400/80 leading-relaxed">
                  {card.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          DEVELOPERS
      ════════════════════════════════════════════════════════ */}
      <section id="developers" className="relative py-32 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <p className="reveal mono text-xs text-indigo-400 tracking-widest uppercase mb-5">
              / Developers
            </p>
            <h2 className="reveal text-4xl sm:text-5xl font-light tracking-tight text-white leading-tight">
              A proof stack built for{" "}
              <span className="serif italic">AI accountability.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="reveal card-hover rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-9 hover:border-indigo-500/30 floating">
              <ProtocolLogo protocol="walrus" size="lg" className="mb-6" />
              <h3 className="text-2xl font-light text-white tracking-tight mb-3">
                Walrus Blob Storage
              </h3>
              <p className="text-base font-light text-zinc-500 leading-relaxed">
                Trace bundles are stored on Walrus. The app may use a
                Tatum-managed Walrus adapter for uploads, while direct blob
                reads remain the proof source.
              </p>
            </div>
            <div
              className="reveal card-hover rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-9 hover:border-emerald-500/30 floating"
              style={{ animationDelay: "1s" }}
            >
              <div className="mb-6 flex items-center gap-2">
                <ProtocolLogo protocol="sui" size="lg" />
                <ProtocolLogo protocol="tatum" size="lg" />
              </div>
              <h3 className="text-2xl font-light text-white tracking-tight mb-3">
                Sui Proof Registry · Tatum RPC
              </h3>
              <p className="text-base font-light text-zinc-500 leading-relaxed">
                Agent BlackBox stores lightweight proof metadata on Sui and
                verifies proof objects, transaction digests, and events through
                Tatum Sui RPC.
              </p>
            </div>
            <div
              className="reveal card-hover rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-9 hover:border-indigo-500/30 floating"
              style={{ animationDelay: "2s" }}
            >
              <iconify-icon
                icon="solar:verified-check-line-duotone"
                className="text-4xl text-indigo-300 mb-6 block"
              />
              <h3 className="text-2xl font-light text-white tracking-tight mb-3">
                Direct Walrus Verification
              </h3>
              <p className="text-base font-light text-zinc-500 leading-relaxed">
                The verifier can read the Walrus blob, recompute the trace hash,
                and compare it against the Sui proof anchor.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          VERIFY PROOF
      ════════════════════════════════════════════════════════ */}
      <section id="verify" className="relative py-32 px-6 lg:px-10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="reveal mono text-xs text-indigo-400 tracking-widest uppercase mb-5">
            / Verify Proof
          </p>
          <h2 className="reveal text-4xl sm:text-6xl font-light tracking-tight text-white leading-tight mb-6">
            Proof you can{" "}
            <span className="serif italic gradient-text">replay.</span>
          </h2>
          <p className="reveal text-lg font-light text-zinc-500 leading-relaxed max-w-2xl mx-auto mb-14">
            Anyone can verify a BlackBox session by reading the Walrus blob,
            recomputing hashes, and confirming the proof anchor through Tatum
            RPC.
          </p>

          <div className="reveal grid sm:grid-cols-3 gap-4 text-left mb-12">
            {[
              {
                icon: "solar:cloud-storage-line-duotone",
                label: "Walrus Upload Job",
                status: "Prepared",
                iconColor: "text-indigo-300",
                protocol: "walrus" as Protocol,
              },
              {
                icon: "solar:database-line-duotone",
                label: "Walrus Trace Blob",
                status: "Prepared",
                iconColor: "text-indigo-300",
                protocol: "walrus" as Protocol,
              },
              {
                icon: "solar:download-minimalistic-line-duotone",
                label: "Direct Walrus Read",
                status: "Pending",
                iconColor: "text-indigo-300",
                protocol: "walrus" as Protocol,
              },
              {
                icon: "solar:anchor-line-duotone",
                label: "Sui Proof Anchor",
                status: "Pending",
                iconColor: "text-indigo-300",
                protocol: "sui" as Protocol,
              },
              {
                icon: "solar:server-line-duotone",
                label: "Tatum RPC Check",
                status: "Pending",
                iconColor: "text-indigo-300",
                protocol: "tatum" as Protocol,
              },
              {
                icon: "solar:shield-check-line-duotone",
                label: "Hash Integrity",
                status: "Prepared",
                iconColor: "text-emerald-300",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  {card.protocol ? (
                    <ProtocolLogo protocol={card.protocol} size="md" />
                  ) : (
                    <iconify-icon
                      icon={card.icon}
                      className={`text-2xl ${card.iconColor}`}
                    />
                  )}
                  <iconify-icon
                    icon="solar:check-circle-bold"
                    className="text-base text-emerald-400"
                  />
                </div>
                <h4 className="text-sm font-medium text-white mb-1.5">
                  {card.label}
                </h4>
                <p className="text-xs font-light text-emerald-400/80 leading-relaxed">
                  {card.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          TAMPER TEST
      ════════════════════════════════════════════════════════ */}
      <section id="tamper" className="relative py-32 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="reveal mono text-xs text-indigo-400 tracking-widest uppercase mb-5">
              / Tamper Test
            </p>
            <h2 className="reveal text-4xl sm:text-5xl font-light tracking-tight text-white leading-tight">
              Change the output.{" "}
              <span className="serif italic">Break the proof.</span>
            </h2>
            <p className="reveal text-lg font-light text-zinc-500 mt-6 leading-relaxed">
              Agent BlackBox makes post-session edits visible. If the final
              output changes, the recomputed hash no longer matches the sealed
              proof.
            </p>
          </div>

          <div className="reveal grid sm:grid-cols-2 gap-5">
            {/* Verified */}
            <div className="card-hover rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.05] to-transparent p-8">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-medium text-white tracking-tight">
                  Original BlackBox trace
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <iconify-icon
                    icon="solar:check-circle-bold"
                    className="text-sm"
                  />
                  Verified
                </span>
              </div>
              <div className="mono text-xs space-y-1.5 text-zinc-500">
                <p>
                  <span className="text-indigo-400">result_hash</span>
                  {` : `}
                  <span className="text-zinc-400">0xa7b9...4d0f</span>
                </p>
                <p>
                  <span className="text-indigo-400">recomputed</span>
                  {` : `}
                  <span className="text-emerald-400">0xa7b9...4d0f</span>
                </p>
                <p>
                  <span className="text-indigo-400">match</span>
                  {` : `}
                  <span className="text-emerald-400">true</span>
                </p>
              </div>
            </div>

            {/* Tampered */}
            <div className="card-hover rounded-3xl border border-red-500/25 bg-gradient-to-b from-red-500/[0.06] to-transparent p-8">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-medium text-white tracking-tight">
                  Modified local trace
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25">
                  <iconify-icon
                    icon="solar:danger-triangle-bold"
                    className="text-sm"
                  />
                  Tampered
                </span>
              </div>
              <div className="mono text-xs space-y-1.5 text-zinc-500">
                <p>
                  <span className="text-indigo-400">result_hash</span>
                  {` : `}
                  <span className="text-zinc-400">0xa7b9...4d0f</span>
                </p>
                <p>
                  <span className="text-indigo-400">recomputed</span>
                  {` : `}
                  <span className="text-red-400">0x31c0...e92b</span>
                </p>
                <p>
                  <span className="text-indigo-400">match</span>
                  {` : `}
                  <span className="text-red-400">false</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          CTA
      ════════════════════════════════════════════════════════ */}
      <section id="cta" className="relative py-32 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto reveal">
          <div className="relative rounded-[2.5rem] border border-white/10 overflow-hidden bg-gradient-to-b from-indigo-950/30 to-[#08080c] p-12 sm:p-20 text-center glow">
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 60%)",
              }}
            />
            <div className="relative">
              <h2 className="text-4xl sm:text-6xl font-light tracking-tight text-white leading-[1.05] mb-6">
                Use an agent with
                <br />
                <span className="serif italic gradient-text">
                  verifiable proof.
                </span>
              </h2>
              <p className="text-lg font-light text-zinc-400 max-w-xl mx-auto mb-10">
                Connect your Sui wallet, run an AI agent, store the trace on
                Walrus, and verify the proof through Tatum RPC.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <WalletConnectButton variant="cta" />
                <Link
                  href="/dashboard"
                  prefetch
                  aria-busy={pendingHref === "/dashboard"}
                  onClick={() => setPendingHref("/dashboard")}
                  onFocus={() => router.prefetch("/dashboard")}
                  onMouseEnter={() => router.prefetch("/dashboard")}
                  className="w-full sm:w-auto text-sm font-light text-zinc-300 border border-white/15 px-8 py-4 rounded-full hover:bg-white/[0.03] transition-all text-center"
                >
                  {pendingHref === "/dashboard" ? "Opening..." : "Open App"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════ */}
      <Footer />
    </div>
  );
}
