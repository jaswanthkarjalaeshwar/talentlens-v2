# TalentLens v2

> New to multi-agent systems or evaluating this from a product/strategy lens? [README-strategist.md](./README-strategist.md) covers the same ground in plain English — including the architecture, the eval story, and the design decisions behind the system.

Production-grade multi-agent candidate screening system. Scores resumes 
against job descriptions using parallel agent execution, deterministic 
business rule enforcement, and an eval suite with LLM-as-judge scoring.

## Architecture

```
[Job Description] ──→ JD Parser Agent (tool_use, cached)
                              │
[Resumes] ──→ PII Scrubber ──→ Coordinator (ReAct loop)
                              │
              ┌───────────────┼───────────────┐
              ↓               ↓               ↓
        Resume Agent 1  Resume Agent 2  Resume Agent N
              └───────────────┼───────────────┘
                        (Promise.all)
                              │
                        Verdict Enforcer
                    (deterministic rule layer)
                              │
                        Ranker Agent
                    (cross-candidate synthesis)
                              │
                    Human Review Checkpoint
                    (confidence < 0.85 → escalate)
                              │
                  ┌───────────┴───────────┐
                  ↓                       ↓
             Eval Logger            Ranked Shortlist
            (SQLite)                (JSON output)
```

Two verdict layers — the model handles nuanced judgment, deterministic 
code enforces hard business rules. The boundary was drawn by the eval 
suite, not by assumption.

## Output contract

Every candidate in a run returns:

```json
{
  "run_id": "uuid",
  "jd_id": "sha256-first-12-chars",
  "screened_at": "2026-06-21T13:27:15Z",
  "model_version": "claude-sonnet-4-6",
  "candidates": [
    {
      "id": "candidate-id",
      "rank": 1,
      "overall_fit": 0.91,
      "verdict": "strong_yes",
      "confidence": 0.94,
      "escalate": false,
      "scores": {
        "skills_match": 0.94,
        "experience_relevance": 0.88,
        "culture_signal": 0.91
      },
      "strengths": [],
      "gaps": [],
      "reasoning": "...",
      "enforcer_applied": false,
      "pii_stripped": true,
      "tokens_used": 1840
    }
  ],
  "total_candidates": 4,
  "escalation_count": 1
}
```

## Eval suite

Golden dataset of 6 canonical cases covering: strong match, sparse resume, 
adjacent domain, clear mismatch, overqualification, and sparse-but-evidenced.

LLM-as-judge scores reasoning quality 0.0–1.0 per case. Results logged to 
SQLite for drift detection across prompt versions.

| Iteration | Change | Verdicts | Avg reasoning |
|-----------|--------|----------|---------------|
| Run 1 | Baseline | 2/5 | 0.78 |
| Run 2 | Production rubric + overqualification rule | 3/5 | 0.82 |
| Run 3 | Moved hard rules to deterministic enforcer | 3/5 | 0.82 |
| Run 4 | Corrected gold_002 label error, added gold_006 | 5/6 | 0.87 |

Run 3 held at 3/5 but was the critical architectural decision: the eval 
identified where prompt instructions were being interpreted inconsistently 
and where deterministic code enforcement was the correct solution.

## Stack

- Node.js + TypeScript
- Anthropic SDK (claude-sonnet-4-6)
- Zod — runtime schema validation on all agent outputs
- SQLite (sql.js) — eval logging and run history
- dotenv

## Usage

```bash
# Install
npm install

# Add your API key
echo ANTHROPIC_API_KEY=your-key > .env
echo MODEL_VERSION=claude-sonnet-4-6 >> .env
echo DB_PATH=./talentlens.db >> .env

# Screen candidates
node dist/index.js --jd data/jd.txt --resumes data/resumes.txt

# Run eval suite
node dist/index.js --eval
```

Resume delimiter format in resumes.txt:
```
---CANDIDATE:alice-chen---
[resume text]
---CANDIDATE:ben-okafor---
[resume text]
```

## Key design decisions

**Parallel execution** — resume agents run concurrently via Promise.all. 
JD is parsed once and cached. Cost scales with candidate count, not run count.

**PII scrubbing before scoring** — name, email, phone, and LinkedIn stripped 
before any agent sees the resume. Reduces demographic bias signal in scoring.

**Confidence separate from fit** — a candidate can score 0.87 fit with 0.72 
confidence. Escalation fires on confidence, not fit. Low confidence means 
incomplete information, not a weak candidate.

**Deterministic enforcer layer** — hard business rules (domain gap + skills 
gap disqualifies, overqualification detection) are enforced in code after 
model scoring. Prompt handles judgment. Code handles rules.

**jd_id as content hash** — SHA-256 of JD text, first 12 chars. Same role 
re-run with edited JD produces a different jd_id, enabling eval drift 
detection across JD versions.
