# Storyteller consent and permissions

Pamchenga records self-reported attestations on the device. It does not verify identity, community authority, legal validity or receipt of a benefit. The representative role records a claim, not verified authority. No recording is uploaded by the protections described here.

## Independent choices and migration

Recording and local storage require explicit authorization for a new capture/import. Sharing, backup, teaching and commercial use remain separate choices. Missing consent, invalid consent and missing choices default to denial. The lesson handout still requires both `teach` and the facilitator's saved `classroomPermission`; neither is inferred from recording permission. Whisper still requires the separate per-action permission to upload to its selected provider.

Consent version 2 adds optional `attribution`, `benefitConditions`, `commercialAgreement` and `licenseAuthorization` fields. Existing v1 records are migrated in memory when read, preserving their giver, role, timestamp, notes and exact choices, with `migratedFromVersion: 1`. The migrated current record is persisted on the next story write. Prior history snapshots are preserved. Stories without consent remain without consent. No permission is backfilled, and no IndexedDB schema/store version bump or audio rewrite is required.

A checked commercial choice is preserved as a recorded request. It is effective only if a specific agreement also records nonempty `parties`, a valid `agreedAt` date and nonempty `terms`. An existing checked choice without an agreement stays checked, displays **needs review**, and has effective commercial permission false. New unchecked choices stay denied even if an agreement is present. Partially completed agreement fields cannot be saved; a checked choice with no agreement can be saved for review but does not authorize commercial use. This is an unverified local attestation; it confers no rights or proof of a legally valid agreement. The app does not implement commercial distribution, payments or enforcement of benefit conditions.

## Returning the storyteller's copy

**Give the storyteller their copy** is a distinct return-only route. It asks the operator to confirm return to the storyteller or their claimed authorized representative, then downloads one ZIP containing the unchanged original audio, an unsigned JSON-LD passport and a return-only README. It does not require `share`, including for older local recordings, and grants no third-party distribution rights. This confirmation does not verify the recipient's identity.

A request is appended atomically to `Story.ownCopyExports` before the ZIP is prepared: `requestedAt`, the recorded storyteller as `recipient`, and `status: "download-requested"`. The passport includes these request notes. A failed preparation or cancelled download can still have a request note; no completion or delivery is claimed. Consent, own-copy notes, transcripts and lesson edits merge with the current stored story, preserving concurrent metadata changes.

The separate **Export audio** and **Export passport** actions are third-party exports and require current `share` permission, re-read from storage at the time of the click. Classroom handouts retain their distinct teaching gates. Returning a copy never changes the sharing choice. The original audio fingerprint remains an integrity check, not certified provenance.

## Attribution and benefits

The capture and consent-edit forms record optional attribution wording, benefit conditions and the existing restrictions/notes independently. Story detail displays all three. The lesson handout retains the storyteller's name and adds a credit line with the supplied attribution wording (or storyteller name if absent), plus the recorded benefit conditions. The app records conditions; it does not certify that they have been satisfied.

## License and withdrawal notices

For **CC BY-NC-SA 4.0**, the form warns before saving that distribution under this license is a public, irrevocable grant permitting noncommercial sharing by anyone under its terms. A rights-holder authorization checkbox is required when saving CC consent; each newly opened form starts unconfirmed. The saved `licenseAuthorization` records the selected license, attestor and timestamp, not verified authority.

Denying sharing conflicts with the public CC grant once distributed. A checked commercial choice conflicts with what the noncommercial public license permits; a separate agreement does not amend the public license. Additional restrictions or benefit conditions may also conflict. These warnings never automatically check a permission or rewrite the selected license. Conflicts need resolution with the rights holder before distribution.

**Community Tribal Copyright** is a community label, not a standardized public license. It does not itself grant public reuse rights. When reuse choices are checked, the form warns that the label supplies no standard reuse terms and conditions must be recorded with the rights holder. No invented community authority is implied.

Before a consent update removes a previously checked choice, the form warns that copies already exported/shared cannot be recalled, and local consent history is editable device data, not proof. The save confirmation repeats the notice. Existing recordings remain on device until explicitly deleted; withdrawing record/store can be recorded for an existing story without granting those permissions to a new capture. Prior consent records append from the current stored record in the same transaction. Saving denied backup permission also removes pending backup jobs atomically; the service worker checks current backup permission before each upload attempt. In-flight requests cannot be recalled. History is not tamper-evident evidence and cannot withdraw a public CC grant from distributed copies.

## JSON-LD passport

Existing metadata and provenance fields remain. In particular, `pam:audioSha256` checks integrity, `pam:provenanceStatus` is `unsigned`, `pam:deviceSignature` is null, `pam:c2paStatus` is `requires-external-signer`, and `pam:consentEvidenceStatus` remains `self-reported-unverified`.

Consent fields are:

| Field | Meaning |
| --- | --- |
| `pam:consentVersion`, `pam:consentRecordedAt` | Current attestation version and original/saved timestamp |
| `pam:consentGiver`, `pam:consentGiverRole` | Self-reported giver and claimed role |
| `pam:permissions` | Effective per-use permission booleans; commercial includes the agreement gate |
| `pam:communityRestrictions` | Existing notes, or null |
| `pam:attributionWording` | Optional requested credit, or null |
| `pam:benefitConditions` | Optional conditions, or null |
| `pam:commercialRequested` | Raw checked commercial choice, separate from effective permission |
| `pam:commercialAgreement` | `{ parties, agreedAt, terms }` or null; not legal verification |
| `pam:commercialReviewRequired` | Checked commercial choice that fails the effective permission gate |
| `pam:licenseAuthorization` | `{ license, recordedAt, attestedBy }` or null; recorded authorization claim |
| `pam:ownCopyExportRequests` | Local download-request notes; not proof of delivery |

`license` preserves the story's selected license string. The app does not backfill it or silently convert one label to another.

## Verification

Run `npm ci`, `npm test`, `npm run build`, start the production preview on port 4173 and run `node tests/browser.mjs`. Unit tests cover denial gates, migration, ZIP audio integrity, agreement requirements, license warnings, escaping, and actual storage round-trips/concurrent writes with fake IndexedDB. Browser checks use synthetic audio and real browser IndexedDB, remain offline for the new paths, and retain the existing worker-cache, saved-story, teaching and Whisper boundaries. These checks are not field testing, legal review or proof of community consent. Review the work-branch Actions browser/offline result before merging.
