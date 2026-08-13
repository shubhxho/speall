import { test } from "node:test";
import assert from "node:assert/strict";

import { dedupe } from "../src/lib/registry";
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
