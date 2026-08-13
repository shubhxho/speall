"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "Auto", light: "Light", dark: "Dark" };
const KEY = "speall-theme";
const EVENT = "speall-theme-change";

/**
 * The document element is the source of truth — the inline script in the layout
 * already stamped it before paint, so React just reads and writes that.
 */
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

function apply(theme: Theme) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem(KEY);
  } else {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
  }
  window.dispatchEvent(new Event(EVENT));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "system" as Theme);

  return (
    <div
      className="flex items-center gap-px rounded-full border border-hairline bg-surface p-px"
      role="group"
      aria-label="Color theme"
    >
      {ORDER.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => apply(option)}
          aria-pressed={theme === option}
          className={`readout rounded-full px-2.5 py-1 transition-colors ${
            theme === option ? "bg-ink text-surface" : "text-ink-faint hover:text-ink"
          }`}
        >
          {LABEL[option]}
        </button>
      ))}
    </div>
  );
}
