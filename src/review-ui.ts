import { updateStoryMetadata } from "./storage";
import {
  blockers,
  roleLabels,
  signOff,
  splitSegment,
  startReview,
  statusLine,
  updateSegment,
  SIGNOFF_STATEMENT,
} from "./review";
import type { ReviewerRole, Story, TranscriptReview } from "./types";
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const t = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
let dialog: HTMLDialogElement | undefined;
function ensure() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "review-dialog";
  document.body.append(dialog);
  return dialog;
}
export function openReview(
  story: Story,
  onSaved: (updated: Story) => void | Promise<void>,
) {
  const d = ensure();
  let s = story;
  let r: TranscriptReview = startReview(story);
  const url = URL.createObjectURL(story.audio);
  const player = document.createElement("audio");
  player.controls = true;
  player.id = "rv-audio";
  player.src = url;
  let saving: Promise<unknown> = Promise.resolve();
  let stopAt: number | undefined;
  let signoffError = "";
  let draftReviewer = "";
  let draftRole: ReviewerRole = "storyteller";
  let draftListened = false;
  const persist = () => {
    const snapshot = r;
    saving = saving
      .then(() => updateStoryMetadata(s.id, { review: snapshot }))
      .then(async (u) => {
        s = u;
        await onSaved(u);
      })
      .catch(() => {
        const el = d.querySelector("#rv-save");
        if (el) el.textContent = "Could not save on this device. Try again.";
      });
  };
  function head() {
    const done = r.segments.filter((x) => x.confirmed).length;
    const unsure = r.segments.filter((x) => x.flags.unsure).length;
    d.querySelector("#rv-progress")!.innerHTML =
      `<b>${done} of ${r.segments.length}</b> parts checked${unsure ? ` · <b>${unsure}</b> unsure` : ""}<i style="width:${Math.round((100 * done) / r.segments.length)}%"></i>`;
    d.querySelector("#rv-status")!.textContent = statusLine({
      ...s,
      review: r,
    });
    const b = blockers(r);
    d.querySelector("#rv-blockers")!.textContent =
      b.length && !r.signoff ? `Before confirming: ${b.join("; ")}.` : "";
    d.querySelector<HTMLButtonElement>("#rv-confirm")!.disabled =
      !!b.length || !draftReviewer.trim() || !draftListened || !!r.signoff;
    d.querySelector<HTMLElement>("#rv-signed")!.hidden = !r.signoff;
  }
  function body() {
    d.innerHTML = `<div class="rv-top"><span>LISTEN AND CORRECT · PROTOTYPE</span><button class="rv-x" id="rv-close" aria-label="Close">×</button></div><h2>${esc(s.title)}</h2><p class="rv-sub">${esc(s.storyteller)} · ${esc(s.language)}</p><div class="rv-player"></div><p class="rv-lead">Listen first. Fix what you hear. Mark anything you are not sure of. Nothing is guessed for you.</p><div class="rv-status" id="rv-status"></div><div class="rv-progress" id="rv-progress"></div><p class="rv-basis">${r.basedOn === "machine-draft" ? "Starting point: a machine draft. It is kept beside your text for comparison and is never overwritten." : "No machine draft. Type what you hear, and use Split here to cut the recording into parts."}</p><div class="rv-list">${r.segments
      .map(
        (x, i) =>
          `<section class="rv-seg ${x.confirmed ? "ok" : ""}" data-seg="${x.id}"><div class="rv-row"><button class="rv-play" data-play="${x.id}">▶ ${t(x.start)}–${t(x.end)}</button><span class="rv-n">Part ${i + 1}</span></div>${x.machineText !== undefined && x.machineText !== x.text ? `<p class="rv-machine"><b>Machine draft:</b> ${esc(x.machineText)}</p>` : ""}<textarea data-text="${x.id}" rows="3" aria-label="Text for part ${i + 1}" placeholder="Type what you hear, in the speaker's own spelling.">${esc(x.text)}</textarea><div class="rv-flags"><button data-flag="unsure:${x.id}" class="${x.flags.unsure ? "on" : ""}" aria-pressed="${x.flags.unsure}">Unsure</button><button data-flag="unclear:${x.id}" class="${x.flags.unclear ? "on" : ""}" aria-pressed="${x.flags.unclear}">Can't hear clearly</button><button data-flag="cultural:${x.id}" class="${x.flags.cultural ? "on" : ""}" aria-pressed="${x.flags.cultural}">Needs a cultural note</button></div>${x.flags.cultural ? `<textarea data-note="${x.id}" rows="2" aria-label="Cultural note for part ${i + 1}" placeholder="Proverb, song, name or ritual: say what it means, in the speaker's words.">${esc(x.note ?? "")}</textarea>` : ""}<div class="rv-row"><button class="rv-check ${x.confirmed ? "on" : ""}" data-check="${x.id}" ${x.flags.unsure ? "disabled" : ""}>${x.confirmed ? "✓ Checked" : "Mark as checked"}</button><button class="rv-split" data-split="${x.id}">Split here</button></div></section>`,
      )
      .join(
        "",
      )}</div><section class="rv-sign"><h3>Confirm the text</h3><p id="rv-blockers" class="rv-block"></p><label>Reviewer's name<input id="rv-name" maxlength="120" value="${esc(draftReviewer)}" autocomplete="off"></label><label>Who is confirming?<select id="rv-role">${(Object.keys(roleLabels) as ReviewerRole[]).map((k) => `<option value="${k}" ${k === draftRole ? "selected" : ""}>${roleLabels[k]}</option>`).join("")}</select></label><label class="rv-listen"><input type="checkbox" id="rv-listened" ${draftListened ? "checked" : ""}> ${SIGNOFF_STATEMENT}</label><p id="rv-err" class="rv-block" role="alert">${esc(signoffError)}</p><button class="rv-confirm" id="rv-confirm">Confirm text</button><p id="rv-signed" class="rv-done" hidden>Confirmed. If anyone edits the text later, this confirmation is cleared and it needs checking again.</p><p class="rv-fine">This records who listened and checked. It does not prove the text or its meaning is correct, especially if the person confirming is not the storyteller. Translation is not part of this prototype: nothing here is translated, and no translation is marked reviewed. Your audio and its fingerprint are not changed. Nothing leaves this device.</p><p id="rv-save" class="rv-fine" role="status"></p></section>`;
    d.querySelector(".rv-player")!.append(player);
    head();
  }
  function rerender(keep?: { id: string; kind: "text" | "note"; pos: number }) {
    const y = d.scrollTop;
    body();
    d.scrollTop = y;
    if (keep) {
      const el = d.querySelector<HTMLTextAreaElement>(
        `[data-${keep.kind}="${keep.id}"]`,
      );
      el?.focus();
      el?.setSelectionRange(keep.pos, keep.pos);
    }
  }
  const audio = () => player;
  /** Typing updates in place so the audio keeps playing and the cursor stays put. */
  function softUpdate(id: string) {
    const x = r.segments.find((z) => z.id === id)!;
    const sec = d.querySelector<HTMLElement>(`[data-seg="${id}"]`)!;
    sec.classList.toggle("ok", x.confirmed);
    const c = sec.querySelector<HTMLButtonElement>("[data-check]")!;
    c.classList.toggle("on", x.confirmed);
    c.textContent = x.confirmed ? "✓ Checked" : "Mark as checked";
    head();
  }
  d.onclick = (e) => {
    const el = e.target as HTMLElement;
    const btn = el.closest<HTMLElement>("button");
    if (!btn) return;
    if (btn.id === "rv-close") return void d.close();
    if (btn.dataset.play) {
      const x = r.segments.find((z) => z.id === btn.dataset.play)!;
      const a = audio();
      a.currentTime = x.start;
      stopAt = x.end;
      void a.play().catch(() => {});
    } else if (btn.dataset.check) {
      const x = r.segments.find((z) => z.id === btn.dataset.check)!;
      r = updateSegment(r, x.id, { confirmed: !x.confirmed });
      persist();
      rerender();
    } else if (btn.dataset.flag) {
      const [k, id] = btn.dataset.flag.split(":");
      const x = r.segments.find((z) => z.id === id)!;
      const key = k as "unsure" | "unclear" | "cultural";
      r = updateSegment(r, id, { flags: { [key]: !x.flags[key] } });
      persist();
      rerender();
    } else if (btn.dataset.split) {
      const before = r;
      r = splitSegment(r, btn.dataset.split, audio().currentTime);
      if (r !== before) persist();
      rerender();
    } else if (btn.id === "rv-confirm") {
      try {
        r = signOff(r, draftReviewer, draftRole, draftListened);
        signoffError = "";
        persist();
      } catch (err) {
        signoffError = (err as Error).message;
      }
      rerender();
    }
  };
  d.oninput = (e) => {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (el.dataset.text) {
      r = updateSegment(r, el.dataset.text, { text: el.value });
      persist();
      softUpdate(el.dataset.text);
    } else if (el.dataset.note) {
      r = updateSegment(r, el.dataset.note, { note: el.value });
      persist();
      softUpdate(el.dataset.note);
    } else if (el.id === "rv-name") {
      draftReviewer = el.value;
      head();
    }
  };
  d.onchange = (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    if (el.id === "rv-role") draftRole = el.value as ReviewerRole;
    if (el.id === "rv-listened") {
      draftListened = (el as HTMLInputElement).checked;
      head();
    }
  };
  d.addEventListener(
    "timeupdate",
    () => {
      if (stopAt !== undefined && audio().currentTime >= stopAt) {
        audio().pause();
        stopAt = undefined;
      }
    },
    true,
  );
  d.addEventListener(
    "close",
    () => {
      audio()?.pause();
      URL.revokeObjectURL(url);
      void saving.then(() => onSaved(s));
    },
    { once: true },
  );
  body();
  d.showModal();
}
