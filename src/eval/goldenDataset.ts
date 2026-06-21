import type { JDCriteria } from "../schemas/index.js";

export interface GoldenCase {
  id: string;
  jd: JDCriteria;
  resume: string;
  expected_verdict: "strong_yes" | "yes" | "no" | "strong_no";
  expected_fit_range: [number, number];
  notes: string;
}

const SENIOR_PM_AI_JD: JDCriteria = {
  title: "Senior Product Manager, ML Platform",
  domain: "machine learning infrastructure",
  seniority_level: "senior",
  min_years_experience: 5,
  required_skills: [
    "ML lifecycle understanding (training, deployment, monitoring)",
    "API or SDK product ownership",
    "SQL and data analysis",
    "cross-functional leadership",
    "executive communication",
    "A/B testing and product analytics",
  ],
  preferred_skills: [
    "cloud ML platforms (SageMaker, Vertex AI, or Azure ML)",
    "feature stores or experiment tracking (MLflow, W&B)",
    "model serving frameworks",
    "MBA or graduate degree in quantitative field",
  ],
  responsibilities: [
    "Own roadmap for the ML Platform used by data scientists and ML engineers",
    "Define API and SDK contracts for developer-facing tooling",
    "Drive cross-functional alignment across Engineering, Data Science, and GTM",
    "Communicate product strategy and roadmap to VP/C-suite",
    "Define and track success metrics for platform adoption and developer productivity",
    "Mentor junior PMs on the team",
  ],
  culture_indicators: [
    "bias to action",
    "data-driven decision-making",
    "strong ownership of outcomes not just outputs",
    "low-ego collaboration",
  ],
};

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: "gold_001",
    jd: SENIOR_PM_AI_JD,
    expected_verdict: "strong_yes",
    expected_fit_range: [0.85, 1.0],
    notes:
      "Near-perfect match: 7 years PM, 4 years direct ML platform ownership, all required skills demonstrated with quantified outcomes. Tests that the model correctly identifies a clear strong hire.",
    resume: `WORK EXPERIENCE

Senior Product Manager, Machine Learning Platform — TechFlow Analytics (2020–present)
- Owned end-to-end product roadmap for the ML Platform serving 80 data scientists and 40 ML engineers
- Defined API contract and Python SDK for the internal feature store; cut feature deployment time from 10 days to 2 days
- Led cross-functional squad of 14 (12 engineers, 2 data scientists) to ship model serving infrastructure on AWS SageMaker; platform now handles 2M+ daily predictions
- Established experiment tracking with MLflow and Weights & Biases; reduced model iteration cycle from 3 weeks to 6 days
- Drove A/B testing framework adoption across 6 product lines; wrote SQL-based metrics dashboards reviewed by VP Data weekly
- Wrote quarterly roadmap briefs presented to CTO and VP Engineering; secured funding approval for 2 consecutive annual investment cycles
- Mentored 2 junior PMs on platform product methodology and PRD writing

Product Manager, Developer Infrastructure — BuildCore (2017–2020)
- Managed developer-facing CI/CD API product used by 300+ engineers
- Defined and shipped 3 SDK versions with full backwards compatibility; internal developer NPS improved from 22 to 61
- Authored all PRDs for major initiatives; maintained documentation across 4 engineering teams
- Ran A/B tests on API onboarding flows; 28% improvement in API activation rate

SKILLS
Python (proficient), SQL (advanced), AWS SageMaker, MLflow, Weights & Biases, Kubernetes, Figma, Amplitude

EDUCATION
M.S. Computer Science, Carnegie Mellon University (2016)
B.S. Electrical Engineering, UC Berkeley (2014)`,
  },

  {
    id: "gold_002",
    jd: SENIOR_PM_AI_JD,
    expected_verdict: "no",
    expected_fit_range: [0.40, 0.62],
    notes:
      "Tests sparse resume with underspecified skills. Correct verdict is no — mentioning skills without demonstrating them is not sufficient evidence. Confidence should be low (0.55–0.75) reflecting sparsity, but verdict should reflect the actual evidence present.",
    resume: `EXPERIENCE

Product Manager, AI Platform
[employer and dates not listed]
Responsible for ML infrastructure product improvements. Worked closely with data scientists and ML engineers to improve model deployment and experiment tracking workflows. Led cross-functional planning between the platform team and model development teams. Familiar with AWS-based infrastructure and internal API tooling.

PM, Data Platform — [COMPANY REDACTED] (2019–2022)
Managed roadmap for data pipeline and internal API tooling. Collaborated with engineering leads on quarterly planning. Ran stakeholder reviews with technical leadership.

SKILLS
SQL, Python (some experience), AWS, product roadmaps, stakeholder management, Jira

EDUCATION
B.S. Computer Science`,
  },

  {
    id: "gold_003",
    jd: SENIOR_PM_AI_JD,
    expected_verdict: "no",
    expected_fit_range: [0.25, 0.55],
    notes:
      "Adjacent domain (enterprise BI / analytics tooling): strong PM seniority and data skills, but zero ML lifecycle experience, no model deployment or serving background, no MLflow/SageMaker. Tests that the model correctly detects a domain mismatch despite surface-level similarity.",
    resume: `WORK EXPERIENCE

Senior Product Manager, Data Intelligence Platform — AnalyticsCo (2020–present)
- Owned product roadmap for enterprise BI platform built on Tableau and Looker serving 340 enterprise accounts
- Managed REST API integrations enabling customers to embed dashboards and programmatically query datasets
- Led 3 major product launches that grew ARR from $4M to $11M
- Partnered with data engineering team on dbt transformation pipelines and Snowflake optimisations
- Wrote monthly executive product updates reviewed by CEO and COO; presented at two industry analytics conferences
- Used SQL daily for funnel analysis, cohort modelling, and feature adoption tracking
- Mentored 1 associate PM on roadmap and stakeholder management practices

Product Manager, Analytics Tooling — DataWorks (2018–2020)
- Managed self-serve reporting product for 500 internal business analysts
- Ran A/B tests on report creation UX; reduced time-to-first-report by 40%
- Worked with engineering on data access API design and documentation

SKILLS
SQL (expert), Tableau, Looker, dbt, Snowflake, Python (basic scripting), Figma, Amplitude, Jira

EDUCATION
B.S. Statistics, University of Michigan (2017)`,
  },

  {
    id: "gold_004",
    jd: SENIOR_PM_AI_JD,
    expected_verdict: "strong_no",
    expected_fit_range: [0.0, 0.20],
    notes:
      "Clear mismatch: ~2 years total PM experience on a consumer fitness app, no technical skills, no ML awareness, no platform experience. Tests that the model does not over-credit enthusiasm or superficial AI interest.",
    resume: `EXPERIENCE

Product Manager — FitPulse Mobile App (2024–present)
- Own roadmap for workout tracking and social features for a consumer fitness app with 50K users
- Running A/B tests on onboarding flow to improve D7 retention; current lift is +8%
- Coordinate weekly with 2 iOS engineers and 1 designer; run sprint ceremonies

Product Analyst Intern — RetailBrand (Summer 2023)
- Built Tableau dashboards for the marketing team
- Pulled ad-hoc data from MySQL using basic SELECT queries

SKILLS
Figma, Amplitude, Notion, basic SQL (self-taught via online course), iOS product intuition

EDUCATION
B.A. Communications, Arizona State University (2023)

INTERESTS
Passionate about AI and excited to break into AI product roles. Built a personal project using the ChatGPT API to generate workout plans.`,
  },

  {
    id: "gold_005",
    jd: SENIOR_PM_AI_JD,
    expected_verdict: "no",
    expected_fit_range: [0.30, 0.65],
    notes:
      "Overqualified VP edge case: 16 years experience, all required and preferred skills are present, but candidate is currently a VP managing 8 PMs with P&L responsibility. Applying for an IC Senior PM role. Tests seniority-mismatch detection when skills are a strong match — the model must penalise the wrong direction of seniority.",
    resume: `WORK EXPERIENCE

VP of Product, AI & Data Division — EnterpriseAI Corp (2021–present)
- Lead product strategy for the company's AI/ML infrastructure platform serving 600+ enterprise clients
- Manage and mentor a team of 8 product managers across 3 product squads
- Own $12M annual product investment budget; report directly to the CPO; present quarterly to the board of directors
- Drove launch of the company's MLOps platform (feature store, model registry, experiment tracking via MLflow and W&B); platform processes 500M daily model inferences on AWS SageMaker
- Secured executive alignment for 3-year AI platform roadmap spanning 6 business units
- Led GCP Vertex AI and AWS SageMaker integration programmes; defined SDK and API standards across the AI division

Director of Product Management, ML Platform — ScaleAI Ventures (2018–2021)
- Grew ML Platform product line from $0 to $8M ARR in 28 months
- Managed 4 PMs; defined SDK and API strategy for developer-facing ML tooling
- Ran quarterly A/B testing reviews across all platform products; built SQL-based metrics infrastructure used by 15 data scientists

Senior Product Manager, Developer Tools — CloudPlatform Inc. (2015–2018)
- Owned external API platform product; 200+ enterprise developers integrating monthly
- Defined Python and Go SDK standards adopted across the engineering organisation
- Authored weekly briefings for CTO and VP Engineering on API adoption metrics

Product Manager — DataCore (2012–2015)
- Early PM at a data infrastructure startup; shipped 5 major product releases over 3 years

SKILLS
Python (expert), SQL (expert), MLflow, Weights & Biases, AWS SageMaker, GCP Vertex AI, Kubernetes, Terraform, executive stakeholder management, P&L ownership, team leadership (8 direct reports currently)

EDUCATION
MBA, Stanford Graduate School of Business (2012)
M.S. Computer Science (Machine Learning specialisation), MIT (2009)
B.S. Computer Science, Caltech (2007)`,
  },

  {
    id: "gold_006",
    jd: SENIOR_PM_AI_JD,
    expected_verdict: "yes",
    expected_fit_range: [0.65, 0.82],
    notes:
      "Tests that sparsity alone doesn't disqualify. Evidence is thin but every claim is demonstrated, not just listed. Correct verdict is yes with low confidence. Contrast with gold_002 where skills are mentioned but not evidenced.",
    resume: `EXPERIENCE

Product Manager, AI Platform — Meridian AI (2021–present)
Sole PM for ML experimentation and model serving infrastructure, working with 18 data scientists and 6 ML engineers.
- Shipped MLflow-based experiment tracking integration; model iteration cycle dropped from 14 days to 3 days (measured across 15 model releases over 6 months)
- Defined REST API schema and Python SDK for the internal feature store; 4 data science teams onboarded within 30 days of v1 launch, zero breaking changes across 3 minor versions shipped
- Wrote PRD and led launch of automated model monitoring dashboard; silent-failure production incidents fell from 6/month to 1/month over 90 days post-launch
- Ran A/B test on model deployment pipeline UX (n=22 engineers, 3-week experiment); 34% reduction in failed deployments
- Presented quarterly platform roadmap to VP Engineering and CTO; all 4 budget requests approved

Senior Associate PM — DataSync Corp (2018–2021)
Shipped 3 major releases for a B2B SaaS data pipeline product used by 600 enterprise customers. Wrote PRDs, ran sprint planning, and managed stakeholder reviews with engineering leads and sales.

SKILLS
SQL (proficient), Python (scripting), MLflow, REST API design, AWS S3 and Lambda (basics), Jira

EDUCATION
B.S. Computer Science, University of Washington (2018)`,
  },
];
