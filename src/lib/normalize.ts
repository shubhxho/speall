/** Archives disagree on vocabulary. Everything funnels through here. */

const MODALITY_ALIASES: Record<string, string> = {
  mri: "mri",
  anat: "mri",
  t1w: "mri",
  t2w: "mri",
  structural: "mri",
  func: "fmri",
  fmri: "fmri",
  "functional magnetic resonance imaging": "fmri",
  bold: "fmri",
  dwi: "dwi",
  diffusion: "dwi",
  pet: "pet",
  "positron emission tomography": "pet",
  eeg: "eeg",
  electroencephalography: "eeg",
  meg: "meg",
  magnetoencephalography: "meg",
  ieeg: "ieeg",
  ecog: "ieeg",
  electrocorticography: "ieeg",
  "intracranial electroencephalography": "ieeg",
  nirs: "nirs",
  fnirs: "nirs",
  ephys: "ephys",
  "extracellular electrophysiology": "ephys",
  "multi electrode extracellular electrophysiology recording technique": "ephys",
  "spike sorting": "ephys",
  icephys: "icephys",
  "intracellular electrophysiology": "icephys",
  "patch clamp technique": "icephys",
  "current clamp technique": "icephys",
  "voltage clamp technique": "icephys",
  ophys: "ophys",
  "optical physiology": "ophys",
  "two photon microscopy technique": "ophys",
  "calcium imaging": "ophys",
  microscopy: "microscopy",
  "microscopy technique": "microscopy",
  histology: "microscopy",
  behavior: "behavior",
  behavioral: "behavior",
  "behavioral approach": "behavior",
  genomics: "genomics",
  transcriptomics: "genomics",
  "rna sequencing": "genomics",
  "single cell rna": "genomics",

  // Free-text sources (GIN, Dryad, Figshare, Zenodo) describe methods in prose
  // rather than controlled terms, so the map has to cover how people write.
  "magnetic resonance": "mri",
  t1weighted: "mri",
  "structural scan": "mri",
  "resting state": "fmri",
  "resting-state": "fmri",
  "blood oxygen": "fmri",
  "task fmri": "fmri",
  tractography: "dwi",
  dti: "dwi",
  "diffusion weighted": "dwi",
  "diffusion tensor": "dwi",
  "amyloid pet": "pet",
  "tau pet": "pet",
  "event related potential": "eeg",
  "event-related potential": "eeg",
  erp: "eeg",
  "evoked potential": "eeg",
  "scalp recording": "eeg",
  "near infrared spectroscopy": "nirs",
  "near-infrared spectroscopy": "nirs",
  "stereo eeg": "ieeg",
  seeg: "ieeg",
  intracranial: "ieeg",
  "depth electrode": "ieeg",
  "spike train": "ephys",
  "spike sorted": "ephys",
  "single unit": "ephys",
  "single-unit": "ephys",
  "multi unit": "ephys",
  "multi-unit": "ephys",
  "local field potential": "ephys",
  lfp: "ephys",
  neuropixels: "ephys",
  tetrode: "ephys",
  "silicon probe": "ephys",
  "unit recording": "ephys",
  "patch clamp": "icephys",
  "patch-clamp": "icephys",
  "whole cell": "icephys",
  "whole-cell": "icephys",
  "membrane potential": "icephys",
  "two photon": "ophys",
  "two-photon": "ophys",
  "2 photon": "ophys",
  "widefield imaging": "ophys",
  "wide field imaging": "ophys",
  "voltage imaging": "ophys",
  gcamp: "ophys",
  "light sheet": "microscopy",
  "light-sheet": "microscopy",
  "confocal microscopy": "microscopy",
  "electron microscopy": "microscopy",
  immunohistochem: "microscopy",
  "connectomics": "microscopy",
  "eye tracking": "behavior",
  "eye-tracking": "behavior",
  "reaction time": "behavior",
  "behavioural": "behavior",
  "open field test": "behavior",
  "psychophysics": "behavior",
  "questionnaire": "behavior",
  "statistical map": "statmap",
  "group level map": "statmap",
  "contrast map": "statmap",
};

export function normalizeModality(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (MODALITY_ALIASES[key]) return MODALITY_ALIASES[key];
  for (const [alias, slug] of Object.entries(MODALITY_ALIASES)) {
    if (key.includes(alias)) return slug;
  }
  return "other";
}

export function normalizeModalities(raw: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const item of raw) {
    if (!item) continue;
    out.add(normalizeModality(item));
  }
  if (out.size > 1) out.delete("other");
  return [...out];
}

/**
 * Word-boundary matched so short aliases stay honest: "pet" must not fire on
 * "competition", "erp" must not fire on "interpretation".
 */
const ALIAS_PATTERNS: [RegExp, string][] = Object.entries(MODALITY_ALIASES).map(
  ([alias, slug]) => [
    new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
    slug,
  ],
);

/** Every modality mentioned anywhere in a block of prose, not just the first. */
export function modalitiesFromText(text: string): string[] {
  const out = new Set<string>();
  for (const [pattern, slug] of ALIAS_PATTERNS) {
    if (pattern.test(text)) out.add(slug);
  }
  out.delete("other");
  return [...out];
}

/**
 * Archives without a controlled vocabulary describe their methods in prose, so
 * keywords and free text are both mined and merged.
 */
export function deriveModalities(terms: string[], text: string): string[] {
  const merged = new Set([...modalitiesFromText([...terms, text].join(" "))]);
  if (!merged.size) {
    for (const modality of normalizeModalities(terms)) merged.add(modality);
  }
  return merged.size ? [...merged] : ["other"];
}

const SPECIES_ALIASES: [RegExp, string][] = [
  [/homo sapiens|human/i, "Human"],
  [/mus musculus|mouse|mice/i, "Mouse"],
  [/rattus|\brat\b/i, "Rat"],
  [/macaca|macaque|rhesus/i, "Macaque"],
  [/marmoset|callithrix/i, "Marmoset"],
  [/drosophila|fruit fly/i, "Fly"],
  [/danio rerio|zebrafish/i, "Zebrafish"],
  [/caenorhabditis|c\. elegans/i, "C. elegans"],
  [/songbird|zebra finch|taeniopygia/i, "Songbird"],
  [/ferret/i, "Ferret"],
  [/\bcat\b|felis/i, "Cat"],
  [/\bpig\b|sus scrofa/i, "Pig"],
];

export function normalizeSpecies(raw: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const item of raw) {
    if (!item) continue;
    for (const [re, label] of SPECIES_ALIASES) {
      if (re.test(item)) {
        out.add(label);
        break;
      }
    }
  }
  return [...out];
}

/** Strip HTML and collapse whitespace — several archives store rich text. */
export function plainText(html: string | null | undefined, max = 600): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatCount(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US");
}
