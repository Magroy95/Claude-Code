import { customAlphabet } from "nanoid";

const digits = customAlphabet("0123456789", 4);
const letters = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ", 4);

/** Öffentliche, gut vorlesbare Analyse-ID, z.B. "HKC-4821-QX7K". */
export function generateAnalysisId(): string {
  return `HKC-${digits()}-${letters()}`;
}
