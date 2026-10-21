import { getTimetableData } from "@/lib/db/queries";
import { buildIcs } from "@/lib/ics";

export async function GET(request: Request) {
  const data = await getTimetableData();
  const download = new URL(request.url).searchParams.has("download");
  return new Response(buildIcs(data), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="timetable.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
