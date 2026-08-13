import type { Dataset } from "@/lib/types";
import { normalizeModalities, plainText } from "@/lib/normalize";
import { fetchWithRetry } from "@/lib/http";

const ENDPOINT = "https://openneuro.org/crn/graphql";

const QUERY = `query Page($first: Int!, $after: String) {
  datasets(first: $first, after: $after, orderBy: {created: descending}) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id
        created
        latestSnapshot {
          tag
          created
          readme
          description { Name Authors License DatasetDOI }
          summary {
            modalities
            secondaryModalities
            subjects
            tasks
            size
            totalFiles
          }
        }
      }
    }
  }
}`;

interface Node {
  id: string;
  created: string;
  latestSnapshot?: {
    tag?: string | null;
    created?: string | null;
    readme?: string | null;
    description?: {
      Name?: string | null;
      Authors?: string[] | null;
      License?: string | null;
      DatasetDOI?: string | null;
    } | null;
    summary?: {
      modalities?: string[] | null;
      secondaryModalities?: string[] | null;
      subjects?: string[] | null;
      tasks?: string[] | null;
      size?: number | null;
      totalFiles?: number | null;
    } | null;
  } | null;
}

const PAGE = 100;

export async function fetchOpenNeuro(limit = Infinity): Promise<Dataset[]> {
  const out: Dataset[] = [];
  let offset = 0;

  while (out.length < limit) {
    const page = await getPage(offset, PAGE);
    if (!page) {
      // A single broken snapshot can poison a whole page; walk that range in
      // smaller bites so one bad record costs 10 datasets, not 100.
      let recovered = false;
      for (let sub = offset; sub < offset + PAGE; sub += 10) {
        const small = await getPage(sub, 10);
        if (!small) continue;
        recovered = true;
        for (const edge of small.edges) {
          const dataset = edge?.node ? toDataset(edge.node) : null;
          if (dataset) out.push(dataset);
        }
        if (!small.pageInfo.hasNextPage) return out;
      }
      if (!recovered) break;
      offset += PAGE;
      continue;
    }

    for (const edge of page.edges) {
      const dataset = edge?.node ? toDataset(edge.node) : null;
      if (dataset) out.push(dataset);
    }
    if (!page.pageInfo.hasNextPage) break;
    offset += PAGE;
  }

  return limit === Infinity ? out : out.slice(0, limit);
}

interface Page {
  pageInfo: { hasNextPage: boolean; endCursor: string };
  /** GraphQL nulls out entries whose snapshot failed to resolve. */
  edges: ({ node: Node } | null)[];
}

async function getPage(offset: number, first: number): Promise<Page | null> {
  const after = offset === 0 ? null : Buffer.from(JSON.stringify({ offset })).toString("base64");
  try {
    const res = await fetchWithRetry(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { first, after } }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Partial data alongside errors is normal here — take what resolved.
    return (json.data?.datasets as Page | undefined) ?? null;
  } catch {
    return null;
  }
}

function toDataset(node: Node): Dataset | null {
  const snapshot = node.latestSnapshot;
  const description = snapshot?.description;
  const summary = snapshot?.summary;
  const name = description?.Name?.trim();
  if (!name) return null;

  return {
    uid: `openneuro:${node.id}`,
    source: "openneuro",
    id: node.id,
    name,
    description: plainText(snapshot?.readme),
    authors: (description?.Authors ?? []).filter(Boolean).map((a) => a.trim()),
    modalities: normalizeModalities([
      ...(summary?.modalities ?? []),
      ...(summary?.secondaryModalities ?? []),
    ]),
    species: [],
    subjects: summary?.subjects?.length ?? undefined,
    tasks: (summary?.tasks ?? []).filter(Boolean),
    files: summary?.totalFiles ?? undefined,
    sizeBytes: summary?.size ?? undefined,
    created: node.created,
    updated: snapshot?.created ?? undefined,
    license: description?.License ?? undefined,
    doi: description?.DatasetDOI ?? undefined,
    version: snapshot?.tag ?? undefined,
    url: `https://openneuro.org/datasets/${node.id}`,
  };
}
