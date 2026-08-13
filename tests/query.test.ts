import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyQuery,
  EMPTY_QUERY,
  parseQuery,
  queryTerms,
  relevanceScore,
  sortDatasets,
  stem,
} from "../src/lib/query";
import type { Dataset, SourceId } from "../src/lib/types";

function make(overrides: Partial<Dataset> & { id: string }): Dataset {
  return {
    uid: `${overrides.source ?? "openneuro"}:${overrides.id}`,
    source: (overrides.source ?? "openneuro") as SourceId,
    name: "Untitled",
    authors: [],
    modalities: [],
    species: [],
    tasks: [],
    created: "2020-01-01",
    url: "https://example.org",
    ...overrides,
  };
}

const CORPUS: Dataset[] = [
  make({
    id: "ds001",
    name: "Hippocampal replay during sleep",
    modalities: ["ephys"],
    species: ["Rat"],
    created: "2021-05-02",
    authors: ["Buzsáki, György"],
  }),
  make({
    id: "ds002",
    name: "Working memory task",
    description: "Participants performed a task while hippocampus activity was recorded.",
    modalities: ["fmri"],
    species: ["Human"],
    created: "2023-07-11",
    tasks: ["n-back"],
  }),
  make({
    id: "ds003",
    source: "dandi",
    name: "Motor cortex units",
    modalities: ["ephys"],
    species: ["Mouse"],
    created: "2019-02-20",
  }),
];

test("all terms must match, across any indexed field", () => {
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, q: "replay" }).results.length, 1);
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, q: "n-back" }).results.length, 1);
  // Both terms exist in the corpus but never in the same record.
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, q: "hippocampal cortex" }).results.length, 0);
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, q: "buzsáki" }).results.length, 1);
});

test("quoted spans match verbatim", () => {
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, q: '"working memory"' }).results.length, 1);
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, q: '"memory working"' }).results.length, 0);
});

test("a title hit outranks the same word buried in an abstract", () => {
  const titleHit = CORPUS[0];
  const bodyHit = CORPUS[1];
  assert.ok(relevanceScore(titleHit, "hippocampal") > relevanceScore(bodyHit, "hippocampus"));

  const ranked = sortDatasets(CORPUS, "relevance", "motor cortex");
  assert.equal(ranked[0].id, "ds003");
});

test("an exact archive id beats everything else", () => {
  const ranked = sortDatasets(CORPUS, "relevance", "ds002");
  assert.equal(ranked[0].id, "ds002");
});

test("relevance with no query falls back to newest first", () => {
  const ranked = sortDatasets(CORPUS, "relevance", "  ");
  assert.deepEqual(
    ranked.map((d) => d.id),
    ["ds002", "ds001", "ds003"],
  );
});

test("facet counts exclude their own dimension", () => {
  const { facets, results } = applyQuery(CORPUS, { ...EMPTY_QUERY, sources: ["openneuro"] });
  assert.equal(results.length, 2);
  // Filtering by archive must not hide the other archives from the archive facet,
  // otherwise the filter can never be widened again.
  const dandi = facets.sources.find((f) => f.key === "dandi");
  assert.equal(dandi?.count, 1);
  // Other dimensions do narrow to the current selection.
  assert.equal(facets.species.find((f) => f.key === "Mouse"), undefined);
});

test("year range filters on the deposit year, inclusive at both ends", () => {
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, from: 2021, to: 2021 }).results.length, 1);
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, from: 2019, to: 2023 }).results.length, 3);
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, from: 2024 }).results.length, 0);
});

test("sorts put missing values last rather than first", () => {
  const withGap = [...CORPUS, make({ id: "ds004", name: "No size recorded" })];
  const bySize = sortDatasets(
    [...withGap.map((d) => ({ ...d, sizeBytes: d.id === "ds001" ? 10 : undefined }))],
    "largest",
  );
  assert.equal(bySize[0].id, "ds001");
});

test("a query defaults to best match, browsing defaults to newest", () => {
  assert.equal(parseQuery(new URLSearchParams("q=eeg")).sort, "relevance");
  assert.equal(parseQuery(new URLSearchParams("")).sort, "recent");
  // An explicit choice always wins over the default.
  assert.equal(parseQuery(new URLSearchParams("q=eeg&sort=name")).sort, "name");
});

test("list params parse into arrays and drop empties", () => {
  const parsed = parseQuery(new URLSearchParams("source=dandi,gin&modality=&species=Mouse"));
  assert.deepEqual(parsed.sources, ["dandi", "gin"]);
  assert.deepEqual(parsed.modalities, []);
  assert.deepEqual(parsed.species, ["Mouse"]);
});

test("stemming finds other forms of the same word", () => {
  // The gap that made "hippocampus" miss "Hippocampal replay".
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, q: "hippocampus" }).results.length, 2);
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, q: "hippocampal" }).results.length, 2);
  assert.equal(applyQuery(CORPUS, { ...EMPTY_QUERY, q: "cortical" }).results.length, 1);
});

test("short words are never stemmed", () => {
  assert.equal(stem("eeg"), "eeg");
  assert.equal(stem("mice"), "mice");
  assert.equal(stem("hippocampus"), "hippocamp");
  assert.equal(stem("neurons"), "neuron");
  assert.equal(stem("imaging"), "imag");
});

test("bare terms match from a word start, not mid-word", () => {
  const escort = make({ id: "ds005", name: "Escort vehicle telemetry" });
  const cortex = make({ id: "ds006", name: "Cortex recordings" });
  const found = applyQuery([escort, cortex], { ...EMPTY_QUERY, q: "cortex" }).results;
  assert.deepEqual(found.map((d) => d.id), ["ds006"]);
});

test("quoted terms stay verbatim and skip stemming", () => {
  const terms = queryTerms('"working memory" neurons');
  assert.deepEqual(terms, [
    { value: "working memory", exact: true },
    { value: "neuron", exact: false },
  ]);
});
