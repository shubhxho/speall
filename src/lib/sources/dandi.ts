import type { Dataset } from "@/lib/types";
import { normalizeModalities, normalizeSpecies, plainText } from "@/lib/normalize";
import { mapWithConcurrency } from "@/lib/concurrency";
import { fetchWithRetry } from "@/lib/http";

const BASE = "https://api.dandiarchive.org/api";

interface VersionStub {
  version: string;
  name: string;
  asset_count: number;
  size: number;
  created: string;
  modified: string;
}

interface DandisetStub {
  identifier: string;
  created: string;
  modified: string;
  contact_person?: string | null;
  embargo_status?: string;
  most_recent_published_version?: VersionStub | null;
  draft_version?: VersionStub | null;
}

/**
 * The list endpoint carries no scientific metadata, so each dandiset needs a
 * second call to its version `info` for species, techniques and licence.
 */
export async function fetchDandi(limit = Infinity): Promise<Dataset[]> {
  const stubs: DandisetStub[] = [];
  let url: string | null = `${BASE}/dandisets/?page_size=100&ordering=-created`;

  while (url && stubs.length < limit) {
    const res: Response = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`DANDI ${res.status}`);
    const json = await res.json();
    stubs.push(...(json.results as DandisetStub[]));
    url = json.next;
  }

  const scoped = limit === Infinity ? stubs : stubs.slice(0, limit);

  const enriched = await mapWithConcurrency(scoped, 10, async (stub) => {
    const version = stub.most_recent_published_version ?? stub.draft_version;
    if (!version) return null;
    let metadata: Record<string, unknown> | undefined;
    try {
      const res = await fetch(
        `${BASE}/dandisets/${stub.identifier}/versions/${version.version}/info/`,
        { signal: AbortSignal.timeout(30_000) },
      );
      if (res.ok) metadata = (await res.json()).metadata;
    } catch {
      // Detail is an enrichment, not a requirement — keep the stub-level record.
    }
    return toDataset(stub, version, metadata);
  });

  return enriched.filter((d): d is Dataset => d !== null);
}

type Named = { name?: string | null; identifier?: string | null };

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: Named | string) => (typeof item === "string" ? item : item?.name))
    .filter((n): n is string => Boolean(n));
}

function toDataset(
  stub: DandisetStub,
  version: VersionStub,
  metadata?: Record<string, unknown>,
): Dataset {
  const summary = (metadata?.assetsSummary ?? {}) as Record<string, unknown>;
  const contributors = Array.isArray(metadata?.contributor)
    ? (metadata!.contributor as { name?: string; roleName?: string[] }[])
        .filter((c) => c.name && !c.roleName?.includes("dcite:Sponsor"))
        .map((c) => c.name!)
    : stub.contact_person
      ? [stub.contact_person]
      : [];

  const license = Array.isArray(metadata?.license)
    ? (metadata!.license as string[])[0]?.replace(/^spdx:/, "")
    : undefined;

  const doiValue = metadata?.doi;

  return {
    uid: `dandi:${stub.identifier}`,
    source: "dandi",
    id: stub.identifier,
    name: version.name,
    description: plainText(metadata?.description as string | undefined),
    authors: contributors,
    modalities: normalizeModalities([
      ...names(summary.measurementTechnique),
      ...names(summary.approach),
    ]),
    species: normalizeSpecies(names(summary.species)),
    subjects: (summary.numberOfSubjects as number | undefined) ?? undefined,
    tasks: [],
    files: version.asset_count,
    sizeBytes: version.size,
    created: stub.created,
    updated: version.modified,
    license,
    doi: typeof doiValue === "string" ? doiValue : undefined,
    version: version.version,
    url: `https://dandiarchive.org/dandiset/${stub.identifier}`,
  };
}
