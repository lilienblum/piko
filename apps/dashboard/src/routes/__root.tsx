import { createRootRoute, HeadContent, Scripts, ScriptOnce } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { sidebarScript } from "@/lib/preferences";
import styles from "../styles.css?url";
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Piko · Product analytics" },
      { name: "description", content: "A clear view of how your products are used." },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      { rel: "icon", href: "/favicon.svg?v=4", type: "image/svg+xml" },
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
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
function Shell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ScriptOnce>{themeScript}</ScriptOnce>
        <ScriptOnce>{sidebarScript}</ScriptOnce>
        <HeadContent />
      </head>
      <body>
        <template
          data-design-contract="yuzu"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static build-time design provenance; no dynamic or user content.
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: Piko is a compact measurement tool with a graphic identity; evidence remains the main content.
OWN-WORLD: Yuzu's butter-yellow rail, warm ink, chart ochre, Geist, squared controls, ink navigation selections, and an upright three-bar mark.
STORY: Choose project, source and dates; follow an event trend; inspect the evidence; manage collection. Identity stays optional.
FIRST VIEWPORT: Preserve the 13rem rail, 64px toolbar, shallow query controls, two-thirds plot and one-third breakdown, followed by the event stream. Run query stays at the right.
FORM: User-selected Yuzu from the eight-direction preview. Preserve the approved compact composition; sharpen its control, type, chart and brand vocabulary. No new direction roll.
-->`,
          }}
        />
        {children}
        <Scripts />
      </body>
    </html>
  );
}
