import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
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
      { rel: "icon", href: "/favicon.svg" },
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
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
