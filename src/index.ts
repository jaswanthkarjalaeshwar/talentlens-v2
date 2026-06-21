import dotenv from "dotenv";
dotenv.config();

async function main(): Promise<void> {
  console.log("TalentLens v2 — scaffold OK");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
