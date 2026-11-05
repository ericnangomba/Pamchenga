import { createHash, timingSafeEqual } from "node:crypto";
import { validateWhisperResponse } from "../../public/whisper-result.js";
import type { TranscriptionResult, WhisperModel } from "../../src/types";
export const HOSTED_MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_BODY_BYTES = HOSTED_MAX_AUDIO_BYTES + 64 * 1024;
const models: Record<WhisperModel, string> = {
  turbo: "whisper-large-v3-turbo",
  "large-v3": "whisper-large-v3",
};
const languages = new Set([
  "auto",
  "sw",
  "ha",
  "yo",
  "sn",
  "en",
  "af",
  "am",
  "so",
]);
const cues: Record<string, string> = {
  "Southern Africa":
    "Pamchenga! Padangokhala! Kwaphela Cosi! Pamberi ne ngano! Tilitonse! Ndaba! Dzake!",
  "East Africa": "Hadithi Hadithi! Hadithi Njoo!",
  "West Africa":
    "Tatsuniyarku ta zo! Alo o! Iro nwanụ! Leebon! Ta zo mu ji! Olo o! Iha! Leebona!",
};
export interface HostedWhisperSettings {
  apiKey?: string;
  accessCode?: string;
}
function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function equalSecret(provided: string, expected: string) {
  return timingSafeEqual(
    createHash("sha256").update(provided).digest(),
    createHash("sha256").update(expected).digest(),
  );
}
function extension(mime: string): string | undefined {
  return (
    {
      "audio/flac": "flac",
      "audio/x-flac": "flac",
      "audio/webm": "webm",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/wave": "wav",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
      "audio/ogg": "ogg",
      "video/webm": "webm",
      "video/mp4": "mp4",
    } as Record<string, string>
  )[mime.split(";")[0].trim().toLowerCase()];
}

/** Single-operator/community pilot gateway. Provider credentials never reach the browser. */
export function createHostedWhisperHandler(
  settings: HostedWhisperSettings,
  fetcher: typeof fetch = fetch,
) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const configured =
      !!settings.apiKey &&
      !!settings.accessCode &&
      /^[\x21-\x7e]{16,128}$/.test(settings.accessCode);
    if (request.method === "GET" && url.pathname.endsWith("/health"))
      return json(200, {
        service: "pamchenga-hosted-whisper",
        provider: "groq",
        configured,
        models: Object.keys(models),
        maxAudioBytes: HOSTED_MAX_AUDIO_BYTES,
      });
    if (request.method !== "POST")
      return json(405, { error: "Use POST to request transcription." });
    if (!configured)
      return json(503, {
        error:
          "The site operator must configure the hosted transcription secrets.",
      });
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin)
      return json(403, { error: "Use the same-origin Pamchenga app." });
    const access = request.headers.get("X-Pamchenga-Access-Code") ?? "";
    if (access.length > 256 || !equalSecret(access, settings.accessCode!))
      return json(401, {
        error: "A valid transcription access code is required.",
      });
    if (
      !request.headers
        .get("Content-Type")
        ?.toLowerCase()
        .startsWith("multipart/form-data")
    )
      return json(400, {
        error: "Send original audio using multipart form data.",
      });
    const declared = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES)
      return json(413, {
        error:
          "Hosted transcription accepts original audio up to 4 MiB. Your recording is not cropped.",
      });
    let form: FormData;
    try {
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > MAX_BODY_BYTES)
        return json(413, {
          error: "Hosted transcription accepts original audio up to 4 MiB.",
        });
      form = await new Request(url, {
        method: "POST",
        headers: { "Content-Type": request.headers.get("Content-Type")! },
        body: bytes,
      }).formData();
    } catch {
      return json(400, { error: "Invalid audio upload." });
    }
    const audio = form.get("audio");
    const id = form.get("job_id"),
      audioSha256 = form.get("audio_sha256"),
      model = form.get("model");
    const language = form.get("language") ?? "auto",
      region = form.get("region"),
      hint = form.get("prompt") ?? "";
    if (!(audio instanceof Blob) || !audio.size)
      return json(422, { error: "Original audio is required." });
    if (audio.size > HOSTED_MAX_AUDIO_BYTES)
      return json(413, {
        error:
          "This recording exceeds the 4 MiB hosted limit. The original stays on your device.",
      });
    if (
      typeof id !== "string" ||
      !/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(
        id,
      ) ||
      typeof audioSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(audioSha256) ||
      typeof model !== "string" ||
      !Object.hasOwn(models, model) ||
      typeof language !== "string" ||
      !languages.has(language) ||
      typeof region !== "string" ||
      !Object.hasOwn(cues, region) ||
      typeof hint !== "string"
    )
      return json(422, {
        error: "Invalid job, model, language hint or region.",
      });
    const suffix = extension(audio.type);
    if (!suffix)
      return json(422, {
        error: "Use FLAC, MP3, MP4/M4A, OGG, WAV or WebM audio.",
      });
    const original = await audio.arrayBuffer();
    if (
      createHash("sha256").update(new Uint8Array(original)).digest("hex") !==
      audioSha256
    )
      return json(422, { error: "Original audio SHA-256 mismatch." });
    const prompt = `${cues[region]} ${hint.trim()}`.trim();
    // UTF-8 bytes bound the number of byte-pair tokens conservatively. Never cut native text.
    if (new TextEncoder().encode(prompt).length > 224)
      return json(422, {
        error:
          "Spelling cues are too long for hosted transcription. Use only a few names or words.",
      });
    const outbound = new FormData();
    outbound.append(
      "file",
      new Blob([original], { type: audio.type }),
      `original.${suffix}`,
    );
    outbound.append("model", models[model as WhisperModel]);
    outbound.append("response_format", "verbose_json");
    outbound.append("timestamp_granularities[]", "segment");
    outbound.append("temperature", "0");
    outbound.append("prompt", prompt);
    if (language !== "auto") outbound.append("language", language);
    let response: Response;
    try {
      response = await fetcher(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${settings.apiKey}` },
          body: outbound,
          signal: AbortSignal.timeout(45000),
        },
      );
    } catch {
      return json(504, {
        error:
          "The hosted Whisper request timed out or could not connect. Your original remains local; retries can incur provider charges.",
      });
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        return json(503, {
          error: "The operator must check the hosted provider API credentials.",
        });
      if (response.status === 429)
        return json(429, {
          error:
            "Hosted transcription rate limit reached. The queue will retry.",
        });
      if (response.status >= 500)
        return json(503, {
          error: "Hosted transcription is temporarily unavailable.",
        });
      return json(422, {
        error:
          "The provider rejected the recording or spelling cues. Review its format and try again.",
      });
    }
    try {
      const value: unknown = await response.json();
      if (!value || typeof value !== "object")
        throw Error("Invalid provider response");
      const raw = value as Record<string, unknown>;
      const result = {
        id,
        model: model as WhisperModel,
        audioSha256,
        text: raw.text,
        language: raw.language,
        segments: raw.segments,
        createdAt: new Date().toISOString(),
      } as TranscriptionResult;
      const payload = { id, model, audioSha256, status: "completed", result };
      validateWhisperResponse(payload, { id, model }, { audioSha256 });
      return json(200, payload);
    } catch {
      return json(502, {
        error:
          "The provider returned an invalid transcript. No generated text has been saved.",
        code: "INVALID_TRANSCRIPT",
      });
    }
  };
}
