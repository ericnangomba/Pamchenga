import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const base = process.env.BASE || "http://localhost:4173";
const out = process.env.OUT || "/tmp";
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
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
for (const w of [320, 390]) {
  const ctx = await browser.newContext({
    permissions: ["microphone"],
    viewport: { width: w, height: 760 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.locator("#a-drum").click();
  await page.locator("#a-entry").waitFor({ state: "hidden" });
  await page.reload();
  assert.equal(
    await page.locator("#a-entry").isHidden(),
    true,
    "entry skipped on return",
  );
  assert.equal(await page.locator(".sidebar").isHidden(), true);
  // no horizontal overflow
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "no horizontal scroll " + w,
  );
  // record with fake mic
  await page.locator("#a-rec").click();
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
  const f = page.locator("#capture-form");
  await page.getByLabel("Story title").fill("Synthetic test story");
  await page.getByLabel("Storyteller", { exact: true }).fill("Test Teller");
  await page.getByLabel("Location", { exact: true }).fill("Test town");
  await page.getByLabel("Language", { exact: true }).fill("Chichewa");
  await f.getByLabel("Person giving consent").fill("Test Teller");
  for (const re of [
    /record this story/,
    /store this story locally/,
    /share this story/,
    /back up this story/,
  ])
    await f.getByRole("checkbox", { name: re }).check();
  await page.screenshot({ path: `${out}/s-${w}-form.png` });
  await page.getByRole("button", { name: "Save story on this device" }).click();
  await page.locator(".a-tile").first().waitFor();
  // import a second synthetic audio
  await page
    .locator("#audio-file")
    .setInputFiles({ name: "Syn.wav", mimeType: "audio/wav", buffer: wav });
  await page.getByLabel("Story title").fill("Imported synthetic");
  await page.getByLabel("Storyteller", { exact: true }).fill("Test Two");
  await page.getByLabel("Location", { exact: true }).fill("Test city");
  await page.getByLabel("Language", { exact: true }).fill("Kiswahili");
  await f.getByLabel("Person giving consent").fill("Test Two");
  for (const re of [/record this story/, /store this story locally/])
    await f.getByRole("checkbox", { name: re }).check();
  await page.getByRole("button", { name: "Save story on this device" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".a-tile").length >= 2,
  );
  await page.screenshot({ path: `${out}/s-${w}-home.png` });
  // bottom nav does not hide last content: scroll to end, last element bottom above tab bar top
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  const clear = await page.evaluate(() => {
    const nav = document.querySelector(".a-tabs").getBoundingClientRect().top;
    const last = [...document.querySelectorAll("#a-main > *")]
      .pop()
      .getBoundingClientRect().bottom;
    return nav - last;
  });
  assert.ok(clear >= 0, `content hidden by tab bar by ${-clear}px at ${w}`);
  // listen tab, open detail, play, export
  await page.locator("[data-t=stories]").click();
  await page
    .locator(".a-grid .a-tile", { hasText: "Imported synthetic" })
    .click();
  await page.locator("#detail audio").waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page
    .locator(".a-grid .a-tile", { hasText: "Synthetic test story" })
    .click();
  await page.locator("#detail audio").waitFor();
  assert.match(await page.locator(".hash").innerText(), /^[a-f0-9]{64}$/);
  const played = await page.evaluate(async () => {
    const a = document.querySelector("#detail audio");
    a.muted = true;
    await new Promise((r) =>
      a.readyState >= 1
        ? r()
        : a.addEventListener("loadedmetadata", r, { once: true }),
    );
    try {
      await a.play();
    } catch (e) {
      return "play-error:" + e.message;
    }
    await new Promise((r) => setTimeout(r, 600));
    return { t: a.currentTime, d: a.duration };
  });
  console.log(w, "playback", JSON.stringify(played));
  assert.ok(typeof played === "object" && played.t > 0, "audio advanced");
  await page.screenshot({ path: `${out}/s-${w}-detail.png` });
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export passport", exact: true })
    .click();
  assert.match((await dl).suggestedFilename(), /\.jsonld$/);
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  // passed on + atlas
  await page.locator("[data-t=passed]").click();
  await page.locator(".a-line").first().click();
  await page.locator("#detail audio").waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.locator("[data-t=atlas]").click();
  await page.screenshot({ path: `${out}/s-${w}-atlas.png` });
  await page.locator("[data-t=stories]").click();
  await page.screenshot({ path: `${out}/s-${w}-listen.png` });
  // persistence across reload
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".a-tile").length >= 2,
  );
  assert.deepEqual(errors, []);
  console.log("PASS shell at", w);
  await ctx.close();
}
await browser.close();
