export const CONTACT_REASONS = {
  GENERAL: "general",
  TECHNICAL: "technical",
  BILLING: "billing",
  FEEDBACK: "feedback",
  REPORT: "report",
  OTHER: "other",
};

export const CONTACT_REASONS_ARRAY = Object.values(CONTACT_REASONS);

export const CONTACT_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

export const CONTACT_PRIORITY_ARRAY = Object.values(CONTACT_PRIORITY);

export const CONTACT_STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
  SPAM: "spam",
};

export const CONTACT_STATUS_ARRAY = Object.values(CONTACT_STATUS);

export const CONTACT_ASSIGNABLE_ADMIN_ROLES = ["admin", "marketing_rep"];

export const CONTACT_EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
