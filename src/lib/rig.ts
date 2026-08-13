/**
 * Recording-rig details, mined from prose.
 *
 * No archive exposes channel counts structurally — DANDI's assetsSummary stops
 * at "ElectrodeGroup", OpenNeuro's GraphQL has no equivalent field at all. The
 * counts only exist in titles and abstracts ("64-channel EEG", "10-20 system"),
 * so this reads them from there. Coverage is partial by nature and the UI says
 * so rather than implying every dataset was checked.
 */

/** Modalities where a channel count means something. */
const ELECTRODE_MODALITIES = new Set(["eeg", "meg", "ieeg", "ephys", "icephys", "nirs"]);

/** Highest plausible count, above which the number is something else. */
const MAX_CHANNELS = 4096;

const COUNT_PATTERNS = [
  // The `s?` matters: "channels" is the common form and `channel\b` never matches it.
  /(\d{1,4})\s*[-–]?\s*(?:channels?|chan)\b/gi,
  /(\d{1,4})\s*[-–]?\s*(?:scalp\s+)?electrodes?\b/gi,
  /\b(?:channels?|electrodes?)\s*[:=]\s*(\d{1,4})\b/gi,
];

export interface Rig {
  channels?: number;
  /** Amplifier, cap or probe named in the text. */
  system?: string;
  /** Electrode placement standard, where one is named. */
  montage?: string;
}

const SYSTEMS: [RegExp, string][] = [
  [/\bbiosemi\b/i, "BioSemi"],
  [/\begi\b|geodesic/i, "EGI Geodesic"],
  [/actichamp|brain\s?products|brainvision/i, "Brain Products"],
  [/neuroscan|synamps/i, "Neuroscan"],
  [/\bant\s?neuro\b|eego/i, "ANT Neuro"],
  [/\bg\.tec\b|g\.usbamp/i, "g.tec"],
  [/openbci/i, "OpenBCI"],
  [/\bemotiv\b/i, "Emotiv"],
  [/\bmuse\b\s*(?:headband|eeg)/i, "Muse"],
  [/neuropixels/i, "Neuropixels"],
  [/blackrock|utah array/i, "Blackrock"],
  [/\bplexon\b/i, "Plexon"],
  [/\bintan\b/i, "Intan"],
  [/open\s?ephys/i, "Open Ephys"],
  [/elekta|neuromag|\btriux\b/i, "Elekta Neuromag"],
  [/\bctf\b\s*(?:meg|system)/i, "CTF MEG"],
];

const MONTAGES: [RegExp, string][] = [
  [/\b10\s*[-–/]\s*20\b/, "10–20"],
  [/\b10\s*[-–/]\s*10\b/, "10–10"],
  [/\b10\s*[-–/]\s*0?5\b/, "10–05"],
  [/high[-\s]?density|\bhd[-\s]?eeg\b/i, "High-density"],
];

/** Neuropixels probes have a fixed geometry, so the count is implied. */
const NEUROPIXELS_CHANNELS = 384;

export function extractRig(text: string, modalities: string[]): Rig {
  if (!modalities.some((m) => ELECTRODE_MODALITIES.has(m))) return {};

  const rig: Rig = {};

  for (const [pattern, label] of SYSTEMS) {
    if (pattern.test(text)) {
      rig.system = label;
      break;
    }
  }
  for (const [pattern, label] of MONTAGES) {
    if (pattern.test(text)) {
      rig.montage = label;
      break;
    }
  }

  // Several counts can appear ("32-channel EEG and 4-channel EMG"); the largest
  // is the one that characterises the rig.
  let best = 0;
  for (const pattern of COUNT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1]);
      if (value > 0 && value <= MAX_CHANNELS && value > best) best = value;
    }
  }
  if (best) rig.channels = best;
  else if (rig.system === "Neuropixels") rig.channels = NEUROPIXELS_CHANNELS;

  return rig;
}

export const CHANNEL_BUCKETS: { key: string; label: string; min: number; max: number }[] = [
  { key: "1-8", label: "1–8", min: 1, max: 8 },
  { key: "9-32", label: "9–32", min: 9, max: 32 },
  { key: "33-64", label: "33–64", min: 33, max: 64 },
  { key: "65-128", label: "65–128", min: 65, max: 128 },
  { key: "129-256", label: "129–256", min: 129, max: 256 },
  { key: "257+", label: "257+", min: 257, max: Infinity },
];

export function channelBucket(channels: number | undefined): string | undefined {
  if (!channels) return undefined;
  return CHANNEL_BUCKETS.find((b) => channels >= b.min && channels <= b.max)?.key;
}

export function channelBucketLabel(key: string): string {
  return CHANNEL_BUCKETS.find((b) => b.key === key)?.label ?? key;
}
