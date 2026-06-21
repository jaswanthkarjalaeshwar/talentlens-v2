import Anthropic from "@anthropic-ai/sdk";
import { ResumeAgentOutputSchema, type ResumeAgentOutput, type JDCriteria } from "../schemas/index.js";
import type { ScrubbedCandidate } from "../schemas/index.js";

const client = new Anthropic();

const SCORE_CANDIDATE_TOOL: Anthropic.Tool = {
  name: "score_candidate",
  description: "Score a candidate resume against parsed job description criteria.",
  input_schema: {
    type: "object" as const,
    properties: {
      overall_fit: {
        type: "number",
        description: "Overall fit score between 0.0 and 1.0",
      },
      verdict: {
        type: "string",
        enum: ["strong_yes", "yes", "maybe", "no", "strong_no"],
        description: "Hiring recommendation",
      },
      confidence: {
        type: "number",
        description: "Confidence in this assessment, 0.0 to 1.0",
      },
      scores: {
        type: "object",
        properties: {
          skills_match: { type: "number", description: "0.0–1.0" },
          experience_relevance: { type: "number", description: "0.0–1.0" },
          culture_signal: { type: "number", description: "0.0–1.0" },
        },
        required: ["skills_match", "experience_relevance", "culture_signal"],
        additionalProperties: false,
      },
      strengths: {
        type: "array",
        items: { type: "string" },
        description: "Top 2-4 candidate strengths relevant to this role",
      },
      gaps: {
        type: "array",
        items: { type: "string" },
        description: "Notable gaps or concerns",
      },
      reasoning: {
        type: "string",
        description: "2-3 sentence summary of the scoring rationale",
      },
    },
    required: [
      "overall_fit",
      "verdict",
      "confidence",
      "scores",
      "strengths",
      "gaps",
      "reasoning",
    ],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are a calibrated candidate screener. Your job is to score one candidate resume against a parsed job description using three dimensions. You must return scores as decimals between 0.0 and 1.0.

Scoring rubric:

skills_match — Does the candidate's demonstrated skills match the required and preferred skills in the JD?
  0.9–1.0: All required skills evidenced, most preferred skills present
  0.7–0.89: All required skills evidenced, few preferred skills
  0.5–0.69: Most required skills evidenced, gaps in 1–2 critical areas
  0.3–0.49: Partial required skills, significant gaps
  0.0–0.29: Missing most required skills

experience_relevance — Is the candidate's experience directly relevant to the role's domain, responsibilities, and seniority level?
  0.9–1.0: Domain match, seniority match, responsibilities map directly
  0.7–0.89: Domain match, seniority close, some responsibility overlap
  0.5–0.69: Adjacent domain, or seniority mismatch of 1–2 years
  0.3–0.49: Different domain but transferable skills visible
  0.0–0.29: No meaningful relevance to role

Domain adjacency guide:
  - Same domain (e.g. ML PM scoring ML PM role): no penalty
  - Adjacent domain (e.g. BI/analytics PM scoring ML PM role): cap experience_relevance at 0.75 maximum
  - Different domain (e.g. fintech PM scoring healthcare AI role): cap at 0.55
  - Unrelated domain: cap at 0.35
  Apply this cap before scoring. Do not let strong skills_match compensate for a domain cap.
  Domain cap verdict rule: if the domain adjacency cap was applied (experience_relevance capped below 0.75) AND the candidate is missing 2 or more required skills, the verdict must be no. Do not return maybe or yes. The combination of domain gap and skills gap is disqualifying regardless of culture_signal or other scores.

Seniority mismatch penalty — overqualification:
  If the candidate's most recent role seniority is more than one level above the target role (e.g. VP or Director applying for Senior IC, or Principal applying for Mid-level), apply a -0.20 penalty to experience_relevance and set verdict to no regardless of fit score. Note the seniority mismatch explicitly in gaps.

culture_signal — Does the resume evidence behaviors that match the role's culture indicators (ownership, builder mindset, cross-functional collaboration, etc.)?
  0.9–1.0: Multiple strong signals, quantified outcomes, visible ownership
  0.7–0.89: Some signals present, outcomes partially quantified
  0.5–0.69: Weak signals, mostly responsibilities listed not outcomes
  0.0–0.49: No culture signals or contradictory evidence

Confidence score — How certain are you in your scores given the evidence available?
  Start at 1.0. Deduct:
  -0.10 for each required field missing from resume (e.g. no dates, no metrics)
  -0.15 if PII scrubbing removed context that affects scoring (e.g. company names stripped)
  -0.20 if resume is sparse (under 300 words)
  Never return confidence above 0.95.
  Confidence floor: never return confidence below 0.55 solely due to resume sparsity or PII scrubbing. Low confidence should widen uncertainty, not override a verdict. If the evidence present is consistent with a verdict, hold that verdict and reflect uncertainty in confidence only.
  Sparse resume verdict guidance: if confidence is between 0.55–0.75 due to sparsity or PII scrubbing, and the skills_match score is 0.70 or above, do not return no. Return yes with the confidence score reflecting the uncertainty. A sparse resume is not evidence of poor fit — it is evidence of incomplete information. Distinguish between 'we don't know' and 'we know it's a no'.

Rules:
- Score only what is explicitly evidenced. Do not infer or assume.
- If a skill is listed without context, score it 0.1 lower than if it were demonstrated in a project or role.
- Strengths must be specific claims from the resume, not generic praise.
- Gaps must reference specific JD requirements that are unmet.
- Reasoning must explain the score, not restate the resume.`;

function buildUserPrompt(jd: JDCriteria, resume: string): string {
  return `## Job criteria
Title: ${jd.title}
Seniority: ${jd.seniority_level}
Domain: ${jd.domain}
Min experience: ${jd.min_years_experience} years
Required skills: ${jd.required_skills.join(", ")}
Preferred skills: ${jd.preferred_skills.join(", ")}
Key responsibilities: ${jd.responsibilities.join("; ")}
Culture indicators: ${jd.culture_indicators.join(", ")}

## Candidate resume (PII scrubbed)
${resume}`;
}

export async function scoreCandidate(
  candidate: ScrubbedCandidate,
  jd: JDCriteria,
): Promise<ResumeAgentOutput & { tokens_used: number }> {
  const response = await client.messages.create({
    model: process.env["MODEL_VERSION"] ?? "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tool_choice: { type: "tool", name: "score_candidate" },
    tools: [SCORE_CANDIDATE_TOOL],
    messages: [{ role: "user", content: buildUserPrompt(jd, candidate.scrubbedText) }],
  });

  const toolUseBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUseBlock) {
    throw new Error(`Resume Agent [${candidate.id}]: model did not return a tool_use block`);
  }

  const tokens_used =
    (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);

  const rawOutput = {
    id: candidate.id,
    tokens_used,
    ...(toolUseBlock.input as object),
  };

  return ResumeAgentOutputSchema.parse(rawOutput);
}
