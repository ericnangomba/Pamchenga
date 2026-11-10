import { unzipSync, strFromU8 } from "fflate";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const context = await browser.newContext({
  permissions: ["microphone"],
  viewport: { width: 1440, height: 1080 },
});
const page = await context.newPage();
const captureForm = page.locator("#capture-form");
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://localhost:4173");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const workerURL = await page.evaluate(
    () => navigator.serviceWorker.controller.scriptURL,
  );
  // Read the controlling worker's source, never guess from existing cache names.
  // Fail explicitly if its cache declaration changes shape.
  const workerResponse = await context.request.get(workerURL);
  assert.ok(workerResponse.ok(), "Could not read the controlling worker");
  const workerSource = await workerResponse.text();
  const cacheDeclarations = [
    ...workerSource.matchAll(/^const CACHE = (["'])([^"'\r\n]+)\1;$/gm),
  ];
  assert.equal(
    cacheDeclarations.length,
    1,
    "Expected one worker CACHE literal",
  );
  assert.match(workerSource, /caches\.open\(CACHE\)/);
  const cacheName = cacheDeclarations[0][2];
  // API requests bypass the worker and cannot populate the browser's cache.
  const shellResponse = await context.request.get("http://localhost:4173/");
  assert.ok(shellResponse.ok(), "Could not read the built app shell");
  const shell = await shellResponse.text();
  const assets = [...shell.matchAll(/["'](\/assets\/[^"']+)["']/g)].map(
    (match) => match[1],
  );
  for (const extension of [".js", ".css"]) {
    assert.ok(
      assets.some((asset) => asset.endsWith(extension)),
      `Built index.html must reference a ${extension} asset`,
    );
  }
  const builtAssets = [];
  for (const path of new Set(assets)) {
    if (!/\.(js|css)$/.test(path)) continue;
    const response = await context.request.get(new URL(path, page.url()).href);
    assert.ok(response.ok(), `Built asset is unavailable: ${path}`);
    assert.match(
      response.headers()["content-type"],
      path.endsWith(".js") ? /javascript/ : /text\/css/,
    );
    const body = await response.text();
    assert.ok(body.trim().length > 0, `Built asset is empty: ${path}`);
    builtAssets.push({ path, body });
  }
  await page.evaluate(
    async ({ cacheName, builtAssets }) => {
      if (!(await caches.has(cacheName)))
        throw Error(`Current worker cache does not exist: ${cacheName}`);
      const cache = await caches.open(cacheName);
      for (const extension of [".js", ".css"]) {
        let found = false;
        for (const asset of builtAssets.filter((asset) =>
          asset.path.endsWith(extension),
        )) {
          const response = await cache.match(asset.path, { ignoreVary: true });
          if (response?.ok && (await response.text()) === asset.body) {
            found = true;
            break;
          }
        }
        if (!found)
          throw Error(
            `Offline built ${extension} referenced by index.html was not precached`,
          );
      }
    },
    { cacheName, builtAssets },
  );
  await page.locator("#new-record").click();
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .waitFor();
  await page.waitForTimeout(1100);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await page
    .getByLabel("Story title")
    .fill("Padangokhala — a circle of wisdom");
  await page.getByLabel("Storyteller", { exact: true }).fill("Thoko");
  await page
    .getByLabel("Location", { exact: true })
    .fill("Kawale, Lilongwe, Malawi");
  await page.getByLabel("Language", { exact: true }).fill("Chichewa");
  await captureForm.getByLabel("Person giving consent").fill("Storyteller");
  await captureForm
    .getByLabel("Attribution wording", { exact: true })
    .fill("Thoko and the Kawale storytelling circle · Iro nwanụ!");
  await captureForm
    .getByLabel("Benefit conditions", { exact: true })
    .fill("Return a copy; community review before publication.");
  await captureForm
    .getByLabel("Restrictions or community conditions", { exact: true })
    .fill("Keep the whole chant.");
  await captureForm
    .getByRole("checkbox", { name: /Permission to record this story/ })
    .check();
  await captureForm
    .getByRole("checkbox", { name: /Permission to store this story locally/ })
    .check();
  await captureForm
    .getByRole("checkbox", { name: /Permission to share this story/ })
    .check();
  await captureForm
    .getByRole("checkbox", { name: /Permission to back up this story/ })
    .check();
  await captureForm
    .getByRole("checkbox", {
      name: /Permission to use this story in classroom teaching/,
    })
    .check();
  await page.getByRole("button", { name: "Save story on this device" }).click();
  await page.locator(".story-card").waitFor();
  console.log("Story collection loaded");
  await page.reload();
  await page.locator(".story-card").waitFor();
  console.log("Story collection loaded");
  await page.locator(".story-card").click();
  await page.locator("audio").waitFor();
  console.log("Playback detail loaded");
  assert.match(await page.locator(".hash").innerText(), /^[a-f0-9]{64}$/);
  await page
    .getByLabel("Transcript or storyteller’s notes")
    .fill("Padangokhala! Iro nwanụ!");
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await page.locator("#toast").filter({ hasText: "Notes saved" }).waitFor();
  const ritualTags = await page.locator("#ritual-tags").innerText();
  assert.match(ritualTags, /Padangokhala!/);
  assert.match(ritualTags, /Iro nwanụ!/);
  console.log("Ritual tags rendered:", ritualTags.replace(/\n/g, " | "));
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export passport", exact: true })
    .click();
  assert.match((await download).suggestedFilename(), /\.jsonld$/);
  await page.getByRole("button", { name: "Queue for backup" }).click();
  await page.waitForTimeout(300);
  console.log("Queue result:", await page.locator("#toast").textContent());
  await page.locator("#toast").filter({ hasText: "Queued locally" }).waitFor();
  await page.waitForTimeout(1000);
  const jobs = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open("pamchenga", 2);
        r.onsuccess = () => {
          const q = r.result.transaction("queue").objectStore("queue").getAll();
          q.onsuccess = () => resolve(q.result);
          q.onerror = reject;
        };
      }),
  );
  assert.equal(jobs[0].status, "queued");
  assert.ok(jobs[0].attempts >= 1);
  assert.ok(jobs[0].nextAttempt > Date.now());
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await context.setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  await page.reload();
  await page.locator(".story-card").waitFor();
  console.log("Story collection loaded");
  await page.locator(".story-card").click();
  assert.equal(
    await page.getByLabel("Transcript or storyteller’s notes").inputValue(),
    "Padangokhala! Iro nwanụ!",
  );
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  // Prepare a real offline classroom resource, with a separate permission gate.
  await page.locator(".story-card").click();
  await page
    .getByLabel("Learning audience", { exact: true })
    .fill("Chichewa-speaking learners, ages 9–12");
  await page
    .getByLabel("Learning objective", { exact: true })
    .fill("Retell a story about cooperation");
  await page.getByLabel("Native proverb", { exact: true }).fill("Iro nwanụ!");
  await page
    .getByLabel("Meaning and cultural context", { exact: true })
    .fill("Interpretation supplied by the facilitator.");
  await page
    .getByLabel("Discussion question", { exact: true })
    .fill("How did the characters help one another?");
  await page
    .getByLabel("Learning activity", { exact: true })
    .fill("Retell the story together.");
  await page.getByLabel("Sessions delivered", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Save learning card", exact: true })
    .click();
  await page
    .locator("#lesson-status")
    .filter({ hasText: "saved on this device" })
    .waitFor();
  await page
    .getByRole("button", { name: "Export lesson handout", exact: true })
    .click();
  await expect(page.locator("#lesson-status")).toHaveText(
    "Record storyteller permission for classroom use before exporting.",
  );
  await page.locator("[name=classroomPermission]").check();
  await page
    .getByRole("button", { name: "Export lesson handout", exact: true })
    .click();
  await expect(page.locator("#lesson-status")).toHaveText(
    "Save your changes before exporting the lesson.",
  );
  await page
    .getByRole("button", { name: "Save learning card", exact: true })
    .click();
  await page
    .locator("#lesson-status")
    .filter({ hasText: "saved on this device" })
    .waitFor();
  await page
    .getByLabel("Transcript or storyteller’s notes")
    .fill("Padangokhala! Iro nwanụ! Community note.");
  await page
    .getByLabel("Learning objective", { exact: true })
    .fill("Retell the story and explain cooperation");
  await page.evaluate(() => {
    document.querySelector("#save-notes").click();
    document.querySelector("#lesson-form").requestSubmit();
  });
  await page.waitForFunction(
    () =>
      !document.querySelector("#lesson-form [type=submit]").disabled &&
      document
        .querySelector("#lesson-status")
        .textContent.includes("saved on this device"),
  );
  await page.locator("#toast").filter({ hasText: "Notes saved" }).waitFor();
  const lessonDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export lesson handout", exact: true })
    .click();
  const lessonText = await readFile(
    await (await lessonDownload).path(),
    "utf8",
  );
  assert.match(lessonText, /Iro nwanụ!/);
  assert.match(lessonText, /Thoko/);
  assert.match(
    lessonText,
    /Credit: Thoko and the Kawale storytelling circle · Iro nwanụ!/,
  );
  assert.match(lessonText, /community review before publication/);
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.reload();
  await page.locator(".story-card").waitFor();
  assert.equal(await page.locator("#lessons-count").innerText(), "1");
  assert.equal(await page.locator("#sessions-count").innerText(), "2");
  await page.locator(".story-card").click();
  assert.equal(
    await page.getByLabel("Native proverb", { exact: true }).inputValue(),
    "Iro nwanụ!",
  );
  assert.equal(
    await page.getByLabel("Transcript or storyteller’s notes").inputValue(),
    "Padangokhala! Iro nwanụ! Community note.",
  );
  assert.match(await page.locator("#ritual-tags").innerText(), /Padangokhala!/);
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page
    .getByRole("button", { name: "Built with Codex", exact: false })
    .click();
  for (const name of ["Plan", "Build", "Review", "Document", "Skill"]) {
    await page.getByRole("button", { name, exact: true }).click();
    assert.ok(
      (await page.locator("#artifact-content").innerText()).length > 100,
    );
  }
  const handoffDownload = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Export Codex engineering handoff",
      exact: true,
    })
    .click();
  const handoffText = await readFile(
    await (await handoffDownload).path(),
    "utf8",
  );
  assert.match(handoffText, /AGENTS.md/);
  assert.match(handoffText, /npm test/);
  assert.ok(!handoffText.includes("Padangokhala! Iro nwanụ!"));
  assert.ok(!handoffText.includes("Thoko"));
  await page
    .getByRole("button", { name: "Close workflow", exact: true })
    .click();
  await page.screenshot({
    path: join(tmpdir(), "pamchenga-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: join(tmpdir(), "pamchenga-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1080 });
  const wav = Buffer.alloc(16044);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  await page
    .locator("#audio-file")
    .setInputFiles({ name: "Hadithi.wav", mimeType: "audio/wav", buffer: wav });
  await page.getByLabel("Storyteller", { exact: true }).fill("Amina");
  await page.getByLabel("Location", { exact: true }).fill("Mombasa, Kenya");
  await page.getByLabel("Region", { exact: true }).selectOption("East Africa");
  await page.getByLabel("Language", { exact: true }).fill("Kiswahili");
  await captureForm.getByLabel("Person giving consent").fill("Storyteller");
  await captureForm
    .getByRole("checkbox", { name: /Permission to record this story/ })
    .check();
  await captureForm
    .getByRole("checkbox", { name: /Permission to store this story locally/ })
    .check();
  await captureForm
    .getByRole("checkbox", { name: /Permission to share this story/ })
    .check();
  await captureForm
    .getByRole("checkbox", { name: /Permission to back up this story/ })
    .check();
  await captureForm
    .getByRole("checkbox", {
      name: /Permission to use this story in classroom teaching/,
    })
    .check();
  await captureForm
    .getByLabel("Attribution wording", { exact: true })
    .fill("Amina and the Mombasa circle");
  await captureForm
    .getByLabel("Benefit conditions", { exact: true })
    .fill("Return a copy before publication.");
  await captureForm
    .getByLabel("Community license", { exact: true })
    .selectOption("CC BY-NC-SA 4.0");
  await captureForm
    .getByRole("checkbox", { name: /Permission to share this story/ })
    .uncheck();
  await expect(captureForm.locator("[data-consent-notices]")).toContainText(
    "irrevocable",
  );
  await expect(captureForm.locator("[data-consent-notices]")).toContainText(
    "denying sharing",
  );
  await captureForm
    .getByRole("button", { name: "Save story on this device" })
    .click();
  await expect(captureForm.locator("#capture-error")).toHaveText(
    /Confirm rights-holder authorization/,
  );
  await captureForm
    .getByRole("checkbox", {
      name: /I confirm I am authorized by the rights holder/,
    })
    .check();
  await page.getByRole("button", { name: "Save story on this device" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".story-card").length === 2,
  );
  const importedDuration = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.open("pamchenga", 2);
        r.onsuccess = () => {
          const g = r.result
            .transaction("stories")
            .objectStore("stories")
            .getAll();
          g.onsuccess = () =>
            resolve(g.result.find((x) => x.title === "Hadithi")?.duration);
        };
      }),
  );
  assert.ok(
    importedDuration > 0.5,
    `imported wav duration should be measured, got ${importedDuration}`,
  );
  await page.getByRole("button", { name: "East Africa", exact: true }).click();
  assert.equal(await page.locator(".story-card").count(), 1);
  assert.match(await page.locator(".story-card").innerText(), /Hadithi/);
  await page.getByRole("button", { name: "All stories", exact: true }).click();
  await page.getByRole("searchbox").fill("Padangokhala");
  assert.equal(await page.locator(".story-card").count(), 1);
  await page.getByRole("searchbox").fill("");
  // These protection checks continue in the same offline context.
  await page.locator(".story-card").filter({ hasText: "Hadithi" }).click();
  const detail = page.locator("#detail-dialog");
  let consentEditor = detail.locator("#consent-update-form");
  await expect(detail.locator("#consent-summary")).toContainText(
    "Amina and the Mombasa circle",
  );
  await expect(
    consentEditor.getByLabel("Benefit conditions", { exact: true }),
  ).toHaveValue("Return a copy before publication.");
  await detail
    .getByRole("button", { name: "Export audio", exact: true })
    .click();
  await expect(page.locator("#toast")).toHaveText(
    /permission for share is not recorded/,
  );
  const ownCopyForm = detail.locator("#own-copy-form");
  await ownCopyForm
    .getByRole("checkbox", {
      name: /I am returning this copy to the storyteller/,
    })
    .check();
  const ownCopyDownload = page.waitForEvent("download");
  await ownCopyForm
    .getByRole("button", {
      name: "Give the storyteller their copy",
      exact: true,
    })
    .click();
  const ownCopy = await ownCopyDownload;
  assert.match(ownCopy.suggestedFilename(), /-storyteller-copy\.zip$/);
  const ownFiles = unzipSync(
    new Uint8Array(await readFile(await ownCopy.path())),
  );
  const passportName = Object.keys(ownFiles).find((name) =>
    name.endsWith(".jsonld"),
  );
  const ownPassport = JSON.parse(strFromU8(ownFiles[passportName]));
  assert.deepEqual(Buffer.from(ownFiles[`${ownPassport.identifier}.wav`]), wav);
  assert.equal(ownPassport.license, "CC BY-NC-SA 4.0");
  assert.equal(ownPassport["pam:permissions"].share, false);
  assert.equal(
    ownPassport["pam:attributionWording"],
    "Amina and the Mombasa circle",
  );
  assert.equal(
    ownPassport["pam:benefitConditions"],
    "Return a copy before publication.",
  );
  assert.equal(ownPassport["pam:provenanceStatus"], "unsigned");
  assert.equal(
    ownPassport["pam:consentEvidenceStatus"],
    "self-reported-unverified",
  );
  assert.equal(ownPassport["pam:ownCopyExportRequests"].length, 1);
  await expect(ownCopyForm.locator("#own-copy-status")).toContainText(
    "not proof of delivery",
  );

  await consentEditor
    .getByRole("checkbox", {
      name: /Permission to use this story commercially/,
    })
    .check();
  await expect(consentEditor.locator("[data-consent-notices]")).toContainText(
    "excludes commercial use",
  );
  await consentEditor
    .getByRole("checkbox", {
      name: /I confirm I am authorized by the rights holder/,
    })
    .check();
  await consentEditor
    .getByRole("button", { name: "Save consent record", exact: true })
    .click();
  await expect(consentEditor.locator("#consent-update-status")).toContainText(
    "Commercial use needs review",
  );
  await expect(detail.locator("#consent-summary")).toContainText(
    "Commercial use is not permitted",
  );
  await consentEditor
    .getByLabel("Who agreed to commercial use", { exact: true })
    .fill("Amina and the publisher");
  await consentEditor
    .getByRole("button", { name: "Save consent record", exact: true })
    .click();
  await expect(consentEditor.locator("#consent-update-status")).toHaveText(
    /Complete the commercial agreement/,
  );
  await consentEditor
    .getByLabel("Agreement date", { exact: true })
    .fill("2026-11-10");
  await consentEditor
    .getByLabel("Agreed commercial terms", { exact: true })
    .fill("Agreed fee and review before commercial publication.");
  await consentEditor
    .getByRole("button", { name: "Save consent record", exact: true })
    .click();
  await expect(detail.locator("#consent-summary")).toContainText(
    "agreement and permission recorded as an unverified attestation",
  );
  await expect(detail.locator("#consent-summary")).toContainText(
    "Amina and the publisher",
  );
  await consentEditor
    .getByRole("checkbox", { name: /Permission to back up this story/ })
    .uncheck();
  await expect(consentEditor.locator("[data-withdrawal-notice]")).toContainText(
    "cannot be recalled",
  );
  await expect(consentEditor.locator("[data-withdrawal-notice]")).toContainText(
    "editable device data, not proof",
  );
  await consentEditor
    .getByRole("button", { name: "Save consent record", exact: true })
    .click();
  await expect(consentEditor.locator("#consent-update-status")).toContainText(
    "cannot be recalled",
  );
  await detail.locator("#close-detail").click();
  await page.reload();
  await page.locator(".story-card").filter({ hasText: "Hadithi" }).click();
  consentEditor = detail.locator("#consent-update-form");
  await expect(
    consentEditor.getByRole("checkbox", {
      name: /Permission to back up this story/,
    }),
  ).not.toBeChecked();
  await expect(
    consentEditor.getByLabel("Agreed commercial terms", { exact: true }),
  ).toHaveValue("Agreed fee and review before commercial publication.");
  await expect(
    consentEditor.getByLabel("Attribution wording", { exact: true }),
  ).toHaveValue("Amina and the Mombasa circle");
  await expect(detail.locator("#consent-summary")).toContainText(
    "download requests recorded on this device: 1",
  );
  await detail.locator("#close-detail").click();

  // Seed the prior on-device consent shape and confirm migration never silently
  // carries a bare commercial checkbox forward as an effective permission.
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("pamchenga", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("stories", "readwrite");
      const store = tx.objectStore("stories");
      const request = store.getAll();
      request.onsuccess = () => {
        const story = request.result.find((s) => s.title === "Hadithi");
        story.consent = {
          version: 1,
          giver: "Amina",
          role: "storyteller",
          recordedAt: "2026-11-09T00:00:00Z",
          permissions: {
            record: true,
            store: true,
            share: false,
            backup: false,
            teach: true,
            commercial: true,
          },
        };
        store.put(story);
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.locator(".story-card").filter({ hasText: "Hadithi" }).click();
  await expect(detail.locator("#consent-summary")).toContainText(
    "Commercial use needs review",
  );
  await expect(
    detail
      .locator("#consent-update-form")
      .getByRole("checkbox", {
        name: /Permission to use this story commercially/,
      }),
  ).toBeChecked();
  await detail.locator("#close-detail").click();
  console.log(
    "PASS: own-copy ZIP bytes/passport without sharing; attribution/benefits; agreement and license warnings; withdrawal and v1 review, offline persistence",
  );
  const deniedBrowser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox"],
  });
  const denied = await deniedBrowser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  const deniedPage = await denied.newPage();
  await deniedPage.goto("http://localhost:4173");
  await deniedPage.locator("#new-record").click();
  await deniedPage
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await deniedPage.waitForFunction(
    () => document.querySelector("#capture-error").textContent.length > 0,
    undefined,
    { timeout: 20000 },
  );
  console.log(
    "Mic-denied error shown:",
    await deniedPage.locator("#capture-error").innerText(),
  );
  await denied.close();
  await deniedBrowser.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: recording, hash, local persistence, notes, export, durable retry queue, offline reload, mobile layout, audio import, filters, search, offline lessons, classroom consent, metrics, and Codex artifact/handoff export",
  );
} finally {
  await browser.close();
}
