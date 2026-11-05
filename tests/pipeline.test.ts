import { test } from "node:test";
import assert from "node:assert/strict";
import { hashAudio, createManifest } from "../src/agents/provenance-agent";
import {
  tagOpenings,
  tagTranscriptOpenings,
} from "../src/agents/opening-agent";
import type { Story } from "../src/types";
test("SHA-256 matches known bytes and preserves original audio", async () => {
  const audio = new Blob(["abc"]);
  assert.equal(
    await hashAudio(audio),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(await audio.text(), "abc");
});
test("ritual cues preserve native text and exclude late and invalid timestamps", () => {
  const text = "Iro nwanụ!";
  const tags = tagOpenings([
    { start: 1, end: 2, text },
    { start: 30, end: 33, text: "Alo o!" },
    { start: -1, end: 1, text: "Pamchenga!" },
    { start: 2, end: 1, text: "Ndaba!" },
  ]);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].text, text);
  assert.equal(tags[0].tag, "interactive_ritual_opening");
  assert.equal(
    tagOpenings([{ start: 0, end: 2, text: "Leebonathan" }]).length,
    0,
  );
});
test("unsigned passport accurately records origin without fabricated credentials", () => {
  const story = {
    id: "one",
    title: "Wisdom",
    storyteller: "Thoko",
    location: "Lilongwe",
    region: "Southern Africa",
    language: "Chichewa",
    license: "Community Tribal Copyright",
    createdAt: "2026-11-05T00:00:00Z",
    audioSha256: "abc",
  } as Story;
  const m = createManifest(story);
  assert.equal(m.author.name, "Thoko");
  assert.equal(m["pam:region"], "Southern Africa");
  assert.equal(m["pam:deviceSignature"], null);
  assert.equal(m["pam:c2paStatus"], "requires-external-signer");
});
test("transcript tagging finds openings in pasted text, keeping native spelling", () => {
  const tags = tagTranscriptOpenings(
    "Padangokhala! Tilitonse!\nOnce there was a clever hare.\nPadangokhala!",
  );
  assert.deepEqual(tags, ["Padangokhala!", "Tilitonse!"]);
  assert.deepEqual(tagTranscriptOpenings("An ordinary sentence."), []);
  assert.deepEqual(tagTranscriptOpenings("Iro nwanụ! A proverb follows."), [
    "Iro nwanụ!",
  ]);
});
