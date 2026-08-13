"use client";

import type { SortKey, ViewMode } from "@/lib/query";
import type { Chip } from "@/lib/chips";
import { SearchBar } from "@/components/search-bar";
import { useQueryNav } from "@/components/use-query-nav";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Best match" },
  { key: "recent", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "largest", label: "Largest" },
  { key: "subjects", label: "Most subjects" },
  { key: "name", label: "A–Z" },
];

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "rows", label: "Rows" },
  { key: "cards", label: "Cards" },
];

interface Props {
  q: string;
  sort: SortKey;
  view: ViewMode;
  chips: Chip[];
  /** Rendered inside the sticky bar so the count travels with the controls. */
  summary: string;
}

export function Toolbar({ q, sort, view, chips, summary }: Props) {
  const { commit, toggleInList, pending } = useQueryNav();

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-hairline bg-bg/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-2 lg:px-2">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar initial={q} />

        <div
          className="flex items-center gap-px rounded-full border border-hairline bg-surface p-px"
          role="group"
          aria-label="Result density"
        >
          {VIEWS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => commit({ view: option.key === "rows" ? null : option.key })}
              aria-pressed={view === option.key}
              className={`readout rounded-full px-2.5 py-1 transition-colors ${
                view === option.key ? "bg-ink text-surface" : "text-ink-faint hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2">
          <span className="readout text-ink-faint">Sort</span>
          <select
            value={sort}
            onChange={(e) => commit({ sort: e.target.value })}
            className="border border-hairline bg-surface px-2 py-2 text-sm text-ink"
          >
            {SORTS.filter((option) => option.key !== "relevance" || q.trim()).map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span
          className={`readout text-ink-faint transition-opacity ${pending ? "opacity-40" : ""}`}
          aria-live="polite"
        >
          {summary}
        </span>

        {chips.length > 0 && (
          <>
            <span className="text-hairline-strong" aria-hidden>
              |
            </span>
            {chips.map((chip) => (
              <button
                key={`${chip.key}:${chip.value}`}
                type="button"
                onClick={() => toggleInList(chip.key, chip.value)}
                className="readout flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-1 text-ink hover:border-hairline-strong"
              >
                {chip.label}
                <span aria-hidden className="text-ink-faint">
                  ✕
                </span>
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                commit({
                  source: null,
                  modality: null,
                  species: null,
                  channels: null,
                  system: null,
                  from: null,
                  to: null,
                  q: null,
                })
              }
              className="readout ml-auto text-ink-muted underline decoration-hairline-strong underline-offset-4 hover:text-ink"
            >
              Clear all filters
            </button>
          </>
        )}
      </div>
    </div>
  );
}
