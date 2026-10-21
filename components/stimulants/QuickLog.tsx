"use client";

import { useState, useTransition } from "react";
import { logStimulant } from "@/app/stimulant-actions";
import { PRESETS } from "@/lib/stimulants";

export default function QuickLog({ only }: { only?: string[] }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const list = PRESETS.filter((p) => !only || only.includes(p.label));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {list.map((p) => (
        <button
          key={p.label}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await logStimulant(p.kind, p.label, p.mg);
              setDone(p.label);
              setTimeout(() => setDone(null), 1600);
            })
          }
          className="btn"
          title={`${p.mg} mg ${p.kind}`}
        >
          {done === p.label ? "Logged ✓" : `+ ${p.label}`}
        </button>
      ))}
    </div>
  );
}
