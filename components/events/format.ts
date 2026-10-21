const tz = "Europe/London";
export const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
export const fmtDayLong = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" });
export const fmtMonth = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { timeZone: tz, month: "short" }).toUpperCase();
export const fmtDayNum = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { timeZone: tz, day: "numeric" });

export function distanceLabel(km: number | null) {
  if (km === null) return "";
  if (km < 2) return "Central London";
  if (km < 60) return `${km} km from London`;
  return `~${km.toLocaleString("en-GB")} km from London`;
}
