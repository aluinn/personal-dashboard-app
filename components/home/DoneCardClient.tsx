"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { Check, X } from "lucide-react";
import Panel from "@/components/ui/Panel";
import { addDone, deleteDone } from "@/app/life-actions";
import type { DoneItem } from "@/lib/db/life";

type Op = { kind: "add"; item: DoneItem } | { kind: "del"; id: number };
const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

/** Tap a suggestion or type something you did today. Resets each day (London time); past days stay in the database. */
export default function DoneCardClient({ items, suggestions }: { items: DoneItem[]; suggestions: string[] }) {
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [list, apply] = useOptimistic(items, (cur, op: Op) => (op.kind === "add" ? [op.item, ...cur] : cur.filter((i) => i.id !== op.id)));

  const add = (text: string) => {
    const t = text.trim();
    if (!t) return;
    start(async () => {
      apply({ kind: "add", item: { id: -Date.now(), text: t, at: Date.now() } });
      await addDone(t);
    });
  };
  const open = suggestions.filter((s) => !list.some((i) => i.text === s));

  return (
    <Panel label="DONE TODAY" meta={`${list.length} THING${list.length === 1 ? "" : "S"}`} delay={0.12} className="md:col-span-6 xl:col-span-12">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(input.current?.value ?? "");
          if (input.current) input.current.value = "";
        }}
      >
        <input ref={input} maxLength={140} placeholder="What have you done today?" aria-label="Add something you did today" className="field" />
        <button className="btn">Add</button>
      </form>
      {open.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Quick add">
          {open.map((s) => (
            <button key={s} onClick={() => add(s)} className="micro rounded-sm border border-line px-2 py-1 normal-case tracking-wide hover:border-teal/50 hover:text-teal">+ {s}</button>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing logged yet today. Add what you get done and it builds up here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {list.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
              <Check className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
              <span className="min-w-0 flex-1 break-words">{i.text}</span>
              <span className="micro shrink-0">{clock(i.at)}</span>
              <button
                aria-label={`Remove: ${i.text}`}
                className="text-muted hover:text-magenta"
                onClick={() => start(async () => { apply({ kind: "del", id: i.id }); if (i.id > 0) await deleteDone(i.id); })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
