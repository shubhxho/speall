import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getDataset } from "@/lib/registry";
import { formatBytes, formatCount } from "@/lib/normalize";
import { MODALITY_LABELS, SOURCES } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";

/** DOIs and GIN repo paths contain slashes, so the id arrives as path segments. */
function joinId(segments: string[]): string {
  return segments.map(decodeURIComponent).join("/");
}

export async function generateMetadata({ params }: PageProps<"/d/[source]/[...id]">): Promise<Metadata> {
  const { source, id } = await params;
  const dataset = await getDataset(source, joinId(id));
  if (!dataset) return { title: "Dataset not found — Speall" };
  return {
    title: `${dataset.name} — Speall`,
    description: dataset.description?.slice(0, 200),
  };
}

export default async function DatasetPage({ params }: PageProps<"/d/[source]/[...id]">) {
  const { source, id } = await params;
  const dataset = await getDataset(source, joinId(id));
  if (!dataset) notFound();

  const meta = SOURCES[dataset.source];
  const color = `var(${meta.token})`;

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-hairline py-4">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="font-display text-lg font-extrabold tracking-[-0.03em] text-ink">
            Speall
          </span>
          <span className="readout text-ink-faint">Back to index</span>
        </Link>
        <ThemeToggle />
      </header>

      <article className="relative border-x border-b border-hairline bg-surface px-5 py-8 shadow-[var(--shadow-card)] sm:px-8 sm:py-10">
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} aria-hidden />

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <a href={meta.home} className="readout" style={{ color }}>
            {meta.label}
          </a>
          <span className="tick text-[11px] text-ink-faint">{dataset.id}</span>
          {dataset.version && (
            <span className="tick text-[11px] text-ink-faint">v{dataset.version}</span>
          )}
        </div>

        <h1 className="mt-3 font-display text-[1.75rem] leading-[1.15] font-extrabold tracking-[-0.03em] text-ink sm:text-[2.25rem]">
          {dataset.name}
        </h1>

        {dataset.authors.length > 0 && (
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {dataset.authors.join(", ")}
          </p>
        )}

        <dl className="mt-7 grid grid-cols-2 gap-px border border-hairline bg-hairline sm:grid-cols-4">
          <Cell label="Subjects" value={formatCount(dataset.subjects)} />
          <Cell label="Files" value={formatCount(dataset.files)} />
          <Cell label="Size" value={formatBytes(dataset.sizeBytes)} />
          <Cell label="Deposited" value={dataset.created.slice(0, 10)} />
        </dl>

        {dataset.description && (
          <p className="mt-7 max-w-[68ch] text-[0.9375rem] leading-relaxed text-ink-muted">
            {dataset.description}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-5 border-t border-hairline pt-6">
          {dataset.modalities.length > 0 && (
            <Field label="Modality">
              {dataset.modalities.map((m) => MODALITY_LABELS[m] ?? m).join(" · ")}
            </Field>
          )}
          {dataset.species.length > 0 && (
            <Field label="Species">{dataset.species.join(", ")}</Field>
          )}
          {dataset.tasks.length > 0 && <Field label="Tasks">{dataset.tasks.join(" · ")}</Field>}
          {dataset.license && <Field label="License">{dataset.license}</Field>}
          {dataset.doi && (
            <Field label="DOI">
              <a
                href={
                  dataset.doi.startsWith("http") ? dataset.doi : `https://doi.org/${dataset.doi}`
                }
                className="underline decoration-hairline-strong underline-offset-4 hover:text-ink"
              >
                {dataset.doi}
              </a>
            </Field>
          )}
          {dataset.updated && (
            <Field label="Last change">{dataset.updated.slice(0, 10)}</Field>
          )}
        </div>

        <a
          href={dataset.url}
          className="readout mt-8 inline-flex items-center gap-2 bg-ink px-4 py-3 text-surface transition-opacity hover:opacity-85"
        >
          Open on {meta.label} →
        </a>
        <p className="mt-3 text-[0.8125rem] text-ink-muted">
          Speall indexes metadata only. Files stay on {meta.label}.
        </p>
      </article>

      <nav className="py-6">
        <Link
          href={`/?source=${dataset.source}`}
          className="readout text-ink-muted underline decoration-hairline-strong underline-offset-4 hover:text-ink"
        >
          More from {meta.label}
        </Link>
      </nav>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-3 py-3">
      <dt className="readout text-ink-faint">{label}</dt>
      <dd className="tick mt-1 text-[0.9375rem] text-ink">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-4">
      <dt className="readout pt-1 text-ink-faint">{label}</dt>
      <dd className="text-[0.9375rem] text-ink">{children}</dd>
    </div>
  );
}
