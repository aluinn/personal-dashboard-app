import { q } from "@/lib/db";


// Streams the original uploaded PDF. The password gate (proxy.ts) covers this route like every other page.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = await q.get<{ name: string; mime: string; data: ArrayBuffer }>("SELECT name, mime, data FROM note_files WHERE note_id = ?", [Number(id)]);
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Content-Disposition": `inline; filename="${row.name.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
