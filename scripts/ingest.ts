/**
 * Rebuilds data/registry.json from every upstream archive.
 * Run with `npm run ingest`. The app falls back to a live ingest if the file is
 * missing, but that makes the first request very slow — keep this file fresh.
 */
import { ingest } from "../src/lib/registry";
import { SOURCES } from "../src/lib/types";

async function main() {
  const started = Date.now();
  console.log("Ingesting open neuro archives…");

  const registry = await ingest();

  for (const row of registry.report) {
    const label = SOURCES[row.source].label.padEnd(12);
    console.log(
      row.ok
        ? `  ok   ${label} ${row.count.toLocaleString()} datasets`
        : `  FAIL ${label} ${row.note}`,
    );
  }

  console.log(
    `\n${registry.datasets.length.toLocaleString()} datasets after dedupe in ${(
      (Date.now() - started) / 1000
    ).toFixed(1)}s -> data/registry.json`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
