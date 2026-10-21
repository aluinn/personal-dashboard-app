import { connection } from "next/server";
import { getNotesData } from "@/lib/db/notes";
import GalaxyWidget from "./GalaxyWidget";

export default async function GalaxyCard() {
  await connection();
  const { modules, notes } = await getNotesData();
  return <GalaxyWidget modules={modules} notes={notes} />;
}
