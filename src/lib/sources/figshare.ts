import type { Dataset } from "@/lib/types";
import { deriveModalities, normalizeSpecies, plainText } from "@/lib/normalize";
import { delay, fetchWithRetry } from "@/lib/http";
import { mapWithConcurrency } from "@/lib/concurrency";

const SEARCH = "https://api.figshare.com/v2/articles/search";
const ARTICLE = "https://api.figshare.com/v2/articles";
/** Figshare's item type 3 is "dataset". */
const DATASET_TYPE = 3;
const PAGE = 100;

const TERMS = [
  "electrophysiology neurons",
  "neuroimaging brain",
  "EEG recordings",
  "fMRI brain",
  "calcium imaging neurons",
  "single unit recording cortex",
  "MEG magnetoencephalography",
  "intracranial EEG epilepsy",
  "patch clamp neurons",
  "diffusion MRI tractography",
  "spike sorting neuropixels",
  "connectome brain network",
  "behaviour neural recording",
];

interface Stub {
  id: number;
  title: string;
  doi?: string;
  published_date?: string;
  url_public_html?: string;
}

interface Article extends Stub {
  description?: string;
  authors?: { full_name?: string }[];
  tags?: string[];
  categories?: { title?: string }[];
  license?: { name?: string };
  size?: number;
  files?: unknown[];
  version?: number;
  created_date?: string;
  modified_date?: string;
  is_public?: boolean;
  is_embargoed?: boolean;
}

/** Search returns bare stubs, so each hit needs a second call for its metadata. */
export async function fetchFigshare(pagesPerTerm = 2): Promise<Dataset[]> {
  const stubs = new Map<number, Stub>();

  for (const term of TERMS) {
    for (let page = 1; page <= pagesPerTerm; page++) {
      await delay(300);
      const res = await fetchWithRetry(SEARCH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_for: term,
          item_type: DATASET_TYPE,
          page_size: PAGE,
          page,
          order: "published_date",
          order_direction: "desc",
        }),
      });
      if (!res.ok) {
        if (term === TERMS[0] && page === 1) throw new Error(`Figshare ${res.status}`);
        break;
      }
      const hits: Stub[] = await res.json();
      if (!hits.length) break;
      for (const hit of hits) stubs.set(hit.id, hit);
    }
  }

  const detailed = await mapWithConcurrency([...stubs.values()], 3, async (stub, index) => {
    if (index) await delay(120);
    try {
      const res = await fetchWithRetry(`${ARTICLE}/${stub.id}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      return toDataset((await res.json()) as Article);
    } catch {
      return null;
    }
  });

  return detailed.filter((d): d is Dataset => d !== null);
}

function toDataset(a: Article): Dataset | null {
  if (a.is_embargoed || a.is_public === false) return null;

  const terms = [...(a.tags ?? []), ...(a.categories ?? []).map((c) => c.title ?? "")];
  const text = [a.title, ...terms, plainText(a.description, 400) ?? ""].join(" ");

  return {
    uid: `figshare:${a.id}`,
    source: "figshare",
    id: String(a.id),
    name: a.title,
    description: plainText(a.description),
    authors: (a.authors ?? []).map((author) => author.full_name ?? "").filter(Boolean),
    modalities: deriveModalities(terms, text),
    species: normalizeSpecies([text]),
    tasks: [],
    files: a.files?.length,
    sizeBytes: a.size || undefined,
    created: a.created_date ?? a.published_date ?? "",
    updated: a.modified_date,
    license: a.license?.name,
    doi: a.doi,
    version: a.version ? String(a.version) : undefined,
    url: a.url_public_html ?? `https://figshare.com/articles/dataset/${a.id}`,
  };
}
