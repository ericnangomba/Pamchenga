import {
  consentUses,
  escapeConsent,
  licenseWarnings,
  withdrawnPermissions,
  withdrawalNotice,
} from "./consent";
import type { ConsentRecord, Story } from "./types";

export function attachConsentNotices(
  form: HTMLFormElement,
  license: () => Story["license"],
  previous?: ConsentRecord,
) {
  function refresh() {
    const data = new FormData(form);
    const permissions = Object.fromEntries(
      consentUses.map((use) => [use, data.has(`permission-${use}`)]),
    ) as ConsentRecord["permissions"];
    const conditions = ["consentNotes", "benefitConditions"].some((name) =>
      String(data.get(name) ?? "").trim(),
    );
    const notices = licenseWarnings(license(), permissions, conditions);
    if (
      permissions.commercial &&
      !["commercialParties", "commercialAgreedAt", "commercialTerms"].every(
        (name) => String(data.get(name) ?? "").trim(),
      )
    )
      notices.push(
        "Commercial use needs review: a checkbox alone does not permit it. Record a complete specific agreement.",
      );
    form.querySelector<HTMLElement>("[data-consent-notices]")!.innerHTML =
      notices.map((notice) => `<p>${escapeConsent(notice)}</p>`).join("");
    form.querySelector<HTMLElement>("[data-license-authorization]")!.hidden =
      license() !== "CC BY-NC-SA 4.0";
    const removed = withdrawnPermissions(previous, permissions);
    form.querySelector<HTMLElement>("[data-withdrawal-notice]")!.textContent =
      removed.length
        ? `Removing previously recorded permission: ${removed.join(", ")}. ${withdrawalNotice}`
        : "";
  }
  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);
  form.addEventListener("reset", () => queueMicrotask(refresh));
  refresh();
  return (consent: ConsentRecord) => {
    previous = consent;
    refresh();
  };
}
