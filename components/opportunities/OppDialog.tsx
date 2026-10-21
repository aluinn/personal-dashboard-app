"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { deleteOpportunity, saveOpportunity } from "@/app/opportunities/actions";
import type { MatchResult } from "@/lib/match";
import { ALL_STATUSES, PIPELINE, PROGRAMMES, TYPES } from "@/lib/opp";
import { MatchBreakdown } from "./parts";

export type DialogValues = {
  id?: number;
  firm?: string;
  role?: string;
  type?: string;
  programme?: string;
  status?: string;
  deadline?: string | null;
  opensOn?: string | null;
  link?: string;
  notes?: string;
  description?: string;
  location?: string;
  source?: string;
};

const STATUS_LABEL: Record<string, string> = {
  feed: "Feed (unsorted)",
  dismissed: "Dismissed",
  ...Object.fromEntries(PIPELINE.map((p) => [p.key, p.label])),
};

export default function OppDialog({
  open,
  values,
  notice,
  match,
  onClose,
}: {
  open: boolean;
  values: DialogValues;
  notice?: string;
  match?: MatchResult;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const editing = Boolean(values.id);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: 40 }}
            animate={{ x: 0 }}
            exit={{ x: 40 }}
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-lg overflow-y-auto border-l border-teal/30 bg-[#0a1115] p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="micro text-teal">{editing ? "Edit opportunity" : "Add opportunity"}</span>
              <button onClick={onClose} aria-label="Close" className="text-muted hover:text-teal">
                <X className="h-4 w-4" />
              </button>
            </div>
            {notice && <p className="mb-3 rounded-sm border border-violet/40 bg-violet/10 p-2 text-xs text-text/90">{notice}</p>}

            <form
              key={values.id ?? values.link ?? "new"}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setError("");
                start(async () => {
                  try {
                    await saveOpportunity(f);
                    onClose();
                  } catch (err) {
                    setError((err as Error).message || "Couldn't save");
                  }
                });
              }}
              className="grid grid-cols-2 gap-3"
            >
              {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
              <input type="hidden" name="source" value={values.source ?? "manual"} />
              <label className="space-y-1">
                <span className="micro">Firm</span>
                <input name="firm" required defaultValue={values.firm} className="field" />
              </label>
              <label className="space-y-1">
                <span className="micro">Role</span>
                <input name="role" required defaultValue={values.role} className="field" />
              </label>
              <label className="space-y-1">
                <span className="micro">Type</span>
                <select name="type" defaultValue={values.type ?? "other"} className="field">
                  {TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="micro">Programme</span>
                <select name="programme" defaultValue={values.programme ?? "other"} className="field">
                  {PROGRAMMES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="micro">Opens</span>
                <input name="opensOn" type="date" defaultValue={values.opensOn ?? ""} className="field" />
              </label>
              <label className="space-y-1">
                <span className="micro">Deadline</span>
                <input name="deadline" type="date" defaultValue={values.deadline ?? ""} className="field" />
              </label>
              <label className="col-span-2 space-y-1">
                <span className="micro">Link</span>
                <input name="link" type="url" defaultValue={values.link} placeholder="https://…" className="field" />
              </label>
              <label className="space-y-1">
                <span className="micro">Status</span>
                <select name="status" defaultValue={values.status ?? "saved"} className="field">
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="micro">Location</span>
                <input name="location" defaultValue={values.location} className="field" />
              </label>
              <label className="col-span-2 space-y-1">
                <span className="micro">Description (used for CV matching)</span>
                <textarea name="description" rows={3} defaultValue={values.description} className="field" />
              </label>
              <label className="col-span-2 space-y-1">
                <span className="micro">Notes</span>
                <textarea name="notes" rows={3} defaultValue={values.notes} className="field" />
              </label>
              {error && <p className="col-span-2 text-xs text-magenta">{error}</p>}
              <div className="col-span-2 flex items-center justify-between">
                <button className="btn" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </button>
                {editing && (
                  <button
                    type="button"
                    className="micro hover:text-magenta"
                    onClick={() => {
                      if (confirm("Delete this opportunity?")) start(async () => { await deleteOpportunity(values.id!); onClose(); });
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>

            {match && (
              <div className="mt-6 border-t border-line pt-4">
                <MatchBreakdown m={match} />
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
