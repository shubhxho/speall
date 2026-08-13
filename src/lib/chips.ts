import { MODALITY_LABELS, SOURCES, type SourceId } from "@/lib/types";

export interface Chip {
  key: string;
  value: string;
  label: string;
}

/** Flattens the active facet selections into removable chips. */
export function buildChips(active: {
  sources: string[];
  modalities: string[];
  species: string[];
}): Chip[] {
  return [
    ...active.sources.map((value) => ({
      key: "source",
      value,
      label: SOURCES[value as SourceId]?.label ?? value,
    })),
    ...active.modalities.map((value) => ({
      key: "modality",
      value,
      label: MODALITY_LABELS[value] ?? value,
    })),
    ...active.species.map((value) => ({ key: "species", value, label: value })),
  ];
}
