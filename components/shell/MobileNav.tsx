"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "@/lib/nav";

/** Phones: the left rail becomes a bottom tab bar (scrolls sideways if the icons don't all fit). */
export default function MobileNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-line bg-[#05080a]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      {nav.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`flex h-16 min-w-[62px] flex-1 flex-col items-center justify-center gap-1 transition-colors ${active ? "text-teal" : "text-muted"}`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.5} style={active ? { filter: "drop-shadow(0 0 6px rgba(46,230,214,0.7))" } : undefined} />
            <span className="micro !text-[8px]">{label.split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
