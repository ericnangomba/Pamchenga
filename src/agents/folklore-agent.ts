import type { Segment, Region } from "../types";
export interface CulturalWisdom {
  moral_lesson: string;
  proverbs: {
    native: string;
    literal_translation: string;
    cultural_context: string;
  }[];
  embedded_songs: { start: number; end: number }[];
}
export interface FolkloreAdapter {
  transcribe(
    audio: Blob,
    cues: { language: string; region: Region; preserveRituals: true },
  ): Promise<Segment[]>;
  extract(segments: Segment[]): Promise<CulturalWisdom>;
}
/** No synthetic transcription: retain human-entered text until a localized model is connected. */
export const folkloreStatus = "Awaiting localized transcription service";
