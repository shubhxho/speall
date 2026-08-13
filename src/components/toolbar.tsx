"use client";

import type { SortKey } from "@/lib/query";
import type { Chip } from "@/lib/chips";
import { SearchBar } from "@/components/search-bar";
import { useQueryNav } from "@/components/use-query-nav";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "largest", label: "Largest" },
  { key: "subjects", label: "Most subjects" },
  { key: "name", label: "A–Z" },
];

interface Props {
  q: string;
  sort: SortKey;
  chips: Chip[];
}

export function Toolbar({ q, sort, chips }: Props) {
  const { commit, toggleInList } = useQueryNav();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar initial={q} />
        <label className="flex items-center gap-2">
          <span className="readout text-ink-faint">Sort</span>
          <select
            value={sort}
            onChange={(e) => commit({ sort: e.target.value === "recent" ? null : e.target.value })}
            className="border border-hairline bg-surface px-2 py-2 text-sm text-ink"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
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
              commit({ source: null, modality: null, species: null, from: null, to: null, q: null })
            }
            className="readout text-ink-muted underline decoration-hairline-strong underline-offset-4 hover:text-ink"
          >
            Reset all
          </button>
        </div>
      )}
    </div>
  );
}
