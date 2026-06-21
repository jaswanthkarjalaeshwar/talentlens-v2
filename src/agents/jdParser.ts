import Anthropic from "@anthropic-ai/sdk";
import { JDCriteriaSchema, type JDCriteria } from "../schemas/index.js";

const client = new Anthropic();

const PARSE_JD_TOOL: Anthropic.Tool = {
  name: "parse_job_description",
  description:
    "Extract structured hiring criteria from a job description text.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Job title" },
      required_skills: {
        type: "array",
        items: { type: "string" },
        description: "Must-have technical or domain skills",
      },
      preferred_skills: {
        type: "array",
        items: { type: "string" },
        description: "Nice-to-have skills",
      },
      min_years_experience: {
        type: "integer",
        description: "Minimum years of relevant experience required",
      },
      responsibilities: {
        type: "array",
        items: { type: "string" },
        description: "Key job responsibilities",
      },
      culture_indicators: {
        type: "array",
        items: { type: "string" },
        description:
          "Values, working style, or cultural signals mentioned in the JD",
      },
      seniority_level: {
        type: "string",
        enum: ["junior", "mid", "senior", "staff", "principal", "executive"],
        description: "Inferred seniority level",
      },
      domain: {
        type: "string",
        description:
          "Primary business domain (e.g., 'product management', 'software engineering')",
      },
    },
    required: [
      "title",
      "required_skills",
      "preferred_skills",
      "min_years_experience",
      "responsibilities",
      "culture_indicators",
      "seniority_level",
      "domain",
    ],
    additionalProperties: false,
  },
};

// Simple in-process cache keyed on the JD text hash
const jdCache = new Map<string, JDCriteria>();

function hashText(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return String(h >>> 0);
}

export async function parseJobDescription(jdText: string): Promise<JDCriteria> {
  const key = hashText(jdText);
  const cached = jdCache.get(key);
  if (cached) return cached;

  const response = await client.messages.create({
    model: process.env["MODEL_VERSION"] ?? "claude-sonnet-4-6",
    max_tokens: 2048,
    tool_choice: { type: "tool", name: "parse_job_description" },
    tools: [PARSE_JD_TOOL],
    system:
      "You are an expert technical recruiter. Extract structured hiring criteria from job descriptions faithfully. Do not infer skills or requirements that are not stated or strongly implied.",
    messages: [
      {
        role: "user",
        content: `Parse the following job description and extract structured hiring criteria:\n\n${jdText}`,
      },
    ],
  });

  const toolUseBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUseBlock) {
    throw new Error("JD Parser: model did not return a tool_use block");
  }

  const parsed = JDCriteriaSchema.parse(toolUseBlock.input);
  jdCache.set(key, parsed);
  return parsed;
}
