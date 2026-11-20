import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blockers,
  reviewSummary,
  signOff,
  splitSegment,
  stage,
  startReview,
  statusLine,
  updateSegment,
} from "../src/review";
import { createManifest } from "../src/agents/provenance-agent";
import type { Story } from "../src/types";
const base = {
  id: "s1",
  title: "T",
  storyteller: "Thoko",
  location: "X",
  language: "Chichewa",
  region: "Southern Africa",
  license: "Community Tribal Copyright",
  createdAt: "2026-11-20T00:00:00Z",
  duration: 20,
  audioSha256: "h",
  transcript: "",
} as Story;
const withDraft = {
  ...base,
  transcription: {
    id: "r1",
    model: "turbo",
    audioSha256: "h",
    language: "ny",
    text: "a b",
    createdAt: "x",
    segments: [
      { start: 0, end: 5, text: " first " },
      { start: 5, end: 9, text: "second" },
      { start: 9, end: 10, text: "  " },
    ],
  },
} as Story;
test("a machine draft seeds segments, keeps its text beside the person's, and skips empty ones", () => {
  const r = startReview(withDraft);
  assert.equal(r.basedOn, "machine-draft");
  assert.equal(r.segments.length, 2);
  assert.equal(r.segments[0].machineText, "first");
  assert.ok(r.segments.every((s) => !s.confirmed));
});
test("without a draft the reviewer types: one empty whole-recording segment", () => {
  const r = startReview(base);
  assert.equal(r.basedOn, "typed-by-reviewer");
  assert.equal(r.segments.length, 1);
  assert.equal(r.segments[0].end, 20);
});
test("editing a checked segment un-checks it; machine text is never overwritten", () => {
  let r = startReview(withDraft);
  const [a] = r.segments;
  r = updateSegment(r, a.id, { confirmed: true });
  assert.equal(r.segments[0].confirmed, true);
  r = updateSegment(r, a.id, { text: "corrected" });
  assert.equal(r.segments[0].confirmed, false);
  assert.equal(r.segments[0].machineText, "first");
  assert.equal(r.segments[0].text, "corrected");
});
test("an unsure flag blocks checking and confirmation; unclear is allowed but counted", () => {
  let r = startReview(withDraft);
  for (const s of r.segments) r = updateSegment(r, s.id, { confirmed: true });
  assert.deepEqual(blockers(r), []);
  r = updateSegment(r, r.segments[0].id, { flags: { unsure: true } });
  assert.equal(r.segments[0].confirmed, false);
  assert.match(blockers(r).join(), /unsure/);
  assert.throws(() => signOff(r, "Thoko", "storyteller", true), /Not ready/);
  r = updateSegment(r, r.segments[0].id, {
    flags: { unsure: false, unclear: true },
  });
  r = updateSegment(r, r.segments[0].id, { confirmed: true });
  const done = signOff(r, "Thoko", "storyteller", true);
  assert.equal(done.signoff?.unclearCount, 1);
});
test("sign-off needs a name and the listened-to-all statement", () => {
  let r = startReview(withDraft);
  for (const s of r.segments) r = updateSegment(r, s.id, { confirmed: true });
  assert.throws(() => signOff(r, "  ", "storyteller", true), /name/);
  assert.throws(() => signOff(r, "Thoko", "storyteller", false), /listened/);
});
test("editing after sign-off clears it and says so", () => {
  let r = startReview(withDraft);
  for (const s of r.segments) r = updateSegment(r, s.id, { confirmed: true });
  r = signOff(r, "Thoko", "storyteller", true);
  const story = { ...withDraft, review: r } as Story;
  assert.equal(stage(story), "confirmed");
  r = updateSegment(r, r.segments[0].id, { text: "changed" });
  assert.equal(r.signoff, undefined);
  assert.equal(
    stage({ ...withDraft, review: r } as Story),
    "edited-after-confirmation",
  );
});
test("split creates an empty unchecked second half and ignores edge cuts", () => {
  let r = startReview(base);
  const id = r.segments[0].id;
  assert.equal(splitSegment(r, id, 0.1), r);
  r = splitSegment(r, id, 8);
  assert.equal(r.segments.length, 2);
  assert.deepEqual(
    [r.segments[0].end, r.segments[1].start, r.segments[1].end],
    [8, 8, 20],
  );
  assert.equal(r.segments[1].text, "");
});
test("status wording names who checked and never claims accuracy", () => {
  let r = startReview(withDraft);
  for (const s of r.segments) r = updateSegment(r, s.id, { confirmed: true });
  const rep = signOff(r, "Amina", "other-fluent-speaker", true);
  const line = statusLine({ ...withDraft, review: rep } as Story);
  assert.match(line, /Amina/);
  assert.match(line, /not confirmed by the storyteller/);
  assert.doesNotMatch(line, /accurate|correct|verified/i);
  assert.match(statusLine(withDraft), /not checked by a person/);
});
test("passport carries status and reviewer but never the transcript text", () => {
  let r = startReview(withDraft);
  for (const s of r.segments)
    r = updateSegment(r, s.id, { confirmed: true, text: "SECRET WORDS" });
  for (const s of r.segments) r = updateSegment(r, s.id, { confirmed: true });
  r = signOff(r, "Thoko", "storyteller", true);
  const m = createManifest({ ...withDraft, review: r } as Story) as Record<
    string,
    unknown
  >;
  const json = JSON.stringify(m);
  assert.ok(m["pam:transcriptReview"]);
  assert.doesNotMatch(json, /SECRET WORDS/);
  assert.equal(reviewSummary(r).status, "reviewer-confirmed");
  assert.equal(
    "pam:transcriptReview" in (createManifest(withDraft) as object),
    false,
  );
});
