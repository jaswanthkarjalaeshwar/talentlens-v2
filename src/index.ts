import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { runCoordinator } from "./agents/coordinator.js";
import { rankCandidates } from "./agents/ranker.js";
import { logScreeningRun } from "./eval/logger.js";
import { runEval } from "./eval/judge.js";
import { ScreeningRunSchema } from "./schemas/index.js";
import type { RawCandidate } from "./schemas/index.js";
import { randomUUID, createHash } from "crypto";

function parseArgs(): { jd: string; resumes: string } {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  const jd = get("--jd");
  const resumes = get("--resumes");
  if (!jd || !resumes) {
    console.error("Usage: node dist/index.js --jd <jd-file> --resumes <resumes-file>");
    process.exit(1);
  }
  return { jd, resumes };
}

function loadJD(filePath: string): { id: string; text: string } {
  const text = fs.readFileSync(path.resolve(filePath), "utf-8");
  const id = createHash("sha256").update(text).digest("hex").slice(0, 12);
  return { id, text };
}

function loadResumes(filePath: string): RawCandidate[] {
  const raw = fs.readFileSync(path.resolve(filePath), "utf-8");
  // Format: candidates separated by "---CANDIDATE:<id>---" lines
  const sections = raw.split(/^---CANDIDATE:(.+?)---$/m);
  // sections: ["", id1, body1, id2, body2, ...]
  const candidates: RawCandidate[] = [];
  for (let i = 1; i < sections.length; i += 2) {
    const id = sections[i]?.trim();
    const resumeText = sections[i + 1]?.trim() ?? "";
    if (id) candidates.push({ id, resumeText });
  }
  if (candidates.length === 0) {
    console.error(
      "No candidates found. Resumes file must contain sections separated by:\n---CANDIDATE:<id>---",
    );
    process.exit(1);
  }
  return candidates;
}

async function mainScreening(): Promise<void> {
  const { jd: jdPath, resumes: resumesPath } = parseArgs();

  const jd = loadJD(jdPath);
  const candidates = loadResumes(resumesPath);

  console.log(`\nTalentLens v2`);
  console.log(`JD: ${jd.id} | Candidates: ${candidates.length}`);
  console.log(`Model: ${process.env["MODEL_VERSION"] ?? "claude-sonnet-4-6"}\n`);

  console.log("Step 1/3 — Parsing JD + scoring candidates in parallel...");
  const coordOutput = await runCoordinator({ jdId: jd.id, jdText: jd.text, candidates });

  console.log("Step 2/3 — Ranking...");
  const { candidates: ranked, escalationCount } = await rankCandidates(coordOutput.scores);

  const run = ScreeningRunSchema.parse({
    run_id: randomUUID(),
    jd_id: coordOutput.jdId,
    screened_at: coordOutput.screenedAt,
    model_version: coordOutput.modelVersion,
    candidates: ranked,
    total_candidates: ranked.length,
    escalation_count: escalationCount,
  });

  console.log("Step 3/3 — Logging to SQLite...");
  await logScreeningRun(run);

  // Print results
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  Screening Run: ${run.run_id}`);
  console.log(`  JD: ${run.jd_id} | Screened: ${run.screened_at}`);
  console.log(`  Total: ${run.total_candidates} | Escalations: ${run.escalation_count}`);
  console.log("═══════════════════════════════════════════════════════\n");

  for (const c of run.candidates) {
    const flag = c.escalate ? " ⚑ ESCALATE" : "";
    console.log(`  Rank ${c.rank}  [${c.verdict.toUpperCase().padEnd(10)}]  ${c.id}`);
    console.log(
      `    fit=${c.overall_fit.toFixed(2)}  conf=${c.confidence.toFixed(2)}  skills=${c.scores.skills_match.toFixed(2)}  exp=${c.scores.experience_relevance.toFixed(2)}  culture=${c.scores.culture_signal.toFixed(2)}${flag}`,
    );
    console.log(`    Strengths: ${c.strengths.join(" | ")}`);
    console.log(`    Gaps:      ${c.gaps.join(" | ")}`);
    console.log(`    Reasoning: ${c.reasoning}`);
    console.log();
  }

  console.log(`Run saved to ${process.env["DB_PATH"] ?? "./talentlens.db"}`);
}

async function runEvalMode(): Promise<void> {
  console.log("\nTalentLens v2 — Golden Dataset Eval");
  console.log(`Model: ${process.env["MODEL_VERSION"] ?? "claude-sonnet-4-6"}\n`);

  const results = await runEval();

  const col = (s: string, w: number) => s.padEnd(w).slice(0, w);

  console.log(`\n┌${"─".repeat(10)}┬${"─".repeat(18)}┬${"─".repeat(16)}┬${"─".repeat(14)}┬${"─".repeat(13)}┬${"─".repeat(17)}┐`);
  console.log(`│ ${col("Case", 8)} │ ${col("Expected", 16)} │ ${col("Got", 14)} │ ${col("Verdict match", 12)} │ ${col("Fit in range", 11)} │ ${col("Reasoning score", 15)} │`);
  console.log(`├${"─".repeat(10)}┼${"─".repeat(18)}┼${"─".repeat(16)}┼${"─".repeat(14)}┼${"─".repeat(13)}┼${"─".repeat(17)}┤`);

  let verdictPasses = 0;
  let fitPasses = 0;
  let totalReasoning = 0;

  for (const r of results) {
    const vm = r.verdictMatch ? "✓" : "✗";
    const fr = r.fitInRange ? "✓" : "✗";
    if (r.verdictMatch) verdictPasses++;
    if (r.fitInRange) fitPasses++;
    totalReasoning += r.reasoningScore;
    console.log(
      `│ ${col(r.caseId, 8)} │ ${col(r.expectedVerdict, 16)} │ ${col(r.gotVerdict, 14)} │ ${col(vm, 12)} │ ${col(fr, 11)} │ ${col(r.reasoningScore.toFixed(2), 15)} │`,
    );
  }

  console.log(`└${"─".repeat(10)}┴${"─".repeat(18)}┴${"─".repeat(16)}┴${"─".repeat(14)}┴${"─".repeat(13)}┴${"─".repeat(17)}┘`);
  console.log(`\nOverall pass rate: ${verdictPasses}/${results.length} verdicts correct, ${fitPasses}/${results.length} fit in range, avg reasoning score: ${(totalReasoning / results.length).toFixed(2)}`);

  console.log("\nJudge notes:");
  for (const r of results) {
    console.log(`  ${r.caseId}: ${r.judgeNotes}`);
  }

  console.log(`\nEval run saved to ${process.env["DB_PATH"] ?? "./talentlens.db"}`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--eval")) {
    await runEvalMode();
    return;
  }
  await mainScreening();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
