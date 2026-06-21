import { z } from "zod";

// ── JD Parser ─────────────────────────────────────────────────────────────────

export const JDCriteriaSchema = z.object({
  title: z.string(),
  required_skills: z.array(z.string()),
  preferred_skills: z.array(z.string()),
  min_years_experience: z.number().int().nonnegative(),
  responsibilities: z.array(z.string()),
  culture_indicators: z.array(z.string()),
  seniority_level: z.enum(["junior", "mid", "senior", "staff", "principal", "executive"]),
  domain: z.string(),
});

export type JDCriteria = z.infer<typeof JDCriteriaSchema>;

// ── Candidate Scores ──────────────────────────────────────────────────────────

export const CandidateScoresSchema = z.object({
  skills_match: z.number().min(0).max(1),
  experience_relevance: z.number().min(0).max(1),
  culture_signal: z.number().min(0).max(1),
});

export type CandidateScores = z.infer<typeof CandidateScoresSchema>;

// ── Single Candidate Result ───────────────────────────────────────────────────

export const VerdictSchema = z.enum(["strong_yes", "yes", "maybe", "no", "strong_no"]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const CandidateResultSchema = z.object({
  id: z.string(),
  rank: z.number().int().positive(),
  overall_fit: z.number().min(0).max(1),
  verdict: VerdictSchema,
  confidence: z.number().min(0).max(1),
  escalate: z.boolean(),
  scores: CandidateScoresSchema,
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  reasoning: z.string(),
  human_override: z.boolean().nullable(),
  pii_stripped: z.boolean(),
  tokens_used: z.number().int().nonnegative(),
});

export type CandidateResult = z.infer<typeof CandidateResultSchema>;

// ── Raw Resume Agent Output (before ranking assigns rank) ─────────────────────

export const ResumeAgentOutputSchema = z.object({
  id: z.string(),
  overall_fit: z.number().min(0).max(1),
  verdict: VerdictSchema,
  confidence: z.number().min(0).max(1),
  scores: CandidateScoresSchema,
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  reasoning: z.string(),
  tokens_used: z.number().int().nonnegative(),
});

export type ResumeAgentOutput = z.infer<typeof ResumeAgentOutputSchema>;

// ── Final Run Output ──────────────────────────────────────────────────────────

export const ScreeningRunSchema = z.object({
  run_id: z.string().uuid(),
  jd_id: z.string(),
  screened_at: z.string().datetime(),
  model_version: z.string(),
  candidates: z.array(CandidateResultSchema),
  total_candidates: z.number().int().nonnegative(),
  escalation_count: z.number().int().nonnegative(),
});

export type ScreeningRun = z.infer<typeof ScreeningRunSchema>;

// ── Input types ───────────────────────────────────────────────────────────────

export interface RawCandidate {
  id: string;
  resumeText: string;
}

export interface ScrubbedCandidate {
  id: string;
  scrubbedText: string;
  pii_stripped: boolean;
}
