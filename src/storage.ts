import type { Story, SyncJob } from "./types";
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("pamchenga", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("stories", { keyPath: "id" });
      req.result.createObjectStore("queue", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
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
  changes: Partial<Pick<Story, "transcript" | "learning">>,
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
