# Education impact: from an elder's voice to a listening lesson

## Who benefits and how

The initial intended beneficiaries are teachers and community facilitators working with Chichewa-speaking learners in Malawi, especially where mobile data is costly or connectivity intermittent. Elders and storytellers receive explicit attribution and retain the original recording and selected community license. The same workflow can support the app's other African languages and regions, with locally authored interpretation.

## Concrete classroom journey

1. With permission, a facilitator records or imports an elder's story and credits its source.
2. The original audio and metadata are saved on the device for offline playback.
3. The teacher writes a learning objective, a native proverb and its meaning, a discussion question and a short activity. These are human-authored materials, not automated cultural judgments.
4. The teacher records separate permission for classroom use before exporting a credited Markdown handout.
5. Learners listen, discuss the proverb in their own language, and retell or illustrate its lesson. The facilitator can record the number of sessions delivered.
6. When hosted on Netlify or another HTTPS static host, the facilitator can install the PWA and revisit cached assets offline. Stories and lesson cards remain local to that browser; public hosting does not publish private recordings.

## What the app measures

The learning panel counts locally saved lesson cards, distinct languages with lessons and facilitator-reported sessions. These are device-local activity indicators, not unique learners, verified school attendance, community reach or demonstrated learning gains. No fictional impact numbers or partnerships are displayed.

## Outcomes to validate in a future pilot

With an actual consenting school/community partner: assess teacher preparation time, lesson reuse, learner oral retelling/comprehension, native-language confidence and storyteller satisfaction. Establish baseline and follow-up measures with the community before claiming improved outcomes. No pilot has been run or learning improvement measured in this repository.

## Limits

Browser storage may be evicted; export originals and lesson cards for backup. Classroom permission is a facilitator attestation, not a legal clearance service. A chosen license can still impose additional community conditions. Offline lesson preparation works now; Whisper transcription now has an optional self-hosted backend but needs downloaded weights and human review; C2PA signing and remote sync still need their external services. Netlify static hosting does not implement the optional `/api/stories` endpoint, and deployment provides no analytics or education outcome evidence.

## Hosted-transcription rollout

The selected Netlify/Groq pilot can reduce a facilitator's manual transcription work while preserving local audio and human review. A circle organizer supplies a pilot access code and enables server-side provider credentials; the app asks explicit permission to send each recording to Groq. Hosted transcription is limited to 4 MiB originals by the gateway. Longer recordings still work for local listening, notes and lessons, and the optional Python mode supports larger transcription uploads. This size/hosting tradeoff is explicit, not an invented claim that all long storytelling sessions can already be transcribed through Netlify. Hosted recognition awaits live credentials; no additional school adoption or learning-outcome evidence is claimed.

## Storyteller return and benefit conditions — 10 November 2026

Storytellers can receive a ZIP of their original and unsigned passport through an explicit return-only action without granting third-party sharing. Attribution wording and benefit conditions are recorded separately from restrictions and carried into passports; credit wording and benefit conditions also appear in lesson handouts. Commercial use requires an attested agreement in addition to its checkbox, and missing historical agreements are surfaced for review. These are local records and permission checks, not verified delivery, legal clearance, benefit payments, measured economic outcomes or community validation. CC license conflicts and the limits of withdrawing already distributed copies are disclosed. No new adoption or education-outcome claims are made.
