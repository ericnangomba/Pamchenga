import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { unzipSync, strFromU8 } from "fflate";
import {
  migrateConsent,
  permitted,
  licenseWarnings,
  withdrawnPermissions,
  consentFields,
  consentSummaryHtml,
} from "../src/consent";
import {
  queueStory,
  getStories,
  openDatabase,
  saveStory,
  updateStoryMetadata,
  updateConsentRecord,
  recordOwnCopyExport,
} from "../src/storage";
import {
  sharedAudio,
  sharedPassport,
  storytellerCopy,
  originalAudioFilename,
} from "../src/story-exports";
import { hashAudio } from "../src/agents/provenance-agent";
import type { ConsentRecord, Story } from "../src/types";

const consent = (): ConsentRecord => ({
  version: 1,
  giver: "Thoko",
  role: "storyteller",
  recordedAt: "2026-11-09T00:00:00Z",
  permissions: {
    record: true,
    store: true,
    share: false,
    backup: false,
    teach: false,
    commercial: true,
  },
  notes: "Keep the chant intact.",
});
const story = (id: string): Story => ({
  id,
  title: "Iro nwanụ!",
  storyteller: "Thoko",
  location: "Kawale",
  language: "Chichewa",
  region: "Southern Africa",
  license: "CC BY-NC-SA 4.0",
  createdAt: "2026-11-09T00:00:00Z",
  duration: 1,
  audio: new Blob([new Uint8Array([0, 255, 6, 8, 21])], { type: "audio/wav" }),
  audioSha256: "",
  transcript: "Original notes",
  consent: consent(),
});

test("v1 migration preserves choices and time but flags bare commercial choice for review", () => {
  const old = consent();
  const migrated = migrateConsent(old);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.migratedFromVersion, 1);
  assert.deepEqual(migrated.permissions, old.permissions);
  assert.equal(migrated.recordedAt, old.recordedAt);
  assert.equal(migrated.notes, old.notes);
  assert.equal(old.version, 1);
  assert.equal(permitted({ consent: migrated }, "commercial"), false);
  assert.equal(permitted({ consent: migrated }, "record"), true);
  assert.equal(permitted({ consent: migrated }, "share"), false);
  assert.match(
    consentSummaryHtml({ ...story("review"), consent: migrated }),
    /Commercial use needs review/,
  );
  assert.match(consentFields(migrated), /name="permission-commercial" checked/);
});

test("own-copy ZIP includes exact original bytes and unsigned passport while third-party audio is denied", async () => {
  const original = story("copy");
  original.audioSha256 = await hashAudio(original.audio);
  assert.throws(() => sharedAudio(original), /permission for share/);
  assert.throws(() => sharedPassport(original), /permission for share/);
  const copy = await storytellerCopy(original);
  const files = unzipSync(new Uint8Array(await copy.arrayBuffer()));
  assert.deepEqual(
    files[originalAudioFilename(original)],
    new Uint8Array(await original.audio.arrayBuffer()),
  );
  const passport = JSON.parse(strFromU8(files["copy.jsonld"]));
  assert.equal(passport["pam:audioSha256"], original.audioSha256);
  assert.equal(passport["pam:permissions"].share, false);
  assert.equal(passport["pam:provenanceStatus"], "unsigned");
  assert.equal(
    passport["pam:consentEvidenceStatus"],
    "self-reported-unverified",
  );
  assert.equal(permitted(original, "share"), false);
  original.consent!.permissions.share = true;
  assert.equal(sharedAudio(original), original.audio);
});

test("old raw IndexedDB records migrate on read without losing license, original bytes or history", async () => {
  const original = story("old-record");
  original.consentHistory = [consent()];
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("stories", "readwrite");
    tx.objectStore("stories").put(original);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
  const migrated = (await getStories()).find((s) => s.id === original.id)!;
  assert.equal(migrated.consent?.version, 2);
  assert.equal(migrated.consent?.permissions.commercial, true);
  assert.equal(permitted(migrated, "commercial"), false);
  assert.equal(migrated.consentHistory?.[0].version, 1);
  assert.equal(migrated.license, original.license);
  assert.deepEqual(
    await migrated.audio.arrayBuffer(),
    await original.audio.arrayBuffer(),
  );
  const noConsent = { ...story("no-consent"), consent: undefined };
  await saveStory(noConsent);
  const loaded = (await getStories()).find((s) => s.id === noConsent.id)!;
  assert.equal(loaded.consent, undefined);
  for (const use of [
    "record",
    "store",
    "share",
    "backup",
    "teach",
    "commercial",
  ] as const)
    assert.equal(permitted(loaded, use), false);
});

test("benefits and both license values survive storage and overlapping metadata/history writes", async () => {
  for (const license of [
    "Community Tribal Copyright",
    "CC BY-NC-SA 4.0",
  ] as const) {
    const original = { ...story(license), license };
    const terms: ConsentRecord = {
      ...migrateConsent(consent()),
      attribution: "Thoko & the circle",
      benefitConditions: "A copy and community review",
      commercialAgreement: {
        parties: "Thoko and publisher",
        agreedAt: "2026-11-10",
        terms: "An agreed fee before use",
      },
    };
    await saveStory(original);
    await Promise.all([
      updateConsentRecord(original.id, terms),
      updateStoryMetadata(original.id, { transcript: "Concurrent notes" }),
      recordOwnCopyExport(original.id),
      recordOwnCopyExport(original.id),
    ]);
    const loaded = (await getStories()).find((s) => s.id === original.id)!;
    assert.equal(loaded.license, license);
    assert.deepEqual(loaded.consent, terms);
    assert.equal(loaded.transcript, "Concurrent notes");
    assert.equal(loaded.consentHistory?.length, 1);
    assert.equal(loaded.ownCopyExports?.length, 2);
    assert.equal(loaded.ownCopyExports?.[0].status, "download-requested");
    assert.equal(loaded.audio.size, original.audio.size);
    await Promise.all([
      updateConsentRecord(original.id, { ...terms, notes: "Second change" }),
      recordOwnCopyExport(original.id),
    ]);
    const updated = (await getStories()).find((s) => s.id === original.id)!;
    assert.equal(updated.consentHistory?.length, 2);
    assert.equal(updated.ownCopyExports?.length, 3);
    assert.equal(
      updated.consentHistory?.[1].benefitConditions,
      terms.benefitConditions,
    );
  }
});

test("license warnings expose conflicts in both directions and withdrawal identifies only removed choices", () => {
  const permissions = consent().permissions;
  const cc = licenseWarnings("CC BY-NC-SA 4.0", permissions, true).join(" ");
  assert.match(cc, /irrevocable/);
  assert.match(cc, /denying sharing/);
  assert.match(cc, /excludes commercial/);
  assert.match(cc, /conditions may conflict/);
  const community = licenseWarnings("Community Tribal Copyright", {
    ...permissions,
    share: true,
  }).join(" ");
  assert.match(community, /not a standardized public license/);
  assert.match(community, /no standard public reuse terms/);
  assert.deepEqual(
    withdrawnPermissions(consent(), { ...permissions, commercial: false }),
    ["commercial"],
  );
  assert.deepEqual(withdrawnPermissions(undefined, permissions), []);
});

test("new condition and agreement fields are escaped in HTML", () => {
  const data = {
    ...migrateConsent(consent()),
    attribution: '<img src=x onerror="alert(1)">',
    benefitConditions: "<script>bad()</script>",
  };
  const html =
    consentFields(data) +
    consentSummaryHtml({ ...story("escape"), consent: data });
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("withdrawing backup atomically removes pending jobs without losing audio or other metadata", async () => {
  const original = story("withdraw-backup");
  original.consent!.permissions.backup = true;
  await saveStory(original);
  await queueStory(original.id);
  await updateConsentRecord(original.id, {
    ...migrateConsent(original.consent!),
    permissions: { ...original.consent!.permissions, backup: false },
  });
  const db = await openDatabase();
  const jobs = await new Promise<{ id: string }[]>((resolve, reject) => {
    const tx = db.transaction("queue");
    const request = tx.objectStore("queue").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
  assert.ok(!jobs.some((job) => job.id === original.id));
  assert.equal(
    (await getStories()).find((s) => s.id === original.id)!.audio.size,
    original.audio.size,
  );
  await assert.rejects(queueStory(original.id));
});

test("the actual worker rechecks backup permission before sending a queued original", async () => {
  const source = (
    await readFile(new URL("../public/sw.js", import.meta.url), "utf8")
  ).replace(
    'import { validateWhisperResponse } from "/whisper-result.js";',
    "",
  );
  let uploads = 0;
  const sandbox = {
    indexedDB,
    FormData,
    self: { addEventListener() {} },
    fetch: async (_input: unknown, init: { body: FormData }) => {
      uploads++;
      const metadata = JSON.parse(String(init.body.get("metadata")));
      return Response.json({
        id: metadata.id,
        audioSha256: metadata.audioSha256,
      });
    },
  };
  // Run the worker's real flush implementation against fake IndexedDB and a
  // counted transport. No install/fetch event is simulated by this unit test.
  const flush: () => Promise<void> = runInNewContext(
    source + "\nperformFlush;",
    sandbox,
  );
  for (const variant of [
    "legacy",
    "denied",
    "invalid",
    "v1-allowed",
    "v2-allowed",
  ]) {
    const sample = story(`worker-${variant}`);
    if (variant === "legacy") sample.consent = undefined;
    else {
      sample.consent = {
        ...consent(),
        version: variant === "v2-allowed" ? 2 : 1,
      };
      sample.consent.permissions.backup = variant !== "denied";
      if (variant === "invalid") sample.consent.giver = "";
    }
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["stories", "queue"], "readwrite");
      tx.objectStore("stories").put(sample);
      tx.objectStore("queue").put({
        id: sample.id,
        status: "queued",
        attempts: 0,
        nextAttempt: 0,
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
    const before = uploads;
    await flush();
    assert.equal(
      uploads - before,
      variant.endsWith("-allowed") ? 1 : 0,
      variant,
    );
  }
});
