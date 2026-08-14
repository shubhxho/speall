import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
  Fonts are self-hosted rather than fetched from Google at build time.
  next/font/google downloads from fonts.gstatic.com during the build, and a 404
  from that CDN broke CI while the same commit built fine on Vercel. Committing
  the woff2 files makes the build hermetic and drops a third-party request.
*/

const display = localFont({
  src: "./fonts/BricolageGrotesque-Variable.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const sans = localFont({
  src: [
    { path: "./fonts/IBMPlexSans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexSans-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-sans",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const mono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Speall — open neuroscience datasets, one index",
  description:
    "Search OpenNeuro, DANDI, NeuroVault, GIN, Dryad, Figshare and Zenodo in one place. Filter by modality, species, recording channels and year.",
};

/** Applies the stored theme before paint so the page never flashes the wrong one. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("speall-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
