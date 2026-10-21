"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { download, drawPoster, posterToBlob, posterToPdf, type PosterData } from "@/lib/poster";

export default function ShareButton({ build }: { build: () => PosterData }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const render = async () => {
    const root = getComputedStyle(document.documentElement);
    const mono = root.getPropertyValue("--font-jetbrains").trim() || "monospace";
    const sans = root.getPropertyValue("--font-inter").trim() || "system-ui";
    return drawPoster(build(), mono, sans);
  };
  const run = async (kind: "png" | "pdf" | "share") => {
    setBusy(kind);
    setMsg("");
    try {
      const canvas = await render();
      if (kind === "png") download(await posterToBlob(canvas), "training-90-days.png");
      else if (kind === "pdf") download(await posterToPdf(canvas), "training-90-days.pdf");
      else {
        const file = new File([await posterToBlob(canvas)], "training-90-days.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "My last 90 days of training" });
        else download(file, file.name);
      }
      setOpen(false);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg((e as Error).message || "Couldn't create that");
    } finally {
      setBusy("");
    }
  };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="relative">
      <button className="btn inline-flex items-center gap-1.5" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Share2 className="h-3 w-3" /> Share
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-60 space-y-2 rounded-sm border border-teal/40 bg-[#0a1115] p-3 shadow-[0_0_30px_-8px_rgba(46,230,214,0.4)]">
          <p className="text-xs text-muted">A clean progress card of your last 90 days.</p>
          <button className="btn w-full" disabled={!!busy} onClick={() => run("png")}>{busy === "png" ? "Rendering…" : "Download image (PNG)"}</button>
          <button className="btn w-full" disabled={!!busy} onClick={() => run("pdf")}>{busy === "pdf" ? "Rendering…" : "Download PDF"}</button>
          {canShare && <button className="btn w-full" disabled={!!busy} onClick={() => run("share")}>Share…</button>}
          {msg && <p className="text-xs text-magenta">{msg}</p>}
        </div>
      )}
    </div>
  );
}
