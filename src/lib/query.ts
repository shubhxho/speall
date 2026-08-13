import type { Dataset, SourceId } from "@/lib/types";

export type SortKey = "relevance" | "recent" | "oldest" | "largest" | "subjects" | "name";
export type ViewMode = "rows" | "cards";

export interface Query {
  q: string;
  sources: SourceId[];
  modalities: string[];
  species: string[];
  from?: number;
  to?: number;
  sort: SortKey;
  view: ViewMode;
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
  view: "rows",
};

function haystack(d: Dataset): string {
  return [d.name, d.description, d.id, d.authors.join(" "), d.tasks.join(" ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export interface Term {
  /** What to match on: a stem for bare words, the literal span when quoted. */
  value: string;
  /** Quoted terms match verbatim and anywhere; bare terms match at word starts. */
  exact: boolean;
}

/**
 * Endings stripped so a search for one word form finds the others —
 * "hippocampus" has to find "hippocampal", "neurons" has to find "neuronal".
 * Ordered longest-first so the most specific ending wins.
 */
const SUFFIXES = ["ological", "ology", "ations", "ation", "ically", "ally", "ing", "ies", "es", "us", "um", "al", "ic", "ed", "s"];

export function stem(word: string): string {
  if (word.length < 6) return word;
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

/**
 * Suffix stripping cannot bridge Latin noun/adjective pairs — "cortical" stems
 * to "cortic", which never meets "cortex". These are the pairs common enough in
 * neuroscience titles to matter. Kept to specific stems on purpose: a group for
 * neuron/neural would reduce to "neur" and match most of the corpus.
 */
const SYNONYMS = [
  ["cortex", "cortical", "cortices"],
  ["thalamus", "thalamic"],
  ["cerebellum", "cerebellar"],
  ["cerebrum", "cerebral"],
  ["striatum", "striatal"],
  ["amygdala", "amygdalar"],
  ["retina", "retinal"],
  ["synapse", "synaptic"],
  ["axon", "axonal"],
];

const SYNONYM_STEMS = new Map<string, string[]>();
for (const group of SYNONYMS) {
  const stems = [...new Set(group.map((word) => stem(word)))];
  for (const s of stems) SYNONYM_STEMS.set(s, stems);
}

/** A stem plus any equivalent stems it should also match. */
export function expandStem(value: string): string[] {
  return SYNONYM_STEMS.get(value) ?? [value];
}

/** Split a query into terms, treating a quoted span as one verbatim term. */
export function queryTerms(q: string): Term[] {
  const raw = q.toLowerCase().match(/"[^"]+"|\S+/g) ?? [];
  return raw.map((token) =>
    token.startsWith('"')
      ? { value: token.replace(/"/g, "").trim(), exact: true }
      : { value: stem(token), exact: false },
  ).filter((t) => t.value.length > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bare terms match from a word start, so "cortex" finds "cortex" but not "escort". */
export function matchesTerm(haystack: string, term: Term): boolean {
  if (term.exact) return haystack.includes(term.value);
  return expandStem(term.value).some((value) =>
    new RegExp(`\\b${escapeRegExp(value)}`).test(haystack),
  );
}

/**
 * Where a term matches decides how much it counts. A title hit is what someone
 * searching "hippocampus" means; the same word buried in an abstract is weaker
 * evidence, and an exact archive ID is almost certainly the target.
 */
export function relevanceScore(d: Dataset, q: string): number {
  const terms = queryTerms(q);
  if (!terms.length) return 0;

  const title = d.name.toLowerCase();
  const id = d.id.toLowerCase();
  const authors = d.authors.join(" ").toLowerCase();
  const tasks = d.tasks.join(" ").toLowerCase();
  const description = (d.description ?? "").toLowerCase();

  let score = 0;
  const phrase = terms.map((t) => t.value).join(" ");
  if (title === phrase) score += 60;
  else if (terms.length > 1 && title.includes(phrase)) score += 30;

  for (const term of terms) {
    if (id === term.value) score += 50;
    else if (id.includes(term.value)) score += 12;

    if (matchesTerm(title, term)) score += 15;
    else if (title.includes(term.value)) score += 8; // mid-word hit, weaker evidence
    if (matchesTerm(tasks, term)) score += 5;
    if (matchesTerm(authors, term)) score += 4;
    if (matchesTerm(description, term)) score += 1;
  }

  return score;
}

/** Every term must appear somewhere in the record. */
function matchesText(d: Dataset, q: string): boolean {
  if (!q.trim()) return true;
  const hay = haystack(d);
  return queryTerms(q).every((term) => matchesTerm(hay, term));
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
  return { results: sortDatasets(results, query.sort, query.q), facets };
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

export function sortDatasets(datasets: Dataset[], sort: SortKey, q = ""): Dataset[] {
  const copy = [...datasets];
  switch (sort) {
    case "relevance": {
      if (!q.trim()) return copy.sort((a, b) => b.created.localeCompare(a.created));
      const scores = new Map(copy.map((d) => [d.uid, relevanceScore(d, q)]));
      // Recency breaks ties, so equally-relevant hits still lead with the newest.
      return copy.sort(
        (a, b) =>
          (scores.get(b.uid) ?? 0) - (scores.get(a.uid) ?? 0) ||
          b.created.localeCompare(a.created),
      );
    }
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
    // A search with no explicit sort should lead with the best match, not the
    // newest deposit; browsing with no query should lead with the newest.
    sort: (params.get("sort") as SortKey) || (params.get("q")?.trim() ? "relevance" : "recent"),
    view: params.get("view") === "cards" ? "cards" : "rows",
  };
}
