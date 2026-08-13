import { Suspense } from "react";

import { getRegistry } from "@/lib/registry";
import { applyQuery, parseQuery } from "@/lib/query";
import { buildRaster } from "@/lib/raster";
import { formatCount } from "@/lib/normalize";
import { SOURCES, type SourceId } from "@/lib/types";
import { DatasetRow } from "@/components/dataset-row";
import { FilterRail } from "@/components/filter-rail";
import { Pagination } from "@/components/pagination";
import { RasterBand } from "@/components/raster-band";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toolbar } from "@/components/toolbar";
import { buildChips } from "@/lib/chips";

const PER_PAGE = 25;

const NUMBER_WORDS = [
  "No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
];

function archiveWord(count: number): string {
  return NUMBER_WORDS[count] ?? String(count);
}

/** "A, B, C and D" — reads as prose, stays correct as archives are added. */
function listArchives(labels: string[]): string {
  if (labels.length < 2) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const resolved = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) params.set(key, value.join(","));
  }

  const query = parseQuery(params);
  const registry = await getRegistry();
  const { results, facets } = applyQuery(registry.datasets, query);
  const raster = buildRaster(registry.datasets, new Set(results.map((d) => d.uid)));

  const pages = Math.max(1, Math.ceil(results.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(params.get("page")) || 1));
  const visible = results.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const active = {
    sources: query.sources,
    modalities: query.modalities,
    species: query.species,
  };
  const failed = registry.report.filter((row) => !row.ok);
  const archiveLabels = Object.values(SOURCES).map((meta) => meta.label);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-hairline py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-lg font-extrabold tracking-[-0.03em] text-ink">
            Speall
          </span>
          <span className="readout hidden text-ink-faint sm:inline">Open neuro data index</span>
        </div>
        <ThemeToggle />
      </header>

      <section className="border-b border-hairline py-8 sm:py-10">
        <h1 className="max-w-[19ch] font-display text-[2.1rem] leading-[1.05] font-extrabold tracking-[-0.035em] text-ink sm:text-[3.1rem]">
          {archiveWord(archiveLabels.length)} archives. One search field.
        </h1>
        <p className="mt-4 max-w-[62ch] text-[0.9375rem] leading-relaxed text-ink-muted">
          Open neuroscience data is spread across archives that share no vocabulary and no search.
          Speall indexes {formatCount(registry.datasets.length)} public datasets from{" "}
          {listArchives(archiveLabels)}, maps their modality and species labels onto one scheme, and
          puts them behind a single query.
        </p>

        <div className="mt-8">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 className="readout text-ink-faint">Deposits per month, by archive</h2>
            <p className="readout hidden text-ink-faint sm:block">Drag across to filter by year</p>
          </div>
          <Suspense fallback={<div className="h-[118px]" />}>
            <RasterBand raster={raster} from={query.from} to={query.to} />
          </Suspense>
        </div>
      </section>

      <div className="grid flex-1 gap-8 py-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <details className="lg:hidden" name="filters">
            <summary className="readout cursor-pointer list-none border border-hairline bg-surface px-3 py-2 text-ink [&::-webkit-details-marker]:hidden">
              Filters {chipsCount(active) > 0 && `(${chipsCount(active)})`}
            </summary>
            <div className="mt-4">
              <Suspense fallback={null}>
                <FilterRail facets={facets} active={active} />
              </Suspense>
            </div>
          </details>
          <div className="hidden lg:block">
            <Suspense fallback={null}>
              <FilterRail facets={facets} active={active} />
            </Suspense>
          </div>
        </aside>

        <main className="min-w-0">
          <Suspense fallback={null}>
            <Toolbar q={query.q} sort={query.sort} chips={buildChips(active)} />
          </Suspense>

          <p className="readout mt-4 text-ink-faint" aria-live="polite">
            {formatCount(results.length)} datasets
            {query.from || query.to ? ` · ${query.from ?? "…"}–${query.to ?? "…"}` : ""}
          </p>

          {visible.length === 0 ? (
            <div className="mt-6 border border-dashed border-hairline-strong px-6 py-14 text-center">
              <p className="font-display text-lg font-semibold text-ink">Nothing matches yet</p>
              <p className="mt-2 text-sm text-ink-muted">
                Widen the year range or drop a filter. Search matches titles, authors, task names
                and archive IDs.
              </p>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {visible.map((dataset) => (
                <DatasetRow key={dataset.uid} dataset={dataset} />
              ))}
            </ul>
          )}

          <Pagination page={page} pages={pages} params={params} />
        </main>
      </div>

      <footer className="mt-4 border-t border-hairline py-6">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="readout text-ink-faint">
            Indexed {registry.fetchedAt.slice(0, 10)}
          </span>
          {registry.report
            .filter((row) => row.ok)
            .map((row) => (
              <span key={row.source} className="readout text-ink-faint">
                <a
                  href={SOURCES[row.source].home}
                  className="text-ink-muted underline decoration-hairline-strong underline-offset-4 hover:text-ink"
                >
                  {SOURCES[row.source].label}
                </a>{" "}
                {formatCount(row.count)}
              </span>
            ))}
        </div>
        <p className="mt-3 max-w-[74ch] text-[0.8125rem] leading-relaxed text-ink-muted">
          OpenNeuro, DANDI, NeuroVault and GIN are indexed in full — they are neuroscience
          archives end to end. Dryad, Figshare and Zenodo host every discipline and have no
          neuroscience-only endpoint, so they are swept by topic query and contribute matching
          deposits rather than complete coverage. Where the same DOI appears twice, the primary
          archive wins and the mirror is dropped.
        </p>
        {failed.length > 0 && (
          <p className="readout mt-3 text-ink-muted">
            Unreachable at last index:{" "}
            {failed.map((row) => SOURCES[row.source as SourceId].label).join(", ")}
          </p>
        )}
      </footer>
    </div>
  );
}

function chipsCount(active: { sources: string[]; modalities: string[]; species: string[] }) {
  return active.sources.length + active.modalities.length + active.species.length;
}
