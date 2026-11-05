import { todayWarsaw } from "./wasteReport";

export type WasteDatePreset = "today" | "week" | "month";
export function wasteDateRange(preset: WasteDatePreset, today: string = todayWarsaw()): {from: string; to: string} {
  const start = new Date(`${today}T00:00:00Z`);
  if (preset === "week") start.setUTCDate(start.getUTCDate() - 6);
  if (preset === "month") start.setUTCDate(1);
  return {from: start.toISOString().slice(0, 10), to: today};
}
