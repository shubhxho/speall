export type SourceId = "openneuro" | "dandi" | "neurovault" | "zenodo";

export interface SourceMeta {
  id: SourceId;
  label: string;
  /** What the archive actually holds, in one line. */
  blurb: string;
  home: string;
  /** CSS custom property name carrying this source's signal color. */
  token: string;
}

export const SOURCES: Record<SourceId, SourceMeta> = {
  openneuro: {
    id: "openneuro",
    label: "OpenNeuro",
    blurb: "BIDS-formatted human imaging — MRI, EEG, MEG, iEEG, PET.",
    home: "https://openneuro.org",
    token: "--signal-openneuro",
  },
  dandi: {
    id: "dandi",
    label: "DANDI",
    blurb: "NWB neurophysiology — spikes, patch clamp, calcium imaging.",
    home: "https://dandiarchive.org",
    token: "--signal-dandi",
  },
  neurovault: {
    id: "neurovault",
    label: "NeuroVault",
    blurb: "Unthresholded statistical maps from published fMRI studies.",
    home: "https://neurovault.org",
    token: "--signal-neurovault",
  },
  zenodo: {
    id: "zenodo",
    label: "Zenodo",
    blurb: "General-purpose archive; the long tail of neuro data deposits.",
    home: "https://zenodo.org",
    token: "--signal-zenodo",
  },
};

export interface Dataset {
  /** `${source}:${id}` — stable across refreshes. */
  uid: string;
  source: SourceId;
  id: string;
  name: string;
  description?: string;
  authors: string[];
  /** Normalized modality slugs, see MODALITY_LABELS. */
  modalities: string[];
  species: string[];
  subjects?: number;
  tasks: string[];
  files?: number;
  sizeBytes?: number;
  /** ISO date the record first appeared in its archive. */
  created: string;
  updated?: string;
  license?: string;
  doi?: string;
  version?: string;
  url: string;
}

export const MODALITY_LABELS: Record<string, string> = {
  mri: "MRI",
  fmri: "fMRI",
  dwi: "Diffusion",
  pet: "PET",
  eeg: "EEG",
  meg: "MEG",
  ieeg: "iEEG",
  nirs: "fNIRS",
  ephys: "Extracellular",
  icephys: "Intracellular",
  ophys: "Optical imaging",
  microscopy: "Microscopy",
  behavior: "Behavior",
  genomics: "Genomics",
  statmap: "Statistical maps",
  other: "Other",
};

/** Rough grouping used for the modality rail; order is deliberate. */
export const MODALITY_ORDER = [
  "mri",
  "fmri",
  "dwi",
  "pet",
  "statmap",
  "eeg",
  "meg",
  "ieeg",
  "nirs",
  "ephys",
  "icephys",
  "ophys",
  "microscopy",
  "behavior",
  "genomics",
  "other",
];

export interface Registry {
  fetchedAt: string;
  datasets: Dataset[];
  /** Per-source ingest outcome, surfaced in the UI so gaps are never silent. */
  report: { source: SourceId; count: number; ok: boolean; note?: string }[];
}
