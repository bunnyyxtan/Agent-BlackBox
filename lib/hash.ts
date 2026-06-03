import type { AgentTrace } from "@/types/blackbox";

function rotateRight(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

// Browser-safe SHA-256 keeps local trace generation deterministic without a backend.
export function createHashFromString(input: string): string {
  const maxWord = 2 ** 32;
  const words: number[] = [];
  const hash: number[] = [];
  const constants: number[] = [];
  const composite: Record<number, boolean> = {};
  let primeCounter = 0;

  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!composite[candidate]) {
      for (let multiple = candidate * candidate; multiple < 313; multiple += candidate) {
        composite[multiple] = true;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (Math.sqrt(candidate) * maxWord) | 0;
      }
      constants[primeCounter] = (Math.cbrt(candidate) * maxWord) | 0;
      primeCounter += 1;
    }
  }

  const utf8 = unescape(encodeURIComponent(input));
  const bitLength = utf8.length * 8;
  let padded = `${utf8}\x80`;
  while ((padded.length % 64) !== 56) padded += "\x00";

  for (let index = 0; index < padded.length; index += 1) {
    const character = padded.charCodeAt(index);
    words[index >> 2] |= character << ((3 - (index % 4)) * 8);
  }

  words.push((bitLength / maxWord) | 0);
  words.push(bitLength);

  for (let block = 0; block < words.length; block += 16) {
    const working = hash.slice(0);
    const schedule = words.slice(block, block + 16);
    const oldHash = hash.slice(0);

    for (let index = 0; index < 64; index += 1) {
      const w15 = schedule[index - 15];
      const w2 = schedule[index - 2];
      const a = working[0];
      const e = working[4];
      const sigma0 =
        index < 16
          ? 0
          : rotateRight(w15, 7) ^ rotateRight(w15, 18) ^ (w15 >>> 3);
      const sigma1 =
        index < 16
          ? 0
          : rotateRight(w2, 17) ^ rotateRight(w2, 19) ^ (w2 >>> 10);

      if (index >= 16) {
        schedule[index] =
          (schedule[index - 16] + sigma0 + schedule[index - 7] + sigma1) | 0;
      }

      const choice = (e & working[5]) ^ (~e & working[6]);
      const majority = (a & working[1]) ^ (a & working[2]) ^ (working[1] & working[2]);
      const temp1 =
        (working[7] +
          (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) +
          choice +
          constants[index] +
          schedule[index]) |
        0;
      const temp2 =
        ((rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) + majority) |
        0;

      working.pop();
      working.unshift((temp1 + temp2) | 0);
      working[4] = (working[4] + temp1) | 0;
    }

    for (let index = 0; index < 8; index += 1) {
      hash[index] = (working[index] + oldHash[index]) | 0;
    }
  }

  return hash
    .map((value) => {
      let result = "";
      for (let byte = 3; byte >= 0; byte -= 1) {
        result += ((value >> (byte * 8)) & 255).toString(16).padStart(2, "0");
      }
      return result;
    })
    .join("");
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createTraceHash(trace: Partial<AgentTrace>): string {
  const sealedFields = {
    sessionId: trace.sessionId,
    userIntent: trace.userIntent,
    agentPlan: trace.agentPlan,
    toolCalls: trace.toolCalls,
    structuredOutput: trace.structuredOutput,
    finalOutput: trace.finalOutput,
    inputHash: trace.inputHash,
    resultHash: trace.resultHash,
    createdAt: trace.createdAt,
  };
  return createHashFromString(stableStringify(sealedFields));
}

export function createResultHash(output: string): string {
  return createHashFromString(output);
}

export function compareHashes(a: string, b: string): boolean {
  return a === b;
}
