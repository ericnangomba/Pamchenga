import type { TranscriptionResult } from "../src/types";
export interface WhisperEnvelope {
  id: string;
  model: string;
  audioSha256: string;
  status: "queued" | "running" | "completed" | "failed";
  result?: TranscriptionResult;
}
export function validateWhisperResponse(
  payload: unknown,
  job: { id: string; model: string },
  story: { audioSha256: string },
): WhisperEnvelope;
