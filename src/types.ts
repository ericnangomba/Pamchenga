export type Region = "Southern Africa" | "East Africa" | "West Africa";
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
