"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import Panel from "@/components/ui/Panel";

type Mod = { code: string; name: string };

/** Add a lecture: upload the PDF you exported from Notion; the text is read out of it and shown in the galaxy, search and reading view. */
export default function UploadPanel({ modules, hasReal }: { modules: Mod[]; hasReal: boolean }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return setMsg({ ok: false, text: "Choose a PDF first." });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/notes/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({ ok: false, error: res.status === 413 ? "That file is too large to upload (limit about 4 MB)." : "Upload failed." }));
      if (j.ok) {
        setMsg({ ok: true, text: `Added “${j.title}” (${j.words} words, ${j.pages} page${j.pages === 1 ? "" : "s"}).` });
        form.current?.reset();
        router.refresh();
      } else setMsg({ ok: false, text: j.error ?? "Upload failed." });
    } catch {
      setMsg({ ok: false, text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel label="ADD A LECTURE // UPLOAD A NOTION PDF" accent="violet">
      <form ref={form} onSubmit={submit} className="grid gap-2 md:grid-cols-[1fr_1fr_90px_1.2fr_auto] md:items-end">
        <label className="space-y-1">
          <span className="micro">Module</span>
          <select name="module" required className="field" defaultValue="">
            <option value="" disabled>Choose…</option>
            {modules.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="micro">Title (optional)</span>
          <input name="title" maxLength={140} placeholder="Week 3: Explanation…" className="field" />
        </label>
        <label className="space-y-1">
          <span className="micro">Week</span>
          <input name="week" type="number" min={1} max={12} placeholder="auto" className="field" />
        </label>
        <label className="space-y-1">
          <span className="micro">Tags (comma separated)</span>
          <input name="tags" placeholder="AI, regulation, expertise" className="field" />
        </label>
        <label className="btn inline-flex cursor-pointer items-center gap-1.5 text-center">
          <FileUp className="h-3 w-3" /> {busy ? "Reading…" : "PDF"}
          <input name="file" type="file" accept="application/pdf,.pdf" required disabled={busy} className="sr-only" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
        </label>
      </form>
      {msg && <p role="status" className={`mt-2 text-xs ${msg.ok ? "text-teal" : "text-magenta"}`}>{msg.text}</p>}
      <details className="mt-3 text-xs text-muted" open={!hasReal}>
        <summary className="micro cursor-pointer text-text">How to get a lecture out of Notion</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open the lecture page in Notion. Click <b>•••</b> (top right) → <b>Export</b>.</li>
          <li>Set <b>Export format</b> to <b>PDF</b> (leave “Include subpages” off). Click <b>Export</b>.</li>
          <li>Pick the module above, optionally add a title/week/tags, then choose the PDF. It uploads as soon as you pick the file.</li>
        </ol>
        <p className="mt-2">
          Keep each PDF under 4 MB (turn off “Include images” when exporting if it’s bigger). Headings, bullets and paragraphs are rebuilt from the PDF’s text; scanned
          or image-only PDFs have no text to read. Tags drive the links between lectures in the galaxy, and typing <code>#AI</code> inside a Notion page
          before exporting adds that tag automatically. Your original PDF is kept and linked from each note. To update a lecture, delete it and upload the new export.
        </p>
      </details>
    </Panel>
  );
}
