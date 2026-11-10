import { zipSync, strToU8 } from "fflate";
import { requirePermission } from "./consent";
import { createManifest } from "./agents/provenance-agent";
import type { Story } from "./types";

export function originalAudioFilename(story: Story): string {
  const type = story.audio.type;
  const extension = type.includes("mp4")
    ? "m4a"
    : type.includes("mpeg")
      ? "mp3"
      : type.includes("wav")
        ? "wav"
        : type.includes("ogg")
          ? "ogg"
          : type.includes("flac")
            ? "flac"
            : "webm";
  return `${story.id}.${extension}`;
}
/** Third-party export retains the independent sharing gate. */
export function sharedAudio(story: Story): Blob {
  requirePermission(story, "share");
  return story.audio;
}
export function sharedPassport(story: Story) {
  requirePermission(story, "share");
  return createManifest(story);
}
/** Return-only route; it grants no permission for third-party distribution. */
export async function storytellerCopy(story: Story): Promise<Blob> {
  const files = zipSync({
    [originalAudioFilename(story)]: [
      new Uint8Array(await story.audio.arrayBuffer()),
      { level: 0 },
    ],
    [`${story.id}.jsonld`]: strToU8(
      JSON.stringify(createManifest(story), null, 2),
    ),
    "README.txt": strToU8(
      "For return to the storyteller or their claimed authorized representative only. This copy does not authorize sharing or commercial use. The passport is unsigned and self-reported; SHA-256 checks integrity only. Local download-request notes do not prove delivery.\n",
    ),
  });
  return new Blob([new Uint8Array(files)], { type: "application/zip" });
}
