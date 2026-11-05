import type { Story } from "../types";
export async function hashAudio(audio: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await audio.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function createManifest(story: Story) {
  return {
    "@context": {
      "@vocab": "https://schema.org/",
      pam: "https://pamchenga.org/ns#",
    },
    "@type": "AudioObject",
    identifier: story.id,
    name: story.title,
    author: { "@type": "Person", name: story.storyteller },
    contentLocation: { "@type": "Place", name: story.location },
    inLanguage: story.language,
    license: story.license,
    dateCreated: story.createdAt,
    "pam:region": story.region,
    "pam:audioSha256": story.audioSha256,
    "pam:provenanceStatus": "unsigned",
    "pam:deviceSignature": null,
    "pam:c2paStatus": "requires-external-signer",
  };
}
export interface ProvenanceAdapter {
  signAndEmbed(
    audio: Blob,
    manifest: ReturnType<typeof createManifest>,
  ): Promise<{ audio: Blob; verified: boolean }>;
  index(audio: Blob): Promise<{ network: "ipfs" | "arweave"; address: string }>;
}
