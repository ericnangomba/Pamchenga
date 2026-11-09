# Storyteller consent and permissions

Pamchenga keeps recordings local by default. The person providing consent is identified by name and role; this is a locally recorded attestation, not independently verified identity or cryptographic proof.

Recording and local storage must be explicitly authorized for new stories. Sharing, off-device backup, classroom teaching and commercial use each require a separate affirmative choice. All unrecorded permissions are denied.

Older stories are preserved without altering audio or transcripts. Their missing consent record means unknown, not permission granted. Open the story and record authorization before protected uses.

The classroom handout requires both the storyteller's `teach` permission and the facilitator's existing learning-card classroom checkbox. Backup/sync requires `backup`. Audio export is treated as potentially shareable and requires `share`. Exporting the unsigned metadata passport does not authorize distributing the audio.

Consent changes are saved with prior records in `consentHistory`. The current consent governs operations. This history is local, editable device data, not tamper-evident proof. A previously exported copy cannot be revoked by changing the local consent.

A license label does not grant rights beyond explicit consent. The default Community Tribal Copyright label is not a standardized public license; the CC BY-NC-SA 4.0 option is noncommercial and requires appropriate rights-holder authorization before distributing content under its terms. Commercial use remains denied by default.

The JSON-LD passport records current permissions, timestamp, giver role, restrictions and `self-reported-unverified` evidence status. Existing SHA-256 and unsigned provenance status are retained.

## Verification

Run `npm ci`, `npm test`, and `npm run build` and review the GitHub Actions run on the pull request before merging. Confirm browser recording/import, legacy story loading, consent editing, classroom denial, and backup denial. Do not merge on failed checks.
