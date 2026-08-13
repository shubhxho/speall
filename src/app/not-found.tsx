import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col items-start justify-center px-4 py-24 sm:px-6">
      <p className="readout text-ink-faint">No signal</p>
      <h1 className="mt-3 font-display text-[2rem] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
        That dataset isn&apos;t in the index.
      </h1>
      <p className="mt-3 max-w-[52ch] text-[0.9375rem] leading-relaxed text-ink-muted">
        It may have been withdrawn upstream, or the index may be due a refresh. Run{" "}
        <code className="tick text-ink">npm run ingest</code> to rebuild it from the archives.
      </p>
      <Link
        href="/"
        className="readout mt-8 bg-ink px-4 py-3 text-surface transition-opacity hover:opacity-85"
      >
        Back to the index
      </Link>
    </div>
  );
}
