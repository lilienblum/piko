import { createRouter } from "@tanstack/react-router";
import { PageLoading } from "@/components/loading";
import { routeTree } from "./routeTree.gen";
export function getRouter() {
  return createRouter({
    routeTree,
    trailingSlash: "never",
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPendingComponent: PageLoading,
    defaultPendingMs: 150,
    defaultPendingMinMs: 0,
  });
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
