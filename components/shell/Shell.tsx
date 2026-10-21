"use client";

import { Suspense, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import TopBar from "./TopBar";
import CommandPalette from "./CommandPalette";
import Notifier from "@/components/opportunities/Notifier";

export default function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-sm focus:bg-[#0a1115] focus:px-3 focus:py-2 focus:text-teal">Skip to content</a>
      {/* usePathname() needs a Suspense boundary on routes with dynamic segments (/notes/[id]) */}
      <Suspense fallback={null}>
        <Sidebar />
        <MobileNav />
      </Suspense>
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-16">
        <TopBar onOpenPalette={() => setOpen(true)} />
        <main id="main" className="mx-auto max-w-[1400px] p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette open={open} setOpen={setOpen} />
      <Notifier />
    </MotionConfig>
  );
}
