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

Browser storage may be evicted; export originals and lesson cards for backup. Classroom permission is a facilitator attestation, not a legal clearance service. A chosen license can still impose additional community conditions. Offline lesson preparation works now; automatic transcription, C2PA signing and remote sync still need their external services. Netlify static hosting does not implement the optional `/api/stories` endpoint, and deployment provides no analytics or education outcome evidence.
