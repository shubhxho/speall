"use client";

import { useQueryNav } from "@/components/use-query-nav";

/**
 * Filtering is a server round trip. Without this the page simply sits there,
 * which reads as a dropped click rather than work in progress.
 */
export function ProgressBar() {
  const { pending } = useQueryNav();

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
      aria-hidden={!pending}
      role="presentation"
    >
      <div
        className={`h-full origin-left bg-ink transition-transform duration-500 ease-out ${
          pending ? "scale-x-90" : "scale-x-0 opacity-0"
        }`}
      />
    </div>
  );
}
