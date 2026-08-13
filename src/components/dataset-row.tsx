import Link from "next/link";

import type { Dataset } from "@/lib/types";
import { MODALITY_LABELS, SOURCES } from "@/lib/types";
import { formatBytes, formatCount } from "@/lib/normalize";

/**
 * One dataset drawn as a recording channel: the archive's signal color runs
 * down the left edge, everything an instrument would print is monospaced.
 */
export function DatasetRow({ dataset }: { dataset: Dataset }) {
  const source = SOURCES[dataset.source];
  const authors = dataset.authors.slice(0, 3).join(", ");
  const overflow = dataset.authors.length - 3;

  return (
    <li className="group relative">
      <Link
        href={`/d/${dataset.source}/${encodeURIComponent(dataset.id)}`}
        className="block border border-hairline bg-surface pl-4 pr-4 py-4 shadow-[var(--shadow-card)] transition-colors hover:border-hairline-strong sm:pl-5"
      >
        <span
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: `var(${source.token})` }}
          aria-hidden
        />

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="readout" style={{ color: `var(${source.token})` }}>
            {source.label}
          </span>
          <span className="tick text-[11px] text-ink-faint">{dataset.id}</span>
          <span className="tick ml-auto text-[11px] text-ink-faint">
            {dataset.created.slice(0, 10)}
          </span>
        </div>

        <h3 className="mt-1.5 font-display text-[1.05rem] leading-snug font-semibold tracking-[-0.015em] text-ink">
          {dataset.name}
        </h3>

        {authors && (
          <p className="mt-1 truncate text-[0.8125rem] text-ink-muted">
            {authors}
            {overflow > 0 && ` +${overflow}`}
          </p>
        )}

        {dataset.description && (
          <p className="mt-2 line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-muted">
            {dataset.description}
          </p>
        )}

        <dl className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
          {dataset.modalities.length > 0 && (
            <Stat label="Modality">
              {dataset.modalities.map((m) => MODALITY_LABELS[m] ?? m).join(" · ")}
            </Stat>
          )}
          {dataset.species.length > 0 && <Stat label="Species">{dataset.species.join(", ")}</Stat>}
          {!!dataset.subjects && <Stat label="Subjects">{formatCount(dataset.subjects)}</Stat>}
          {!!dataset.files && <Stat label="Files">{formatCount(dataset.files)}</Stat>}
          {!!dataset.sizeBytes && <Stat label="Size">{formatBytes(dataset.sizeBytes)}</Stat>}
        </dl>
      </Link>
    </li>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="readout text-ink-faint">{label}</dt>
      <dd className="tick text-[0.8125rem] text-ink">{children}</dd>
    </div>
  );
}
