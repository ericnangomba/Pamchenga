// Full Netlify-mode browser flow using the actual function handler and a mocked Groq response.
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createHostedWhisperHandler } from "../netlify/lib/hosted-whisper";
const accessCode = "fixture-pilot-access-code-not-real";
const apiKey = "fixture-provider-key-not-real";
let calls = 0;
const mappedModels: string[] = [];
const handler = createHostedWhisperHandler(
  { apiKey, accessCode },
  async (_input, init) => {
    calls++;
    const form = init!.body as FormData;
    mappedModels.push(String(form.get("model")));
    if (String(form.get("prompt")).includes("invalid-fixture"))
      return Response.json({
        text: "invalid",
        language: "yoruba",
        segments: [{ start: -1, end: 2, text: "invalid" }],
      });
    return Response.json({
      text: "Alo o! Iro nwanụ!",
      language: "yoruba",
      segments: [{ start: 0, end: 2, text: "Alo o! Iro nwanụ!" }],
    });
  },
);
const fixture = createServer(async (req, res) => {
  try {
    const url = new URL(req.url!, "http://127.0.0.1:4181");
    if (url.pathname === "/seed") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<!doctype html><title>Pilot access fixture</title>");
      return;
    }
    if (url.pathname.startsWith("/api/transcriptions")) {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers))
        if (value !== undefined)
          headers.set(name, Array.isArray(value) ? value.join(",") : value);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const method = req.method ?? "GET";
      const request = new Request(url, {
        method,
        headers,
        body:
          method === "GET" || method === "HEAD"
            ? undefined
            : Buffer.concat(chunks),
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const upstream = await fetch(
      "http://127.0.0.1:4173" + url.pathname + url.search,
    );
    res.writeHead(
      upstream.status,
      Object.fromEntries(
        [...upstream.headers].filter(
          ([name]) =>
            ![
              "content-encoding",
              "content-length",
              "transfer-encoding",
            ].includes(name),
        ),
      ),
    );
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end("Fixture failure");
  }
});
await new Promise<void>((resolve) =>
  fixture.listen(4181, "127.0.0.1", resolve),
);
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
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:4181/seed");
  await page.evaluate(async () => {
    const audio = new Blob(["original pilot fixture audio"], {
      type: "audio/wav",
    });
    const digest = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", await audio.arrayBuffer()),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const story = {
      id: crypto.randomUUID(),
      title: "Pilot fixture",
      storyteller: "Test storyteller",
      location: "Test location",
      region: "West Africa",
      language: "Yoruba",
      license: "Community Tribal Copyright",
      createdAt: new Date().toISOString(),
      duration: 30,
      audio,
      audioSha256: digest,
      transcript: "Human notes.",
    };
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("pamchenga", 2);
      r.onupgradeneeded = () => {
        for (const name of ["stories", "queue", "transcriptions"])
          r.result.createObjectStore(name, { keyPath: "id" });
      };
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction(["stories", "transcriptions"], "readwrite");
        tx.objectStore("stories").put(story);
        tx.objectStore("transcriptions").put({
          id: crypto.randomUUID(),
          storyId: story.id,
          model: "turbo",
          language: "yo",
          prompt: "",
          hosted: false,
          status: "queued",
          attempts: 0,
          nextAttempt: 0,
          accepted: false,
          createdAt: new Date().toISOString(),
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      r.onerror = () => reject(r.error);
    });
  });
  await page.goto("http://127.0.0.1:4181");
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.locator(".story-card").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#whisper-status")!
      .textContent!.includes("provider changed"),
  );
  assert.equal(calls, 0);
  assert.match(await page.locator("#whisper-form").innerText(), /Groq/);
  await page
    .getByLabel("Whisper model", { exact: true })
    .selectOption("large-v3");
  await page
    .getByLabel("Whisper language hint", { exact: true })
    .selectOption("yo");
  await page.locator("#whisper-form [name=consent]").check();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Queue Whisper transcription", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#whisper-status")!
      .textContent!.includes("Queued on this device"),
  );
  assert.equal(calls, 0);
  await context.setOffline(false);
  await page.waitForFunction(
    () =>
      document
        .querySelector("#whisper-status")!
        .textContent!.includes("access code"),
    null,
    { timeout: 20000 },
  );
  await page
    .getByLabel("Transcription access code", { exact: true })
    .fill("wrong-code");
  await page
    .getByRole("button", { name: "Use access code / resume", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#whisper-status")!
      .textContent!.includes("not accepted"),
  );
  assert.equal(calls, 0);
  await page
    .getByLabel("Transcription access code", { exact: true })
    .fill(accessCode);
  await page
    .getByRole("button", { name: "Use access code / resume", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#whisper-text")!.textContent ===
      "Alo o! Iro nwanụ!",
  );
  assert.equal(calls, 1);
  assert.equal(mappedModels[0], "whisper-large-v3");
  assert.equal(await page.locator("#transcript").inputValue(), "Human notes.");
  await page.locator("#whisper-reviewed").check();
  await page
    .getByRole("button", {
      name: "Append reviewed draft to notes",
      exact: true,
    })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector<HTMLTextAreaElement>("#transcript")!
      .value.includes("Human notes.\n\nAlo o! Iro nwanụ!"),
  );
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  const state = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const r = indexedDB.open("pamchenga", 2);
        r.onsuccess = () => {
          const db = r.result;
          const q = db
            .transaction("transcriptions")
            .objectStore("transcriptions")
            .getAll();
          q.onsuccess = () => {
            resolve(JSON.stringify(q.result));
            db.close();
          };
          q.onerror = () => reject(q.error);
        };
      }),
  );
  assert.ok(!state.includes(accessCode));
  assert.ok(!state.includes(apiKey));
  // Simulate worker memory loss: queued work remains durable, but the secret must be re-entered.
  await page.evaluate(() =>
    navigator.serviceWorker.controller!.postMessage({
      type: "SET_WHISPER_ACCESS",
      code: "",
    }),
  );
  await page.reload();
  await page.locator(".story-card").click();
  await page.getByLabel("Whisper model", { exact: true }).selectOption("turbo");
  await page.locator("#whisper-form [name=consent]").check();
  await page
    .getByRole("button", { name: "Queue Whisper transcription", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#whisper-status")!
      .textContent!.includes("access code"),
  );
  assert.equal(calls, 1);
  await page
    .getByLabel("Transcription access code", { exact: true })
    .fill(accessCode);
  await page
    .getByRole("button", { name: "Use access code / resume", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#whisper-model-info")!
      .textContent!.includes("Turbo"),
  );
  assert.equal(calls, 2);
  assert.equal(mappedModels[1], "whisper-large-v3-turbo");
  await page
    .getByLabel("Names and spelling cues (optional)", { exact: true })
    .fill("invalid-fixture");
  await page
    .getByRole("button", { name: "Queue Whisper transcription", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#whisper-status")!
      .textContent!.includes("invalid text or timestamps"),
  );
  assert.equal(calls, 3);
  await page.waitForTimeout(3000);
  assert.equal(calls, 3);
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  const oversizedId = await page.evaluate(async () => {
    const audio = new Blob([new Uint8Array(4 * 1024 * 1024 + 1)], {
      type: "audio/wav",
    });
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", await audio.arrayBuffer()),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const id = crypto.randomUUID();
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("pamchenga", 2);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction("stories", "readwrite");
        tx.objectStore("stories").put({
          id,
          title: "Oversized original",
          storyteller: "Fixture",
          location: "Test location",
          region: "West Africa",
          language: "Yoruba",
          license: "Community Tribal Copyright",
          createdAt: new Date().toISOString(),
          duration: 180,
          audio,
          audioSha256: hash,
          transcript: "",
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    return id;
  });
  await page.reload();
  await page
    .locator(".story-card")
    .filter({ hasText: "Oversized original" })
    .click();
  await page.locator("#whisper-form [name=consent]").check();
  await page
    .getByRole("button", { name: "Queue Whisper transcription", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.querySelector("#whisper-status")!.textContent!.includes("4 MiB"),
  );
  assert.equal(calls, 3);
  const oversizedState = await page.evaluate(
    (id) =>
      new Promise<{ size: number; jobs: number }>((resolve, reject) => {
        const r = indexedDB.open("pamchenga", 2);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(["stories", "transcriptions"]);
          const story = tx.objectStore("stories").get(id);
          const jobs = tx.objectStore("transcriptions").getAll();
          tx.oncomplete = () => {
            resolve({
              size: story.result.audio.size,
              jobs: jobs.result.filter(
                (j: { storyId: string }) => j.storyId === id,
              ).length,
            });
            db.close();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    oversizedId,
  );
  assert.equal(oversizedState.size, 4 * 1024 * 1024 + 1);
  assert.equal(oversizedState.jobs, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Netlify/Groq browser mode, renewed provider consent, offline queue, missing/wrong/correct pilot access, server-only provider key, both model mappings, reviewed notes, no persisted credentials, invalid-provider failure without paid retries, and oversized originals preserved without upload. Groq responses are mocked.",
  );
} finally {
  await browser.close();
  fixture.closeAllConnections();
  await new Promise<void>((resolve) => fixture.close(() => resolve()));
}
