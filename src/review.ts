import type {
  ReviewSegment,
  ReviewerRole,
  Story,
  TranscriptReview,
} from "./types";
export const SIGNOFF_STATEMENT =
  "I listened to the whole recording and this text matches what I hear.";
export const roleLabels: Record<ReviewerRole, string> = {
  storyteller: "Storyteller",
  "authorized-representative": "Authorized representative",
  "other-fluent-speaker": "Another fluent speaker (not the storyteller)",
};
const seg = (
  start: number,
  end: number,
  machineText?: string,
): ReviewSegment => ({
  id: crypto.randomUUID(),
  start,
  end,
  machineText,
  text: machineText ?? "",
  confirmed: false,
  flags: { unsure: false, unclear: false, cultural: false },
});
export function startReview(story: Story, now = new Date()): TranscriptReview {
  if (story.review) return story.review;
  const t = story.transcription;
  const usable = t?.segments.filter((s) => s.text.trim()) ?? [];
  return {
    version: 1,
    basedOn: usable.length ? "machine-draft" : "typed-by-reviewer",
    machineResultId: usable.length ? t!.id : undefined,
    segments: usable.length
      ? usable.map((s) => seg(s.start, s.end, s.text.trim()))
      : [seg(0, Math.max(story.duration, 0.1))],
    updatedAt: now.toISOString(),
  };
}
function touch(
  r: TranscriptReview,
  segments: ReviewSegment[],
  now: Date,
): TranscriptReview {
  return {
    ...r,
    segments,
    updatedAt: now.toISOString(),
    signoff: undefined,
    editedSinceSignoff: r.signoff ? true : r.editedSinceSignoff,
  };
}
export function updateSegment(
  r: TranscriptReview,
  id: string,
  change: Partial<
    Pick<ReviewSegment, "text" | "confirmed" | "note"> & {
      flags: Partial<ReviewSegment["flags"]>;
    }
  >,
  now = new Date(),
): TranscriptReview {
  return touch(
    r,
    r.segments.map((s) => {
      if (s.id !== id) return s;
      const next = {
        ...s,
        ...change,
        flags: { ...s.flags, ...change.flags },
      };
      // Any edit to the words or flags needs a fresh check of that segment.
      const edited =
        (change.text !== undefined && change.text !== s.text) ||
        change.flags !== undefined ||
        (change.note !== undefined && change.note !== s.note);
      if (edited && change.confirmed === undefined) next.confirmed = false;
      // An unresolved part (unsure or inaudible) can never be checked.
      if (next.flags.unsure || next.flags.unclear) next.confirmed = false;
      return next;
    }),
    now,
  );
}
/** Split one segment at a playback time. The new second half starts empty and unchecked. */
export function splitSegment(
  r: TranscriptReview,
  id: string,
  at: number,
  now = new Date(),
): TranscriptReview {
  const i = r.segments.findIndex((s) => s.id === id);
  const s = r.segments[i];
  if (!s || at <= s.start + 0.2 || at >= s.end - 0.2) return r;
  const first: ReviewSegment = { ...s, end: at, confirmed: false };
  const second = seg(at, s.end);
  const next = [...r.segments];
  next.splice(i, 1, first, second);
  return touch(r, next, now);
}
export function blockers(r: TranscriptReview): string[] {
  const out: string[] = [];
  const unsure = r.segments.filter((s) => s.flags.unsure).length;
  const unchecked = r.segments.filter((s) => !s.confirmed).length;
  const unclear = r.segments.filter((s) => s.flags.unclear).length;
  const empty = r.segments.filter((s) => !s.text.trim()).length;
  if (unsure) out.push(`${unsure} marked unsure`);
  if (unclear) out.push(`${unclear} can't be heard clearly`);
  if (unchecked) out.push(`${unchecked} not yet checked`);
  if (empty) out.push(`${empty} with no text`);
  return out;
}
export function signOff(
  r: TranscriptReview,
  reviewer: string,
  role: ReviewerRole,
  listenedToAll: boolean,
  now = new Date(),
): TranscriptReview {
  if (!reviewer.trim()) throw Error("Add the reviewer's name.");
  if (!listenedToAll)
    throw Error("Confirm that you listened to the whole recording.");
  const b = blockers(r);
  if (b.length) throw Error(`Not ready: ${b.join(", ")}.`);
  return {
    ...r,
    updatedAt: now.toISOString(),
    editedSinceSignoff: undefined,
    signoff: {
      reviewer: reviewer.trim().slice(0, 120),
      role,
      confirmedAt: now.toISOString(),
      unclearCount: r.segments.filter((s) => s.flags.unclear).length,
      statement: SIGNOFF_STATEMENT,
    },
  };
}
export type ReviewStage =
  | "recorded"
  | "machine-draft"
  | "in-review"
  | "edited-after-confirmation"
  | "confirmed";
export function stage(story: Story): ReviewStage {
  const r = story.review;
  if (r?.signoff) return "confirmed";
  if (r?.editedSinceSignoff) return "edited-after-confirmation";
  if (r) return "in-review";
  if (story.transcription) return "machine-draft";
  return "recorded";
}
/** Plain wording. It states who checked, never that the text is accurate. */
export function statusLine(story: Story): string {
  const r = story.review;
  switch (stage(story)) {
    case "recorded":
      return "Recorded. No transcript yet.";
    case "machine-draft":
      return "Machine draft, not checked by a person.";
    case "in-review": {
      const done = r!.segments.filter((s) => s.confirmed).length;
      const un = r!.segments.filter((s) => s.flags.unsure).length;
      const cl = r!.segments.filter((s) => s.flags.unclear).length;
      const open = [
        un ? `${un} unsure` : "",
        cl ? `${cl} can't be heard clearly` : "",
      ].filter(Boolean);
      return `Partly checked: ${done} of ${r!.segments.length} parts${open.length ? `, ${open.join(", ")}` : ""}. Not confirmed as a whole.`;
    }
    case "edited-after-confirmation":
      return "Edited since it was confirmed. Needs checking again.";
    case "confirmed": {
      const s = r!.signoff!;
      const u = "";
      const who =
        s.role === "storyteller"
          ? "the storyteller"
          : s.role === "authorized-representative"
            ? "an authorized representative, not confirmed by the storyteller"
            : "another fluent speaker, not confirmed by the storyteller";
      return `Text checked by ${s.reviewer} (${who})${u}.`;
    }
  }
}
/** What the passport may carry: status and who, never the text itself. */
export function reviewSummary(r: TranscriptReview) {
  return {
    status: r.signoff
      ? "reviewer-confirmed"
      : r.editedSinceSignoff
        ? "edited-after-confirmation"
        : "in-review",
    basedOn: r.basedOn,
    segments: r.segments.length,
    checkedSegments: r.segments.filter((s) => s.confirmed).length,
    unclearSegments: r.segments.filter((s) => s.flags.unclear).length,
    culturalNoteSegments: r.segments.filter((s) => s.flags.cultural).length,
    reviewer: r.signoff?.reviewer ?? null,
    reviewerRole: r.signoff?.role ?? null,
    confirmedAt: r.signoff?.confirmedAt ?? null,
    note: "Records who listened and checked. Not proof of accuracy. No translation review is recorded.",
  };
}
