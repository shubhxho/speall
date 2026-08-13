"use client";

import type { Facets } from "@/lib/query";
import { MODALITY_LABELS, MODALITY_ORDER, SOURCES, type SourceId } from "@/lib/types";
import { formatCount } from "@/lib/normalize";
import { useQueryNav } from "@/components/use-query-nav";

interface Props {
  facets: Facets;
  active: { sources: string[]; modalities: string[]; species: string[] };
}

export function FilterRail({ facets, active }: Props) {
  const { toggleInList } = useQueryNav();

  const modalities = [...facets.modalities].sort(
    (a, b) => MODALITY_ORDER.indexOf(a.key) - MODALITY_ORDER.indexOf(b.key),
  );

  return (
    <div className="flex flex-col gap-8">
      <Group title="Archive">
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

      <Group title="Modality">
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
        <Group title="Species">
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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="readout mb-3 text-ink-faint">{title}</h2>
      <ul className="flex flex-col gap-px">{children}</ul>
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
        <span
          className={`tick ml-auto text-[11px] ${checked ? "opacity-70" : "text-ink-faint"}`}
        >
          {formatCount(count)}
        </span>
      </button>
    </li>
  );
}
