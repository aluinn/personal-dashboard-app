import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ExternalLink } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Blocks from "@/components/notes/Blocks";
import NoteAdmin from "@/components/notes/NoteAdmin";
import { getNotesData, getReadingNote } from "@/lib/db/notes";

async function Reader({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const note = await getReadingNote(decodeURIComponent(id));
  if (!note) notFound();
  const { modules } = await getNotesData();
  const m = modules.find((x) => x.code === note.module);
  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/notes" className="micro hover:text-teal">← All notes</Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="micro" style={{ color: m?.color }}>{note.module}{m ? ` · ${m.name}` : ""}</span>
        {note.placeholder && <span className="micro rounded-sm border border-line px-1.5 py-0.5 !text-[9px]">placeholder</span>}
        <span className="micro">Year {note.year} · {note.term}{note.week ? ` · week ${note.week}` : ""}</span>
      </div>
      <h1 className="mt-2 text-3xl font-light tracking-wide">{note.title}</h1>
      <div className="micro mt-2 normal-case tracking-wide">
        {note.editedAt ? `Last edited ${new Date(note.editedAt).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" })} · ` : ""}
        {note.words} words
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {note.tags.map((t) => <span key={t} className="micro rounded-sm border border-line px-1.5 py-0.5 !text-[9px]">{t}</span>)}
        {note.url && (
          <a href={note.url} target="_blank" rel="noreferrer" className="btn ml-auto inline-flex items-center gap-1">Open original PDF <ExternalLink className="h-3 w-3" /></a>
        )}
      </div>
      <div className="mt-6 border-t border-line pt-4 text-[15px]"><Blocks blocks={note.blocks} /></div>
      {note.hasPdf && <NoteAdmin id={note.id} title={note.title} week={note.week} tags={note.tags} />}
    </article>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <PageHeader code="03 // NOTES / READING" title="Reading view" />
      <Suspense fallback={<div className="micro">Loading…</div>}><Reader params={params} /></Suspense>
    </>
  );
}
