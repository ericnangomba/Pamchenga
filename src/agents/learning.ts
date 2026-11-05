import type { LearningCard, Story } from "../types";

export function learningMetrics(stories: Story[]) {
  const prepared = stories.filter((s) => s.learning);
  return {
    lessons: prepared.length,
    languages: new Set(
      prepared.map((s) => s.language.normalize("NFC").toLocaleLowerCase()),
    ).size,
    sessions: prepared.reduce(
      (n, s) => n + (s.learning?.sessionsDelivered ?? 0),
      0,
    ),
  };
}

export function validateLearningCard(card: LearningCard): void {
  if (
    ![
      card.audience,
      card.objective,
      card.discussionQuestion,
      card.activity,
    ].every((value) => value.trim())
  )
    throw Error(
      "Add an audience, objective, discussion question and activity.",
    );
  if (
    !Number.isSafeInteger(card.sessionsDelivered) ||
    card.sessionsDelivered < 0 ||
    card.sessionsDelivered > 1000000
  )
    throw Error("Sessions must be a whole number between 0 and 1,000,000.");
}

/** Facilitator-authored learning content; no model-generated cultural claims. */
export function exportLesson(story: Story): string {
  const card = story.learning;
  if (!card) throw Error("Save a learning card first.");
  validateLearningCard(card);
  if (!card.classroomPermission)
    throw Error(
      "Record storyteller permission for classroom use before exporting.",
    );
  return [
    `# ${story.title}`,
    "",
    `Storyteller: ${story.storyteller}`,
    `Language: ${story.language} · ${story.region}`,
    `License: ${story.license}`,
    `Original audio SHA-256: ${story.audioSha256}`,
    "",
    "Classroom-use permission: attested by the facilitator. Follow any additional community conditions.",
    "",
    "## Audience",
    card.audience,
    "",
    "## Learning objective",
    card.objective,
    "",
    "## Native proverb (facilitator supplied)",
    card.nativeProverb || "Not supplied",
    "",
    "## Meaning and cultural context (facilitator supplied)",
    card.meaning || "Not supplied",
    "",
    "## Discuss together",
    card.discussionQuestion,
    "",
    "## Learning activity",
    card.activity,
    "",
    "Listen to the complete original recording, including opening rituals and songs. This handout does not include audio; export the original separately with permission.",
    "",
    "Prepared locally in Pamchenga. Learning outcomes have not been independently assessed.",
  ].join("\n");
}
