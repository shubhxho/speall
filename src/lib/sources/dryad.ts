import type { Dataset } from "@/lib/types";
import { deriveModalities, normalizeSpecies, plainText } from "@/lib/normalize";
import { fetchWithRetry } from "@/lib/http";

const BASE = "https://datadryad.org/api/v2/search";
const PAGE = 100;

/** Dryad takes one query string at a time, so the scope is swept term by term. */
const TERMS = [
  "neuroscience",
  "neuroimaging",
  "electrophysiology",
  "EEG",
  "MEG",
  "fMRI",
  "neurons",
  "brain",
  "cortex",
  "hippocampus",
  "spike train",
  "single neuron",
  "calcium imaging",
  "behaviour neural",
  "connectome",
  "synapse",
  "sleep EEG",
  "motor cortex",
];

interface Record {
  identifier: string;
  id: number;
  title: string;
  abstract?: string;
  usageNotes?: string;
  keywords?: string[];
  authors?: { firstName?: string; lastName?: string }[];
  publicationDate?: string;
  lastModificationDate?: string;
  storageSize?: number;
  versionNumber?: number;
  license?: string;
  visibility?: string;
}

export async function fetchDryad(pagesPerTerm = 5): Promise<Dataset[]> {
  const byId = new Map<string, Dataset>();

  for (const term of TERMS) {
    for (let page = 1; page <= pagesPerTerm; page++) {
      const url = `${BASE}?${new URLSearchParams({
        q: term,
        per_page: String(PAGE),
        page: String(page),
      })}`;
      const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        if (page === 1 && term === TERMS[0]) throw new Error(`Dryad ${res.status}`);
        break;
      }
      const json = await res.json();
      const records: Record[] = json._embedded?.["stash:datasets"] ?? [];
      if (!records.length) break;
      for (const record of records) {
        if (record.visibility && record.visibility !== "public") continue;
        const dataset = toDataset(record);
        byId.set(dataset.uid, dataset);
      }
    }
  }

  return [...byId.values()];
}

function toDataset(r: Record): Dataset {
  const doi = r.identifier.replace(/^doi:/, "");
  const text = [r.title, ...(r.keywords ?? []), r.abstract ?? ""].join(" ");

  return {
    uid: `dryad:${doi}`,
    source: "dryad",
    id: doi,
    name: r.title,
    description: plainText(r.abstract ?? r.usageNotes),
    authors: (r.authors ?? [])
      .map((a) => [a.firstName, a.lastName].filter(Boolean).join(" ").trim())
      .filter(Boolean),
    modalities: deriveModalities(r.keywords ?? [], text),
    species: normalizeSpecies([text]),
    tasks: [],
    sizeBytes: r.storageSize,
    created: r.publicationDate ?? r.lastModificationDate ?? "",
    updated: r.lastModificationDate,
    license: r.license?.replace(/^https:\/\/spdx\.org\/licenses\//, "").replace(/\.html$/, ""),
    doi,
    version: r.versionNumber ? String(r.versionNumber) : undefined,
    url: `https://datadryad.org/dataset/${r.identifier}`,
  };
}
