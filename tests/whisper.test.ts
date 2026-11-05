import { test } from "node:test";
import assert from "node:assert/strict";
import { validateWhisperResponse } from "../public/whisper-result.js";
const job = { id: "job", model: "turbo" };
const story = { audioSha256: "original" };
const payload = {
  id: "job",
  model: "turbo",
  audioSha256: "original",
  status: "completed",
  result: {
    id: "job",
    model: "turbo",
    audioSha256: "original",
    text: "Iro nwanụ!",
    language: "yo",
    createdAt: "2026-11-05T00:00:00Z",
    segments: [{ start: 0, end: 1, text: "Iro nwanụ!" }],
  },
};
test("Whisper results preserve native text and bind to the original job/audio/model", () => {
  assert.equal(
    validateWhisperResponse(payload, job, story).result.text,
    "Iro nwanụ!",
  );
  for (const invalid of [
    { ...payload, id: "other" },
    { ...payload, audioSha256: "other" },
    { ...payload, model: "large-v3" },
    { ...payload, status: "invented" },
  ])
    assert.throws(() => validateWhisperResponse(invalid, job, story));
});
test("Malformed result payloads and timestamp ordering cannot become saved transcripts", () => {
  for (const changes of [
    { segments: [{ start: -1, end: 1, text: "bad" }] },
    { segments: [{ start: 2, end: 1, text: "bad" }] },
    { createdAt: "bad" },
    { text: null },
    { audioSha256: "other" },
    {
      segments: [
        { start: 2, end: 3, text: "two" },
        { start: 1, end: 2, text: "one" },
      ],
    },
  ])
    assert.throws(() =>
      validateWhisperResponse(
        { ...payload, result: { ...payload.result, ...changes } },
        job,
        story,
      ),
    );
});
