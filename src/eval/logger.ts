import initSqlJs, { type Database } from "sql.js";
import fs from "fs";
import path from "path";
import type { ScreeningRun } from "../schemas/index.js";

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();
  const dbPath = path.resolve(process.env["DB_PATH"] ?? "./talentlens.db");

  // Load existing database from disk if it exists
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS screening_runs (
      run_id        TEXT PRIMARY KEY,
      jd_id         TEXT NOT NULL,
      screened_at   TEXT NOT NULL,
      model_version TEXT NOT NULL,
      total_candidates INTEGER NOT NULL,
      escalation_count INTEGER NOT NULL,
      payload       TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS candidate_scores (
      id                   TEXT NOT NULL,
      run_id               TEXT NOT NULL,
      rank                 INTEGER NOT NULL,
      overall_fit          REAL NOT NULL,
      verdict              TEXT NOT NULL,
      confidence           REAL NOT NULL,
      escalate             INTEGER NOT NULL,
      skills_match         REAL NOT NULL,
      experience_relevance REAL NOT NULL,
      culture_signal       REAL NOT NULL,
      tokens_used          INTEGER NOT NULL,
      PRIMARY KEY (id, run_id),
      FOREIGN KEY (run_id) REFERENCES screening_runs(run_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS eval_runs (
      eval_id          TEXT PRIMARY KEY,
      case_id          TEXT NOT NULL,
      run_id           TEXT NOT NULL,
      verdict_match    INTEGER NOT NULL,
      fit_in_range     INTEGER NOT NULL,
      reasoning_score  REAL NOT NULL,
      judge_notes      TEXT NOT NULL,
      evaluated_at     TEXT NOT NULL
    )
  `);

  persistDb(dbPath);
  return db;
}

function persistDb(dbPath: string): void {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export async function logScreeningRun(run: ScreeningRun): Promise<void> {
  const database = await getDb();
  const dbPath = path.resolve(process.env["DB_PATH"] ?? "./talentlens.db");

  database.run(
    `INSERT OR REPLACE INTO screening_runs
      (run_id, jd_id, screened_at, model_version, total_candidates, escalation_count, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      run.run_id,
      run.jd_id,
      run.screened_at,
      run.model_version,
      run.total_candidates,
      run.escalation_count,
      JSON.stringify(run),
    ],
  );

  for (const c of run.candidates) {
    database.run(
      `INSERT OR REPLACE INTO candidate_scores
        (id, run_id, rank, overall_fit, verdict, confidence, escalate,
         skills_match, experience_relevance, culture_signal, tokens_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        run.run_id,
        c.rank,
        c.overall_fit,
        c.verdict,
        c.confidence,
        c.escalate ? 1 : 0,
        c.scores.skills_match,
        c.scores.experience_relevance,
        c.scores.culture_signal,
        c.tokens_used,
      ],
    );
  }

  persistDb(dbPath);
}

export interface EvalRunRecord {
  eval_id: string;
  case_id: string;
  run_id: string;
  verdict_match: boolean;
  fit_in_range: boolean;
  reasoning_score: number;
  judge_notes: string;
  evaluated_at: string;
}

export async function logEvalRun(record: EvalRunRecord): Promise<void> {
  const database = await getDb();
  const dbPath = path.resolve(process.env["DB_PATH"] ?? "./talentlens.db");

  database.run(
    `INSERT OR REPLACE INTO eval_runs
      (eval_id, case_id, run_id, verdict_match, fit_in_range, reasoning_score, judge_notes, evaluated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.eval_id,
      record.case_id,
      record.run_id,
      record.verdict_match ? 1 : 0,
      record.fit_in_range ? 1 : 0,
      record.reasoning_score,
      record.judge_notes,
      record.evaluated_at,
    ],
  );

  persistDb(dbPath);
}

export async function getRunHistory(limit = 20): Promise<ScreeningRun[]> {
  const database = await getDb();
  const result = database.exec(
    `SELECT payload FROM screening_runs ORDER BY screened_at DESC LIMIT ?`,
    [limit],
  );
  if (!result.length || !result[0]) return [];
  return result[0].values.map((row) => JSON.parse(row[0] as string) as ScreeningRun);
}
