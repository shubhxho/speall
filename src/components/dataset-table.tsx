import Link from "next/link";

import type { Dataset } from "@/lib/types";
import { MODALITY_LABELS, SOURCES } from "@/lib/types";
import { formatBytes, formatCount } from "@/lib/normalize";
import { datasetHref } from "@/components/dataset-row";

/**
 * The scanning view. A data catalog is read column by column, so titles line up
 * and every number sits in the same place on every row.
 */
export function DatasetTable({ datasets }: { datasets: Dataset[] }) {
  return (
    <div className="mt-4 overflow-x-auto border border-hairline bg-surface">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline">
            <Th className="w-[42%]">Dataset</Th>
            <Th>Modality</Th>
            <Th className="text-right">Subjects</Th>
            <Th className="text-right">Size</Th>
            <Th className="text-right">Deposited</Th>
          </tr>
        </thead>
        <tbody>
          {datasets.map((dataset) => {
            const source = SOURCES[dataset.source];
            return (
              <tr
                key={dataset.uid}
                className="group border-b border-hairline last:border-b-0 hover:bg-surface-2"
              >
                <td className="relative py-2.5 pl-4 pr-3 align-middle">
                  <span
                    className="absolute inset-y-0 left-0 w-[3px] opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ background: `var(${source.token})` }}
                    aria-hidden
                  />
                  <Link
                    href={datasetHref(dataset)}
                    className="flex items-baseline gap-2 text-ink hover:underline decoration-hairline-strong underline-offset-4"
                  >
                    <span
                      className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-[1px]"
                      style={{ background: `var(${source.token})` }}
                      title={source.label}
                      aria-hidden
                    />
                    <span className="line-clamp-1 text-[0.875rem] font-medium">{dataset.name}</span>
                  </Link>
                  <span className="tick mt-0.5 block truncate text-[11px] text-ink-faint">
                    {source.label} · {dataset.id}
                    {dataset.authors[0] ? ` · ${dataset.authors[0]}` : ""}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <span className="tick line-clamp-1 text-[0.8125rem] text-ink-muted">
                    {dataset.modalities.map((m) => MODALITY_LABELS[m] ?? m).join(" · ") || "—"}
                  </span>
                </td>
                <Td>{dataset.subjects ? formatCount(dataset.subjects) : "—"}</Td>
                <Td>{dataset.sizeBytes ? formatBytes(dataset.sizeBytes) : "—"}</Td>
                <Td>{dataset.created.slice(0, 10) || "—"}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`readout px-3 py-2 font-normal text-ink-faint ${className}`}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="tick whitespace-nowrap px-3 py-2.5 text-right align-middle text-[0.8125rem] text-ink-muted">
      {children}
    </td>
  );
}
