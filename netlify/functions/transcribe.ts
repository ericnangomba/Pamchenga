import type { Config } from "@netlify/functions";
import { createHostedWhisperHandler } from "../lib/hosted-whisper";
export default async (request: Request): Promise<Response> =>
  createHostedWhisperHandler({
    apiKey: process.env.GROQ_API_KEY,
    accessCode: process.env.PAMCHENGA_TRANSCRIPTION_ACCESS_CODE,
  })(request);
export const config: Config = {
  path: ["/api/transcriptions", "/api/transcriptions/health"],
  rateLimit: {
    windowSize: 60,
    windowLimit: 10,
    aggregateBy: ["ip"],
    action: "rate_limit",
  },
};
