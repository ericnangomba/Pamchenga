import type { ConsentRecord, ConsentUse, Story } from "./types";

export const consentUses: ConsentUse[] = ["record", "store", "share", "backup", "teach", "commercial"];
export function permitted(story: Pick<Story, "consent">, use: ConsentUse): boolean {
  const c = story.consent;
  return c?.version === 1 && !!c.giver?.trim() &&
    (c.role === "storyteller" || c.role === "authorized-representative") &&
    !Number.isNaN(Date.parse(c.recordedAt)) && c.permissions?.[use] === true;
}
export function requirePermission(story: Pick<Story, "consent">, use: ConsentUse): void {
  if (!permitted(story, use)) throw Error(`Storyteller permission for ${use} is not recorded. Review consent before proceeding.`);
}
export function readConsent(form: FormData): ConsentRecord {
  const giver = String(form.get("consentGiver") ?? "").trim();
  const role = String(form.get("consentRole") ?? "");
  if (!giver || (role !== "storyteller" && role !== "authorized-representative"))
    throw Error("Record the name and role of the person giving consent.");
  const permissions = Object.fromEntries(consentUses.map(use => [use, form.has(`permission-${use}`)])) as Record<ConsentUse, boolean>;
  if (!permissions.record || !permissions.store)
    throw Error("Explicit recording and local storage permission are required.");
  return { version: 1, giver, role, recordedAt: new Date().toISOString(), permissions, notes: String(form.get("consentNotes") ?? "").trim() };
}
export function consentFields(existing?: ConsentRecord): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return `<fieldset><legend>Storyteller permissions · separate choices</legend><p class="muted small-text">Only check uses expressly authorized by the storyteller or authorized representative. Unchecked means not permitted.</p><label>Person giving consent<input name="consentGiver" maxlength="120" required value="${esc(existing?.giver ?? "")}"></label><label>Consent giver's role<select name="consentRole"><option value="storyteller" ${existing?.role === "storyteller" ? "selected" : ""}>Storyteller</option><option value="authorized-representative" ${existing?.role === "authorized-representative" ? "selected" : ""}>Authorized community representative</option></select></label>${consentUses.map(use => `<label class="consent"><input type="checkbox" name="permission-${use}" ${existing?.permissions?.[use] ? "checked" : ""}> Permission to ${({record:"record this story",store:"store this story locally",share:"share this story with others",backup:"back up this story to another service or device",teach:"use this story in classroom teaching",commercial:"use this story commercially"} as Record<ConsentUse,string>)[use]}</label>`).join("")}<label>Restrictions or community conditions<textarea name="consentNotes" rows="2" maxlength="2000">${esc(existing?.notes ?? "")}</textarea></label></fieldset>`;
}
