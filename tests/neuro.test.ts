import { test } from "node:test";
import assert from "node:assert/strict";

import { isNeuroscience, neuroText } from "../src/lib/neuro";

test("one unambiguous term is enough", () => {
  assert.ok(isNeuroscience("Hippocampal replay during sleep"));
  assert.ok(isNeuroscience("Resting state fMRI of the human brain"));
  assert.ok(isNeuroscience("Neuropixels recordings in visual cortex"));
  assert.ok(isNeuroscience("A BIDS dataset of EEG during rest"));
});

test("shared method words alone are not enough", () => {
  // "Electrophysiology" belongs to cardiology too, so it cannot carry a record.
  assert.equal(isNeuroscience("Electrophysiology data from tissue samples"), false);
  assert.equal(isNeuroscience("High resolution imaging dataset"), false);
});

test("two supporting terms together are enough", () => {
  assert.ok(isNeuroscience("Electrophysiology in awake behaving macaque"));
  assert.ok(isNeuroscience("Mouse sleep and circadian rhythm measurements"));
});

test("off-field context beats a lone keyword", () => {
  // The real near miss that motivated this: a cardiac EP dataset was ranking
  // inside an index that claims to be neuroscience.
  assert.equal(
    isNeuroscience("GraphEP: Cardiac Electrophysiology as Spatiotemporal signals on Graphs"),
    false,
  );
  assert.equal(isNeuroscience("Myocardial imaging in heart failure patients"), false);
  assert.equal(isNeuroscience("Photosynthesis imaging across crop yield trials"), false);
});

test("genuine cross-over survives an off-field word", () => {
  // Two strong terms outweigh the disqualifier — this really is neuroscience.
  assert.ok(
    isNeuroscience("Brainstem control of cardiac rhythm, recorded with neuropixels in the medulla"),
  );
});

test("clinical neuroscience is recognised", () => {
  assert.ok(isNeuroscience("MRI in Alzheimer's disease progression"));
  assert.ok(isNeuroscience("Seizure onset zones in drug-resistant epilepsy"));
});

test("neuroText joins the parts an adapter has, skipping gaps", () => {
  assert.equal(neuroText(["Title", null, "keyword", undefined, ""]), "Title keyword");
});
