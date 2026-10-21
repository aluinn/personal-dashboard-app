// Draws the shareable 90-day progress poster on a canvas (1080x1350, 4:5) and exports PNG / PDF.
import type { HeatCell } from "./workouts";

export type PosterData = {
  name: string;
  rangeLabel: string;
  stats: { label: string; value: string }[];
  heat: HeatCell[][]; // 13 weeks
  weekly: { weekStart: string; volumeKg: number }[]; // 13 weeks
  lifts: { name: string; start: number; current: number; deltaPct: number; pr: boolean }[];
};

const W = 1080;
const H = 1350;
const LEVELS = ["rgba(255,255,255,0.06)", "#134e4a", "#14766f", "#1fb5a8", "#2ee6d6"];

function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = "rgba(12,20,24,0.72)";
  rrect(c, x, y, w, h, 6);
  c.fill();
  c.strokeStyle = "rgba(120,220,214,0.22)";
  c.lineWidth = 1.5;
  c.stroke();
  // corner brackets
  c.strokeStyle = "#2ee6d6";
  c.lineWidth = 3;
  const L = 18;
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
    c.beginPath();
    c.moveTo(cx + dx * L, cy);
    c.lineTo(cx, cy);
    c.lineTo(cx, cy + dy * L);
    c.stroke();
  }
}

export async function drawPoster(data: PosterData, mono: string, sans: string): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load(`24px ${mono}`), document.fonts.load(`24px ${sans}`)]);
  } catch {
    /* fall back to system fonts */
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;
  const M = `${mono}, monospace`;
  const S = `${sans}, system-ui, sans-serif`;

  c.fillStyle = "#05080a";
  c.fillRect(0, 0, W, H);
  for (const [x, y, r, col] of [[120, 80, 700, "rgba(46,230,214,0.13)"], [980, 1250, 700, "rgba(124,92,255,0.16)"]] as const) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  // header
  c.fillStyle = "#2ee6d6";
  c.font = `500 22px ${M}`;
  c.fillText(`${data.name.toUpperCase()} // TRAINING LOG`, 60, 84);
  c.fillStyle = "#e6f1f0";
  c.font = `300 84px ${S}`;
  c.fillText("Last 90 days", 60, 178);
  c.fillStyle = "#7d9392";
  c.font = `400 22px ${M}`;
  c.fillText(data.rangeLabel.toUpperCase(), 60, 222);

  // stat tiles
  const tw = (W - 120 - 3 * 20) / 4;
  data.stats.slice(0, 4).forEach((s, i) => {
    const x = 60 + i * (tw + 20);
    panel(c, x, 256, tw, 150);
    c.shadowColor = "rgba(46,230,214,0.6)";
    c.shadowBlur = 22;
    c.fillStyle = "#2ee6d6";
    c.font = `300 58px ${M}`;
    c.fillText(s.value, x + 22, 338);
    c.shadowBlur = 0;
    c.fillStyle = "#7d9392";
    c.font = `400 17px ${M}`;
    c.fillText(s.label.toUpperCase(), x + 22, 380);
  });

  // heatmap panel
  const py = 436;
  const ph = 330;
  panel(c, 60, py, 580, ph);
  c.fillStyle = "#7d9392";
  c.font = `400 17px ${M}`;
  c.fillText("CONSISTENCY", 84, py + 38);
  const cell = 32;
  const gap = 6;
  const gx = 84;
  const gy = py + 66;
  data.heat.forEach((col, w) =>
    col.forEach((cl, r) => {
      if (cl.future) return;
      const x = gx + w * (cell + gap);
      const y = gy + r * (cell + gap);
      if (cl.level >= 3) {
        c.shadowColor = LEVELS[cl.level];
        c.shadowBlur = 12;
      }
      c.fillStyle = LEVELS[cl.level];
      rrect(c, x, y, cell, cell, 6);
      c.fill();
      c.shadowBlur = 0;
    }),
  );

  // weekly volume panel
  panel(c, 670, py, 350, ph);
  c.fillStyle = "#7d9392";
  c.font = `400 17px ${M}`;
  c.fillText("WEEKLY VOLUME", 694, py + 38);
  const maxV = Math.max(1, ...data.weekly.map((w) => w.volumeKg));
  const bw = 17;
  const bg = 7;
  data.weekly.forEach((w, i) => {
    const h = Math.max(3, (w.volumeKg / maxV) * (ph - 130));
    const x = 694 + i * (bw + bg);
    const y = py + ph - 40 - h;
    c.fillStyle = "#2ee6d6";
    c.globalAlpha = 0.85;
    rrect(c, x, y, bw, h, 4);
    c.fill();
    c.globalAlpha = 1;
  });
  c.fillStyle = "#7d9392";
  c.font = `400 15px ${M}`;
  c.fillText(`PEAK ${(maxV / 1000).toFixed(1)} t`, 694, py + ph - 14);

  // lifts
  const ly = 796;
  panel(c, 60, ly, 960, 440);
  c.fillStyle = "#7d9392";
  c.font = `400 17px ${M}`;
  c.fillText("STRENGTH // ESTIMATED 1RM (EPLEY)", 84, ly + 38);
  if (data.lifts.length === 0) {
    c.fillStyle = "#7d9392";
    c.font = `400 22px ${S}`;
    c.fillText("Log lifts with weights to see strength progress here.", 84, ly + 120);
  }
  const maxE = Math.max(1, ...data.lifts.map((l) => Math.max(l.start, l.current)));
  data.lifts.slice(0, 4).forEach((l, i) => {
    const y = ly + 76 + i * 78;
    c.fillStyle = "#e6f1f0";
    c.font = `400 26px ${S}`;
    c.fillText(l.name, 84, y + 22);
    const bx = 400;
    const bwid = 380;
    c.fillStyle = "rgba(255,255,255,0.07)";
    rrect(c, bx, y + 4, bwid, 12, 6);
    c.fill();
    c.fillStyle = "rgba(124,92,255,0.8)";
    rrect(c, bx, y + 4, (l.start / maxE) * bwid, 12, 6);
    c.fill();
    c.shadowColor = "rgba(46,230,214,0.7)";
    c.shadowBlur = 10;
    c.fillStyle = "#2ee6d6";
    rrect(c, bx, y + 22, (l.current / maxE) * bwid, 12, 6);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = "#e6f1f0";
    c.font = `400 22px ${M}`;
    c.fillText(`${Math.round(l.start)} → ${Math.round(l.current)} kg`, 800, y + 22);
    c.fillStyle = l.deltaPct >= 0 ? "#2ee6d6" : "#ff7a90";
    c.font = `500 20px ${M}`;
    c.fillText(`${l.deltaPct >= 0 ? "+" : ""}${l.deltaPct.toFixed(1)}%${l.pr ? "  PR" : ""}`, 800, y + 52);
  });

  c.fillStyle = "#7d9392";
  c.font = `400 16px ${M}`;
  c.fillText("VIOLET = START OF PERIOD · TEAL = NOW", 84, ly + 412);
  c.textAlign = "right";
  c.fillText("GENERATED BY MY DASHBOARD", W - 60, H - 40);
  c.textAlign = "left";
  return canvas;
}

export async function posterToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't render the image"))), "image/png"));
}

export async function posterToPdf(canvas: HTMLCanvasElement) {
  const { jsPDF } = await import("jspdf"); // loaded only when you ask for a PDF
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(5, 8, 10);
  pdf.rect(0, 0, pw, ph, "F");
  const h = (pw * H) / W;
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, Math.max(0, (ph - h) / 2), pw, h); // JPEG keeps the PDF small
  return pdf.output("blob");
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
