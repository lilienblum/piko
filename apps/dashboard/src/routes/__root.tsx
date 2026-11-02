import { SkulletProvider } from "skullet/react";
import { DisplayPreferencesProvider } from "@/components/display-preferences";
import { createRootRoute, HeadContent, Scripts, ScriptOnce } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { sidebarScript } from "@/lib/preferences";
import styles from "../styles.css?url";
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#1f1f28" },
      { title: "Piko · Product analytics" },
      { name: "description", content: "A clear view of how your products are used." },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      { rel: "icon", href: "/favicon.svg?v=7", type: "image/svg+xml" },
    ],
  }),
  component: Root,
  shellComponent: Shell,
  notFoundComponent: () => (
    <div className="page-heading">
      <h1>Page not found</h1>
      <a href="/">Back to Overview</a>
    </div>
  ),
});
function Root() {
  return (
    <DisplayPreferencesProvider>
      <SkulletProvider
        theme={{
          light: { base: "var(--skeleton-base)", highlight: "var(--skeleton-highlight)" },
          dark: { base: "var(--skeleton-base)", highlight: "var(--skeleton-highlight)" },
          radius: "3px",
          animation: "shimmer",
          speed: "slow",
        }}
        reveal={{ order: "together", duration: 120, hold: 150 }}
      >
        <AppShell />
      </SkulletProvider>
    </DisplayPreferencesProvider>
  );
}
function Shell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <ScriptOnce>{sidebarScript}</ScriptOnce>
        <HeadContent />
      </head>
      <body>
        <template
          data-design-contract="kanagawa-wave"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static build-time design provenance; no dynamic or user content.
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: Piko is a compact measurement tool with a graphic identity; evidence remains the main content.
OWN-WORLD: One Kanagawa Wave palette: sumi-ink surfaces, warm Fuji text, Surimi Orange actions, Carp Yellow measurements, violet/aqua categories, and green outcomes. Preserve Geist, squared controls, and the upright three-bar mark.
STORY: Choose project, source and dates; follow an event trend; inspect the evidence; manage collection. Identity stays optional.
FIRST VIEWPORT: Keep the project/source rail and report controls. Overview uses six square analytical widgets; Explore keeps its query, chart, breakdown and event stream.
FORM: User-selected Kanagawa Wave palette from the official rebelot/kanagawa.nvim source. One static dark theme with no selector or preference. Preserve the approved layouts and behavior.
-->`,
          }}
        />
        {children}
        <Scripts />
      </body>
    </html>
  );
}
