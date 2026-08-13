import type { Dataset, SourceId } from "@/lib/types";

export type SortKey = "recent" | "oldest" | "largest" | "subjects" | "name";

export interface Query {
  q: string;
  sources: SourceId[];
  modalities: string[];
  species: string[];
  from?: number;
  to?: number;
  sort: SortKey;
}

export interface Facets {
  sources: { key: string; count: number }[];
  modalities: { key: string; count: number }[];
  species: { key: string; count: number }[];
}

export const EMPTY_QUERY: Query = {
  q: "",
  sources: [],
  modalities: [],
  species: [],
  sort: "recent",
};

function haystack(d: Dataset): string {
  return [d.name, d.description, d.id, d.authors.join(" "), d.tasks.join(" ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Every term must appear somewhere; quoted spans match verbatim. */
function matchesText(d: Dataset, q: string): boolean {
  if (!q.trim()) return true;
  const hay = haystack(d);
  const terms = q.toLowerCase().match(/"[^"]+"|\S+/g) ?? [];
  return terms.every((term) => hay.includes(term.replace(/"/g, "")));
}

function inYearRange(d: Dataset, from?: number, to?: number): boolean {
  if (from === undefined && to === undefined) return true;
  const year = Number(d.created.slice(0, 4));
  if (Number.isNaN(year)) return false;
  if (from !== undefined && year < from) return false;
  if (to !== undefined && year > to) return false;
  return true;
}

export function applyQuery(datasets: Dataset[], query: Query) {
  const textual = datasets.filter(
    (d) => matchesText(d, query.q) && inYearRange(d, query.from, query.to),
  );

  // Facet counts ignore their own dimension so a filter never hides its siblings.
  const bySource = (d: Dataset) => !query.sources.length || query.sources.includes(d.source);
  const byModality = (d: Dataset) =>
    !query.modalities.length || query.modalities.some((m) => d.modalities.includes(m));
  const bySpecies = (d: Dataset) =>
    !query.species.length || query.species.some((s) => d.species.includes(s));

  const facets: Facets = {
    sources: tally(textual.filter((d) => byModality(d) && bySpecies(d)), (d) => [d.source]),
    modalities: tally(textual.filter((d) => bySource(d) && bySpecies(d)), (d) => d.modalities),
    species: tally(textual.filter((d) => bySource(d) && byModality(d)), (d) => d.species),
  };

  const results = textual.filter((d) => bySource(d) && byModality(d) && bySpecies(d));
  return { results: sortDatasets(results, query.sort), facets };
}

function tally(datasets: Dataset[], keys: (d: Dataset) => string[]) {
  const counts = new Map<string, number>();
  for (const d of datasets) {
    for (const key of keys(d)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function sortDatasets(datasets: Dataset[], sort: SortKey): Dataset[] {
  const copy = [...datasets];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => a.created.localeCompare(b.created));
    case "largest":
      return copy.sort((a, b) => (b.sizeBytes ?? -1) - (a.sizeBytes ?? -1));
    case "subjects":
      return copy.sort((a, b) => (b.subjects ?? -1) - (a.subjects ?? -1));
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy.sort((a, b) => b.created.localeCompare(a.created));
  }
}

export function parseQuery(params: URLSearchParams): Query {
  const list = (key: string) =>
    (params.get(key) ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const num = (key: string) => {
    const value = Number(params.get(key));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  return {
    q: params.get("q") ?? "",
    sources: list("source") as SourceId[],
    modalities: list("modality"),
    species: list("species"),
    from: num("from"),
    to: num("to"),
    sort: (params.get("sort") as SortKey) || "recent",
  };
}
