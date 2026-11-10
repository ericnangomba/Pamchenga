import assert from "node:assert/strict";
import test from "node:test";
import { permitted, readConsent, requirePermission } from "../src/consent";
import { exportLesson } from "../src/agents/learning";
import { createManifest } from "../src/agents/provenance-agent";
import type { Story } from "../src/types";

const base = (): Story => ({
  id: "story-1",
  title: "Story",
  storyteller: "Elder",
  location: "Village",
  language: "Chichewa",
  region: "Southern Africa",
  license: "Community Tribal Copyright",
  createdAt: "2026-01-01T00:00:00Z",
  duration: 1,
  audio: new Blob(["audio"]),
  audioSha256: "hash",
  transcript: "",
  learning: {
    audience: "Learners",
    objective: "Learn",
    nativeProverb: "",
    meaning: "",
    discussionQuestion: "Discuss",
    activity: "Retell",
    sessionsDelivered: 0,
    classroomPermission: true,
  },
});
test("historical stories default deny every protected use", () => {
  const story = base();
  for (const use of [
    "record",
    "store",
    "share",
    "backup",
    "teach",
    "commercial",
  ] as const) {
    assert.equal(permitted(story, use), false);
    assert.throws(() => requirePermission(story, use));
  }
  assert.throws(() => exportLesson(story));
});
test("consent choices are independent and commercial use defaults off", () => {
  const form = new FormData();
  form.set("consentGiver", "Elder");
  form.set("consentRole", "storyteller");
  form.set("permission-record", "on");
  form.set("permission-store", "on");
  form.set("permission-teach", "on");
  const consent = readConsent(form);
  const story = { ...base(), consent };
  assert.equal(permitted(story, "teach"), true);
  assert.equal(permitted(story, "share"), false);
  assert.equal(permitted(story, "backup"), false);
  assert.equal(permitted(story, "commercial"), false);
  assert.match(exportLesson(story), /Storyteller:/);
  const manifest = createManifest(story);
  assert.equal(manifest["pam:permissions"].teach, true);
  assert.equal(manifest["pam:permissions"].commercial, false);
  assert.equal(manifest["pam:provenanceStatus"], "unsigned");
});
test("recording and storage require explicit consent", () => {
  const form = new FormData();
  form.set("consentGiver", "Elder");
  form.set("consentRole", "storyteller");
  assert.throws(() => readConsent(form));
  form.set("permission-record", "on");
  form.set("permission-store", "on");
  assert.doesNotThrow(() => readConsent(form));
});
test("classroom facilitator permission cannot override storyteller denial", () => {
  const story = base();
  story.consent = {
    version: 1,
    giver: "Elder",
    role: "storyteller",
    recordedAt: new Date().toISOString(),
    permissions: {
      record: true,
      store: true,
      share: true,
      backup: true,
      teach: false,
      commercial: false,
    },
  };
  assert.throws(() => exportLesson(story));
  story.consent.permissions.teach = true;
  story.learning!.classroomPermission = false;
  assert.throws(() => exportLesson(story));
});

function consentForm(): FormData {
  const form = new FormData();
  form.set("consentGiver", "Elder");
  form.set("consentRole", "storyteller");
  form.set("permission-record", "on");
  form.set("permission-store", "on");
  return form;
}

test("commercial checkbox alone cannot grant rights and missing agreement stays visible for review", () => {
  const form = consentForm();
  form.set("permission-commercial", "on");
  const story = { ...base(), consent: readConsent(form) };
  assert.equal(story.consent.permissions.commercial, true);
  assert.equal(permitted(story, "commercial"), false);
  assert.throws(() => requirePermission(story, "commercial"));
  assert.equal(createManifest(story)["pam:commercialRequested"], true);
  assert.equal(createManifest(story)["pam:commercialReviewRequired"], true);
  form.set("commercialParties", "Elder and publisher");
  assert.throws(() => readConsent(form), /Complete the commercial agreement/);
  form.set("commercialAgreedAt", "2026-11-10");
  form.set(
    "commercialTerms",
    "A separate fee and community review before publication.",
  );
  const consent = readConsent(form);
  assert.equal(permitted({ consent }, "commercial"), true);
  const passport = createManifest({ ...base(), consent });
  assert.deepEqual(
    passport["pam:commercialAgreement"],
    consent.commercialAgreement,
  );
  assert.equal(passport["pam:permissions"].commercial, true);
  consent.permissions.commercial = false;
  assert.equal(
    permitted({ consent }, "commercial"),
    false,
    "agreement cannot replace permission",
  );
  form.set("commercialAgreedAt", "2026-02-31");
  assert.throws(() => readConsent(form));
  form.set("commercialAgreedAt", "not a date");
  assert.throws(() => readConsent(form));
});

test("attribution and benefits reach the passport and credited lesson without changing provenance", () => {
  const form = consentForm();
  form.set(
    "attribution",
    "Thoko and the Kawale storytelling circle · Iro nwanụ!",
  );
  form.set(
    "benefitConditions",
    "Give the storyteller their copy; community review before publication.",
  );
  form.set("consentNotes", "No excerpts without review.");
  form.set("permission-teach", "on");
  const consent = readConsent(form);
  const story = { ...base(), consent };
  const passport = createManifest(story);
  assert.equal(passport["pam:attributionWording"], consent.attribution);
  assert.equal(passport["pam:benefitConditions"], consent.benefitConditions);
  assert.equal(passport["pam:communityRestrictions"], consent.notes);
  assert.equal(
    passport["pam:consentEvidenceStatus"],
    "self-reported-unverified",
  );
  assert.equal(passport["pam:provenanceStatus"], "unsigned");
  assert.ok(exportLesson(story).includes(`Credit: ${consent.attribution}`));
});

test("CC authorization must be freshly confirmed; it never overrides denied permissions", () => {
  const form = consentForm();
  assert.throws(
    () => readConsent(form, "CC BY-NC-SA 4.0"),
    /Confirm rights-holder authorization/,
  );
  form.set("licenseAuthorized", "on");
  const consent = readConsent(form, "CC BY-NC-SA 4.0");
  assert.equal(consent.licenseAuthorization?.license, "CC BY-NC-SA 4.0");
  assert.equal(consent.licenseAuthorization?.attestedBy, "Elder");
  assert.equal(permitted({ consent }, "share"), false);
});

test("updates can withdraw recording/storage permission without granting it to new captures", () => {
  const form = consentForm();
  form.delete("permission-record");
  form.delete("permission-store");
  assert.throws(() => readConsent(form));
  const withdrawn = readConsent(form, "Community Tribal Copyright", false);
  assert.equal(permitted({ consent: withdrawn }, "record"), false);
  assert.equal(permitted({ consent: withdrawn }, "store"), false);
});
