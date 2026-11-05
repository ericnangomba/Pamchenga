export const hostedWhisper = import.meta.env.VITE_WHISPER_PROVIDER === "groq";
export const maxTranscriptionBytes = (hostedWhisper ? 4 : 100) * 1024 * 1024;
