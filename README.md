# Speall

One search field over the open neuroscience archives. Speall ingests public dataset metadata from
four archives, normalizes their modality and species vocabularies onto a single scheme, and serves
the result as a browsable, linkable index.

| Archive | Holds | API |
| --- | --- | --- |
| [OpenNeuro](https://openneuro.org) | BIDS human imaging: MRI, EEG, MEG, iEEG, PET | GraphQL |
| [DANDI](https://dandiarchive.org) | NWB neurophysiology: spikes, patch clamp, calcium imaging | REST |
| [NeuroVault](https://neurovault.org) | Statistical maps from published fMRI studies | REST |
| [Zenodo](https://zenodo.org) | The long tail of neuro data deposits | REST search |

Only metadata is indexed. Files stay on the archive that hosts them.

## Running it

```bash
npm install
npm run ingest   # builds data/registry.json from all four archives (~2 min)
npm run dev
```

`npm run ingest` is not optional in practice: without `data/registry.json` the first request triggers
a live ingest and takes minutes. The file is gitignored — it is a cache, not source.

`POST /api/refresh` re-ingests at runtime. Set `REFRESH_TOKEN` to require
`Authorization: Bearer <token>` on that route.

## How it fits together

```
src/lib/sources/*.ts   one adapter per archive -> Dataset[]
src/lib/normalize.ts   modality/species vocabularies, byte and count formatting
src/lib/registry.ts    ingest, DOI dedupe across archives, disk cache
src/lib/query.ts       text search, facet filtering, facet counts, sorting
src/lib/raster.ts      per-month deposit counts per archive
src/app/page.tsx       the index; all browse state lives in the URL
src/app/d/[source]/[id]/page.tsx   one dataset
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

When an archive is unreachable the ingest keeps the other three and records the failure, which the
footer reports rather than silently showing a short index.
