import { test } from "node:test";
import assert from "node:assert/strict";

import { channelBucket, extractRig } from "../src/lib/rig";

const EEG = ["eeg"];

test("channel counts are read from the phrasings people actually use", () => {
  assert.equal(extractRig("A 64-channel EEG recording", EEG).channels, 64);
  assert.equal(extractRig("recorded with 128 channel caps", EEG).channels, 128);
  assert.equal(extractRig("21 scalp electrodes were placed", EEG).channels, 21);
  assert.equal(extractRig("channels: 256", EEG).channels, 256);
});

test("the largest count characterises the rig", () => {
  // Auxiliary channels should not win over the array being described.
  const rig = extractRig("32-channel EEG alongside a 4-channel EMG montage", EEG);
  assert.equal(rig.channels, 32);
});

test("counts are ignored for modalities where they mean nothing", () => {
  assert.equal(extractRig("64-channel confocal stack", ["microscopy"]).channels, undefined);
  assert.equal(extractRig("a 64-channel array", ["fmri"]).channels, undefined);
});

test("implausible numbers are rejected", () => {
  assert.equal(extractRig("10000-channel something", EEG).channels, undefined);
  assert.equal(extractRig("0 channel", EEG).channels, undefined);
});

test("amplifiers and caps are recognised", () => {
  assert.equal(extractRig("Recorded on a BioSemi ActiveTwo", EEG).system, "BioSemi");
  assert.equal(extractRig("EGI Geodesic sensor net", EEG).system, "EGI Geodesic");
  assert.equal(extractRig("BrainVision actiCHamp amplifier", EEG).system, "Brain Products");
  assert.equal(extractRig("Elekta Neuromag TRIUX", ["meg"]).system, "Elekta Neuromag");
});

test("Neuropixels implies its fixed channel count", () => {
  const rig = extractRig("Neuropixels probes in motor cortex", ["ephys"]);
  assert.equal(rig.system, "Neuropixels");
  assert.equal(rig.channels, 384);
  // An explicit count in the text still wins over the implied one.
  assert.equal(extractRig("Neuropixels, 192 channels used", ["ephys"]).channels, 192);
});

test("placement standards are recognised in their common spellings", () => {
  assert.equal(extractRig("the international 10-20 system", EEG).montage, "10–20");
  assert.equal(extractRig("electrodes placed per 10/20", EEG).montage, "10–20");
  assert.equal(extractRig("high-density EEG array", EEG).montage, "High-density");
});

test("nothing is invented when the text says nothing", () => {
  assert.deepEqual(extractRig("An EEG dataset of resting state", EEG), {});
});

test("counts bucket into readable ranges", () => {
  assert.equal(channelBucket(1), "1-8");
  assert.equal(channelBucket(32), "9-32");
  assert.equal(channelBucket(64), "33-64");
  assert.equal(channelBucket(384), "257+");
  assert.equal(channelBucket(undefined), undefined);
});
