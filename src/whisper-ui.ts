import {
  getStories,
  getTranscriptionJobs,
  queueTranscription,
  appendReviewedDraft,
} from "./storage";
import { tagOpenings } from "./agents/opening-agent";
import type { Story, WhisperModel } from "./types";

/** Local queue and review UI. Every remote request is made by the service worker. */
export function attachWhisperEditor(
  story: Story,
  requestSync: () => Promise<void>,
  onSaved: (story: Story) => Promise<void>,
) {
  document
    .querySelector("#detail")!
    .insertAdjacentHTML(
      "beforeend",
      `<section class="whisper-editor" aria-labelledby="whisper-title"><span class="eyebrow">FOLKLORE AGENT · SPEECH TO TEXT</span><h3 id="whisper-title">Transcribe with OpenAI Whisper</h3><p class="muted">Large V3 / Turbo · Multilingual models covering 99+ languages. Accuracy varies by language, dialect and recording. Chichewa and isiZulu are not explicit language hints in these models; automatic detection may be incorrect. Review every native spelling, tone mark and opening chant.</p><form id="whisper-form"><div class="form-row"><label>Whisper model<select aria-label="Whisper model" name="model"><option value="turbo">Turbo · faster transcription</option><option value="large-v3">Large V3 · larger model</option></select></label><label>Whisper language hint<select aria-label="Whisper language hint" name="language"><option value="auto">Automatic detection</option><option value="sw">Kiswahili</option><option value="ha">Hausa</option><option value="yo">Yoruba</option><option value="sn">Shona</option><option value="af">Afrikaans</option><option value="am">Amharic</option><option value="so">Somali</option><option value="en">English</option></select></label></div><label>Names and spelling cues (optional)<textarea name="prompt" maxlength="1000" rows="2" placeholder="Native names or phrases that should keep their original spelling"></textarea></label><label class="consent"><input name="consent" type="checkbox" required> I have permission to send this original audio to the configured Whisper server for transcription.</label><p class="muted small-text">Queued locally first. Requires a same-origin Python backend with downloaded weights; a static Netlify ZIP alone cannot run these models. No OpenAI API key is sent from the browser. No cropping, translation, or voice-activity filter is applied. Audio uploads are deleted by the backend after processing.</p><button class="button primary" type="submit">Queue Whisper transcription</button></form><p id="whisper-status" class="small-text" role="status"></p><div id="whisper-draft" hidden><h4>Machine-generated draft · human review required</h4><p id="whisper-model-info" class="muted small-text"></p><pre id="whisper-text" class="transcript-draft" tabindex="0"></pre><p id="whisper-rituals" class="muted small-text"></p><label class="consent"><input id="whisper-reviewed" type="checkbox"> I have checked the wording, language, native spellings and ritual openings against the audio.</label><button class="button secondary" id="apply-whisper" type="button">Append reviewed draft to notes</button></div></section>`,
    );
  const form = document.querySelector<HTMLFormElement>("#whisper-form")!;
  const root = document.querySelector<HTMLElement>(".whisper-editor")!;
  const status = root.querySelector<HTMLElement>("#whisper-status")!;
  let active = true;
  let polling = false;
  let displayedResultId = "";
  async function refresh() {
    if (!active || polling) return;
    polling = true;
    try {
      const [jobs, all] = await Promise.all([
        getTranscriptionJobs(story.id),
        getStories(),
      ]);
      if (!active) return;
      const latest = all.find((s) => s.id === story.id);
      const job = jobs[0];
      if (job)
        status.textContent =
          job.status === "completed"
            ? "Whisper draft saved locally. Check the audio before using it."
            : job.status === "failed"
              ? `Transcription failed. ${job.error ?? ""}`
              : `${job.status === "running" ? "Transcribing on the server" : "Queued on this device"} · ${job.model === "turbo" ? "Turbo" : "Large V3"}. ${job.error ?? "Waiting for the configured backend."}`;
      const pending = jobs.some(
        (j) => j.status === "queued" || j.status === "running",
      );
      const submit = form.querySelector<HTMLButtonElement>("[type=submit]")!;
      submit.disabled = pending;
      submit.textContent = pending
        ? "Transcription request pending"
        : "Queue Whisper transcription";
      if (pending && navigator.onLine && job && job.nextAttempt <= Date.now())
        void requestSync().catch(() => {});
      const result = latest?.transcription;
      if (!result) return;
      root.querySelector<HTMLElement>("#whisper-draft")!.hidden = false;
      root.querySelector("#whisper-text")!.textContent =
        result.text ||
        "(No speech text returned. Listen and review; no transcript has been added to notes.)";
      root.querySelector("#whisper-model-info")!.textContent =
        `${result.model === "turbo" ? "Turbo" : "Large V3"} · detected language: ${result.language} · ${result.segments.length} timestamped segments`;
      const rituals = tagOpenings(result.segments);
      root.querySelector("#whisper-rituals")!.textContent = rituals.length
        ? `Opening ritual text cues: ${rituals.map((r) => `${r.start.toFixed(1)}–${r.end.toFixed(1)}s`).join(", ")}. Text matches only; confirm acoustically.`
        : "No opening ritual text cue matched in the first 30 seconds. This does not mean no ritual was spoken.";
      if (result.id !== displayedResultId) {
        root.querySelector<HTMLInputElement>("#whisper-reviewed")!.checked =
          false;
        displayedResultId = result.id;
      }
      const apply = root.querySelector<HTMLButtonElement>("#apply-whisper")!;
      apply.disabled = !!result.reviewedAt || !result.text.trim();
      apply.textContent = result.reviewedAt
        ? "Reviewed draft already added to notes"
        : "Append reviewed draft to notes";
    } catch {
      if (active)
        status.textContent =
          "Could not read local transcription state. Your audio has not been changed.";
    } finally {
      polling = false;
    }
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const data = new FormData(form);
      if (!data.has("consent"))
        throw Error("Permission is required before sending audio.");
      await queueTranscription(
        story.id,
        String(data.get("model")) as WhisperModel,
        String(data.get("language")),
        String(data.get("prompt")).trim(),
      );
      status.textContent =
        "Saved locally. Whisper will run when the configured backend is available.";
      // Registration may fail in browsers without Background Sync; foreground messages still retry.
      await requestSync().catch(() => {});
      await refresh();
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Could not queue transcription.";
    }
  });
  root.querySelector<HTMLButtonElement>("#apply-whisper")!.onclick =
    async () => {
      try {
        if (!root.querySelector<HTMLInputElement>("#whisper-reviewed")!.checked)
          throw Error(
            "Review the original audio and confirm the wording first.",
          );
        const notes =
          document.querySelector<HTMLTextAreaElement>("#transcript")!;
        const updated = await appendReviewedDraft(
          story.id,
          displayedResultId,
          notes.value,
        );
        notes.value = updated.transcript;
        await onSaved(updated);
        await refresh();
        status.textContent =
          "Reviewed draft appended to notes. Existing notes and original audio were preserved.";
      } catch (error) {
        status.textContent =
          error instanceof Error
            ? error.message
            : "Could not save the reviewed draft.";
      }
    };
  const update = () => void refresh();
  navigator.serviceWorker?.addEventListener("message", update);
  const timer = window.setInterval(() => void refresh(), 2000);
  document.querySelector<HTMLDialogElement>("#detail-dialog")!.addEventListener(
    "close",
    () => {
      active = false;
      clearInterval(timer);
      navigator.serviceWorker?.removeEventListener("message", update);
    },
    { once: true },
  );
  void refresh();
}
