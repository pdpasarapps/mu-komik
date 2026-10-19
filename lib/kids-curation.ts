export type KidsAgeRange = "4_6" | "7_9" | "10_12";

export function getKidsAgeLabel(ageRange: KidsAgeRange | null) {
  if (!ageRange) return null;
  const range = ageRange === "4_6" ? "4–6" : ageRange === "7_9" ? "7–9" : "10–12";
  return `Cocok untuk usia ${range} tahun`;
}
