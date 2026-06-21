import Anthropic from "@anthropic-ai/sdk";
import {
  CandidateResultSchema,
  type CandidateResult,
  type ResumeAgentOutput,
} from "../schemas/index.js";

const client = new Anthropic();

const RANK_CANDIDATES_TOOL: Anthropic.Tool = {
  name: "rank_candidates",
  description: "Synthesize individual candidate scores into a ranked shortlist.",
  input_schema: {
    type: "object" as const,
    properties: {
      ranked: {
        type: "array",
        description: "Candidates in rank order (rank 1 = best fit)",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            rank: { type: "integer", description: "1-based rank" },
            overall_fit: { type: "number" },
            verdict: {
              type: "string",
              enum: ["strong_yes", "yes", "maybe", "no", "strong_no"],
            },
            confidence: { type: "number" },
            escalate: {
              type: "boolean",
              description: "True if confidence < 0.85 — requires human review",
            },
            scores: {
              type: "object",
              properties: {
                skills_match: { type: "number" },
                experience_relevance: { type: "number" },
                culture_signal: { type: "number" },
              },
              required: ["skills_match", "experience_relevance", "culture_signal"],
              additionalProperties: false,
            },
            strengths: { type: "array", items: { type: "string" } },
            gaps: { type: "array", items: { type: "string" } },
            reasoning: { type: "string" },
          },
          required: [
            "id",
            "rank",
            "overall_fit",
            "verdict",
            "confidence",
            "escalate",
            "scores",
            "strengths",
            "gaps",
            "reasoning",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["ranked"],
    additionalProperties: false,
  },
};

function buildRankingPrompt(scores: ResumeAgentOutput[]): string {
  const summaries = scores
    .map(
      (s) =>
        `Candidate ${s.id}: overall_fit=${s.overall_fit.toFixed(2)}, verdict=${s.verdict}, confidence=${s.confidence.toFixed(2)}\n` +
        `  skills_match=${s.scores.skills_match.toFixed(2)}, experience=${s.scores.experience_relevance.toFixed(2)}, culture=${s.scores.culture_signal.toFixed(2)}\n` +
        `  Strengths: ${s.strengths.join("; ")}\n` +
        `  Gaps: ${s.gaps.join("; ")}\n` +
        `  Reasoning: ${s.reasoning}`,
    )
    .join("\n\n");

  return `You are a hiring committee chair. Given the following individual candidate assessments, produce a final ranked shortlist.

Rules:
- Rank candidates from 1 (best) to ${scores.length} (least suitable)
- Set escalate=true for any candidate whose confidence < 0.85 (borderline cases need human review)
- You may adjust the overall_fit score slightly based on cross-candidate comparison
- Preserve all other fields from the individual assessments unless you have a strong reason to revise

## Individual Assessments
${summaries}

Rank all ${scores.length} candidates and return them in the ranked array.`;
}

export interface RankerOutput {
  candidates: CandidateResult[];
  escalationCount: number;
}

export async function rankCandidates(
  scores: Array<ResumeAgentOutput & { pii_stripped: boolean; tokens_used: number }>,
): Promise<RankerOutput> {
  const prompt = buildRankingPrompt(scores);

  const response = await client.messages.create({
    model: process.env["MODEL_VERSION"] ?? "claude-sonnet-4-6",
    max_tokens: 8192,
    tool_choice: { type: "tool", name: "rank_candidates" },
    tools: [RANK_CANDIDATES_TOOL],
    messages: [{ role: "user", content: prompt }],
  });

  const toolUseBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUseBlock) {
    console.error("Ranker full response:", JSON.stringify(response.content, null, 2));
    throw new Error("Ranker Agent: model did not return a tool_use block");
  }

  console.error("Ranker stop_reason:", response.stop_reason, "| input_tokens:", response.usage.input_tokens, "| output_tokens:", response.usage.output_tokens);
  const rawInput = toolUseBlock.input as Record<string, unknown>;
  const ranked = (
    Array.isArray(rawInput["ranked"]) ? rawInput["ranked"] :
    Array.isArray(rawInput["candidates"]) ? rawInput["candidates"] :
    Array.isArray(rawInput) ? rawInput :
    undefined
  ) as unknown[] | undefined;

  if (!ranked) {
    console.error("Ranker raw input:", JSON.stringify(toolUseBlock.input, null, 2));
    throw new Error("Ranker Agent: could not find ranked candidates array in model response");
  }

  // Build a lookup map for per-candidate metadata preserved from individual scoring
  const metaMap = new Map(
    scores.map((s) => [
      s.id,
      { pii_stripped: s.pii_stripped, tokens_used: s.tokens_used },
    ]),
  );

  const candidates: CandidateResult[] = ranked.map((item) => {
    const r = item as Record<string, unknown>;
    const meta = metaMap.get(r["id"] as string) ?? {
      pii_stripped: false,
      tokens_used: 0,
    };
    return CandidateResultSchema.parse({
      ...r,
      human_override: null,
      pii_stripped: meta.pii_stripped,
      tokens_used: meta.tokens_used,
    });
  });

  // Human checkpoint: escalate any candidate with confidence < 0.85
  // (also enforced in the ranker prompt, but we apply it here as a hard rule)
  for (const c of candidates) {
    if (c.confidence < 0.85 && !c.escalate) {
      c.escalate = true;
    }
  }

  const escalationCount = candidates.filter((c) => c.escalate).length;

  return { candidates, escalationCount };
}
