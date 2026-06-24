## The problem it solves

Screening resumes at scale has two failure modes: too slow and too inconsistent.

The slow version is a recruiter reading 200 resumes for a technical role they 
partially understand. The inconsistent version is the same recruiter reading them 
on different days, or a different recruiter reading them, and producing a different 
shortlist.

AI screening tools exist but most have the same structural flaw: they send all 
resumes to a single model in a single call. This works for 3 candidates. At 20, 
the model starts anchoring — scoring later candidates relative to earlier ones 
rather than against the job description. The shortlist reflects the order resumes 
were read, not the quality of the candidates.

A second flaw is demographic signal. Most AI tools see the candidate's name, email 
address, university name, and LinkedIn URL before they see a single line of 
experience. These carry information that has no bearing on whether someone can do 
the job.

TalentLens was built to fix both. Every candidate is scored independently — no 
anchoring, no comparison to who came before. PII is stripped from every resume 
before any agent sees it. The score reflects the work, not the name.

---

## How it works — plain English

You give TalentLens a job description and a file of resumes. It returns a ranked 
shortlist with a score, a verdict, and written reasoning for each candidate. The 
whole process runs automatically.

**Step 1 — The job description is parsed.**
The system reads the JD and extracts what it actually requires: required skills, 
preferred skills, seniority level, domain, responsibilities, and culture indicators. 
This structured version is what every resume agent scores against — not the raw 
text, which can be ambiguous or wordy.

**Step 2 — PII is removed from every resume.**
Before any AI sees a resume, the system strips names, email addresses, phone 
numbers, LinkedIn URLs, and GitHub handles. The resume agent scores skills and 
experience. It never sees who the candidate is.

**Step 3 — All candidates are scored simultaneously.**
A separate agent runs for each candidate. Each agent scores the resume against the 
parsed JD across three dimensions: skills match, experience relevance, and culture 
signal. Each score runs from 0.0 to 1.0. Agents run in parallel — a 20-candidate 
batch takes roughly the same wall-clock time as a 4-candidate batch.

**Step 4 — Hard rules are enforced in code.**
After each agent returns its score, a deterministic rule layer checks for cases 
that should never pass: a director or VP applying for a senior individual 
contributor role, or a candidate from a different domain who is also missing most 
of the required skills. These verdicts are not left to AI judgment. They are 
enforced by code.

**Step 5 — A ranker synthesizes the full cohort.**
Once all individual scores are in, a ranker agent sees the complete set for the 
first time. It produces a final ranked shortlist with cross-candidate reasoning — 
who stands out and why, relative to the others.

**Step 6 — Low-confidence cases are flagged.**
Every score includes a confidence value. If confidence falls below 0.85 — because 
the resume was sparse, PII scrubbing removed useful context, or the evidence was 
genuinely ambiguous — the candidate is flagged for human review. The escalation 
fires on confidence, not fit. A strong candidate with an incomplete resume gets 
escalated, not rejected.

The output is a ranked list with scores, verdicts, strengths, gaps, reasoning, and 
a flag for every case that needs a human to look closer.

---

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

---

## How we know it works — the eval story

Before the system was used on real candidates, it was tested against a set 
of cases designed to fail it.

The eval suite contains six golden cases — candidates hand-crafted to 
represent the specific scenarios where AI screening systems typically go 
wrong. Each case has a known correct verdict and an expected score range. 
After every change to the system, the eval reruns and the results are 
compared against those known answers.

**The six cases:**

- A near-perfect match — senior PM, 7 years experience, all required skills 
  demonstrated with quantified outcomes
- A sparse resume — skills mentioned but not demonstrated, employer and dates 
  redacted, low evidence overall
- An adjacent domain — strong BI and analytics PM background, but zero ML 
  lifecycle experience
- A clear mismatch — 2 years experience, consumer fitness app, no technical 
  background
- An overqualified VP — every required skill present, but currently managing 8 
  PMs with P&L responsibility, applying for a senior individual contributor role
- A sparse-but-evidenced resume — short resume, but every claim is tied to a 
  specific project, metric, or outcome

These cases were chosen because they represent the hardest calls. Domain-adjacent 
is not domain-qualified. A sparse resume is not a weak candidate. Overqualification 
in the wrong direction is a real disqualifier.

**What the eval found:**

| Iteration | Change | Verdicts correct | Avg reasoning quality |
|---|---|---|---|
| Run 1 | Baseline prompt | 2/5 | 0.78 |
| Run 2 | Added domain adjacency guide, overqualification rule to rubric | 3/5 | 0.82 |
| Run 3 | Moved hard rules from prompt to deterministic code enforcer | 3/5 | 0.82 |
| Run 4 | Corrected mislabelled eval case, added sparse-but-evidenced case | 5/6 | 0.87 |

Run 3 is the most important iteration. The verdict count held at 3/5 — it did not 
improve. But it was not a failed change. The eval had identified that two rules 
were being applied inconsistently by the model from run to run. Moving them into 
deterministic code fixed the inconsistency. Without that change, the score would 
have continued to vary unpredictably depending on which run you happened to test.

Run 4 surfaced a data error. The sparse resume case had been labelled as an 
expected pass — the thinking was that a sparse resume should not be penalised. 
But the model consistently returned a fail. On review, the model was correct. 
That resume mentioned skills without demonstrating them in any project or role, 
which is not the same as a sparse-but-evidenced resume. The label was wrong, not 
the model. The case was corrected, a new case was added to test the 
sparse-but-evidenced scenario specifically, and the final run hit 5/6 verdicts 
correct with an average reasoning quality of 0.87.

The eval also scores reasoning quality separately from verdict accuracy, using a 
second AI model as a judge. A verdict can be correct for the wrong reasons — the 
reasoning quality score catches that. It is an earlier warning sign than verdict 
accuracy alone: reasoning quality below 0.7 flags a case where the system is 
reaching the right answer through flawed logic, which means the next prompt change 
might break it.

---

## What this is not

**It is not a hiring decision.**
TalentLens produces a ranked shortlist with reasoning. It does not decide who 
gets hired. Every candidate flagged for escalation still goes to a human. Every 
verdict is accompanied by the specific evidence and gaps the agent used — so a 
recruiter can agree, disagree, or override with full context.

**It is not a black box.**
Every score includes written reasoning. Every gap references a specific JD 
requirement that was unmet. Every strength is a specific claim from the resume, 
not generic praise. If the system scores a candidate low, you can read exactly 
why in plain language.

**It is not a demographic filter.**
Names, email addresses, phone numbers, LinkedIn URLs, and GitHub handles are 
stripped from every resume before scoring. The system scores work history, 
demonstrated skills, and outcomes. It does not see who the candidate is.

**It is not a static tool.**
The eval suite exists so the system can be improved without regressing. Every 
change to the scoring rubric or business rules runs against the golden dataset 
before being deployed. The eval tracks reasoning quality over time, not just 
verdict accuracy — so drift is caught before it affects real candidates.

**It is not appropriate for every role.**
The system was built for roles with clear skill requirements in the job 
description and enough resume text to score against. Sparse job descriptions 
produce unreliable parsed criteria. Roles where culture fit is the primary signal 
and technical skills are secondary require different configuration.

---

## At a glance

**What it does**
Screens and ranks candidates against a job description using parallel AI agents, 
deterministic business rule enforcement, and confidence-based human escalation.

**Input**
A job description file and a resumes file. Resumes are separated by 
`---CANDIDATE:<id>---` markers.

**Output**
A ranked shortlist. Each candidate entry includes: verdict (`strong_yes`, `yes`, 
`maybe`, `no`, `strong_no`), overall fit score (0.0–1.0), confidence score 
(0.0–1.0), three subscores (skills match, experience relevance, culture signal), 
written strengths and gaps, reasoning, and an escalation flag.

**Escalation**
Any candidate with a confidence score below 0.85 is flagged for human review. 
Escalation fires on uncertainty, not on low fit. A strong candidate with an 
incomplete resume gets a human look — not a rejection.

**PII handling**
Names, emails, phone numbers, LinkedIn, and GitHub handles are stripped before 
any agent sees the resume.

**Eval coverage**
6 golden cases: strong match, sparse resume, adjacent domain, clear mismatch, 
overqualification, sparse-but-evidenced. LLM-as-judge scores reasoning quality 
per case. All results logged to SQLite for drift detection across prompt versions.

**Current eval score**
5/6 verdicts correct. Average reasoning quality: 0.87.

**Stack**
Node.js, TypeScript, Anthropic SDK (claude-sonnet-4-6), Zod, SQLite (sql.js).

**Run time**
Wall-clock time scales with the slowest individual resume agent, not with 
candidate count. A 20-candidate batch runs in approximately the same time as a 
4-candidate batch.
