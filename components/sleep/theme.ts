// Stage colours validated with the dataviz palette checker (dark surface #0a1115):
// lightness band, chroma, colour-blind separation and contrast all pass. Colour follows the entity
// (Deep is always blue, REM always magenta…), never its rank.
export const SURFACE = "#0a1115";
export const STAGE = {
  deep: "#5b7cff",
  core: "#14a398",
  rem: "#c455dc",
  awake: "#c4811a",
  unspec: "#7d9392",
} as const;
export const INK = { primary: "#e6f1f0", muted: "#7d9392", grid: "rgba(255,255,255,0.06)" };
export const TOTAL = "#2ee6d6"; // total sleep (a different entity from any single stage)
export const HR_COLOR = "#ff7a90";
export const HRV_COLOR = "#9be564";

export const axisProps = {
  stroke: "transparent",
  tick: { fill: INK.muted, fontSize: 10, fontFamily: "var(--font-jetbrains), monospace" },
  tickLine: false,
} as const;
