import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const base = process.env.BASE || "http://localhost:4173";
const out = process.env.OUT || "/tmp";
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
const wav = Buffer.alloc(8000 * 2 * 4 + 44);
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
wav.writeUInt32LE(wav.length - 44, 40);
for (const [w, mobile] of [
  [320, true],
  [390, true],
  [1280, false],
]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: 780 },
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  if (mobile) {
    await page.locator("#a-drum").click();
    await page.locator("#a-entry").waitFor({ state: "hidden" });
  }
  await page
    .locator("#audio-file")
    .setInputFiles({ name: "r.wav", mimeType: "audio/wav", buffer: wav });
  await page.getByLabel("Story title").fill("Review synthetic");
  await page.getByLabel("Storyteller", { exact: true }).fill("Test Teller");
  await page.getByLabel("Location", { exact: true }).fill("Test town");
  await page.getByLabel("Language", { exact: true }).fill("Lingala");
  const f = page.locator("#capture-form");
  await f.getByLabel("Person giving consent").fill("Test Teller");
  for (const re of [
    /record this story/,
    /store this story locally/,
    /share this story/,
  ])
    await f.getByRole("checkbox", { name: re }).check();
  await page.getByRole("button", { name: "Save story on this device" }).click();
  if (mobile) {
    await page.locator("[data-t=passed]").click();
    await page.locator(".a-rv").first().click();
  } else {
    await page.locator(".story-card").click();
    await page.locator("#open-review").click();
  }
  const dlg = page.locator("#review-dialog");
  await dlg.waitFor();
  assert.match(
    await dlg.locator("#rv-status").innerText(),
    /Being checked: 0 of 1/,
  );
  assert.ok(
    await dlg.evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
    "no horizontal overflow " + w,
  );
  // confirm is blocked until work is done
  assert.equal(await dlg.locator("#rv-confirm").isDisabled(), true);
  const ta = dlg.locator("[data-text]").first();
  await ta.fill("synthetic first words");
  // split at 2s of playback
  await dlg.locator("#rv-audio").evaluate((a) => {
    a.currentTime = 2;
  });
  await dlg.locator("[data-split]").first().click();
  assert.equal(await dlg.locator(".rv-seg").count(), 2);
  await dlg.locator("[data-text]").nth(1).fill("synthetic second words");
  // unsure blocks checking
  await dlg.locator("[data-flag^='unsure:']").nth(1).click();
  assert.equal(await dlg.locator("[data-check]").nth(1).isDisabled(), true);
  await dlg.locator("[data-check]").first().click();
  await dlg.locator("#rv-name").fill("Test Teller");
  await dlg.locator("#rv-listened").check();
  assert.equal(
    await dlg.locator("#rv-confirm").isDisabled(),
    true,
    "unsure part blocks confirm",
  );
  assert.match(await dlg.locator("#rv-blockers").innerText(), /unsure/);
  await dlg.screenshot({ path: `${out}/r-${w}-blocked.png` });
  // resolve: playback does not stop when typing (audio element survives)
  await dlg.locator("[data-flag^='unsure:']").nth(1).click();
  await dlg.locator("[data-flag^='cultural:']").nth(1).click();
  await dlg.locator("[data-note]").first().fill("synthetic cultural note");
  await dlg.locator("[data-check]").nth(1).click();
  assert.equal(await dlg.locator("#rv-confirm").isDisabled(), false);
  await dlg.locator("#rv-confirm").scrollIntoViewIfNeeded();
  await dlg.locator("#rv-confirm").click();
  assert.match(
    await dlg.locator("#rv-status").innerText(),
    /Text checked by Test Teller \(the storyteller\)/,
  );
  assert.equal(await dlg.locator("#rv-signed").isVisible(), true);
  assert.doesNotMatch(await dlg.innerText(), /accurate|verified correct/i);
  await dlg.locator("#rv-signed").scrollIntoViewIfNeeded();
  await dlg.screenshot({ path: `${out}/r-${w}-confirmed.png` });
  await dlg.locator("#rv-close").click();
  // persisted
  await page.reload();
  if (mobile) {
    await page.locator("[data-t=passed]").click();
    assert.match(
      await page.locator(".a-line").first().innerText(),
      /Text checked by Test Teller/,
    );
    await page.screenshot({ path: `${out}/r-${w}-passed.png` });
    await page.locator(".a-rv").first().click();
  } else {
    await page.locator(".story-card").click();
    await page.locator("#open-review").click();
  }
  await dlg.waitFor();
  assert.equal(
    await dlg.locator("[data-text]").first().inputValue(),
    "synthetic first words",
  );
  assert.equal(
    await dlg.locator("[data-note]").first().inputValue(),
    "synthetic cultural note",
  );
  // edit after confirmation clears it
  await dlg
    .locator("[data-text]")
    .first()
    .fill("synthetic first words, edited");
  assert.match(
    await dlg.locator("#rv-status").innerText(),
    /Edited since it was confirmed|Being checked/,
  );
  assert.equal(await dlg.locator("#rv-signed").isVisible(), false);
  await dlg.locator("#rv-close").click();
  assert.deepEqual(errors, []);
  console.log("PASS review at", w);
  await ctx.close();
}
await browser.close();
