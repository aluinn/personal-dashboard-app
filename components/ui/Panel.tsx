"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import type { ReactNode } from "react";

function Corner({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "pointer-events-none absolute h-3 w-3 border-[color:var(--c,#2ee6d6)] transition-all duration-300",
        "group-hover:h-4 group-hover:w-4",
        className,
      )}
    />
  );
}

export default function Panel({
  label,
  meta,
  children,
  className,
  delay = 0,
  accent = "teal",
  color,
  pulse,
}: {
  label?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
  accent?: "teal" | "violet";
  /** Custom accent colour (hex); overrides `accent`. */
  color?: string;
  /** Gentle glow pulse, e.g. for the current/next class. */
  pulse?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      style={color ? ({ "--c": color } as React.CSSProperties) : undefined}
      className={clsx(
        pulse && "pulse-accent",
        "group relative overflow-hidden rounded-sm border border-line bg-panel p-4 backdrop-blur-md",
        "transition-[border-color,box-shadow] duration-300",
        color
          ? "hover:border-[color:var(--c)] hover:shadow-[0_0_28px_-6px_var(--c)]"
          : accent === "teal"
          ? "hover:border-teal/50 hover:shadow-[0_0_28px_-6px_rgba(46,230,214,0.35)]"
          : "hover:border-violet/60 hover:shadow-[0_0_28px_-6px_rgba(124,92,255,0.45)]",
        className,
      )}
    >
      <Corner className="left-0 top-0 border-l border-t" />
      <Corner className="right-0 top-0 border-r border-t" />
      <Corner className="bottom-0 left-0 border-b border-l" />
      <Corner className="bottom-0 right-0 border-b border-r" />
      {(label || meta) && (
        <header className="mb-3 flex items-center justify-between">
          <span className="micro flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-teal blink" />
            {label}
          </span>
          {meta && <span className="micro">{meta}</span>}
        </header>
      )}
      {children}
    </motion.section>
  );
}
