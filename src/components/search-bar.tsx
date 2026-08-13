"use client";

import { useEffect, useRef, useState } from "react";

import { useQueryNav } from "@/components/use-query-nav";

export function SearchBar({ initial }: { initial: string }) {
  const { commit } = useQueryNav();
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) setValue(initial);
  }, [initial]);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      commit({ q: value || null }, { replace: true });
    }, 220);
    return () => clearTimeout(timer);
  }, [value, commit]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => {
          dirty.current = true;
          setValue(e.target.value);
        }}
        placeholder="Search titles, authors, tasks, IDs"
        aria-label="Search datasets"
        className="w-full border border-hairline bg-surface py-2.5 pl-3 pr-12 text-sm text-ink placeholder:text-ink-faint focus:border-hairline-strong"
      />
      <kbd className="readout pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-hairline px-1.5 py-0.5 text-ink-faint">
        /
      </kbd>
    </div>
  );
}
