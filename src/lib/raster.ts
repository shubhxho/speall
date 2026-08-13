import type { Dataset, SourceId } from "@/lib/types";
import { SOURCES } from "@/lib/types";

export interface RasterLane {
  source: SourceId;
  /** Deposits per month across the shared axis. */
  total: number[];
  /** Of those, how many survive the current filters. */
  hit: number[];
}

export interface Raster {
  /** Month labels, "YYYY-MM", oldest first. */
  months: string[];
  years: number[];
  lanes: RasterLane[];
  peak: number;
}

const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];

/**
 * Collapses the index into a four-channel raster: one lane per archive, one
 * column per month. Reads like a recording — bursts of deposits, quiet stretches.
 */
export function buildRaster(all: Dataset[], matchedUids: Set<string>): Raster {
  const stamps = all
    .map((d) => d.created.slice(0, 7))
    .filter((m) => /^\d{4}-\d{2}$/.test(m) && m >= "2005-01");
  if (!stamps.length) {
    return { months: [], years: [], lanes: [], peak: 0 };
  }

  const first = stamps.reduce((a, b) => (a < b ? a : b));
  const last = stamps.reduce((a, b) => (a > b ? a : b));
  const months = monthRange(first, last);
  const index = new Map(months.map((m, i) => [m, i]));

  const lanes: RasterLane[] = SOURCE_IDS.map((source) => ({
    source,
    total: new Array(months.length).fill(0),
    hit: new Array(months.length).fill(0),
  }));
  const laneBySource = new Map(lanes.map((lane) => [lane.source, lane]));

  for (const dataset of all) {
    const column = index.get(dataset.created.slice(0, 7));
    if (column === undefined) continue;
    const lane = laneBySource.get(dataset.source);
    if (!lane) continue;
    lane.total[column] += 1;
    if (matchedUids.has(dataset.uid)) lane.hit[column] += 1;
  }

  const peak = Math.max(1, ...lanes.flatMap((lane) => lane.total));
  const years = [...new Set(months.map((m) => Number(m.slice(0, 4))))];

  return { months, years, lanes, peak };
}

function monthRange(first: string, last: string): string[] {
  const out: string[] = [];
  let [year, month] = first.split("-").map(Number);
  const [endYear, endMonth] = last.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}
