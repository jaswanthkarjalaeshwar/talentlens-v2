import type { JDCriteria, ResumeAgentOutput } from "../schemas/index.js";

// Match overqualification titles only at the start of a line (where job titles appear in resumes).
// This prevents false positives from stakeholder references like "reported to VP Engineering".
const OVERQUAL_TITLE_RE = /(?:^|\n)\s*(VP|Vice[-\s]President|Director|Principal|Head\s+of)\b/im;

export function enforceRules(
  score: ResumeAgentOutput,
  jd: JDCriteria,
  resumeText: string,
): ResumeAgentOutput & { enforcer_applied: boolean } {
  const result: ResumeAgentOutput & { enforcer_applied: boolean } = {
    ...score,
    gaps: [...score.gaps],
    enforcer_applied: false,
  };

  // Rule 1 — Domain cap verdict enforcement
  // experience_relevance ≤ 0.75 means the domain adjacency cap was applied.
  // Combining that with weak skills coverage is disqualifying.
  // overall_fit < 0.75 guard: if the model itself rates the candidate highly,
  // the individual subscores alone are not enough to disqualify.
  if (
    result.scores.experience_relevance <= 0.75 &&
    result.scores.skills_match < 0.65 &&
    result.overall_fit < 0.75 &&
    result.verdict !== "no" &&
    result.verdict !== "strong_no"
  ) {
    result.verdict = "no";
    result.gaps.push(
      "Disqualifying combination: domain adjacency cap applied and insufficient required skills coverage",
    );
    result.enforcer_applied = true;
  }

  // Rule 2 — Sparse resume floor enforcement
  // A "no" verdict driven purely by sparse evidence (low confidence) with meaningful
  // skills signal and acceptable fit should be softened to "yes".
  if (
    result.confidence < 0.75 &&
    result.scores.skills_match >= 0.60 &&
    result.verdict === "no" &&
    result.overall_fit >= 0.55
  ) {
    result.verdict = "yes";
    result.reasoning +=
      " Verdict adjusted by sparse-resume rule: insufficient negative evidence to sustain no verdict given skills signal present.";
    result.enforcer_applied = true;
  }

  // Rule 3 — Overqualification backstop
  // Code-level guard in case the prompt rule misses a VP/Director/Principal title.
  if (
    OVERQUAL_TITLE_RE.test(resumeText) &&
    (jd.seniority_level === "senior" || jd.seniority_level === "mid") &&
    result.verdict !== "no" &&
    result.verdict !== "strong_no"
  ) {
    result.verdict = "no";
    result.gaps.push("Seniority mismatch: overqualification detected");
    result.enforcer_applied = true;
  }

  return result;
}
