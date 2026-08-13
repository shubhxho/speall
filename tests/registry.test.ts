import { test } from "node:test";
import assert from "node:assert/strict";

import { dedupe, mergeOutcomes } from "../src/lib/registry";
import type { Dataset, SourceId } from "../src/lib/types";

function make(source: SourceId, id: string, doi?: string): Dataset {
  return {
    uid: `${source}:${id}`,
    source,
    id,
    name: `${source} ${id}`,
    authors: [],
    modalities: [],
    species: [],
    tasks: [],
    created: "2020-01-01",
    url: "https://example.org",
    doi,
  };
}

test("records without a DOI are never merged", () => {
  const kept = dedupe([make("gin", "a/one"), make("gin", "a/two")]);
  assert.equal(kept.length, 2);
});

test("a mirror loses to the primary archive regardless of ingest order", () => {
  const doi = "10.18112/openneuro.ds000001.v1.0.0";
  const primaryFirst = dedupe([make("openneuro", "ds000001", doi), make("zenodo", "999", doi)]);
  assert.equal(primaryFirst.length, 1);
  assert.equal(primaryFirst[0].source, "openneuro");

  const mirrorFirst = dedupe([make("zenodo", "999", doi), make("openneuro", "ds000001", doi)]);
  assert.equal(mirrorFirst.length, 1);
  assert.equal(mirrorFirst[0].source, "openneuro");
});

test("one archive reusing a DOI across deposits keeps both records", () => {
  // NeuroVault collections routinely share the DOI of the paper they came from;
  // collapsing those would silently delete real datasets.
  const kept = dedupe([
    make("neurovault", "1", "10.1016/j.neuroimage.2019.01.001"),
    make("neurovault", "2", "10.1016/j.neuroimage.2019.01.001"),
  ]);
  assert.equal(kept.length, 2);
});

test("DOI matching ignores resolver prefixes and case", () => {
  const kept = dedupe([
    make("dandi", "000004", "https://doi.org/10.48324/DANDI.000004"),
    make("zenodo", "555", "10.48324/dandi.000004"),
  ]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].source, "dandi");
});

test("nothing is lost when every record is distinct", () => {
  const input = [
    make("openneuro", "ds1", "10.1/a"),
    make("dandi", "d1", "10.1/b"),
    make("dryad", "x", undefined),
  ];
  assert.equal(dedupe(input).length, 3);
});

test("a failed source keeps its previous records instead of shrinking the index", () => {
  // The regression this guards: one Dryad timeout took the index from
  // 10,248 datasets to 8,490 because the failure silently dropped the source.
  const previous = {
    fetchedAt: "2026-08-13T00:00:00.000Z",
    datasets: [make("dryad", "a", "10.1/a"), make("dryad", "b", "10.1/b"), make("gin", "x/y")],
    report: [],
  };

  const { datasets, report } = mergeOutcomes(
    [
      { source: "gin", datasets: [make("gin", "x/y"), make("gin", "x/z")] },
      { source: "dryad", datasets: null, error: "The operation was aborted due to timeout" },
    ],
    previous,
  );

  assert.equal(datasets.filter((d) => d.source === "dryad").length, 2);
  assert.equal(datasets.filter((d) => d.source === "gin").length, 2);

  const dryad = report.find((r) => r.source === "dryad")!;
  assert.equal(dryad.ok, false);
  assert.equal(dryad.stale, true);
  assert.match(dryad.note!, /kept 2 records from 2026-08-13/);
});

test("a first-run failure has nothing to fall back on and says so", () => {
  const { datasets, report } = mergeOutcomes(
    [{ source: "zenodo", datasets: null, error: "Zenodo 504" }],
    null,
  );
  assert.equal(datasets.length, 0);
  assert.equal(report[0].stale, false);
  assert.equal(report[0].note, "Zenodo 504");
});

test("a successful source is unioned with its previous records", () => {
  // Topic sweeps are non-deterministic samples: Figshare returned 331 records
  // one run and 94 the next from an unchanged query. The index must accumulate.
  const previous = {
    fetchedAt: "2026-08-13T00:00:00.000Z",
    datasets: [make("figshare", "1"), make("figshare", "2"), make("figshare", "3")],
    report: [],
  };

  const { datasets, report } = mergeOutcomes(
    [{ source: "figshare", datasets: [make("figshare", "3"), make("figshare", "4")] }],
    previous,
  );

  assert.equal(datasets.length, 4);
  assert.deepEqual(datasets.map((d) => d.id).sort(), ["1", "2", "3", "4"]);
  assert.equal(report[0].ok, true);
  assert.match(report[0].note!, /2 fetched, 2 carried over/);
});

test("fresh records win over carried ones on collision", () => {
  const previous = {
    fetchedAt: "2026-08-13T00:00:00.000Z",
    datasets: [{ ...make("dandi", "000004"), name: "old title" }],
    report: [],
  };
  const { datasets } = mergeOutcomes(
    [{ source: "dandi", datasets: [{ ...make("dandi", "000004"), name: "new title" }] }],
    previous,
  );
  assert.equal(datasets.length, 1);
  assert.equal(datasets[0].name, "new title");
});
