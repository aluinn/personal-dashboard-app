import { connection, NextResponse } from "next/server";
import { getMatchConfig, listOpportunities } from "@/lib/db/opp";
import { scoreListing } from "@/lib/match";
import { londonDate } from "@/lib/time";

// Feeds the in-browser notifier (components/opportunities/Notifier.tsx).
export async function GET() {
  await connection();
  const config = getMatchConfig();
  const items = listOpportunities()
    .filter((o) => o.status === "saved" || o.status === "feed")
    .map((o) => ({
      id: o.id,
      firm: o.firm,
      role: o.role,
      status: o.status,
      opensOn: o.opensOn,
      deadline: o.deadline,
      score: scoreListing(o, config).score,
    }));
  return NextResponse.json({ today: londonDate(Date.now()), items }, { headers: { "Cache-Control": "no-store" } });
}
