import type { RawCandidate, ScrubbedCandidate } from "../schemas/index.js";

// Patterns for common PII fields
const PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  // Email addresses
  {
    name: "email",
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[EMAIL REDACTED]",
  },
  // US/international phone numbers (various formats)
  {
    name: "phone",
    pattern:
      /(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,5})?/g,
    replacement: "[PHONE REDACTED]",
  },
  // LinkedIn profile URLs
  {
    name: "linkedin",
    pattern: /https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/gi,
    replacement: "[LINKEDIN REDACTED]",
  },
  // GitHub profile URLs
  {
    name: "github",
    pattern: /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9\-]+\/?/gi,
    replacement: "[GITHUB REDACTED]",
  },
  // Personal website / portfolio patterns (simple heuristic)
  {
    name: "website",
    pattern: /https?:\/\/(?:www\.)?[A-Za-z0-9\-]+\.(?:io|me|com|net|co)\/?(?:\s|$)/gi,
    replacement: "[WEBSITE REDACTED]",
  },
  // Candidate name in common resume header formats:
  // "Name: John Smith" or lines that look like a standalone proper name at the top
  // We remove lines that match "FirstName LastName" at the very start (heuristic)
  {
    name: "name_label",
    pattern: /^(?:Name|Applicant|Candidate)\s*:\s*.+$/gim,
    replacement: "[NAME REDACTED]",
  },
  // Address lines (number + street)
  {
    name: "address",
    pattern: /\b\d{1,5}\s+[A-Za-z0-9\s.,']{5,40}(?:Street|St|Avenue|Ave|Road|Rd|Blvd|Boulevard|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\b/gi,
    replacement: "[ADDRESS REDACTED]",
  },
];

export function scrubPII(raw: RawCandidate): ScrubbedCandidate {
  let text = raw.resumeText;
  let stripped = false;

  for (const { pattern, replacement } of PII_PATTERNS) {
    const before = text;
    text = text.replace(pattern, replacement);
    if (text !== before) stripped = true;
  }

  return {
    id: raw.id,
    scrubbedText: text,
    pii_stripped: stripped,
  };
}

export function scrubAllPII(raws: RawCandidate[]): ScrubbedCandidate[] {
  return raws.map(scrubPII);
}
