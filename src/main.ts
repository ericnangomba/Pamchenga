import "./style.css";
import {
  mountLearningPanel,
  updateLearningMetrics,
  attachLearningEditor,
} from "./learning-ui";
import {
  getStories,
  saveStory,
  queueStory,
  updateStoryMetadata,
} from "./storage";
import { hashAudio, createManifest } from "./agents/provenance-agent";
import { tagTranscriptOpenings } from "./agents/opening-agent";
import type { Story, Region } from "./types";
const app = document.querySelector<HTMLDivElement>("#app")!;
const icons = {
  circle: "◉",
  record: "●",
  library: "▤",
  compass: "◎",
  shield: "◇",
};
let stories: Story[] = [];
let filter = "All stories";
let search = "";
let current = "My circle";
let recorder: MediaRecorder | undefined;
let stream: MediaStream | undefined;
let chunks: Blob[] = [];
let pending: Blob | undefined;
let pendingHash: Promise<string> | undefined;
let duration = 0;
let started = 0;
let timer: number | undefined;
let playbackUrl: string | undefined;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function toast(message: string) {
  const el = document.querySelector<HTMLElement>("#toast")!;
  el.textContent = message;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 4500);
}
const clock = (s: number) =>
  `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
app.innerHTML = `<aside class="sidebar"><a class="brand" href="/" aria-label="Pamchenga home"><img src="/icon.svg" alt=""><span>Pamchenga<small>THE DIGITAL SAND CIRCLE</small></span></a><div class="nav-label">YOUR GATHERING PLACE</div><nav>${[
  ["My circle", icons.circle],
  ["Story collection", icons.library],
  ["Cultural atlas", icons.compass],
  ["Story passports", icons.shield],
]
  .map(
    ([name, icon]) =>
      `<button class="nav-item ${name === "My circle" ? "active" : ""}" data-nav="${name}"><span>${icon}</span>${name}${name === "Story collection" ? '<b id="nav-count">0</b>' : ""}</button>`,
  )
  .join(
    "",
  )}</nav><div class="sidebar-note"><div class="little-circle">✳</div><h3>Every voice belongs.</h3><p>A story shared is a thread that connects generations.</p><span>ROOTED IN UBUNTU</span></div><div class="profile"><div class="avatar">Y</div><div>Your sand circle<small>Personal collection · This device</small></div><span>⌄</span></div></aside><div class="workspace"><header><div class="breadcrumb">Your gathering place <span>/</span> <strong id="crumb">My circle</strong></div><div class="header-right"><span id="connection" class="status"><i></i> Online · local-first</span><button id="install" class="quiet" hidden>Install app →</button><div class="avatar small">Y</div></div></header><main><section class="page-heading"><div><div class="eyebrow">A PLACE FOR OUR STORIES</div><h1 id="page-title">Welcome to your circle<span>.</span></h1><p>Gather the voices of today. Keep the wisdom for tomorrow.</p></div><button class="button primary" id="new-record"><span>＋</span> Record a story</button></section><section class="hero"><div class="hero-copy"><div class="hero-label"><span></span> OUR STORIES. OUR ROOTS. OUR FUTURE.</div><h2>Before there were books,<br>there was a circle.</h2><p>From the first “Padangokhala!” to the last lesson,<br>preserve every voice, song, and moment in between.</p><button class="button sand" id="hero-record">● &nbsp; Start your first story <span>→</span></button><div class="hero-foot">◌ &nbsp; Made to gather stories, even offline.</div></div><div class="circle-art" aria-hidden="true"><div class="orbit o1"></div><div class="orbit o2"></div><div class="orbit o3"></div><div class="orbit o4"></div><div class="orbit o5"></div><div class="sun"></div><div class="flame f1"></div><div class="flame f2"></div><span class="person p1"></span><span class="person p2"></span><span class="person p3"></span><span class="person p4"></span><span class="person p5"></span><span class="person p6"></span><span class="art-caption">PAMCHENGA · TOGETHER IN THE SAND</span></div></section><section class="stats"><div><span class="stat-icon">▤</span><div><strong id="story-total">0</strong><span>Stories preserved</span></div><small>Our living archive</small></div><div><span class="stat-icon">◷</span><div><strong id="minutes-total">0 min</strong><span>Voices captured</span></div><small>Every moment matters</small></div><div><span class="stat-icon">◎</span><div><strong id="language-total">0</strong><span>Languages celebrated</span></div><small>In their own words</small></div></section><section id="collection"><div class="collection-heading"><div><h2 id="collection-title">Around the circle</h2><p id="collection-subtitle">Your stories, safe and close to home.</p></div><label class="search"><span>⌕</span><input id="search" type="search" placeholder="Find a story…" aria-label="Find a story"></label></div><div class="filter-row"><div class="tabs">${["All stories", "Southern Africa", "East Africa", "West Africa"].map((s, i) => `<button data-filter="${s}" class="tab ${i === 0 ? "selected" : ""}">${s}</button>`).join("")}</div><button id="import" class="quiet">↑ &nbsp; Import audio</button><input type="file" id="audio-file" accept="audio/*" hidden></div><div id="story-grid" class="story-grid"></div></section><section class="values"><div><span>⌁</span><div><h3>Keep the whole story</h3><p>The opening chants. The laughter. The songs.</p></div></div><div><span>▧</span><div><h3>Yours, wherever you are</h3><p>Saved on your device. Ready without internet.</p></div></div><div><span>◇</span><div><h3>A traceable beginning</h3><p>Original audio fingerprinted at capture.</p></div></div></section><footer><span>Pamchenga <b>·</b> A living memory, carried together.</span><span>Built on community. Rooted in Africa. <span class="footer-mark">✳</span></span></footer></main></div><div id="toast" role="status"></div><dialog id="capture-dialog"><form id="capture-form"><div class="dialog-top"><span class="eyebrow">ADD TO THE CIRCLE</span><button type="button" class="close" data-close="capture-dialog" aria-label="Close">×</button></div><h2>Every story starts with a voice.</h2><p class="muted">Record with the storyteller’s permission. Rituals and ambient sounds are preserved.</p><div class="recorder"><div class="record-orb" id="record-orb">●</div><strong id="record-time">00:00</strong><span id="record-status">Take a moment. Gather your circle.</span><button type="button" id="toggle-record" class="button primary">Start recording</button></div><label>Story title<input name="title" required maxlength="160" placeholder="Give this memory a name"></label><div class="form-row"><label>Storyteller<input name="storyteller" required maxlength="120" placeholder="Who carries this story?"></label><label>Location<input name="location" required maxlength="160" placeholder="Village, city, country"></label></div><div class="form-row"><label>Region<select aria-label="Region" name="region"><option>Southern Africa</option><option>East Africa</option><option>West Africa</option></select></label><label>Language<input aria-label="Language" name="language" required maxlength="80" placeholder="e.g. Chichewa" list="languages"><datalist id="languages"><option>Chichewa</option><option>isiZulu</option><option>isiXhosa</option><option>Shona</option><option>Kiswahili</option><option>Hausa</option><option>Yoruba</option><option>Igbo</option><option>Wolof</option></datalist></label></div><label>Community license<select aria-label="Community license" name="license"><option>Community Tribal Copyright</option><option>CC BY-NC-SA 4.0</option></select></label><label class="consent"><input name="consent" type="checkbox" required> I have permission to record and store this story on this device.</label><p id="capture-error" class="error" role="alert"></p><button id="save" class="button primary wide" type="submit" disabled>Save story on this device</button></form></dialog><dialog id="detail-dialog"><div id="detail"></div></dialog>`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
mountLearningPanel(download);
function render() {
  updateLearningMetrics(stories);
  $("#story-total").textContent = String(stories.length);
  $("#nav-count").textContent = String(stories.length);
  $("#minutes-total").textContent =
    `${Math.round(stories.reduce((n, s) => n + s.duration, 0) / 60)} min`;
  $("#language-total").textContent = String(
    new Set(stories.map((s) => s.language.toLocaleLowerCase())).size,
  );
  const visible = stories.filter(
    (s) =>
      (filter === "All stories" || s.region === filter) &&
      `${s.title} ${s.storyteller} ${s.language}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  $("#story-grid").innerHTML = visible.length
    ? visible
        .map(
          (s) =>
            `<button class="story-card" data-story="${s.id}"><div class="card-art"><span>◌</span><div class="sound-bars">${Array.from({ length: 25 }, (_, i) => `<i style="height:${12 + ((i * 17) % 43)}px"></i>`).join("")}</div><b>▶</b></div><div class="card-info"><div class="card-meta">${esc(s.region)} <span>· ${clock(s.duration)}</span></div><h3>${esc(s.title)}</h3><p>${esc(s.storyteller)} · ${esc(s.language)}</p><div class="card-bottom"><span>● Saved on device</span><span>${new Date(s.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span></div></div></button>`,
        )
        .join("")
    : `<div class="empty-state"><div class="empty-symbol">◎</div><h3>${stories.length ? "No stories found" : "Your circle is ready. Bring a story."}</h3><p>${stories.length ? "Try another language, title, or region." : "An elder’s wisdom, a childhood tale, a song passed down.<br>Your first story is the beginning of a living collection."}</p><button class="text-button" id="empty-action">${stories.length ? "Clear filters" : "Record your first story"} <span>→</span></button></div>`;
  $("#empty-action")?.addEventListener("click", () => {
    if (stories.length) {
      filter = "All stories";
      search = "";
      $<HTMLInputElement>("#search").value = "";
      document
        .querySelectorAll("[data-filter]")
        .forEach((el) =>
          el.classList.toggle(
            "selected",
            el.getAttribute("data-filter") === filter,
          ),
        );
      render();
    } else openCapture();
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-story]")
    .forEach(
      (el) =>
        (el.onclick = () =>
          showStory(stories.find((s) => s.id === el.dataset.story)!)),
    );
  if (current === "Cultural atlas") renderAtlas();
}
function renderAtlas() {
  $("#story-grid").innerHTML = ["Southern Africa", "East Africa", "West Africa"]
    .map(
      (region) =>
        `<div class="atlas-card"><span>◎</span><h3>${region}</h3><p>${region === "Southern Africa" ? "“Padangokhala!” · “Tilitonse!”" : region === "East Africa" ? "“Hadithi Hadithi!” · “Hadithi Njoo!”" : "“Alo o!” · “Olo o!”"}</p><strong>${stories.filter((s) => s.region === region).length} stories in your circle</strong></div>`,
    )
    .join("");
}
function openCapture() {
  pending = undefined;
  pendingHash = undefined;
  duration = 0;
  $<HTMLFormElement>("#capture-form").reset();
  $<HTMLButtonElement>("#save").disabled = true;
  $("#record-status").textContent = "Take a moment. Gather your circle.";
  $("#record-time").textContent = "00:00";
  $("#capture-error").textContent = "";
  $("#toggle-record").textContent = "Start recording";
  $("#record-orb").classList.remove("recording");
  $<HTMLDialogElement>("#capture-dialog").showModal();
}
async function probeDuration(blob: Blob): Promise<number> {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return 0;
    const ctx = new Ctor();
    try {
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      return Number.isFinite(decoded.duration) ? decoded.duration : 0;
    } finally {
      void ctx.close();
    }
  } catch {
    return 0;
  }
}
async function startRecording() {
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
      throw Error(
        "Recording requires a supported browser on HTTPS or localhost. You can import audio instead.",
      );
    stream = await Promise.race([
      navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: false,
          echoCancellation: false,
          autoGainControl: false,
        },
      }),
      new Promise<never>((_, reject) =>
        window.setTimeout(
          () =>
            reject(
              Error(
                "No answer from the microphone. Check the browser permission prompt, or use Import audio.",
              ),
            ),
          15000,
        ),
      ),
    ]);
    if (!$<HTMLDialogElement>("#capture-dialog").open) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    recorder = new MediaRecorder(stream);
    chunks = [];
    pending = undefined;
    $<HTMLButtonElement>("#save").disabled = true;
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      clearInterval(timer);
      duration = (Date.now() - started) / 1000;
      pending = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
      pendingHash = hashAudio(pending);
      void pendingHash.catch(() => {});
      stream?.getTracks().forEach((t) => t.stop());
      $<HTMLButtonElement>("#save").disabled = !pending.size;
      $("#record-orb").classList.remove("recording");
      $("#record-status").textContent =
        "Recording ready. Add the story’s details below.";
      $("#toggle-record").textContent = "Record again";
    };
    recorder.start(1000);
    started = Date.now();
    timer = window.setInterval(() => {
      $("#record-time").textContent = clock((Date.now() - started) / 1000);
    }, 250);
    $("#record-orb").classList.add("recording");
    $("#toggle-record").textContent = "Stop recording";
    $("#record-status").textContent = "Listening. Let the whole story unfold.";
    $("#capture-error").textContent = "";
  } catch (error) {
    $("#capture-error").textContent =
      error instanceof Error && error.message
        ? error.message
        : "Microphone unavailable. You can import audio instead.";
    $("#record-status").textContent = "Take a moment. Gather your circle.";
    stream?.getTracks().forEach((t) => t.stop());
  }
}
$("#toggle-record").onclick = () => {
  if (recorder?.state === "recording") recorder.stop();
  else void startRecording();
};
for (const id of ["new-record", "hero-record"])
  $(`#${id}`).onclick = openCapture;
for (const btn of document.querySelectorAll<HTMLElement>("[data-close]"))
  btn.onclick = () => $<HTMLDialogElement>(`#${btn.dataset.close}`).close();
$<HTMLDialogElement>("#capture-dialog").addEventListener("close", () => {
  if (recorder?.state === "recording") recorder.stop();
  stream?.getTracks().forEach((t) => t.stop());
  clearInterval(timer);
});
$<HTMLFormElement>("#capture-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pending?.size) return;
  const save = $<HTMLButtonElement>("#save");
  save.disabled = true;
  save.textContent = "Preserving your story…";
  try {
    if ((!Number.isFinite(duration) || duration <= 0) && pending)
      duration = await probeDuration(pending);
    const f = new FormData($<HTMLFormElement>("#capture-form"));
    const story: Story = {
      id: crypto.randomUUID(),
      title: String(f.get("title")).trim(),
      storyteller: String(f.get("storyteller")).trim(),
      location: String(f.get("location")).trim(),
      language: String(f.get("language")).trim(),
      region: String(f.get("region")) as Region,
      license: String(f.get("license")) as Story["license"],
      createdAt: new Date().toISOString(),
      duration,
      audio: pending,
      audioSha256: await (pendingHash ?? hashAudio(pending)),
      transcript: "",
    };
    if (
      !story.title ||
      !story.storyteller ||
      !story.location ||
      !story.language
    )
      throw Error("Please complete all story details.");
    await saveStory(story);
    stories = await getStories();
    $<HTMLDialogElement>("#capture-dialog").close();
    render();
    toast("Story preserved on this device. Your original audio is intact.");
  } catch (error) {
    $("#capture-error").textContent =
      error instanceof Error
        ? error.message
        : "Could not save. Your recording is still available; try again.";
  } finally {
    save.disabled = false;
    save.textContent = "Save story on this device";
  }
});
$("#import").onclick = () => $<HTMLInputElement>("#audio-file").click();
$("#audio-file").addEventListener("change", async () => {
  const file = $<HTMLInputElement>("#audio-file").files?.[0];
  if (!file) return;
  if (!file.type.startsWith("audio/")) {
    toast("Please select an audio file.");
    return;
  }
  openCapture();
  pending = file;
  pendingHash = hashAudio(file);
  void pendingHash.catch(() => {});
  $<HTMLButtonElement>("#save").disabled = false;
  $("#record-status").textContent = `Imported: ${file.name}`;
  $<HTMLInputElement>("[name=title]").value = file.name.replace(/\.[^.]+$/, "");
  const url = URL.createObjectURL(file);
  const audio = new Audio();
  audio.preload = "metadata";
  audio.onloadedmetadata = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      duration = audio.duration;
      $("#record-time").textContent = clock(duration);
    }
    URL.revokeObjectURL(url);
  };
  audio.onerror = () => URL.revokeObjectURL(url);
  audio.src = url;
  void probeDuration(file).then((probed) => {
    if (probed > 0 && (!Number.isFinite(duration) || duration <= 0)) {
      duration = probed;
      $("#record-time").textContent = clock(duration);
    }
  });
  $<HTMLInputElement>("#audio-file").value = "";
});
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ritualTagsHtml(tags: string[] | undefined) {
  if (!tags?.length) return "";
  return `<p class="muted small-text">Ritual openings tagged in this transcript, from text cues only:</p><div class="detail-tags ritual-tags-list">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>`;
}
function showStory(s: Story) {
  if (playbackUrl) URL.revokeObjectURL(playbackUrl);
  playbackUrl = URL.createObjectURL(s.audio);
  $("#detail").innerHTML =
    `<div class="dialog-top"><span class="eyebrow">A STORY IN YOUR CIRCLE</span><button class="close" id="close-detail" aria-label="Close">×</button></div><h2>${esc(s.title)}</h2><p class="muted">${esc(s.storyteller)} · ${esc(s.location)}</p><audio controls src="${playbackUrl}"></audio><div class="detail-tags"><span>${esc(s.language)}</span><span>${esc(s.region)}</span><span>Saved on device</span></div><h3>Story passport</h3><p class="muted">Original audio fingerprint · SHA-256</p><code class="hash">${s.audioSha256}</code><p class="notice">C2PA signature pending. This fingerprint verifies file integrity; a configured C2PA signer is required for certified provenance and device signatures.</p><p class="muted">${esc(s.license)}</p><label>Transcript or storyteller’s notes<textarea id="transcript" rows="4" placeholder="Keep native spellings, tone marks, chants, and songs intact.">${esc(s.transcript)}</textarea></label><p class="muted small-text">Automatic transcription and wisdom extraction await a localized model connection.</p><div id="ritual-tags">${ritualTagsHtml(s.ritualTags)}</div><div class="detail-actions"><button class="button primary" id="save-notes">Save notes</button><button class="button secondary" id="export-audio">Export audio</button><button class="button secondary" id="export-manifest">Export passport</button></div><button class="text-button" id="sync-story">Queue for sync →</button><p class="muted small-text">Sync needs a configured /api/stories service. Queued stories stay on this device until acknowledged.</p>`;
  attachLearningEditor(s, download, async (updated) => {
    s = updated;
    stories = await getStories();
    render();
  });
  $("#close-detail").onclick = () =>
    $<HTMLDialogElement>("#detail-dialog").close();
  $("#export-audio").onclick = () =>
    download(
      s.audio,
      `${s.id}.${s.audio.type.includes("mp4") ? "m4a" : s.audio.type.includes("mpeg") ? "mp3" : s.audio.type.includes("wav") ? "wav" : "webm"}`,
    );
  $("#export-manifest").onclick = () =>
    download(
      new Blob([JSON.stringify(createManifest(s), null, 2)], {
        type: "application/ld+json",
      }),
      `${s.id}.jsonld`,
    );
  $("#save-notes").onclick = async () => {
    try {
      const transcript = $<HTMLTextAreaElement>("#transcript").value;
      const updated = await updateStoryMetadata(s.id, {
        transcript,
        ritualTags: tagTranscriptOpenings(transcript),
      });
      s = updated;
      stories = await getStories();
      $("#ritual-tags").innerHTML = ritualTagsHtml(s.ritualTags);
      toast("Notes saved on this device.");
    } catch {
      toast("Could not save notes. Please try again.");
    }
  };
  $("#sync-story").onclick = async () => {
    try {
      await queueStory(s.id);
      await requestSync();
      toast(
        "Queued locally. Sync will retry when the story service is available.",
      );
    } catch {
      toast("Could not queue the story. Try again.");
    }
  };
  $<HTMLDialogElement>("#detail-dialog").showModal();
}
$<HTMLDialogElement>("#detail-dialog").addEventListener("close", () => {
  $<HTMLAudioElement>("#detail audio")?.pause();
  if (playbackUrl) URL.revokeObjectURL(playbackUrl);
  playbackUrl = undefined;
});
$<HTMLInputElement>("#search").addEventListener("input", () => {
  search = $<HTMLInputElement>("#search").value;
  render();
});
document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach(
  (el) =>
    (el.onclick = () => {
      filter = el.dataset.filter!;
      document
        .querySelectorAll("[data-filter]")
        .forEach((e) => e.classList.toggle("selected", e === el));
      render();
    }),
);
document.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach(
  (el) =>
    (el.onclick = () => {
      current = el.dataset.nav!;
      document
        .querySelectorAll("[data-nav]")
        .forEach((e) => e.classList.toggle("active", e === el));
      $("#crumb").textContent = current;
      $("#page-title").textContent =
        current === "My circle" ? "Welcome to your circle." : current;
      $("#collection-title").textContent =
        current === "Cultural atlas"
          ? "Across the continent"
          : current === "Story passports"
            ? "Your stories, with a traceable origin"
            : "Around the circle";
      $("#collection-subtitle").textContent =
        current === "Story passports"
          ? "Open a story to inspect its audio fingerprint and export its unsigned passport."
          : "Your stories, safe and close to home.";
      render();
      if (current !== "My circle")
        $("#collection").scrollIntoView({ behavior: "smooth", block: "start" });
    }),
);
async function requestSync() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const syncRegistration = registration as ServiceWorkerRegistration & {
    sync?: { register(tag: string): Promise<void> };
  };
  if (syncRegistration.sync) {
    try {
      await syncRegistration.sync.register("pamchenga-sync");
    } catch {
      /* Foreground worker messages retry when Background Sync is denied. */
    }
  }
  registration.active?.postMessage({ type: "SYNC" });
}
function connection() {
  const online = navigator.onLine;
  $("#connection").innerHTML =
    `<i class="${online ? "" : "offline"}"></i> ${online ? "Online · local-first" : "Offline · still gathering"}`;
  if (online) void requestSync().catch(() => {});
}
window.setInterval(() => {
  if (navigator.onLine) void requestSync().catch(() => {});
}, 30000);
window.addEventListener("online", connection);
window.addEventListener("offline", connection);
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
let installEvent: InstallEvent | undefined;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e as InstallEvent;
  $("#install").hidden = false;
});
$("#install").onclick = async () => {
  await installEvent?.prompt();
  if ((await installEvent?.userChoice)?.outcome === "accepted")
    $("#install").hidden = true;
};
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("/sw.js")
    .catch(() => toast("Offline caching is unavailable in this browser."));
void getStories()
  .then((data) => {
    stories = data;
    render();
  })
  .catch(() => {
    render();
    toast("Local storage is unavailable. Check browser storage permissions.");
  });
connection();
