export type Region =
  "Southern Africa" | "East Africa" | "Central Africa" | "West Africa";
export type ConsentUse =
  "record" | "store" | "share" | "backup" | "teach" | "commercial";
export interface ConsentRecord {
  version: 1 | 2;
  giver: string;
  role: "storyteller" | "authorized-representative";
  recordedAt: string;
  permissions: Record<ConsentUse, boolean>;
  notes?: string;
  attribution?: string;
  benefitConditions?: string;
  commercialAgreement?: {
    parties: string;
    agreedAt: string;
    terms: string;
  };
  licenseAuthorization?: {
    license: "CC BY-NC-SA 4.0";
    recordedAt: string;
    attestedBy: string;
  };
  migratedFromVersion?: 1;
}
export interface Story {
  id: string;
  title: string;
  storyteller: string;
  location: string;
  language: string;
  region: Region;
  license: "CC BY-NC-SA 4.0" | "Community Tribal Copyright";
  createdAt: string;
  duration: number;
  audio: Blob;
  audioSha256: string;
  transcript: string;
  ritualTags?: string[];
  consent?: ConsentRecord;
  consentHistory?: ConsentRecord[];
  ownCopyExports?: {
    requestedAt: string;
    recipient: string;
    status: "download-requested";
  }[];
  learning?: LearningCard;
  transcription?: TranscriptionResult;
  review?: TranscriptReview;
}
export interface Segment {
  start: number;
  end: number;
  text: string;
}
export interface SyncJob {
  id: string;
  attempts: number;
  nextAttempt: number;
  status: "queued" | "synced";
}

export interface LearningCard {
  audience: string;
  objective: string;
  nativeProverb: string;
  meaning: string;
  discussionQuestion: string;
  activity: string;
  sessionsDelivered: number;
  classroomPermission: boolean;
}

export type WhisperModel = "large-v3" | "turbo";
export interface TranscriptionResult {
  id: string;
  model: WhisperModel;
  audioSha256: string;
  language: string;
  text: string;
  segments: Segment[];
  createdAt: string;
  reviewedAt?: string;
}
export interface TranscriptionJob {
  id: string;
  storyId: string;
  model: WhisperModel;
  language: string;
  prompt: string;
  status: "queued" | "running" | "completed" | "failed";
  attempts: number;
  nextAttempt: number;
  accepted: boolean;
  hosted?: boolean;
  needsAccess?: boolean;
  error?: string;
  createdAt: string;
}

export type ReviewerRole =
  "storyteller" | "authorized-representative" | "other-fluent-speaker";
export interface ReviewSegment {
  id: string;
  start: number;
  end: number;
  /** The machine draft for this span, kept for comparison. Never overwritten. */
  machineText?: string;
  text: string;
  confirmed: boolean;
  flags: { unsure: boolean; unclear: boolean; cultural: boolean };
  note?: string;
}
export interface ReviewSignoff {
  reviewer: string;
  role: ReviewerRole;
  confirmedAt: string;
  unclearCount: number;
  statement: string;
}
/** Human listen-and-correct record. A prototype: it records who checked, not that the text is correct. */
export interface TranscriptReview {
  version: 1;
  basedOn: "machine-draft" | "typed-by-reviewer";
  machineResultId?: string;
  segments: ReviewSegment[];
  updatedAt: string;
  signoff?: ReviewSignoff;
  editedSinceSignoff?: boolean;
}
