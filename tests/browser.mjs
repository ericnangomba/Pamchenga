import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
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
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://localhost:4173");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
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
  await page.getByRole("checkbox").check();
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
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export passport", exact: true })
    .click();
  assert.match((await download).suggestedFilename(), /\.jsonld$/);
  await page.getByRole("button", { name: "Queue for sync" }).click();
  await page.waitForTimeout(300);
  console.log("Queue result:", await page.locator("#toast").textContent());
  await page.locator("#toast").filter({ hasText: "Queued locally" }).waitFor();
  await page.waitForTimeout(1000);
  const jobs = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open("pamchenga", 1);
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
  await page.reload();
  await page.locator(".story-card").waitFor();
  console.log("Story collection loaded");
  assert.match(await page.locator("#connection").innerText(), /Offline/);
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
  assert.match(await page.locator("#lesson-status").innerText(), /permission/);
  await page.locator("[name=classroomPermission]").check();
  await page
    .getByRole("button", { name: "Export lesson handout", exact: true })
    .click();
  assert.match(
    await page.locator("#lesson-status").innerText(),
    /Save your changes/,
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
  await page.screenshot({ path: "/tmp/pamchenga-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "/tmp/pamchenga-mobile.png", fullPage: true });
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
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save story on this device" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".story-card").length === 2,
  );
  await page.getByRole("button", { name: "East Africa", exact: true }).click();
  assert.equal(await page.locator(".story-card").count(), 1);
  assert.match(await page.locator(".story-card").innerText(), /Hadithi/);
  await page.getByRole("button", { name: "All stories", exact: true }).click();
  await page.getByRole("searchbox").fill("Padangokhala");
  assert.equal(await page.locator(".story-card").count(), 1);
  await page.getByRole("searchbox").fill("");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: recording, hash, local persistence, notes, export, durable retry queue, offline reload, mobile layout, audio import, filters, search, offline lessons, classroom consent, metrics, and Codex artifact/handoff export",
  );
} finally {
  await browser.close();
}
