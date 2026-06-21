import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { scoreCandidate } from "../agents/resumeAgent.js";
import { logEvalRun } from "./logger.js";
import { GOLDEN_CASES, type GoldenCase } from "./goldenDataset.js";
import type { ResumeAgentOutput } from "../schemas/index.js";
import type { ScrubbedCandidate } from "../schemas/index.js";

const client = new Anthropic();

const JUDGE_SYSTEM_PROMPT = `You are an evaluation judge for a candidate screening system. You will be given a job description, a candidate resume, the screening agent's output (verdict, scores, strengths, gaps, reasoning), and the expected verdict for this test case.

Score the reasoning quality on a scale of 0.0 to 1.0:
  0.9–1.0: Reasoning is specific, grounded in resume evidence, correctly identifies the most important strengths and gaps, and the verdict is well-justified
  0.7–0.89: Reasoning is mostly grounded but misses 1–2 important signals or includes a generic claim not backed by the resume
  0.5–0.69: Reasoning is partially grounded but contains at least one unsupported claim or misses a critical gap
  0.0–0.49: Reasoning is generic, contradicts the resume, or the verdict is unjustified given the evidence

Return JSON only:
{
  "reasoning_score": float,
  "verdict_correct": boolean,
  "judge_notes": string (one sentence explaining the score)
}`;

const JUDGE_TOOL: Anthropic.Tool = {
  name: "submit_evaluation",
  description: "Submit the reasoning quality evaluation for this screening result.",
  input_schema: {
    type: "object" as const,
    properties: {
      reasoning_score: {
        type: "number",
        description: "Reasoning quality score 0.0–1.0",
      },
      verdict_correct: {
        type: "boolean",
        description: "Whether the verdict matches the expected verdict",
      },
      judge_notes: {
        type: "string",
        description: "One sentence explaining the reasoning score",
      },
    },
    required: ["reasoning_score", "verdict_correct", "judge_notes"],
    additionalProperties: false,
  },
};

interface JudgeOutput {
  reasoning_score: number;
  verdict_correct: boolean;
  judge_notes: string;
}

function buildJudgeUserPrompt(gcase: GoldenCase, score: ResumeAgentOutput): string {
  const jd = gcase.jd;
  return `## Job Description
Title: ${jd.title}
Domain: ${jd.domain}
Seniority: ${jd.seniority_level}
Min experience: ${jd.min_years_experience} years
Required skills: ${jd.required_skills.join(", ")}
Preferred skills: ${jd.preferred_skills.join(", ")}
Key responsibilities: ${jd.responsibilities.join("; ")}
Culture indicators: ${jd.culture_indicators.join(", ")}

## Candidate Resume
${gcase.resume}

## Screening Agent Output
Verdict: ${score.verdict}
Overall fit: ${score.overall_fit}
Confidence: ${score.confidence}
Skills match: ${score.scores.skills_match}
Experience relevance: ${score.scores.experience_relevance}
Culture signal: ${score.scores.culture_signal}
Strengths: ${score.strengths.join(" | ")}
Gaps: ${score.gaps.join(" | ")}
Reasoning: ${score.reasoning}

## Expected Verdict
${gcase.expected_verdict}

Evaluate the reasoning quality. Is it grounded in specific resume evidence? Does it correctly identify the key strengths and gaps relevant to this JD?`;
}

async function judgeReasoning(gcase: GoldenCase, score: ResumeAgentOutput): Promise<JudgeOutput> {
  const response = await client.messages.create({
    model: process.env["MODEL_VERSION"] ?? "claude-sonnet-4-6",
    max_tokens: 512,
    system: JUDGE_SYSTEM_PROMPT,
    tool_choice: { type: "tool", name: "submit_evaluation" },
    tools: [JUDGE_TOOL],
    messages: [{ role: "user", content: buildJudgeUserPrompt(gcase, score) }],
  });

  const toolUseBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUseBlock) {
    throw new Error(`Judge: model did not return a tool_use block for case ${gcase.id}`);
  }

  return toolUseBlock.input as JudgeOutput;
}

export interface EvalResult {
  caseId: string;
  expectedVerdict: string;
  gotVerdict: string;
  overallFit: number;
  verdictMatch: boolean;
  fitInRange: boolean;
  reasoningScore: number;
  judgeNotes: string;
}

export async function runEval(): Promise<EvalResult[]> {
  const runId = randomUUID();
  const results: EvalResult[] = [];

  for (const gcase of GOLDEN_CASES) {
    process.stdout.write(`  Evaluating ${gcase.id}...`);

    const candidate: ScrubbedCandidate = {
      id: gcase.id,
      scrubbedText: gcase.resume,
      pii_stripped: false,
    };

    const score = await scoreCandidate(candidate, gcase.jd);

    const verdictMatch = score.verdict === gcase.expected_verdict;
    const fitInRange =
      score.overall_fit >= gcase.expected_fit_range[0] &&
      score.overall_fit <= gcase.expected_fit_range[1];

    const judgeOutput = await judgeReasoning(gcase, score);

    await logEvalRun({
      eval_id: randomUUID(),
      case_id: gcase.id,
      run_id: runId,
      verdict_match: verdictMatch,
      fit_in_range: fitInRange,
      reasoning_score: judgeOutput.reasoning_score,
      judge_notes: judgeOutput.judge_notes,
      evaluated_at: new Date().toISOString(),
    });

    results.push({
      caseId: gcase.id,
      expectedVerdict: gcase.expected_verdict,
      gotVerdict: score.verdict,
      overallFit: score.overall_fit,
      verdictMatch,
      fitInRange,
      reasoningScore: judgeOutput.reasoning_score,
      judgeNotes: judgeOutput.judge_notes,
    });

    process.stdout.write(` ${verdictMatch ? "✓" : "✗"} (fit=${score.overall_fit.toFixed(2)}, reasoning=${judgeOutput.reasoning_score.toFixed(2)})\n`);
  }

  return results;
}
