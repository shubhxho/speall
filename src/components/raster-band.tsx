"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { Raster } from "@/lib/raster";
import { SOURCES } from "@/lib/types";
import { useQueryNav } from "@/components/use-query-nav";

const LANE_HEIGHT = 22;
const LANE_GAP = 5;

interface Props {
  raster: Raster;
  from?: number;
  to?: number;
}

/**
 * The whole index as a four-channel recording: one lane per archive, one column
 * per month. Drag across it to filter by year.
 */
export function RasterBand({ raster, from, to }: Props) {
  const { commit } = useQueryNav();
  const frameRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);

  const { months, years, lanes } = raster;
  const columns = months.length;
  const height = lanes.length * (LANE_HEIGHT + LANE_GAP) - LANE_GAP;

  const yearBounds = useMemo(() => {
    const map = new Map<number, { start: number; end: number }>();
    months.forEach((month, i) => {
      const year = Number(month.slice(0, 4));
      const existing = map.get(year);
      if (existing) existing.end = i + 1;
      else map.set(year, { start: i, end: i + 1 });
    });
    return map;
  }, [months]);

  // Each lane is scaled to its own busiest month, the way a multi-channel trace
  // is: NeuroVault's volume would otherwise flatten every other archive.
  const lanePeaks = useMemo(
    () => lanes.map((lane) => Math.max(1, ...lane.total)),
    [lanes],
  );

  const positionToYear = useCallback(
    (clientX: number) => {
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect || !columns) return null;
      const ratio = Math.min(0.9999, Math.max(0, (clientX - rect.left) / rect.width));
      return Number(months[Math.floor(ratio * columns)].slice(0, 4));
    },
    [columns, months],
  );

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const year = positionToYear(event.clientX);
    if (year === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ a: year, b: year });
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const year = positionToYear(event.clientX);
    if (year !== null) setDrag({ ...drag, b: year });
  }

  function onPointerUp() {
    if (!drag) return;
    const lo = Math.min(drag.a, drag.b);
    const hi = Math.max(drag.a, drag.b);
    setDrag(null);
    const spansEverything = lo <= years[0] && hi >= years[years.length - 1];
    commit(spansEverything ? { from: null, to: null } : { from: lo, to: hi });
  }

  const selection = drag
    ? { lo: Math.min(drag.a, drag.b), hi: Math.max(drag.a, drag.b) }
    : from !== undefined || to !== undefined
      ? { lo: from ?? years[0], hi: to ?? years[years.length - 1] }
      : null;

  const selectionRect = selection
    ? (() => {
        const start = yearBounds.get(selection.lo)?.start ?? 0;
        const end = yearBounds.get(selection.hi)?.end ?? columns;
        return { left: (start / columns) * 100, width: ((end - start) / columns) * 100 };
      })()
    : null;

  const columnWidth = 100 / Math.max(columns, 1);
  const labelYears = years.filter((year) => year % 5 === 0);

  if (!columns) return null;

  return (
    <figure className="m-0">
      <div
        ref={frameRef}
        className="relative cursor-crosshair touch-none select-none"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        {labelYears.map((year) => (
          <span
            key={`grid-${year}`}
            className="absolute top-0 bottom-0 w-px bg-hairline"
            style={{ left: `${(yearBounds.get(year)!.start / columns) * 100}%` }}
            aria-hidden
          />
        ))}

        {selectionRect && (
          <span
            className="absolute top-0 bottom-0 border-x border-hairline-strong bg-ink/[0.06]"
            style={{ left: `${selectionRect.left}%`, width: `${selectionRect.width}%` }}
            aria-hidden
          />
        )}

        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`Deposits per month by archive, ${years[0]} to ${
            years[years.length - 1]
          }. Each lane is scaled to its own busiest month. Drag across to filter by year.`}
        >
          {lanes.map((lane, laneIndex) => {
            const top = laneIndex * (LANE_HEIGHT + LANE_GAP);
            const color = `var(${SOURCES[lane.source].token})`;
            const peak = lanePeaks[laneIndex];
            return (
              <g key={lane.source}>
                <line
                  x1={0}
                  x2={100}
                  y1={top + LANE_HEIGHT}
                  y2={top + LANE_HEIGHT}
                  stroke="var(--hairline)"
                  strokeWidth={0.06}
                  vectorEffect="non-scaling-stroke"
                />
                {lane.total.map((total, column) => {
                  if (!total) return null;
                  const barHeight = Math.max(1.5, Math.sqrt(total / peak) * LANE_HEIGHT);
                  const hit = lane.hit[column];
                  const hitHeight = hit ? Math.max(1.5, (hit / total) * barHeight) : 0;
                  const x = column * columnWidth;
                  return (
                    <g key={column}>
                      <rect
                        x={x}
                        y={top + LANE_HEIGHT - barHeight}
                        width={columnWidth}
                        height={barHeight}
                        fill={color}
                        opacity={0.24}
                      />
                      {hitHeight > 0 && (
                        <rect
                          x={x}
                          y={top + LANE_HEIGHT - hitHeight}
                          width={columnWidth}
                          height={hitHeight}
                          fill={color}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="relative mt-1 h-4" aria-hidden>
        {labelYears.map((year) => (
          <span
            key={`label-${year}`}
            className="tick absolute top-0 text-[10px] text-ink-faint"
            style={{ left: `${(yearBounds.get(year)!.start / columns) * 100}%` }}
          >
            {year}
          </span>
        ))}
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {lanes.map((lane) => (
          <span key={lane.source} className="readout flex items-center gap-1.5 text-ink-faint">
            <span
              className="h-2 w-2 rounded-[1px]"
              style={{ background: `var(${SOURCES[lane.source].token})` }}
              aria-hidden
            />
            {SOURCES[lane.source].label}
          </span>
        ))}
        <span className="flex items-center gap-2 sm:ml-auto">
          <label htmlFor="year-from" className="sr-only">
            First year
          </label>
          <select
            id="year-from"
            value={from ?? ""}
            onChange={(e) => commit({ from: e.target.value || null })}
            className="readout rounded-full border border-hairline bg-surface px-2 py-1 text-ink"
          >
            <option value="">From</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <label htmlFor="year-to" className="sr-only">
            Last year
          </label>
          <select
            id="year-to"
            value={to ?? ""}
            onChange={(e) => commit({ to: e.target.value || null })}
            className="readout rounded-full border border-hairline bg-surface px-2 py-1 text-ink"
          >
            <option value="">To</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {(from !== undefined || to !== undefined) && (
            <button
              type="button"
              onClick={() => commit({ from: null, to: null })}
              className="readout text-ink underline decoration-hairline-strong underline-offset-4 hover:decoration-ink"
            >
              Clear
            </button>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
