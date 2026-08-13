# Speall

One search field over the open neuroscience archives. Speall ingests public dataset metadata from
seven archives, normalizes their modality and species vocabularies onto a single scheme, and serves
the result as a browsable, linkable index.

| Archive | Holds | Coverage |
| --- | --- | --- |
| [OpenNeuro](https://openneuro.org) | BIDS human imaging: MRI, EEG, MEG, iEEG, PET | full |
| [DANDI](https://dandiarchive.org) | NWB neurophysiology: spikes, patch clamp, calcium imaging | full |
| [NeuroVault](https://neurovault.org) | Statistical maps from published fMRI studies | full |
| [GIN](https://gin.g-node.org) | G-Node versioned data repositories, raw lab recordings | full |
| [Dryad](https://datadryad.org) | Curated data behind published papers | topic sweep |
| [Figshare](https://figshare.com) | Institutional and author deposits, all disciplines | topic sweep |
| [Zenodo](https://zenodo.org) | The long tail of neuro data deposits | topic sweep |

The first four are neuroscience archives end to end and are indexed completely. The last three host
every discipline with no neuroscience-only endpoint, so they are swept by topic query — matching
deposits, not complete coverage. The UI says so in the footer rather than implying otherwise.

Only metadata is indexed. Files stay on the archive that hosts them.

## Running it

```bash
npm install
npm run ingest   # builds data/registry.json from all seven archives (~5 min)
npm run dev
```

`data/registry.json` is committed so a deploy ships with a working index. It is a build artifact
kept in the repo on purpose: serverless has nowhere to write one, and a live ingest takes minutes.
Regenerate it with `npm run ingest` and commit the result. A page request never triggers an ingest
unless the file is missing entirely.

`POST /api/refresh` re-ingests at runtime. Set `REFRESH_TOKEN` to require
`Authorization: Bearer <token>` on that route.

## How it fits together

```
src/lib/sources/*.ts   one adapter per archive -> Dataset[]
src/lib/normalize.ts   modality/species vocabularies, prose mining, formatting
src/lib/registry.ts    ingest, DOI dedupe across archives, disk cache
src/lib/query.ts       text search, facet filtering, facet counts, sorting
src/lib/raster.ts      per-month deposit counts per archive
src/app/page.tsx       the index; all browse state lives in the URL
src/app/d/[source]/[...id]/page.tsx   one dataset (ids can contain slashes)
```

Filtering runs server-side against the in-memory registry, driven entirely by search params, so
every view is a shareable link and the browser never downloads the full index.

### Notes on the upstream APIs

- OpenNeuro nulls out individual edges whose snapshot fails to resolve; the adapter retries those
  ranges in smaller pages rather than losing 100 datasets to one bad record.
- DANDI's list endpoint carries no scientific metadata, so each dandiset needs a second call for
  species and technique. That is the slow part of an ingest.
- NeuroVault ignores filter and ordering params — the full collection list is walked and filtered
  locally to the ones with a DOI or paper link.
- Zenodo caps anonymous pages at 25 records.
- Figshare's search returns bare stubs, so every hit needs a second call for authors and tags.
- Dryad accepts one query string per request; the neuro scope is swept term by term.
- GIN is a Gitea instance with no scientific metadata at all — modality and species are mined from
  repository names and descriptions, word-boundary matched so "pet" does not fire on "competition".

When an archive is unreachable the ingest keeps the others and records the failure, which the
footer reports rather than silently showing a short index.
