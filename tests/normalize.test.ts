import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveModalities,
  formatBytes,
  formatCount,
  modalitiesFromText,
  normalizeModalities,
  normalizeSpecies,
  plainText,
} from "../src/lib/normalize";

test("short aliases only match whole words", () => {
  // These are the false positives that made prose mining unusable.
  assert.deepEqual(modalitiesFromText("a competition between subjects"), []);
  assert.deepEqual(modalitiesFromText("open to interpretation"), []);
  assert.deepEqual(modalitiesFromText("amyloid PET imaging of the brain"), ["pet"]);
  assert.deepEqual(modalitiesFromText("ERP components after stimulus onset"), ["eeg"]);
});

test("prose yields every modality mentioned, not just the first", () => {
  const found = modalitiesFromText(
    "Simultaneous EEG and fMRI during a two-photon calcium imaging session",
  );
  assert.ok(found.includes("eeg"));
  assert.ok(found.includes("fmri"));
  assert.ok(found.includes("ophys"));
});

test("controlled vocabulary maps onto the shared scheme", () => {
  assert.deepEqual(normalizeModalities(["mri"]), ["mri"]);
  assert.deepEqual(normalizeModalities(["Patch clamp technique"]), ["icephys"]);
  assert.deepEqual(normalizeModalities(["magnetoencephalography"]), ["meg"]);
});

test("normalizeModalities drops 'other' once anything real is known", () => {
  assert.deepEqual(normalizeModalities(["eeg", "some unmappable term"]), ["eeg"]);
  assert.deepEqual(normalizeModalities(["some unmappable term"]), ["other"]);
});

test("deriveModalities prefers prose hits and falls back to 'other'", () => {
  assert.deepEqual(deriveModalities([], "neuropixels recordings in motor cortex"), ["ephys"]);
  assert.deepEqual(deriveModalities([], "a study of institutional funding"), ["other"]);
  assert.ok(deriveModalities(["EEG"], "resting state scan").includes("eeg"));
});

test("species are recognised from prose, scientific or common name", () => {
  assert.deepEqual(normalizeSpecies(["Mus musculus"]), ["Mouse"]);
  assert.deepEqual(normalizeSpecies(["recordings in macaque V1"]), ["Macaque"]);
  assert.deepEqual(normalizeSpecies(["Homo sapiens", "human participants"]), ["Human"]);
  assert.deepEqual(normalizeSpecies(["no organism named here"]), []);
});

test("plainText strips markup, decodes entities and truncates", () => {
  assert.equal(plainText("<p>Hello &amp; welcome</p>"), "Hello & welcome");
  assert.equal(plainText(""), undefined);
  assert.equal(plainText(undefined), undefined);
  const long = plainText("x".repeat(500), 50);
  assert.equal(long?.length, 50);
  assert.ok(long?.endsWith("…"));
});

test("byte and count formatting stay readable and honest about gaps", () => {
  assert.equal(formatBytes(undefined), "—");
  assert.equal(formatBytes(0), "—");
  assert.equal(formatBytes(1024), "1.0 KB");
  assert.equal(formatBytes(2_416_199_965), "2.3 GB");
  assert.equal(formatCount(undefined), "—");
  assert.equal(formatCount(9648), "9,648");
});
