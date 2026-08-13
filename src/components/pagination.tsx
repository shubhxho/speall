import Link from "next/link";

interface Props {
  page: number;
  pages: number;
  params: URLSearchParams;
}

export function Pagination({ page, pages, params }: Props) {
  if (pages <= 1) return null;

  const href = (target: number) => {
    const next = new URLSearchParams(params.toString());
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    const query = next.toString();
    return query ? `/?${query}` : "/";
  };

  return (
    <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="readout border border-hairline bg-surface px-3 py-2 text-ink hover:border-hairline-strong"
        >
          ← Previous
        </Link>
      ) : (
        <span />
      )}

      <span className="readout text-ink-faint">
        Page {page} of {pages}
      </span>

      {page < pages ? (
        <Link
          href={href(page + 1)}
          className="readout border border-hairline bg-surface px-3 py-2 text-ink hover:border-hairline-strong"
        >
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
