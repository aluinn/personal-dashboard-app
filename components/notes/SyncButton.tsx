"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncNow } from "@/app/notes/actions";
import type { SyncResult } from "@/lib/notion/sync";

export default function SyncButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<SyncResult | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className="btn inline-flex items-center gap-1.5"
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            setRes(await syncNow());
            router.refresh();
          })
        }
      >
        <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} /> {pending ? "Syncing…" : "Sync now"}
      </button>
      {res && (
        <span className={`micro normal-case tracking-wide ${res.ok ? "!text-teal" : "!text-magenta"}`} role="status">
          {res.ok ? `Synced ${res.pages} page${res.pages === 1 ? "" : "s"} (${res.fetched} changed${res.removed ? `, ${res.removed} removed` : ""}).` : res.error}
          {res.notes.length > 0 && ` ${res.notes.join(" ")}`}
        </span>
      )}
    </div>
  );
}
