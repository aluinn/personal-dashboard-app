"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { nav } from "@/lib/nav";

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center gap-1 border-r border-line bg-[#05080a]/90 py-4 backdrop-blur-md md:flex">
      <Link href="/" className="mb-4 font-mono text-xs font-bold tracking-widest text-teal glow-text">
        AM
      </Link>
      {nav.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className="group relative flex h-10 w-10 items-center justify-center rounded-sm text-muted transition-colors hover:text-teal"
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-sm border border-teal/40 bg-teal/10 shadow-[0_0_14px_-2px_rgba(46,230,214,0.5)]"
              />
            )}
            <Icon className={`relative h-[18px] w-[18px] ${active ? "text-teal" : ""}`} strokeWidth={1.5} />
            <span className="micro pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-sm border border-line bg-[#0a1115] px-2 py-1 text-teal opacity-0 transition-opacity group-hover:opacity-100">
              {label}
            </span>
          </Link>
        );
      })}
    </aside>
  );

}
