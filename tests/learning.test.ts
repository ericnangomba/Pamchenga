import { test } from "node:test";
import assert from "node:assert/strict";
import {
  learningMetrics,
  validateLearningCard,
  exportLesson,
} from "../src/agents/learning";
import type { Story, LearningCard } from "../src/types";
const card: LearningCard = {
  audience: "Chichewa-speaking learners, ages 9–12",
  objective: "Retell a lesson about cooperation",
  nativeProverb: "Iro nwanụ!",
  meaning: "Facilitator-provided context",
  discussionQuestion: "How did the characters help one another?",
  activity: "Retell the story together",
  sessionsDelivered: 2,
  classroomPermission: false,
};
const story = {
  id: "local",
  title: "Our circle",
  storyteller: "Thoko",
  language: "Chichewa",
  region: "Southern Africa",
  license: "Community Tribal Copyright",
  audioSha256: "original-hash",
} as Story;
test("impact metrics count real local lesson records and remain zero on existing stories", () => {
  assert.deepEqual(learningMetrics([story]), {
    lessons: 0,
    languages: 0,
    sessions: 0,
  });
  assert.deepEqual(
    learningMetrics([
      { ...story, learning: card },
      {
        ...story,
        id: "two",
        language: "CHICHEWA",
        learning: { ...card, sessionsDelivered: 1 },
      },
    ]),
    { lessons: 2, languages: 1, sessions: 3 },
  );
});
test("classroom export requires distinct permission and preserves attribution and native text", () => {
  assert.throws(() => exportLesson({ ...story, learning: card }), /permission/);
  const output = exportLesson({
    ...story,
    consent: { version: 1, giver: "Thoko", role: "storyteller", recordedAt: "2026-11-09T00:00:00Z", permissions: { record: true, store: true, share: false, backup: false, teach: true, commercial: false } },
    learning: { ...card, classroomPermission: true },
  });
  for (const text of [
    "Iro nwanụ!",
    "Thoko",
    "Community Tribal Copyright",
    "original-hash",
    "facilitator supplied",
    "not been independently assessed",
  ])
    assert.ok(output.includes(text));
});
test("invalid learning content and misleading fractional/negative sessions are rejected", () => {
  for (const sessionsDelivered of [-1, 0.5, Infinity, 1000001])
    assert.throws(() => validateLearningCard({ ...card, sessionsDelivered }));
  assert.throws(() => validateLearningCard({ ...card, objective: " " }));
  assert.doesNotThrow(() => validateLearningCard(card));
});
