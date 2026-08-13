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

```bash
npm test   # 27 tests over normalization, search and dedupe
```

`POST /api/refresh` re-ingests at runtime. Set `REFRESH_TOKEN` to require
`Authorization: Bearer <token>` on that route.

## How it fits together

```
src/lib/sources/*.ts   one adapter per archive -> Dataset[]
src/lib/normalize.ts   modality/species vocabularies, prose mining, formatting
src/lib/registry.ts    ingest, DOI dedupe across archives, disk cache
src/lib/neuro.ts       neuroscience gate for the general-purpose archives
src/lib/rig.ts         channel counts, amplifiers and montages mined from prose
src/lib/query.ts       stemmed search, relevance ranking, facets, sorting
src/lib/raster.ts      per-month deposit counts per archive
src/app/page.tsx       the index; all browse state lives in the URL
src/app/d/[source]/[...id]/page.tsx   one dataset (ids can contain slashes)
```

Filtering runs server-side against the in-memory registry, driven entirely by search params, so
every view is a shareable link and the browser never downloads the full index.

Search stems bare terms so "hippocampus" finds "hippocampal", matches them at word starts so
"cortex" does not hit "escort", and keeps quoted spans verbatim. A short synonym table covers the
Latin noun/adjective pairs suffix stripping cannot bridge — "cortical" stems to "cortic", which
never meets "cortex". Results with a query rank by where the match landed: an exact archive ID
beats a title hit, which beats a word buried in an abstract.

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

### Recording rig

No archive exposes channel counts structurally — DANDI's `assetsSummary` stops at `ElectrodeGroup`,
OpenNeuro's GraphQL has no equivalent field. The counts only exist in prose ("64-channel EEG",
"10-20 system"), so they are mined from titles and abstracts, and only for modalities where a
channel count means anything. Coverage is partial by nature: ~214 of 10,248 records carry a count.
The facet says so rather than implying every dataset was checked.

### It refreshes itself

`.github/workflows/refresh.yml` re-ingests every Monday, verifies the result
(tests, typecheck, build) *before* committing, and only commits when the index
actually changed. Vercel is connected to the repo, so that commit deploys
itself. `workflow_dispatch` runs it on demand.

The additive ingest below is what makes running this unattended safe: a bad
network day cannot publish a smaller index.

### Ingest is additive

An ingest may only add or refresh, never delete. Two incidents forced this: a Dryad timeout took the
index from 10,248 datasets to 8,490, and Figshare returned 331 records one run and 94 the next from
an unchanged query — topic sweeps are non-deterministic samples. Every source is now unioned with
what it contributed last time, fresh records winning on collision, and a source that fails outright
keeps its previous records and is reported as stale in the footer.

### Page weight

The raster covers ~200 months across seven lanes. Drawn as one rect per month per lane that is
~1,400 SVG nodes in the server-rendered HTML; each lane is emitted as a single `<path>` instead,
which is 14 nodes and roughly halves the page. Measured: 391 KB to 193 KB, server render 55 ms.
