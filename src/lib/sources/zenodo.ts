import type { Dataset } from "@/lib/types";
import { deriveModalities, normalizeSpecies, plainText } from "@/lib/normalize";
import { delay, fetchWithRetry } from "@/lib/http";

const BASE = "https://zenodo.org/api/records";

/** Zenodo holds everything, so the query does the scoping. */
const QUERY = [
  "neuroscience",
  "neuroimaging",
  "electrophysiology",
  "EEG",
  "MEG",
  "fMRI",
  "connectome",
  '"spike train"',
  '"single unit recording"',
  '"calcium imaging"',
].join(" OR ");

interface Record {
  id: number;
  doi?: string;
  doi_url?: string;
  created: string;
  updated?: string;
  links?: { self_html?: string; html?: string };
  files?: { size?: number }[];
  metadata: {
    title: string;
    description?: string;
    publication_date?: string;
    creators?: { name?: string }[];
    keywords?: string[];
    subjects?: { subject?: string }[];
    license?: { id?: string } | string;
    version?: string;
    resource_type?: { type?: string; subtype?: string };
  };
}

/** Anonymous Zenodo requests are capped at 25 records per page. */
const PAGE = 25;

export async function fetchZenodo(pages = 100): Promise<Dataset[]> {
  const out: Dataset[] = [];

  for (let page = 1; page <= pages; page++) {
    if (page > 1) await delay(1100); // Guest quota is 60 requests per minute.
    const url = `${BASE}?${new URLSearchParams({
      q: QUERY,
      type: "dataset",
      size: String(PAGE),
      page: String(page),
      sort: "mostrecent",
    })}`;
    const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      if (page === 1) throw new Error(`Zenodo ${res.status}`);
      break; // Partial results beat none once the first page succeeded.
    }
    const json = await res.json();
    const hits: Record[] = json.hits?.hits ?? [];
    if (!hits.length) break;
    out.push(...hits.map(toDataset));
  }

  return out;
}

function toDataset(r: Record): Dataset {
  const m = r.metadata;
  const terms = [...(m.keywords ?? []), ...(m.subjects ?? []).map((s) => s.subject ?? "")];
  const haystack = [m.title, ...terms].join(" ");
  const license = typeof m.license === "string" ? m.license : m.license?.id;
  const size = r.files?.reduce((sum, f) => sum + (f.size ?? 0), 0);

  return {
    uid: `zenodo:${r.id}`,
    source: "zenodo",
    id: String(r.id),
    name: m.title,
    description: plainText(m.description),
    authors: (m.creators ?? []).map((c) => c.name ?? "").filter(Boolean),
    modalities: deriveModalities(terms, `${haystack} ${plainText(m.description, 400) ?? ""}`),
    species: normalizeSpecies([haystack, plainText(m.description, 400) ?? ""]),
    tasks: [],
    files: r.files?.length,
    sizeBytes: size || undefined,
    // publication_date can predate or postdate the deposit; `created` is when
    // the record actually landed in Zenodo, matching the other archives.
    created: r.created ?? m.publication_date,
    updated: r.updated,
    license,
    doi: r.doi,
    version: m.version,
    url: r.links?.self_html ?? r.links?.html ?? `https://zenodo.org/records/${r.id}`,
  };
}
