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

export async function ingest(): Promise<Registry> {
  const settled = await Promise.allSettled(LOADERS.map(({ load }) => load()));

  const report: Registry["report"] = [];
  const datasets: Dataset[] = [];

  settled.forEach((result, i) => {
    const { source } = LOADERS[i];
    if (result.status === "fulfilled") {
      datasets.push(...result.value);
      report.push({ source, count: result.value.length, ok: true });
    } else {
      report.push({
        source,
        count: 0,
        ok: false,
        note: String(result.reason?.message ?? result.reason),
      });
    }
  });

  const registry: Registry = {
    fetchedAt: new Date().toISOString(),
    datasets: dedupe(datasets).sort((a, b) => b.created.localeCompare(a.created)),
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
function dedupe(datasets: Dataset[]): Dataset[] {
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
