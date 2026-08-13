import type { Dataset } from "@/lib/types";
import { plainText } from "@/lib/normalize";
import { mapWithConcurrency } from "@/lib/concurrency";
import { fetchWithRetry } from "@/lib/http";

const BASE = "https://neurovault.org/api/collections/";
const PAGE = 100;

interface Collection {
  id: number;
  name: string;
  description?: string | null;
  authors?: string | null;
  owner_name?: string | null;
  DOI?: string | null;
  paper_url?: string | null;
  journal_name?: string | null;
  number_of_images: number;
  number_of_experimental_units?: number | null;
  add_date: string;
  modify_date: string;
  private?: boolean;
  type_of_design?: string | null;
  scanner_make?: string | null;
  field_strength?: number | null;
}

/**
 * NeuroVault ignores filter and ordering query params, so the whole collection
 * list is walked and filtered here. Most rows are empty scratch collections;
 * only ones with a DOI or a paper link are real deposits.
 */
export async function fetchNeuroVault(): Promise<Dataset[]> {
  const first = await getPage(0);
  const total: number = first.count;
  const offsets: number[] = [];
  for (let offset = PAGE; offset < total; offset += PAGE) offsets.push(offset);

  const pages = await mapWithConcurrency(offsets, 6, async (offset) => {
    try {
      return (await getPage(offset)).results;
    } catch {
      return [] as Collection[];
    }
  });

  const all = [first.results, ...pages].flat();
  return all.filter(isPublished).map(toDataset);
}

async function getPage(offset: number): Promise<{ count: number; results: Collection[] }> {
  const res = await fetchWithRetry(`${BASE}?format=json&limit=${PAGE}&offset=${offset}`);
  if (!res.ok) throw new Error(`NeuroVault ${res.status}`);
  return res.json();
}

function isPublished(c: Collection): boolean {
  if (c.private) return false;
  if (c.number_of_images < 1) return false;
  if (/temporary collection$/i.test(c.name ?? "")) return false;
  return Boolean(c.DOI || c.paper_url);
}

function toDataset(c: Collection): Dataset {
  const authors = (c.authors ?? "")
    .split(/,|;| and /)
    .map((a) => a.trim())
    .filter(Boolean);

  return {
    uid: `neurovault:${c.id}`,
    source: "neurovault",
    id: String(c.id),
    name: c.name?.trim() || `Collection ${c.id}`,
    description: plainText(c.description),
    authors: authors.length ? authors : c.owner_name ? [c.owner_name] : [],
    // Every NeuroVault collection is a set of fMRI-derived statistical maps.
    modalities: ["statmap", "fmri"],
    species: ["Human"],
    subjects: c.number_of_experimental_units ?? undefined,
    tasks: c.type_of_design ? [c.type_of_design] : [],
    files: c.number_of_images,
    sizeBytes: undefined,
    created: c.add_date,
    updated: c.modify_date,
    license: "CC0-1.0",
    doi: c.DOI ?? undefined,
    url: `https://neurovault.org/collections/${c.id}/`,
  };
}
