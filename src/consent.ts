import type { ConsentRecord, ConsentUse, Story } from "./types";

export const consentUses: ConsentUse[] = [
  "record",
  "store",
  "share",
  "backup",
  "teach",
  "commercial",
];
export const withdrawalNotice =
  "Copies already exported or shared cannot be recalled. Local consent history is editable device data, not proof. The local original remains until explicitly deleted.";

/** Preserve the recorded choices and timestamp; never infer a missing permission. */
export function migrateConsent(consent: ConsentRecord): ConsentRecord {
  return consent.version === 1
    ? {
        ...consent,
        version: 2,
        migratedFromVersion: 1,
        permissions: { ...consent.permissions },
      }
    : consent;
}
export function migrateStory(story: Story): Story {
  return story.consent
    ? { ...story, consent: migrateConsent(story.consent) }
    : story;
}
export function hasCommercialAgreement(consent: ConsentRecord): boolean {
  const agreement = consent.commercialAgreement;
  return (
    !!agreement &&
    typeof agreement.parties === "string" &&
    !!agreement.parties.trim() &&
    typeof agreement.terms === "string" &&
    !!agreement.terms.trim() &&
    typeof agreement.agreedAt === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(agreement.agreedAt) &&
    Number.isFinite(Date.parse(agreement.agreedAt)) &&
    new Date(agreement.agreedAt).toISOString().slice(0, 10) ===
      agreement.agreedAt.slice(0, 10)
  );
}
export function commercialNeedsReview(consent?: ConsentRecord): boolean {
  return (
    consent?.permissions?.commercial === true &&
    !hasCommercialAgreement(consent)
  );
}
export function permitted(
  story: Pick<Story, "consent">,
  use: ConsentUse,
): boolean {
  const c = story.consent;
  return (
    !!c &&
    (c.version === 1 || c.version === 2) &&
    typeof c.giver === "string" &&
    !!c.giver.trim() &&
    (c.role === "storyteller" || c.role === "authorized-representative") &&
    Number.isFinite(Date.parse(c.recordedAt)) &&
    c.permissions?.[use] === true &&
    (use !== "commercial" || hasCommercialAgreement(c))
  );
}
export function requirePermission(
  story: Pick<Story, "consent">,
  use: ConsentUse,
): void {
  if (!permitted(story, use))
    throw Error(
      `Storyteller permission for ${use} is not recorded. Review consent before proceeding.`,
    );
}
export function withdrawnPermissions(
  previous: ConsentRecord | undefined,
  permissions: ConsentRecord["permissions"],
): ConsentUse[] {
  return consentUses.filter(
    (use) => previous?.permissions?.[use] === true && permissions[use] !== true,
  );
}
export function licenseWarnings(
  license: Story["license"],
  permissions: ConsentRecord["permissions"],
  conditions = false,
): string[] {
  if (license === "CC BY-NC-SA 4.0") {
    return [
      "CC BY-NC-SA 4.0 is a public, irrevocable grant once content is distributed under it. It permits noncommercial sharing by anyone under its terms. Confirm that you are authorized by the rights holder before saving.",
      ...(!permissions.share
        ? [
            "Conflict: denying sharing cannot restrict the public noncommercial sharing allowed by this CC license once distributed.",
          ]
        : []),
      ...(!permissions.backup || !permissions.teach
        ? [
            "Conflict: the CC grant permits noncommercial copying and reuse under its terms, including backups and classroom use. Denied backup or teaching choices cannot restrict copies distributed under that grant.",
          ]
        : []),
      ...(permissions.commercial
        ? [
            "Conflict: this CC license excludes commercial use. A separate recorded agreement does not change the public CC license or verify rights.",
          ]
        : []),
      ...(conditions
        ? [
            "Additional restrictions or benefit conditions may conflict with the public CC grant. Resolve incompatible conditions with the rights holder before distribution.",
          ]
        : []),
    ];
  }
  return [
    "Community Tribal Copyright is a community label, not a standardized public license. It does not itself grant public reuse rights or verify community authority.",
    ...(permissions.share || permissions.teach || permissions.commercial
      ? [
          "Reuse permission is recorded, but the community label supplies no standard public reuse terms. Record the applicable conditions with the rights holder before reuse.",
        ]
      : []),
  ];
}
export function readConsent(
  form: FormData,
  license: Story["license"] = "Community Tribal Copyright",
  requireCapturePermissions = true,
): ConsentRecord {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const giver = text("consentGiver");
  const role = text("consentRole");
  if (
    !giver ||
    (role !== "storyteller" && role !== "authorized-representative")
  )
    throw Error("Record the name and role of the person giving consent.");
  const permissions = Object.fromEntries(
    consentUses.map((use) => [use, form.has(`permission-${use}`)]),
  ) as Record<ConsentUse, boolean>;
  if (requireCapturePermissions && (!permissions.record || !permissions.store))
    throw Error(
      "Explicit recording and local storage permission are required.",
    );
  const parties = text("commercialParties"),
    agreedAt = text("commercialAgreedAt"),
    terms = text("commercialTerms");
  const commercialAgreement =
    parties || agreedAt || terms ? { parties, agreedAt, terms } : undefined;
  const recordedAt = new Date().toISOString();
  const consent: ConsentRecord = {
    version: 2,
    giver,
    role,
    recordedAt,
    permissions,
    notes: text("consentNotes"),
    attribution: text("attribution"),
    benefitConditions: text("benefitConditions"),
    commercialAgreement,
  };
  if (commercialAgreement && !hasCommercialAgreement(consent))
    throw Error(
      "Complete the commercial agreement: who agreed, a valid date, and agreed terms.",
    );
  if (license === "CC BY-NC-SA 4.0") {
    if (!form.has("licenseAuthorized"))
      throw Error(
        "Confirm rights-holder authorization for the public, irrevocable CC license before saving.",
      );
    consent.licenseAuthorization = { license, recordedAt, attestedBy: giver };
  }
  return consent;
}
export const escapeConsent = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function consentFields(existing?: ConsentRecord): string {
  const esc = escapeConsent;
  const agreement = existing?.commercialAgreement;
  return `<fieldset><legend>Storyteller permissions · separate choices</legend><p class="muted small-text">Only check uses expressly authorized by the storyteller or their claimed authorized representative. This records a self-reported attestation; identity, authority and legal validity are not verified. Unchecked means not permitted.</p><label>Person giving consent<input name="consentGiver" maxlength="120" required value="${esc(existing?.giver ?? "")}"></label><label>Consent giver's role<select name="consentRole"><option value="storyteller" ${existing?.role === "storyteller" ? "selected" : ""}>Storyteller</option><option value="authorized-representative" ${existing?.role === "authorized-representative" ? "selected" : ""}>Authorized community representative (self-reported claim)</option></select></label>${consentUses.map((use) => `<label class="consent"><input type="checkbox" name="permission-${use}" ${existing?.permissions?.[use] ? "checked" : ""}> Permission to ${({ record: "record this story", store: "store this story locally", share: "share this story with others", backup: "back up this story to another service or device", teach: "use this story in classroom teaching", commercial: "use this story commercially" } as Record<ConsentUse, string>)[use]}</label>`).join("")}<label>Attribution wording<textarea aria-label="Attribution wording" name="attribution" rows="2" maxlength="2000">${esc(existing?.attribution ?? "")}</textarea></label><label>Benefit conditions<textarea aria-label="Benefit conditions" name="benefitConditions" rows="2" maxlength="3000">${esc(existing?.benefitConditions ?? "")}</textarea></label><label>Restrictions or community conditions<textarea aria-label="Restrictions or community conditions" name="consentNotes" rows="2" maxlength="2000">${esc(existing?.notes ?? "")}</textarea></label><fieldset><legend>Specific commercial agreement · recorded attestation only</legend><p class="muted small-text">A checkbox alone does not permit commercial use. Record who agreed, when and the terms. The app does not confer rights or verify legal validity.</p><label>Who agreed to commercial use<input name="commercialParties" maxlength="1000" value="${esc(agreement?.parties ?? "")}"></label><label>Agreement date<input name="commercialAgreedAt" type="date" value="${esc(agreement?.agreedAt.slice(0, 10) ?? "")}"></label><label>Agreed commercial terms<textarea aria-label="Agreed commercial terms" name="commercialTerms" rows="3" maxlength="5000">${esc(agreement?.terms ?? "")}</textarea></label></fieldset><div data-consent-notices role="status" class="muted small-text"></div><label class="consent" data-license-authorization hidden><input name="licenseAuthorized" type="checkbox"> I confirm I am authorized by the rights holder to record this public, irrevocable CC license grant.</label><p data-withdrawal-notice role="status" class="muted small-text"></p></fieldset>`;
}
export function consentSummaryHtml(story: Story): string {
  const c = story.consent,
    esc = escapeConsent;
  const agreement = c?.commercialAgreement;
  return `<p>Attribution: ${esc(c?.attribution || "No additional wording recorded.")}</p><p>Benefit conditions: ${esc(c?.benefitConditions || "None recorded.")}</p><p>Restrictions: ${esc(c?.notes || "None recorded.")}</p><p>${commercialNeedsReview(c) ? "Commercial use needs review: the commercial choice is checked, but no complete specific agreement is recorded. Commercial use is not permitted." : permitted(story, "commercial") ? "Commercial use: agreement and permission recorded as an unverified attestation; this does not confer rights or verify legal validity." : "Commercial use is not permitted."}</p>${agreement ? `<p>Agreement parties: ${esc(agreement.parties)} · Date: ${esc(agreement.agreedAt)}</p><p>Agreed terms: ${esc(agreement.terms)}</p>` : ""}<p>Own-copy download requests recorded on this device: ${story.ownCopyExports?.length ?? 0}. These notes do not prove download completion or delivery.</p>`;
}
