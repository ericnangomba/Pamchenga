import { updateStoryMetadata } from "./storage";
import {
  exportLesson,
  learningMetrics,
  validateLearningCard,
} from "./agents/learning";
import type { Story, LearningCard } from "./types";
import plan from "../docs/PLAN.md?raw";
import review from "../docs/REVIEW.md?raw";
import impact from "../docs/IMPACT.md?raw";
import architecture from "../AGENTS.md?raw";
import build from "../docs/BUILD.md?raw";
import skill from "../.agents/skills/pamchenga-development/SKILL.md?raw";

type Download = (blob: Blob, name: string) => void;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const docs = {
  Plan: plan,
  Build: `${architecture}\n\n${build}`,
  Review: review,
  Document: impact,
  Skill: skill,
};

export function mountLearningPanel(download: Download) {
  document
    .querySelector(".values")!
    .insertAdjacentHTML(
      "beforebegin",
      `<section class="learning-panel" aria-labelledby="learning-heading"><div><span class="eyebrow">EDUCATION · WISDOM INTO LEARNING</span><h2 id="learning-heading">An elder’s voice. A classroom’s next lesson.</h2><p>For teachers and community facilitators supporting Chichewa-speaking learners in Malawi: preserve an elder’s story, listen offline, and create a mother-tongue discussion and activity. The same tools support every language in your circle.</p><p class="learning-instruction">Open a saved story → Prepare a learning card → Record classroom permission → Export a credited handout.</p></div><div class="learning-metrics"><div><strong id="lessons-count">0</strong><span>Lesson cards saved</span></div><div><strong id="lesson-languages">0</strong><span>Lesson languages</span></div><div><strong id="sessions-count">0</strong><span>Sessions reported</span></div></div><p class="small-text muted">Counts reflect this device only. Sessions are facilitator-reported activity, not verified attendance or measured learning improvement.</p><div class="learning-links"><button id="impact-evidence" class="text-button">Who benefits and how →</button><button id="codex-evidence" class="text-button">Built with Codex · Explore the workflow →</button></div></section>`,
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog id="workflow-dialog" aria-labelledby="workflow-title"><div class="dialog-top"><span class="eyebrow">THE WORK BEHIND THE CIRCLE</span><button class="close" id="close-workflow" aria-label="Close workflow">×</button></div><h2 id="workflow-title">Built with Codex, from plan to review.</h2><p class="muted">Codex works with the repository’s architecture and reusable skills throughout development. These are the project’s actual planning, building, review and documentation artifacts. No live Codex agent or MCP service is connected inside this app.</p><div class="workflow-tabs" aria-label="Development artifacts">${Object.keys(
      docs,
    )
      .map(
        (name) =>
          `<button class="button secondary" data-artifact="${name}" aria-pressed="false">${name}</button>`,
      )
      .join(
        "",
      )}</div><p id="artifact-path" class="muted small-text"></p><pre id="artifact-content" tabindex="0"></pre><button class="button primary" id="export-codex">Export Codex engineering handoff</button><p class="muted small-text">The handoff contains repository instructions and public project documentation. It includes no recordings, storyteller metadata or lesson content and sends nothing to an AI service.</p></dialog>`,
  );
  const dialog = document.querySelector<HTMLDialogElement>("#workflow-dialog")!;
  const paths = {
    Plan: "docs/PLAN.md",
    Build: "AGENTS.md + docs/BUILD.md",
    Review: "docs/REVIEW.md",
    Document: "docs/IMPACT.md",
    Skill: ".agents/skills/pamchenga-development/SKILL.md",
  };
  const select = (name: keyof typeof docs) => {
    document.querySelector("#artifact-content")!.textContent = docs[name];
    document.querySelector("#artifact-path")!.textContent = paths[name];
    document
      .querySelectorAll<HTMLButtonElement>("[data-artifact]")
      .forEach((btn) =>
        btn.setAttribute("aria-pressed", String(btn.dataset.artifact === name)),
      );
  };
  document.querySelector<HTMLButtonElement>("#codex-evidence")!.onclick =
    () => {
      select("Plan");
      dialog.showModal();
    };
  document.querySelector<HTMLButtonElement>("#impact-evidence")!.onclick =
    () => {
      select("Document");
      dialog.showModal();
    };
  document.querySelector<HTMLButtonElement>("#close-workflow")!.onclick = () =>
    dialog.close();
  document
    .querySelectorAll<HTMLButtonElement>("[data-artifact]")
    .forEach(
      (btn) =>
        (btn.onclick = () => select(btn.dataset.artifact as keyof typeof docs)),
    );
  document.querySelector<HTMLButtonElement>("#export-codex")!.onclick = () => {
    const handoff = `# Pamchenga Codex engineering handoff\n\nRepository: https://github.com/ericnangomba/Pamchenga\n\nRead AGENTS.md and both reusable Pamchenga skills. Use repository planning or Codex plan mode if available; do not claim either has run without evidence. Plan the next change, implement within the three agent module boundaries, review the diff and run the documented checks, then update impact and review documentation. Keep local-first storage, original audio, native language spelling, consent and truthful integration status intact. No private story data is included in this brief.\n\n${Object.entries(
      docs,
    )
      .map(([name, text]) => `## ${name}\n\n${text}`)
      .join("\n\n")}`;
    download(
      new Blob([handoff], { type: "text/markdown;charset=utf-8" }),
      "pamchenga-codex-handoff.md",
    );
  };
}

export function updateLearningMetrics(stories: Story[]) {
  const metrics = learningMetrics(stories);
  for (const [id, value] of [
    ["lessons-count", metrics.lessons],
    ["lesson-languages", metrics.languages],
    ["sessions-count", metrics.sessions],
  ] as const)
    document.getElementById(id)!.textContent = String(value);
}

export function attachLearningEditor(
  story: Story,
  download: Download,
  onSaved: (story: Story) => Promise<void>,
) {
  const card = story.learning;
  document
    .querySelector("#detail")!
    .insertAdjacentHTML(
      "beforeend",
      `<section class="lesson-editor"><span class="eyebrow">EDUCATION · FACILITATOR-AUTHORED</span><h3>Prepare a learning card</h3><p class="muted">Turn this recording into a mother-tongue listening lesson. Add your own interpretation with the storyteller; nothing here is automatically generated.</p><form id="lesson-form"><label>Learning audience<input name="audience" required maxlength="160" placeholder="e.g. Primary school learners, ages 9–12" value="${escapeHtml(card?.audience ?? "")}"></label><label>Learning objective<textarea name="objective" required maxlength="2000" rows="2" placeholder="What should learners be able to explain or retell?">${escapeHtml(card?.objective ?? "")}</textarea></label><label>Native proverb<input name="nativeProverb" maxlength="1000" placeholder="Keep native spelling and tone marks" value="${escapeHtml(card?.nativeProverb ?? "")}"></label><label>Meaning and cultural context<textarea name="meaning" maxlength="3000" rows="2">${escapeHtml(card?.meaning ?? "")}</textarea></label><label>Discussion question<textarea name="discussionQuestion" required maxlength="2000" rows="2">${escapeHtml(card?.discussionQuestion ?? "")}</textarea></label><label>Learning activity<textarea name="activity" required maxlength="3000" rows="2" placeholder="Listen, discuss, retell, draw or perform together">${escapeHtml(card?.activity ?? "")}</textarea></label><label>Sessions delivered<input name="sessionsDelivered" type="number" min="0" max="1000000" step="1" required value="${card?.sessionsDelivered ?? 0}"></label><label class="consent"><input name="classroomPermission" type="checkbox" ${card?.classroomPermission ? "checked" : ""}> The storyteller or authorized community representative permits classroom use under the selected license and any community conditions.</label><p class="muted small-text">Permission to record is separate from permission to use in a classroom. Save a draft without permission; record permission before exporting.</p><p id="lesson-status" role="status" class="small-text"></p><div class="detail-actions"><button class="button primary" type="submit">Save learning card</button><button class="button secondary" id="export-lesson" type="button">Export lesson handout</button></div></form></section>`,
    );
  const form = document.querySelector<HTMLFormElement>("#lesson-form")!;
  const status = document.querySelector<HTMLElement>("#lesson-status")!;
  let saved = story;
  let saving = false;
  let dirty = false;
  form.addEventListener("input", () => {
    dirty = true;
    status.textContent =
      "Unsaved changes. Save the learning card before exporting.";
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (saving) return;
    saving = true;
    const button = form.querySelector<HTMLButtonElement>("[type=submit]")!;
    button.disabled = true;
    const controls = form.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >("input, textarea");
    try {
      const data = new FormData(form);
      const learning: LearningCard = {
        audience: String(data.get("audience")).trim(),
        objective: String(data.get("objective")).trim(),
        nativeProverb: String(data.get("nativeProverb")).trim(),
        meaning: String(data.get("meaning")).trim(),
        discussionQuestion: String(data.get("discussionQuestion")).trim(),
        activity: String(data.get("activity")).trim(),
        sessionsDelivered: Number(data.get("sessionsDelivered")),
        classroomPermission: data.has("classroomPermission"),
      };
      validateLearningCard(learning);
      controls.forEach((control) => (control.disabled = true));
      saved = await updateStoryMetadata(story.id, { learning });
      await onSaved(saved);
      dirty = false;
      status.textContent = "Learning card saved on this device.";
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Could not save this learning card.";
    } finally {
      saving = false;
      button.disabled = false;
      controls.forEach((control) => (control.disabled = false));
    }
  });
  document.querySelector<HTMLButtonElement>("#export-lesson")!.onclick = () => {
    try {
      if (dirty || saving)
        throw Error("Save your changes before exporting the lesson.");
      download(
        new Blob([exportLesson(saved)], {
          type: "text/markdown;charset=utf-8",
        }),
        `${story.id}-lesson.md`,
      );
      status.textContent =
        "Credited lesson handout exported. Export audio separately if permitted.";
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Could not export this lesson.";
    }
  };
}
