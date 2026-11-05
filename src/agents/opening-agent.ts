import type { Segment } from "../types";
export const rituals = [
  "Pamchenga!",
  "Padangokhala!",
  "Kwaphela Cosi!",
  "Pamberi ne ngano!",
  "Tilitonse!",
  "Ndaba!",
  "Dzake!",
  "Hadithi Hadithi!",
  "Hadithi Njoo!",
  "Tatsuniyarku ta zo!",
  "Alo o!",
  "Iro nwanụ!",
  "Leebon!",
  "Ta zo mu ji!",
  "Olo o!",
  "Iha!",
  "Leebona!",
];
const normalize = (text: string) =>
  text
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[!.,?]/g, "")
    .trim();
/** Text-based cues only. Acoustic recognition requires timestamped model output. */
export function tagOpenings(segments: Segment[]) {
  return segments
    .filter(
      (s) =>
        s.start >= 0 &&
        s.start < 30 &&
        s.end >= s.start &&
        rituals.some((r) =>
          new RegExp(`(?:^|\\s)${normalize(r)}(?:$|\\s)`, "u").test(
            normalize(s.text),
          ),
        ),
    )
    .map((s) => ({ ...s, tag: "interactive_ritual_opening" as const }));
}
