import type { Dataset } from "@/lib/types";
import { deriveModalities, normalizeSpecies, plainText } from "@/lib/normalize";
import { fetchWithRetry } from "@/lib/http";

const BASE = "https://gin.g-node.org/api/v1/repos/search";
const PAGE = 50;

interface Repo {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  owner?: { full_name?: string; login?: string };
  private: boolean;
  fork: boolean;
  empty: boolean;
  mirror: boolean;
  size: number;
  html_url: string;
  created_at: string;
  updated_at: string;
}

/**
 * Gitea's search matches repository names only and refuses to list everything
 * from an empty query, so coverage comes from sweeping short substrings —
 * every letter and digit, plus the words neuroscientists actually name repos
 * after — and merging the results.
 */
const SWEEP = [
  ..."abcdefghijklmnopqrstuvwxyz0123456789",
  "neuro",
  "eeg",
  "meg",
  "mri",
  "fmri",
  "ieeg",
  "ecog",
  "lfp",
  "spike",
  "unit",
  "patch",
  "calcium",
  "imaging",
  "recording",
  "behavior",
  "mouse",
  "rat",
  "monkey",
  "human",
  "cortex",
  "hippocampus",
  "retina",
  "data",
  "dataset",
];

/**
 * G-Node GIN is a Gitea instance, so every public data repository is one search
 * result. There is no structured metadata — modality and species come from the
 * repository name and description.
 */
export async function fetchGin(maxPagesPerTerm = 4): Promise<Dataset[]> {
  const byName = new Map<string, Dataset>();
  let firstTermSucceeded = false;

  for (const term of SWEEP) {
    for (let page = 1; page <= maxPagesPerTerm; page++) {
      const url = `${BASE}?${new URLSearchParams({
        q: term,
        limit: String(PAGE),
        page: String(page),
      })}`;

      let repos: Repo[];
      try {
        const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
        if (!res.ok) break;
        const body = await res.text();
        if (!body) break; // Gitea answers past-the-end pages with an empty body.
        repos = (JSON.parse(body).data ?? []) as Repo[];
      } catch {
        break;
      }

      if (!repos.length) break;
      firstTermSucceeded = true;

      for (const repo of repos) {
        if (repo.private || repo.fork || repo.empty || repo.mirror) continue;
        byName.set(repo.full_name, toDataset(repo));
      }
    }
  }

  if (!firstTermSucceeded) throw new Error("GIN returned no results for any term");
  return [...byName.values()];
}

function toDataset(repo: Repo): Dataset {
  // Repository names carry the modality more often than the description does.
  const text = `${repo.name.replace(/[_.-]+/g, " ")} ${repo.description ?? ""}`;
  const owner = repo.owner?.full_name?.trim() || repo.owner?.login;

  return {
    uid: `gin:${repo.full_name}`,
    source: "gin",
    id: repo.full_name,
    name: repo.description?.trim() ? repo.name : repo.full_name,
    description: plainText(repo.description),
    authors: owner ? [owner] : [],
    modalities: deriveModalities([], text),
    species: normalizeSpecies([text]),
    tasks: [],
    sizeBytes: repo.size ? repo.size * 1024 : undefined,
    created: repo.created_at,
    updated: repo.updated_at,
    url: repo.html_url,
  };
}
