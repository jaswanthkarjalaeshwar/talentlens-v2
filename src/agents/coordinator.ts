import { randomUUID } from "crypto";
import { parseJobDescription } from "./jdParser.js";
import { scrubAllPII } from "../utils/piiScrubber.js";
import { scoreCandidate } from "./resumeAgent.js";
import type { RawCandidate, ResumeAgentOutput } from "../schemas/index.js";

export interface CoordinatorInput {
  jdId: string;
  jdText: string;
  candidates: RawCandidate[];
}

export interface CoordinatorOutput {
  runId: string;
  jdId: string;
  screenedAt: string;
  modelVersion: string;
  scores: Array<ResumeAgentOutput & { pii_stripped: boolean }>;
}

export async function runCoordinator(input: CoordinatorInput): Promise<CoordinatorOutput> {
  const runId = randomUUID();
  const screenedAt = new Date().toISOString();
  const modelVersion = process.env["MODEL_VERSION"] ?? "claude-sonnet-4-6";

  // Step 1: Parse JD once (result is cached)
  const jdCriteria = await parseJobDescription(input.jdText);

  // Step 2: Scrub PII from all resumes
  const scrubbed = scrubAllPII(input.candidates);

  // Step 3: Fan out — score all candidates in parallel
  const scoreResults = await Promise.all(
    scrubbed.map(async (candidate) => {
      const score = await scoreCandidate(candidate, jdCriteria);
      return { ...score, pii_stripped: candidate.pii_stripped };
    }),
  );

  return {
    runId,
    jdId: input.jdId,
    screenedAt,
    modelVersion,
    scores: scoreResults,
  };
}
