export type SourceId =
  | "openneuro"
  | "dandi"
  | "neurovault"
  | "gin"
  | "dryad"
  | "figshare"
  | "zenodo";

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
  gin: {
    id: "gin",
    label: "GIN",
    blurb: "G-Node's versioned data repositories, mostly raw lab recordings.",
    home: "https://gin.g-node.org",
    token: "--signal-gin",
  },
  dryad: {
    id: "dryad",
    label: "Dryad",
    blurb: "Data behind published papers, curated and DOI-minted.",
    home: "https://datadryad.org",
    token: "--signal-dryad",
  },
  figshare: {
    id: "figshare",
    label: "Figshare",
    blurb: "Institutional and author deposits across every discipline.",
    home: "https://figshare.com",
    token: "--signal-figshare",
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
  /** Recording-rig details mined from prose; absent when the text says nothing. */
  channels?: number;
  system?: string;
  montage?: string;
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
  report: {
    source: SourceId;
    count: number;
    ok: boolean;
    /** Records carried over from a previous ingest because this source failed. */
    stale?: boolean;
    note?: string;
  }[];
}
