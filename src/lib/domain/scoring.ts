import type { Finding, ReviewAction, ReviewStatus, RiskLevel, Severity } from "./types";

// Illustrative, not statistically calibrated. A single high-severity finding (e.g. an exact duplicate or a changed
// bank account) is enough to reach "high"; a single medium finding reaches "medium". Show findings beside the score.
const POINTS: Record<Severity, number> = { high: 40, medium: 18, low: 6 };

export function scoreFindings(findings: Pick<Finding, "severity">[]): { score: number; level: RiskLevel } {
  const score = Math.min(100, findings.reduce((sum, f) => sum + POINTS[f.severity], 0));
  return { score, level: levelForScore(score) };
}

export function levelForScore(score: number): RiskLevel {
  if (score >= 70) return "critical";
  if (score >= 40) return "high";
  if (score >= 15) return "medium";
  return "low";
}

export const RISK_LABEL: Record<RiskLevel, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
export const SEVERITY_LABEL: Record<Severity, string> = { low: "Low", medium: "Medium", high: "High" };

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending_analysis: "Analyzing",
  needs_review: "Needs review",
  in_review: "In review",
  reviewed: "Reviewed",
  flagged: "Flagged",
  cleared: "Flag cleared",
};

/** Allowed review transitions: current status → action → next status. */
const TRANSITIONS: Record<ReviewStatus, Partial<Record<ReviewAction, ReviewStatus>>> = {
  pending_analysis: {},
  needs_review: { mark_reviewed: "reviewed", flag: "flagged" },
  in_review: { mark_reviewed: "reviewed", flag: "flagged" },
  reviewed: { flag: "flagged", reopen: "needs_review" },
  flagged: { clear: "cleared", mark_reviewed: "reviewed" },
  cleared: { flag: "flagged", reopen: "needs_review" },
};

export function nextReviewStatus(current: ReviewStatus, action: ReviewAction): ReviewStatus | null {
  return TRANSITIONS[current]?.[action] ?? null;
}

export function availableActions(current: ReviewStatus): ReviewAction[] {
  return Object.keys(TRANSITIONS[current] ?? {}) as ReviewAction[];
}

/** Actions that must carry a reviewer note. */
export const NOTE_REQUIRED: ReviewAction[] = ["flag", "clear", "reopen"];
