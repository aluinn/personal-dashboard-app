"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteNote, updateNote } from "@/app/notes/actions";

export default function NoteAdmin({ id, title, week, tags }: { id: string; title: string; week: number | null; tags: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="mt-4 rounded-sm border border-line p-3">
      <div className="flex items-center gap-3">
        <button className="micro hover:text-teal" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Edit details</button>
        <button
          className="micro hover:text-magenta"
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete this note and its PDF?")) return;
            start(async () => {
              await deleteNote(id);
              router.push("/notes");
            });
          }}
        >
          Delete
        </button>
      </div>
      {open && (
        <form
          className="mt-3 grid gap-2 md:grid-cols-[2fr_80px_2fr_auto] md:items-end"
          action={(fd) =>
            start(async () => {
              await updateNote(fd);
              setOpen(false);
              router.refresh();
            })
          }
        >
          <input type="hidden" name="id" value={id} />
          <label className="space-y-1"><span className="micro">Title</span><input name="title" defaultValue={title} required maxLength={140} className="field" /></label>
          <label className="space-y-1"><span className="micro">Week</span><input name="week" type="number" min={1} max={12} defaultValue={week ?? ""} className="field" /></label>
          <label className="space-y-1"><span className="micro">Tags</span><input name="tags" defaultValue={tags.join(", ")} className="field" /></label>
          <button className="btn" disabled={pending}>Save</button>
        </form>
      )}
    </div>
  );
}
