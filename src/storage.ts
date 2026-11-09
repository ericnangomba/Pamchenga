import { requirePermission } from "./consent";
import { hostedWhisper, maxTranscriptionBytes } from "./transcription-config";
import { tagTranscriptOpenings } from "./agents/opening-agent";
import type { Story, SyncJob, TranscriptionJob, WhisperModel } from "./types";
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("pamchenga", 2);
    req.onupgradeneeded = () => {
      for (const name of ["stories", "queue", "transcriptions"]) {
        if (!req.result.objectStoreNames.contains(name))
          req.result.createObjectStore(name, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}
export async function saveStory(story: Story): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("stories", "readwrite");
    tx.objectStore("stories").put(story);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
/** Delete a story together with any sync or transcription jobs that reference it, in one transaction. */
export async function deleteStory(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["stories", "queue", "transcriptions"],
      "readwrite",
    );
    tx.objectStore("stories").delete(id);
    tx.objectStore("queue").delete(id);
    const jobs = tx.objectStore("transcriptions").getAll();
    jobs.onsuccess = () => {
      for (const job of jobs.result as TranscriptionJob[]) {
        if (job.storyId === id) tx.objectStore("transcriptions").delete(job.id);
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getStories(): Promise<Story[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("stories");
    const req = tx.objectStore("stories").getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as Story[]).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
export async function queueStory(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["stories", "queue"], "readwrite");
    const stories = tx.objectStore("stories").get(id);
    stories.onsuccess = () => {
      if (!stories.result) {
        tx.abort();
        return;
      }
      try { requirePermission(stories.result as Story, "backup"); } catch { tx.abort(); return; }
      const job: SyncJob = {
        id,
        attempts: 0,
        nextAttempt: Date.now(),
        status: "queued",
      };
      tx.objectStore("queue").put(job);
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(new Error("Save the story before syncing."));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Merge editable metadata in one transaction so notes and lesson saves cannot erase each other. */
export async function updateStoryMetadata(
  id: string,
  changes: Partial<
    Pick<Story, "transcript" | "ritualTags" | "learning" | "transcription" | "consent" | "consentHistory">
  >,
): Promise<Story> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("stories", "readwrite");
    const store = tx.objectStore("stories");
    const request = store.get(id);
    let updated: Story | undefined;
    request.onsuccess = () => {
      if (!request.result) {
        tx.abort();
        return;
      }
      updated = { ...(request.result as Story), ...changes };
      store.put(updated);
    };
    tx.oncomplete = () => {
      db.close();
      resolve(updated!);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("The original story is unavailable."));
    };
  });
}

export async function queueTranscription(
  storyId: string,
  model: WhisperModel,
  language: string,
  prompt: string,
): Promise<TranscriptionJob> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["stories", "transcriptions"], "readwrite");
    const store = tx.objectStore("transcriptions");
    let job: TranscriptionJob;
    const request = tx.objectStore("stories").get(storyId);
    request.onsuccess = () => {
      if (!request.result) {
        tx.abort();
        return;
      }
      if (request.result.audio.size > maxTranscriptionBytes) {
        tx.abort();
        return;
      }
      const jobs = store.getAll();
      jobs.onsuccess = () => {
        const pending = (jobs.result as TranscriptionJob[]).find(
          (j) =>
            j.storyId === storyId &&
            (j.status === "queued" || j.status === "running"),
        );
        job = pending ?? {
          id: crypto.randomUUID(),
          storyId,
          model,
          language,
          prompt,
          status: "queued",
          attempts: 0,
          nextAttempt: Date.now(),
          accepted: false,
          hosted: hostedWhisper,
          createdAt: new Date().toISOString(),
        };
        if (!pending) store.put(job);
      };
    };
    tx.oncomplete = () => {
      db.close();
      resolve(job);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(
        tx.error ??
          Error(
            `Save audio first. Whisper uploads must fit the selected service limit (${hostedWhisper ? 4 : 100} MiB).`,
          ),
      );
    };
  });
}
export async function getTranscriptionJobs(
  storyId: string,
): Promise<TranscriptionJob[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("transcriptions");
    const request = tx.objectStore("transcriptions").getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as TranscriptionJob[])
          .filter((j) => j.storyId === storyId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Apply a reviewed draft atomically; concurrent edits or a newer draft must never be overwritten. */
export async function appendReviewedDraft(
  id: string,
  jobId: string,
  expectedNotes: string,
): Promise<Story> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("stories", "readwrite");
    const store = tx.objectStore("stories");
    const request = store.get(id);
    let updated: Story;
    let failure = "Could not save the reviewed draft.";
    request.onsuccess = () => {
      const story = request.result as Story | undefined;
      const result = story?.transcription;
      if (
        !story ||
        !result ||
        result.id !== jobId ||
        result.reviewedAt ||
        !result.text.trim()
      ) {
        failure =
          "A new or already-used draft is available. Review the current draft first.";
        tx.abort();
        return;
      }
      if (story.transcript !== expectedNotes) {
        failure =
          "Save your existing notes before appending the Whisper draft. Concurrent edits were preserved.";
        tx.abort();
        return;
      }
      const transcript = [story.transcript, result.text]
        .filter(Boolean)
        .join("\n\n");
      updated = {
        ...story,
        transcript,
        ritualTags: tagTranscriptOpenings(transcript),
        transcription: { ...result, reviewedAt: new Date().toISOString() },
      };
      store.put(updated);
    };
    tx.oncomplete = () => {
      db.close();
      resolve(updated);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(Error(failure));
    };
  });
}
