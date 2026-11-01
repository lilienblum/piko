import { createRootRoute, HeadContent, Scripts, ScriptOnce } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import styles from "../styles.css?url";
export const Route = createRootRoute({
  ssr: false,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Piko · Product analytics" },
      { name: "description", content: "A clear view of how your products are used." },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      { rel: "icon", href: "/favicon.svg?v=3", type: "image/svg+xml" },
    ],
  }),
  component: AppShell,
  shellComponent: Shell,
  notFoundComponent: () => (
    <div className="page-heading">
      <h1>Page not found</h1>
      <a href="/">Back to Overview</a>
    </div>
  ),
});
function Shell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ScriptOnce>{themeScript}</ScriptOnce>
        <HeadContent />
      </head>
      <body>
        <template
          data-design-contract="field-workbench"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static build-time design provenance; no dynamic or user content.
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: A small measurement workbench; the query and evidence lead, replacing the blue card grid.
OWN-WORLD: Stone working ground, pine action and data, citron navigation, Public Sans, flat measurements and contained forms.
STORY: Select product and dates, query activity, read the pattern, inspect an event. Identity stays explicit.
FIRST VIEWPORT: A 13rem navigation rail and 64px context toolbar; compact title and query rail; two-thirds plot with one-third breakdown; event stream follows. Run query sits at the rail's right.
FORM: Field-station labels, candidate 5, registered shared measurements. Seed 1c47a4fc. Compact composition A, preserving actual controls and privacy semantics.
-->`,
          }}
        />
        <ThemeProvider>{children}</ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
