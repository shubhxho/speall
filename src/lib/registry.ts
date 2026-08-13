import { promises as fs } from "node:fs";
import path from "node:path";

import type { Dataset, Registry, SourceId } from "@/lib/types";
import { fetchOpenNeuro } from "@/lib/sources/openneuro";
import { fetchDandi } from "@/lib/sources/dandi";
import { fetchNeuroVault } from "@/lib/sources/neurovault";
import { fetchGin } from "@/lib/sources/gin";
import { fetchDryad } from "@/lib/sources/dryad";
import { fetchFigshare } from "@/lib/sources/figshare";
import { fetchZenodo } from "@/lib/sources/zenodo";
import { extractRig } from "@/lib/rig";

const CACHE_FILE = path.join(process.cwd(), "data", "registry.json");

let memory: Registry | null = null;
let inFlight: Promise<Registry> | null = null;

const LOADERS: { source: SourceId; load: () => Promise<Dataset[]> }[] = [
  { source: "openneuro", load: () => fetchOpenNeuro() },
  { source: "dandi", load: () => fetchDandi() },
  { source: "neurovault", load: () => fetchNeuroVault() },
  { source: "gin", load: () => fetchGin() },
  { source: "dryad", load: () => fetchDryad() },
  { source: "figshare", load: () => fetchFigshare() },
  { source: "zenodo", load: () => fetchZenodo() },
];

/**
 * An ingest may only add or refresh, never quietly delete.
 *
 * Two things forced this. A Dryad timeout once took the index from 10,248
 * datasets to 8,490, because a failed source contributed nothing. And the
 * topic-swept archives are non-deterministic samples — Figshare returned 331
 * records one run and 94 the next, from an unchanged query — so even a
 * successful run can come back smaller.
 *
 * Every source is therefore unioned with what it contributed last time, with
 * fresh records winning on collision. The index accumulates instead of
 * fluctuating, and a bad network day cannot shrink it.
 */
export function mergeOutcomes(
  outcomes: { source: SourceId; datasets: Dataset[] | null; error?: string }[],
  previous: Registry | null,
): { datasets: Dataset[]; report: Registry["report"] } {
  const report: Registry["report"] = [];
  const datasets: Dataset[] = [];

  for (const outcome of outcomes) {
    const retained = previous?.datasets.filter((d) => d.source === outcome.source) ?? [];

    if (!outcome.datasets) {
      datasets.push(...retained);
      report.push({
        source: outcome.source,
        count: retained.length,
        ok: false,
        stale: retained.length > 0,
        note: retained.length
          ? `${outcome.error} — kept ${retained.length} records from ${previous!.fetchedAt.slice(0, 10)}`
          : outcome.error,
      });
      continue;
    }

    const merged = new Map(retained.map((d) => [d.uid, d]));
    for (const dataset of outcome.datasets) merged.set(dataset.uid, dataset);
    const carried = merged.size - outcome.datasets.length;

    datasets.push(...merged.values());
    report.push({
      source: outcome.source,
      count: merged.size,
      ok: true,
      note: carried > 0 ? `${outcome.datasets.length} fetched, ${carried} carried over` : undefined,
    });
  }

  return { datasets, report };
}

export async function ingest(): Promise<Registry> {
  const previous = await readCache();
  const settled = await Promise.allSettled(LOADERS.map(({ load }) => load()));

  const { datasets, report } = mergeOutcomes(
    settled.map((result, i) => ({
      source: LOADERS[i].source,
      datasets: result.status === "fulfilled" ? result.value : null,
      error: result.status === "rejected" ? String(result.reason?.message ?? result.reason) : undefined,
    })),
    previous,
  );

  const registry: Registry = {
    fetchedAt: new Date().toISOString(),
    datasets: dedupe(datasets)
      .map(withRig)
      .sort((a, b) => b.created.localeCompare(a.created)),
    report,
  };

  await writeCache(registry);
  memory = registry;
  return registry;
}

/**
 * The same deposit often lands in two archives. Primary archives win over
 * Zenodo mirrors, so preference follows LOADERS order.
 */
export function dedupe(datasets: Dataset[]): Dataset[] {
  const rank = Object.fromEntries(LOADERS.map((l, i) => [l.source, i])) as Record<
    SourceId,
    number
  >;
  const winner = new Map<string, Dataset>();
  const kept: Dataset[] = [];

  for (const dataset of datasets) {
    const doi = dataset.doi
      ?.toLowerCase()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
      .trim();
    if (!doi) {
      kept.push(dataset);
      continue;
    }
    const existing = winner.get(doi);
    if (!existing) {
      winner.set(doi, dataset);
    } else if (existing.source === dataset.source) {
      // Same archive reusing one DOI across deposits — these are distinct records.
      kept.push(dataset);
    } else if (rank[dataset.source] < rank[existing.source]) {
      winner.set(doi, dataset);
    } else {
      // Mirror of a record we already have from a more authoritative archive.
    }
  }

  return [...kept, ...winner.values()];
}

/**
 * Serves whatever index is on disk, however old. A live ingest takes minutes, so
 * it only runs when there is nothing cached at all — refreshing is deliberate,
 * via `npm run ingest` or POST /api/refresh, never a blocked page request.
 */
/** Rig details live in prose, so they are mined once at ingest for every source. */
function withRig(dataset: Dataset): Dataset {
  const rig = extractRig(
    [dataset.name, dataset.description, dataset.tasks.join(" ")].filter(Boolean).join(" "),
    dataset.modalities,
  );
  return rig.channels || rig.system || rig.montage ? { ...dataset, ...rig } : dataset;
}

export async function getRegistry(): Promise<Registry> {
  if (memory) return memory;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const cached = await readCache();
    if (cached) {
      memory = cached;
      return cached;
    }
    return ingest();
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function readCache(): Promise<Registry | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Registry;
    if (!parsed.datasets?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(registry: Registry): Promise<void> {
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(registry), "utf8");
  } catch {
    // Read-only filesystem (serverless): the in-memory copy still serves.
  }
}

export async function getDataset(source: string, id: string): Promise<Dataset | undefined> {
  const { datasets } = await getRegistry();
  return datasets.find((d) => d.source === source && d.id === id);
}
