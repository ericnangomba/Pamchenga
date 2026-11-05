export function validateWhisperResponse(payload, job, story) {
  if (
    payload?.id !== job.id ||
    payload?.audioSha256 !== story.audioSha256 ||
    payload?.model !== job.model
  )
    throw Error("Whisper returned a mismatched job, model or audio hash.");
  if (!["queued", "running", "completed", "failed"].includes(payload.status))
    throw Error("Invalid Whisper job status.");
  if (payload.status !== "completed") return payload;
  const result = payload.result;
  if (
    !result ||
    result.id !== job.id ||
    result.model !== job.model ||
    result.audioSha256 !== story.audioSha256 ||
    typeof result.text !== "string" ||
    result.text.length > 2000000 ||
    typeof result.language !== "string" ||
    !Number.isFinite(Date.parse(result.createdAt)) ||
    !Array.isArray(result.segments) ||
    result.segments.length > 100000
  )
    throw Error("Invalid Whisper transcription result.");
  let previousStart = 0;
  for (const segment of result.segments) {
    if (
      !Number.isFinite(segment.start) ||
      !Number.isFinite(segment.end) ||
      segment.start < previousStart ||
      segment.end < segment.start ||
      typeof segment.text !== "string"
    )
      throw Error("Invalid Whisper timestamps.");
    previousStart = segment.start;
  }
  return payload;
}
