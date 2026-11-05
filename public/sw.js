import { validateWhisperResponse } from "/whisper-result.js";
const CACHE = "pamchenga-v3";
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([
        "/",
        "/icon.svg",
        "/icon-192.png",
        "/icon-512.png",
        "/manifest.webmanifest",
        "/whisper-result.js",
      ]);
      // Cache the production entry bundle and stylesheet on the first visit,
      // rather than requiring an extra online reload before offline use.
      const shell = await cache.match("/");
      if (!shell) throw Error("App shell was not cached");
      const html = await shell.text();
      const assets = [...html.matchAll(/["'](\/assets\/[^"']+)["']/g)].map(
        (match) => match[1],
      );
      if (!assets.length && !html.includes("/src/main.ts"))
        throw Error("Production assets were not found");
      if (assets.length) await cache.addAll([...new Set(assets)]);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        // Immutable bundles are identical despite Vite's Vary: Origin header.
        const cached = await cache.match(event.request, { ignoreVary: true });
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      }),
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)),
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate")
          return (await caches.match("/")) || Response.error();
        return Response.error();
      }),
  );
});
function database() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("pamchenga", 2);
    r.onupgradeneeded = () => {
      for (const name of ["stories", "queue", "transcriptions"]) {
        if (!r.result.objectStoreNames.contains(name))
          r.result.createObjectStore(name, { keyPath: "id" });
      }
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
  });
}
function read(db, store, key) {
  return new Promise((resolve, reject) => {
    const r =
      key === undefined
        ? db.transaction(store).objectStore(store).getAll()
        : db.transaction(store).objectStore(store).get(key);
    r.onsuccess = () => {
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
  });
}
function put(db, job) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    tx.objectStore("queue").put(job);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
let running;
function flush() {
  if (running) return running;
  running = Promise.allSettled([performFlush(), performTranscriptions()])
    .then((results) => {
      if (results.some((r) => r.status === "rejected"))
        throw Error("Jobs remain queued");
    })
    .finally(() => {
      running = null;
    });
  return running;
}
async function performFlush() {
  const db = await database();
  let failed = false;
  try {
    for (const job of await read(db, "queue")) {
      if (job.status === "synced") continue;
      if (job.nextAttempt > Date.now()) {
        failed = true;
        continue;
      }
      try {
        const story = await read(db, "stories", job.id);
        if (!story) throw Error("Missing local story");
        const data = new FormData();
        const { audio, ...metadata } = story;
        data.append("audio", audio, "original-audio");
        data.append("metadata", JSON.stringify(metadata));
        const response = await fetch("/api/stories", {
          method: "POST",
          body: data,
          headers: { "Idempotency-Key": job.id },
        });
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("application/json")
        )
          throw Error("Sync endpoint unavailable");
        const ack = await response.json();
        if (ack.id !== job.id || ack.audioSha256 !== story.audioSha256)
          throw Error("Invalid acknowledgement");
        await put(db, { ...job, status: "synced" });
      } catch {
        failed = true;
        const attempts = job.attempts + 1;
        await put(db, {
          ...job,
          attempts,
          nextAttempt:
            Date.now() + Math.min(3600000, 1000 * 2 ** Math.min(attempts, 12)),
        });
      }
    }
  } finally {
    db.close();
  }
  if (failed) throw Error("Stories remain queued");
}
self.addEventListener("sync", (event) => {
  if (event.tag === "pamchenga-sync") event.waitUntil(flush());
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SYNC") event.waitUntil(flush().catch(() => {}));
});

function saveTranscriptionJob(db, job, result) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["transcriptions", "stories"], "readwrite");
    tx.objectStore("transcriptions").put(job);
    if (result) {
      const r = tx.objectStore("stories").get(job.storyId);
      r.onsuccess = () => {
        if (!r.result || r.result.audioSha256 !== result.audioSha256) {
          tx.abort();
          return;
        }
        tx.objectStore("stories").put({ ...r.result, transcription: result });
      };
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error("Story integrity mismatch"));
  });
}
async function performTranscriptions() {
  const db = await database();
  let pending = false;
  try {
    for (const job of await read(db, "transcriptions")) {
      if (job.status === "completed" || job.status === "failed") continue;
      if (job.nextAttempt > Date.now()) {
        pending = true;
        continue;
      }
      try {
        const story = await read(db, "stories", job.storyId);
        if (!story) throw Error("Original audio is unavailable");
        let response;
        if (job.accepted) {
          response = await fetch(
            `/api/transcriptions/${encodeURIComponent(job.id)}`,
            { cache: "no-store", signal: AbortSignal.timeout(30000) },
          );
        } else {
          const form = new FormData();
          form.append("audio", story.audio, "original-audio");
          form.append("job_id", job.id);
          form.append("audio_sha256", story.audioSha256);
          form.append("model", job.model);
          form.append("language", job.language);
          form.append("region", story.region);
          form.append("prompt", job.prompt);
          response = await fetch("/api/transcriptions", {
            method: "POST",
            body: form,
            signal: AbortSignal.timeout(120000),
          });
        }
        if (job.accepted && response.status === 404) {
          await saveTranscriptionJob(db, {
            ...job,
            accepted: false,
            nextAttempt: Date.now() + 2000,
            error: "Server job expired. Original audio will be resubmitted.",
          });
          pending = true;
          continue;
        }
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("application/json")
        ) {
          if ([400, 401, 403, 409, 413, 422].includes(response.status)) {
            await saveTranscriptionJob(db, {
              ...job,
              status: "failed",
              error: `Whisper service rejected the request (${response.status}). Check server access, model/language and upload size.`,
            });
            continue;
          }
          throw Error(
            "Whisper backend unavailable. Local audio and queued request are safe; retries continue when the service is reachable.",
          );
        }
        const payload = validateWhisperResponse(
          await response.json(),
          job,
          story,
        );
        if (payload.status === "completed")
          await saveTranscriptionJob(
            db,
            { ...job, status: "completed", accepted: true, error: undefined },
            payload.result,
          );
        else if (payload.status === "failed")
          await saveTranscriptionJob(db, {
            ...job,
            status: "failed",
            accepted: true,
            error:
              "Whisper could not transcribe this recording. Check the audio and installed server model weights; your original audio is unchanged.",
          });
        else {
          pending = true;
          await saveTranscriptionJob(db, {
            ...job,
            status: payload.status,
            accepted: true,
            error: undefined,
            nextAttempt: Date.now() + 5000,
          });
        }
      } catch (error) {
        pending = true;
        const attempts = job.attempts + 1;
        await saveTranscriptionJob(db, {
          ...job,
          attempts,
          error:
            error instanceof Error ? error.message : "Whisper request failed",
          nextAttempt:
            Date.now() + Math.min(3600000, 1000 * 2 ** Math.min(attempts, 12)),
        });
      }
    }
  } finally {
    db.close();
  }
  for (const client of await self.clients.matchAll())
    client.postMessage({ type: "TRANSCRIPTIONS_UPDATED" });
  if (pending) throw Error("Transcriptions remain queued");
}
