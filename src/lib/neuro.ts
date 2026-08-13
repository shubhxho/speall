/**
 * A neuroscience filter for the general-purpose archives.
 *
 * OpenNeuro, DANDI, NeuroVault and GIN are neuroscience archives end to end —
 * everything in them belongs. Dryad, Figshare and Zenodo host every discipline
 * and are swept by topic query, which drags in near misses: "electrophysiology"
 * matches cardiac studies, "imaging" matches astronomy, "memory" matches
 * computer science. This gate keeps the index honest about what it claims.
 */

/** Terms that are neuroscience on their own. One is enough. */
const STRONG = [
  // Anatomy
  "brain",
  "cortex",
  "cortical",
  "neuron",
  "neuronal",
  "neural",
  "hippocamp",
  "amygdala",
  "thalam",
  "cerebell",
  "cerebral",
  "striat",
  "hypothalam",
  "brainstem",
  "midbrain",
  "forebrain",
  "hindbrain",
  "prefrontal",
  "parietal",
  "occipital",
  "temporal lobe",
  "frontal lobe",
  "white matter",
  "grey matter",
  "gray matter",
  "spinal cord",
  "basal ganglia",
  "substantia nigra",
  "locus coeruleus",
  "corpus callosum",
  "dendrite",
  "dendritic",
  "axon",
  "synapse",
  "synaptic",
  "glia",
  "glial",
  "astrocyte",
  "microglia",
  "oligodendrocyte",
  "interneuron",
  "pyramidal cell",
  "purkinje",
  "olfactory bulb",
  "retina",
  "retinal ganglion",
  // Fields and methods that are neuroscience by definition
  "neuroscience",
  "neuroimaging",
  "neurophysiolog",
  "neurobiolog",
  "neuroanatom",
  "neuropsycholog",
  "neurodegener",
  "neurodevelopment",
  "neuromodulation",
  "neurotransmitter",
  "neuroinflammation",
  "electroencephalograph",
  "magnetoencephalograph",
  "electrocorticograph",
  "eeg",
  "meg",
  "fmri",
  "ieeg",
  "ecog",
  "seeg",
  "erp",
  "neuropixels",
  "spike train",
  "spike sorting",
  "local field potential",
  "connectome",
  "tractography",
  "diffusion mri",
  "diffusion tensor",
  "resting state fmri",
  "resting-state fmri",
  "brain-computer interface",
  "brain computer interface",
  "optogenetic",
  "two-photon",
  "two photon",
  "calcium imaging",
  "patch clamp",
  "patch-clamp",
  "whole-cell recording",
  "single-unit",
  "single unit recording",
  "multi-unit",
  "place cell",
  "grid cell",
  "receptive field",
  // Data standards specific to the field
  "bids",
  "neurodata without borders",
  "nwb",
  // Clinical neuroscience
  "alzheimer",
  "parkinson",
  "epilep",
  "schizophren",
  "huntington",
  "multiple sclerosis",
  "traumatic brain injury",
  "concussion",
  "stroke",
  "aphasia",
  "dementia",
  "autism",
  "adhd",
  "migraine",
];

/** Terms that suggest neuroscience only in company. Two are needed. */
const WEAK = [
  "electrophysiolog",
  "cognition",
  "cognitive",
  "perception",
  "attention",
  "working memory",
  "episodic memory",
  "decision making",
  "decision-making",
  "reward learning",
  "sleep",
  "circadian",
  "behavioral",
  "behavioural",
  "psychophysic",
  "eye tracking",
  "eye-tracking",
  "pupillometry",
  "electromyograph",
  "in vivo recording",
  "mouse",
  "rodent",
  "macaque",
  "zebrafish",
  "drosophila",
  "c. elegans",
  "stimulus",
  "stimuli",
  "sensory",
  "motor control",
  "vision",
  "auditory",
  "olfactory",
];

/**
 * Contexts where a shared method word means something else entirely. Cardiac
 * electrophysiology and plant imaging are the two that showed up most.
 */
const DISQUALIFYING = [
  "cardiac",
  "myocard",
  "atrial",
  "ventricular arrhythmia",
  "electrocardiogra",
  "heart failure",
  "crop yield",
  "soil",
  "photosynthe",
  "galaxy",
  "astronom",
  "seismic",
];

function countMatches(text: string, terms: string[]): number {
  let hits = 0;
  for (const term of terms) {
    if (text.includes(term)) hits += 1;
    if (hits >= 2) break; // Nothing above the threshold changes the outcome.
  }
  return hits;
}

/**
 * True when the text carries real neuroscience signal. Deliberately biased
 * toward exclusion: a general archive contributes coverage, not completeness,
 * so a wrong drop costs less than a wrong keep.
 */
export function isNeuroscience(text: string): boolean {
  const haystack = text.toLowerCase();

  const strong = countMatches(haystack, STRONG);
  const disqualifying = countMatches(haystack, DISQUALIFYING);

  // A single strong term still loses to an off-field context — "electrophysiology
  // of the heart" reads as neuroscience to a keyword match and is not.
  if (disqualifying > 0 && strong < 2) return false;
  if (strong > 0) return true;

  return countMatches(haystack, WEAK) >= 2;
}

/** Everything an adapter knows about a record, as one searchable blob. */
export function neuroText(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
