export type Region = "Southern Africa" | "East Africa" | "West Africa";
export type ConsentUse = "record" | "store" | "share" | "backup" | "teach" | "commercial";
export interface ConsentRecord {
  version: 1;
  giver: string;
  role: "storyteller" | "authorized-representative";
  recordedAt: string;
  permissions: Record<ConsentUse, boolean>;
  notes?: string;
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
  learning?: LearningCard;
  transcription?: TranscriptionResult;
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
