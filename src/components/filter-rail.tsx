"use client";

import { useState } from "react";

import type { Facets } from "@/lib/query";
import { MODALITY_LABELS, MODALITY_ORDER, SOURCES, type SourceId } from "@/lib/types";
import { formatCount } from "@/lib/normalize";
import { useQueryNav } from "@/components/use-query-nav";

/** Long facet lists collapse to this until the reader asks for more. */
const COLLAPSED_ROWS = 8;

interface Props {
  facets: Facets;
  active: { sources: string[]; modalities: string[]; species: string[] };
}

export function FilterRail({ facets, active }: Props) {
  const { toggleInList, commit } = useQueryNav();

  const modalities = [...facets.modalities].sort(
    (a, b) => MODALITY_ORDER.indexOf(a.key) - MODALITY_ORDER.indexOf(b.key),
  );

  return (
    <div className="flex flex-col gap-6">
      <Group
        title="Archive"
        selected={active.sources.length}
        onClear={() => commit({ source: null })}
      >
        {facets.sources.map(({ key, count }) => {
          const meta = SOURCES[key as SourceId];
          if (!meta) return null;
          return (
            <Row
              key={key}
              label={meta.label}
              count={count}
              checked={active.sources.includes(key)}
              onToggle={() => toggleInList("source", key)}
              swatch={`var(${meta.token})`}
              hint={meta.blurb}
            />
          );
        })}
      </Group>

      <Group
        title="Modality"
        selected={active.modalities.length}
        onClear={() => commit({ modality: null })}
      >
        {modalities.map(({ key, count }) => (
          <Row
            key={key}
            label={MODALITY_LABELS[key] ?? key}
            count={count}
            checked={active.modalities.includes(key)}
            onToggle={() => toggleInList("modality", key)}
          />
        ))}
      </Group>

      {facets.species.length > 0 && (
        <Group
          title="Species"
          selected={active.species.length}
          onClear={() => commit({ species: null })}
        >
          {facets.species.map(({ key, count }) => (
            <Row
              key={key}
              label={key}
              count={count}
              checked={active.species.includes(key)}
              onToggle={() => toggleInList("species", key)}
            />
          ))}
        </Group>
      )}
    </div>
  );
}

interface GroupProps {
  title: string;
  selected: number;
  onClear: () => void;
  children: React.ReactNode;
}

function Group({ title, selected, onClear, children }: GroupProps) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : [children];
  const overflow = rows.length - COLLAPSED_ROWS;
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);

  return (
    <section className="border-b border-hairline pb-5 last:border-b-0 last:pb-0">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="readout flex flex-1 items-center gap-1.5 text-ink-faint hover:text-ink"
        >
          <span
            className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            ›
          </span>
          {title}
          {selected > 0 && <span className="text-ink">({selected})</span>}
        </button>
        {selected > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="readout text-ink-muted underline decoration-hairline-strong underline-offset-4 hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <>
          <ul className="flex flex-col gap-px">{visible}</ul>
          {overflow > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="readout mt-2 px-2 text-ink-muted underline decoration-hairline-strong underline-offset-4 hover:text-ink"
            >
              {expanded ? "Show less" : `Show ${overflow} more`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

interface RowProps {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
  swatch?: string;
  hint?: string;
}

function Row({ label, count, checked, onToggle, swatch, hint }: RowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        title={hint}
        className={`group flex w-full items-baseline gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
          checked ? "bg-ink text-surface" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
        }`}
      >
        {swatch && (
          <span
            className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-[1px]"
            style={{ background: swatch }}
            aria-hidden
          />
        )}
        <span className="truncate">{label}</span>
        <span className={`tick ml-auto text-[11px] ${checked ? "opacity-70" : "text-ink-faint"}`}>
          {formatCount(count)}
        </span>
      </button>
    </li>
  );
}
