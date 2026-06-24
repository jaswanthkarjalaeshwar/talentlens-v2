## How it works — plain English

<!-- TODO -->

## How it's built — the multi-agent architecture

Most AI tools work like a single employee handed a task. TalentLens works 
like a coordinated team — multiple specialized agents, each with a defined 
job, working simultaneously under a coordinator that manages the whole 
process.

This matters because it is faster, more reliable, and easier to improve 
than a single monolithic AI call.

---

### The coordinator

Every screening run is managed by a coordinator agent that runs a 
continuous loop: decide what to do next, act, observe the result, decide 
again. This pattern — reason, act, observe — is how production AI systems 
handle multi-step work without losing track of where they are.

The coordinator's job is orchestration, not judgment. It does not score 
candidates. It parses the job description once, hands scrubbed resumes to 
resume agents, waits for all results, passes them to the ranker, and 
enforces the escalation rules. Each of those steps has a dedicated agent.

---

### Fan-out — why all candidates are scored at the same time

A traditional sequential system reads resume 1, finishes, reads resume 2, 
finishes, and so on. For 20 candidates that means 20 sequential API calls.

TalentLens uses a fan-out pattern. The coordinator fires all resume agents 
simultaneously and waits for all of them to finish before moving to the 
next step. The technical mechanism is Promise.all — a way of saying "start 
all of these at once and proceed when the last one completes."

The result: a 20-candidate batch takes roughly the same wall-clock time 
as a 4-candidate batch. Cost scales with candidate count. Time does not.

```
Coordinator
    │
    ├──→ Resume Agent (Candidate 1) ──┐
    ├──→ Resume Agent (Candidate 2) ──┤
    ├──→ Resume Agent (Candidate 3) ──┼──→ All results arrive → Ranker
    ├──→ Resume Agent (Candidate 4) ──┤
    └──→ Resume Agent (Candidate N) ──┘
              (all running simultaneously)
```

---

### Specialized agents — why each agent does one thing

The system has four distinct agent types, each with a focused job:

**JD Parser Agent**
Reads the job description and extracts structured data — required skills, 
seniority level, domain, responsibilities, culture indicators. Runs once 
per role and caches the result. Every resume agent in the batch works from 
the same parsed JD, not from re-reading the raw text each time.

**Resume Agent**
One instance per candidate. Scores a single resume against the parsed JD 
across three dimensions: skills match, experience relevance, and culture 
signal. Each instance is independent — resume agents do not see each 
other's scores. This prevents the model from anchoring on early candidates 
when scoring later ones.

**Verdict Enforcer**
Not an AI agent — a deterministic code layer that runs after each resume 
agent returns. Hard business rules that must never bend (overqualification, 
domain gap combined with skills gap) are enforced here in code, not left 
to AI judgment. The boundary between AI judgment and deterministic rules 
was drawn by the eval suite — wherever the model applied a rule 
inconsistently across runs, we moved that rule into code.

**Ranker Agent**
Receives all scored candidates after the enforcer has run. Synthesizes 
across the full cohort — not just individual scores but relative ranking, 
cross-candidate comparison, and the final shortlist with reasoning. This 
is the only agent that sees the full picture. Keeping synthesis separate 
from scoring means individual resume agents are not influenced by the 
batch they happen to be in.

---

### Why this architecture over a single AI call

A single AI call with all resumes pasted in would work for 3 candidates. 
It breaks at scale, produces inconsistent scores (later candidates 
anchored to earlier ones), and is impossible to improve incrementally — 
you cannot fix the ranker without re-running the scorer.

The multi-agent architecture is modular. Each agent has a defined input, 
a defined output schema validated by code, and can be improved 
independently. When the eval suite found that the ranker was 
overconfident on overqualified candidates, the fix was a single rule in 
the verdict enforcer — no other agent changed.

That is the practical value of multi-agent design: the system is as 
improvable as it is functional.

## How we know it works

<!-- TODO -->
