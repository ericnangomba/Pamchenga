// Deterministic HTTP fixture: verifies browser integration, not actual model inference.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const remoteJobs = new Map();
let uploads = 0;
const fixture = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:4180");
    const json = (status, payload) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(payload));
    };
    if (url.pathname === "/legacy-setup") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<!doctype html><title>IndexedDB migration fixture</title>");
      return;
    }
    if (url.pathname === "/api/transcriptions/health") {
      json(200, {
        service: "pamchenga-whisper",
        models: ["turbo", "large-v3"],
      });
      return;
    }
    if (url.pathname === "/api/transcriptions" && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const form = await new Request("http://fixture", {
        method: "POST",
        headers: { "content-type": req.headers["content-type"] },
        body: Buffer.concat(chunks),
      }).formData();
      const audio = Buffer.from(await form.get("audio").arrayBuffer());
      assert.equal(
        createHash("sha256").update(audio).digest("hex"),
        form.get("audio_sha256"),
      );
      uploads++;
      const id = form.get("job_id"),
        model = form.get("model"),
        digest = form.get("audio_sha256");
      const result = {
        id,
        model,
        audioSha256: digest,
        text: "Alo o! Iro nwanụ!",
        language: "yo",
        createdAt: new Date().toISOString(),
        segments: [
          { start: 0, end: 1, text: "Alo o!" },
          { start: 2, end: 4, text: "Iro nwanụ!" },
          { start: 35, end: 37, text: "Alo o!" },
        ],
      };
      if (form.get("prompt") === "invalid-fixture")
        result.audioSha256 = "incorrect";
      remoteJobs.set(id, {
        id,
        model,
        audioSha256: digest,
        status: "completed",
        result,
      });
      json(202, { id, model, audioSha256: digest, status: "queued" });
      return;
    }
    if (url.pathname.startsWith("/api/transcriptions/")) {
      const payload = remoteJobs.get(url.pathname.split("/").at(-1));
      json(payload ? 200 : 404, payload ?? {});
      return;
    }
    const upstream = await fetch(
      `http://127.0.0.1:4173${url.pathname}${url.search}`,
    );
    res.writeHead(
      upstream.status,
      Object.fromEntries(
        [...upstream.headers].filter(
          ([key]) =>
            ![
              "content-encoding",
              "transfer-encoding",
              "content-length",
            ].includes(key),
        ),
      ),
    );
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(error) }));
  }
});
await new Promise((resolve) => fixture.listen(4180, "127.0.0.1", resolve));
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1150, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:4180/legacy-setup");
  const original = await page.evaluate(async () => {
    const audio = new Blob(["original unmodified fixture audio"], {
      type: "audio/wav",
    });
    const digest = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", await audio.arrayBuffer()),
      ),
      (v) => v.toString(16).padStart(2, "0"),
    ).join("");
    const story = {
      id: crypto.randomUUID(),
      title: "Native-language fixture",
      storyteller: "Test storyteller",
      location: "Test location",
      region: "West Africa",
      language: "Yoruba",
      license: "Community Tribal Copyright",
      createdAt: new Date().toISOString(),
      duration: 40,
      audio,
      audioSha256: digest,
      transcript: "Human notes remain intact.",
    };
    await new Promise((resolve, reject) => {
      const r = indexedDB.open("pamchenga", 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("stories", { keyPath: "id" });
        r.result.createObjectStore("queue", { keyPath: "id" });
      };
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction("stories", "readwrite");
        tx.objectStore("stories").put(story);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = reject;
      };
      r.onerror = reject;
    });
    return { id: story.id, digest };
  });
  await page.goto("http://127.0.0.1:4180");
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.locator(".story-card").click();
  assert.equal(
    await page.locator("#transcript").inputValue(),
    "Human notes remain intact.",
  );
  await page
    .getByLabel("Whisper model", { exact: true })
    .selectOption("large-v3");
  await page
    .getByLabel("Whisper language hint", { exact: true })
    .selectOption("yo");
  await page
    .getByRole("button", { name: "Queue Whisper transcription", exact: true })
    .click();
  assert.equal(uploads, 0);
  await page.locator("#whisper-form [name=consent]").check();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Queue Whisper transcription", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#whisper-status")
      .textContent.includes("Queued on this device"),
  );
  assert.equal(uploads, 0);
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.reload();
  await page.locator(".story-card").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#whisper-status")
      .textContent.includes("Queued on this device"),
  );
  await context.setOffline(false);
  await page.waitForFunction(
    () =>
      document.querySelector("#whisper-text").textContent ===
      "Alo o! Iro nwanụ!",
    {},
    { timeout: 25000 },
  );
  assert.equal(uploads, 1);
  assert.match(
    await page.locator("#whisper-model-info").innerText(),
    /Large V3/,
  );
  assert.match(
    await page.locator("#whisper-rituals").innerText(),
    /0.0–1.0s, 2.0–4.0s/,
  );
  assert.equal(
    await page.locator("#transcript").inputValue(),
    "Human notes remain intact.",
  );
  await page
    .getByRole("button", {
      name: "Append reviewed draft to notes",
      exact: true,
    })
    .click();
  assert.match(
    await page.locator("#whisper-status").innerText(),
    /Review the original/,
  );
  await page.locator("#whisper-reviewed").check();
  await page
    .locator("#transcript")
    .fill("Human notes remain intact. Unsaved edit.");
  await page
    .getByRole("button", {
      name: "Append reviewed draft to notes",
      exact: true,
    })
    .click();
  await page
    .locator("#whisper-status")
    .filter({ hasText: "Save your existing notes" })
    .waitFor();
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await page.locator("#toast").filter({ hasText: "Notes saved" }).waitFor();
  await page
    .getByRole("button", {
      name: "Append reviewed draft to notes",
      exact: true,
    })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#transcript")
      .value.includes("Unsaved edit.\n\nAlo o! Iro nwanụ!"),
  );
  await page.waitForFunction(
    () => document.querySelector("#apply-whisper").disabled,
  );
  assert.match(await page.locator("#ritual-tags").innerText(), /Alo o!/);
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await context.setOffline(true);
  await page.reload();
  await page.locator(".story-card").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#apply-whisper").disabled &&
      document
        .querySelector("#whisper-text")
        .textContent.includes("Iro nwanụ!"),
  );
  assert.match(
    await page.locator("#transcript").inputValue(),
    /Human notes remain intact/,
  );
  await context.setOffline(false);
  await page.getByLabel("Whisper model", { exact: true }).selectOption("turbo");
  await page
    .getByLabel("Names and spelling cues (optional)", { exact: true })
    .fill("invalid-fixture");
  await page.locator("#whisper-form [name=consent]").check();
  await page
    .getByRole("button", { name: "Queue Whisper transcription", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#whisper-status")
        .textContent.includes("Invalid Whisper transcription result"),
    {},
    { timeout: 25000 },
  );
  const persisted = await page.evaluate(
    async (id) =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open("pamchenga", 2);
        r.onsuccess = () => {
          const db = r.result;
          const request = db
            .transaction("stories")
            .objectStore("stories")
            .get(id);
          request.onsuccess = async () => {
            const story = request.result;
            resolve({
              hash: story.audioSha256,
              text: await story.audio.text(),
              model: story.transcription.model,
              notes: story.transcript,
            });
            db.close();
          };
          request.onerror = reject;
        };
      }),
    original.id,
  );
  assert.equal(persisted.hash, original.digest);
  assert.equal(persisted.text, "original unmodified fixture audio");
  assert.equal(persisted.model, "large-v3");
  assert.match(persisted.notes, /Human notes remain intact/);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: v1→v2 migration, explicit upload permission, offline durable queue, service-worker-only upload/poll, Large V3/Turbo requests, timestamp ritual cues, human review and unsaved-note gates, append/persistence, invalid-result rejection, and original-byte integrity. Model responses are deterministic fixtures, NOT genuine inference.",
  );
} catch (error) {
  console.error(
    "Whisper browser diagnostics:",
    JSON.stringify(
      {
        errors,
        body: await page
          .locator("body")
          .innerText()
          .catch(() => ""),
        cache: await page
          .evaluate(async () => {
            const out = [];
            for (const name of await caches.keys()) {
              const c = await caches.open(name);
              out.push({ name, urls: (await c.keys()).map((r) => r.url) });
            }
            return out;
          })
          .catch(() => []),
      },
      null,
      2,
    ),
  );
  await page
    .screenshot({
      path: join(tmpdir(), "pamchenga-whisper-failure.png"),
      fullPage: true,
    })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
  fixture.closeAllConnections();
  await new Promise((resolve) => fixture.close(resolve));
}
